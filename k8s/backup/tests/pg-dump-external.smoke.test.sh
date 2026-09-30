#!/usr/bin/env bash
# shellcheck disable=SC2016 # os `bash -c` dos checks usam aspas simples de propósito (expandem no subshell)
# Smoke test do pg-dump-external com binários REAIS (issue #47): constrói a
# imagem de k8s/backup/pg-dump-external, roda o script contra um PostgreSQL 17
# descartável (Docker), com rclone (destino = diretório local) e age reais, e
# prova o ciclo completo: dump -> cifra -> upload -> decifra com a chave
# privada -> restaura -> dados idênticos.
#
# O container roda como o CronJob: non-root, rootfs somente leitura, sem
# capabilities, temporários em tmpfs.
#
# Uso: bash k8s/backup/tests/pg-dump-external.smoke.test.sh
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
JOB_DIR="$ROOT_DIR/k8s/backup/pg-dump-external"
POSTGRES_IMAGE="postgres:17-alpine"
JOB_IMAGE="nossagrana-pg-dump-external:smoke"
RUN_ID="ng-dump-smoke-$$"
NETWORK="$RUN_ID-net"
PG_CT="$RUN_ID-pg"
WORK_DIR="$(mktemp -d)"
REMOTE_DIR="$WORK_DIR/remote"
KEY_DIR="$WORK_DIR/keys"
# Senha "canário": se aparecer em qualquer saída do job, há vazamento.
ROLE_PASSWORD="canario-smoke-senha-nao-pode-vazar"
PASSED=0
FAILED=0

cleanup() {
  docker rm -f "$PG_CT" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
  # Arquivos do remoto pertencem ao uid 10001 do container; o diretório é nosso.
  rm -rf "$WORK_DIR" 2>/dev/null || true
}
trap cleanup EXIT

pass() {
  PASSED=$((PASSED + 1))
  echo "  ✓ $1"
}

fail() {
  FAILED=$((FAILED + 1))
  echo "  ✗ $1"
  echo "    exit=${JOB_EXIT:-?}"
  local line
  while IFS= read -r line; do echo "    | $line"; done <<<"${JOB_OUTPUT:-}"
}

check() {
  local name="$1"
  shift
  if "$@"; then pass "$name"; else fail "$name"; fi
}

pg_exec() {
  docker exec -i "$PG_CT" psql -q -v ON_ERROR_STOP=1 -U postgres "$@"
}

wait_pg_ready() {
  for _ in $(seq 1 60); do
    # Duas checagens: o entrypoint sobe um servidor temporário antes do definitivo.
    if docker exec "$PG_CT" pg_isready -U postgres -h 127.0.0.1 >/dev/null 2>&1 &&
      pg_exec -d postgres -c 'select 1' >/dev/null 2>&1 && sleep 2 &&
      pg_exec -d postgres -c 'select 1' >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "PostgreSQL não ficou pronto em 60s" >&2
  return 1
}

# Container do job com as mesmas restrições do CronJob.
job_container() {
  docker run --rm --network "$NETWORK" --read-only \
    --tmpfs /work:mode=1777 --tmpfs /tmp:mode=1777 \
    --cap-drop ALL --security-opt no-new-privileges \
    -v "$JOB_DIR/base:/job:ro" -v "$REMOTE_DIR:/remote" -v "$KEY_DIR:/keys:ro" \
    "$@"
}

run_job() {
  JOB_OUTPUT="$(job_container \
    -e PGHOST="$PG_CT" -e PGUSER=backup_ro -e PGPASSWORD="${SMOKE_PASSWORD:-$ROLE_PASSWORD}" \
    -e PGDATABASE=nossagrana_prod -e BACKUP_REMOTE=/remote -e AGE_RECIPIENT="$AGE_RECIPIENT" \
    -e TMPDIR=/work -e HOME=/tmp -e UPLOAD_RETRY_DELAY_SECONDS=1 -e PGCONNECT_TIMEOUT=5 \
    "$JOB_IMAGE" sh /job/pg-dump-external.sh 2>&1)"
  JOB_EXIT=$?
}

# Comandos auxiliares na imagem (age, sha256sum, pg_restore) com o remoto montado.
in_image() {
  job_container -e PGHOST="$PG_CT" -e PGUSER=postgres -e PGPASSWORD=postgres "$JOB_IMAGE" "$@"
}

remote_names() {
  find "$REMOTE_DIR" -maxdepth 1 -type f -printf '%f\n' | sort
}

artifact_name() {
  remote_names | grep '\.dump\.age$' | head -n 1
}

prepare_environment() {
  docker build -q -t "$JOB_IMAGE" "$JOB_DIR" >/dev/null || return 1
  docker network create "$NETWORK" >/dev/null
  docker run -d --name "$PG_CT" --network "$NETWORK" -e POSTGRES_PASSWORD=postgres "$POSTGRES_IMAGE" >/dev/null
  wait_pg_ready
  pg_exec -d postgres >/dev/null <<SQL
CREATE ROLE backup_ro LOGIN PASSWORD '$ROLE_PASSWORD';
GRANT pg_read_all_data TO backup_ro;
CREATE DATABASE nossagrana_prod;
SQL
  pg_exec -d nossagrana_prod >/dev/null <<'SQL'
CREATE TABLE familias (id serial PRIMARY KEY, nome text NOT NULL);
INSERT INTO familias (nome) SELECT 'Familia ' || g FROM generate_series(1, 2000) g;
SQL
  mkdir -p "$REMOTE_DIR" "$KEY_DIR"
  chmod 777 "$REMOTE_DIR"
  chmod 755 "$KEY_DIR"
  # Par de chaves gerado fora do "cluster": só o recipient público vai ao job.
  docker run --rm --tmpfs /tmp:mode=1777 "$JOB_IMAGE" sh -c 'age-keygen -o /tmp/key.txt 2>/dev/null; cat /tmp/key.txt' >"$KEY_DIR/key.txt"
  chmod 644 "$KEY_DIR/key.txt"
  AGE_RECIPIENT="$(grep '^# public key:' "$KEY_DIR/key.txt" | awk '{print $4}')"
  [ -n "$AGE_RECIPIENT" ]
}

test_full_cycle_restores_identical_data() {
  run_job
  local name
  name="$(artifact_name)"
  check "job real sai com 0 e publica relatório de sucesso" \
    bash -c '[ "$1" -eq 0 ] && grep -q "\"result\":\"success\"" <<<"$2"' _ "$JOB_EXIT" "$JOB_OUTPUT"
  check "remoto tem artefato, .sha256 e .meta.json" \
    bash -c '[ "$(wc -l <<<"$1")" -eq 3 ]' _ "$(remote_names)"
  check "sha256sum -c confere o artefato no remoto" \
    in_image sh -c "cd /remote && sha256sum -c '$name.sha256'" >/dev/null
  check "senha do banco não aparece na saída do job" \
    bash -c '! grep -q "$1" <<<"$2"' _ "$ROLE_PASSWORD" "$JOB_OUTPUT"
  pg_exec -d postgres -c 'CREATE DATABASE restaurado' >/dev/null
  check "decifra com a chave privada e restaura com pg_restore" \
    job_container -e PGHOST="$PG_CT" -e PGUSER=postgres -e PGPASSWORD=postgres "$JOB_IMAGE" \
    sh -c "age -d -i /keys/key.txt -o /tmp/restore.dump '/remote/$name' && pg_restore --no-owner -d restaurado /tmp/restore.dump"
  check "dados restaurados idênticos aos da origem (2000 famílias)" \
    test "$(pg_exec -d restaurado -At -c 'select count(*) from familias')" = "2000"
}

test_wrong_password_fails_without_uploading() {
  rm -rf "${REMOTE_DIR:?}"/* 2>/dev/null || true
  SMOKE_PASSWORD="senha-errada" run_job
  check "senha errada: job real falha (exit != 0) no estágio dump" \
    bash -c '[ "$1" -ne 0 ] && grep -q "\"result\":\"failure\",\"stage\":\"dump\"" <<<"$2"' _ "$JOB_EXIT" "$JOB_OUTPUT"
  check "senha errada: nada enviado ao remoto" test -z "$(remote_names)"
}

test_second_run_never_overwrites_first() {
  rm -rf "${REMOTE_DIR:?}"/* 2>/dev/null || true
  BACKUP_STAMP=20260101T000000Z
  run_job_with_fixed_name
  check "1ª execução com nome fixo conclui com sucesso" test "$JOB_EXIT" -eq 0
  local first
  first="$(remote_names | tr '\n' ' ')"
  pg_exec -d nossagrana_prod -c "INSERT INTO familias (nome) VALUES ('mudou depois do 1o backup')" >/dev/null
  run_job_with_fixed_name
  check "mesmo nome e conteúdo diferente: 2º job falha e não sobrescreve (rclone real)" test "$JOB_EXIT" -ne 0
  check "1º backup permanece com os mesmos arquivos" test "$(remote_names | tr '\n' ' ')" = "$first"
  check "1º backup permanece com o mesmo conteúdo (sha256 do .sha256 remoto confere)" \
    in_image sh -c "cd /remote && sha256sum -c 'nossagrana_prod-20260101T000000Z-fixo.dump.age.sha256'" >/dev/null
}

# O `timeout` da imagem (alpine/BusyBox) sai com 143, não 124: o job real precisa
# reconhecer isso como timeout, senão o diagnóstico vira "erro de conexão".
# Determinístico: uma sessão segura ACCESS EXCLUSIVE em `familias`, então o
# pg_dump fica esperando o lock até o timeout de 2 s do job.
test_dump_timeout_is_reported_as_timeout() {
  rm -rf "${REMOTE_DIR:?}"/* 2>/dev/null || true
  docker exec -d "$PG_CT" psql -q -U postgres -d nossagrana_prod \
    -c "BEGIN; LOCK TABLE familias IN ACCESS EXCLUSIVE MODE; SELECT pg_sleep(60);"
  wait_table_locked
  JOB_OUTPUT="$(job_container \
    -e PGHOST="$PG_CT" -e PGUSER=backup_ro -e PGPASSWORD="$ROLE_PASSWORD" \
    -e PGDATABASE=nossagrana_prod -e BACKUP_REMOTE=/remote -e AGE_RECIPIENT="$AGE_RECIPIENT" \
    -e TMPDIR=/work -e HOME=/tmp -e PGCONNECT_TIMEOUT=5 -e DUMP_TIMEOUT_SECONDS=2 \
    "$JOB_IMAGE" sh /job/pg-dump-external.sh 2>&1)"
  JOB_EXIT=$?
  pg_exec -d postgres -c "select pg_terminate_backend(pid) from pg_stat_activity where query like '%pg_sleep(60)%' and pid <> pg_backend_pid()" >/dev/null
  check "timeout real (BusyBox): job falha no estágio dump com motivo timeout" \
    bash -c '[ "$1" -ne 0 ] && grep -q "\"stage\":\"dump\"" <<<"$2" && grep -q "timeout após 2s" <<<"$2"' _ "$JOB_EXIT" "$JOB_OUTPUT"
  check "timeout real (BusyBox): não é reportado como erro de conexão/permissão" \
    bash -c '! grep -q "conexão/permissão" <<<"$1"' _ "$JOB_OUTPUT"
  check "timeout real (BusyBox): nada enviado ao remoto" test -z "$(remote_names)"
}

wait_table_locked() {
  for _ in $(seq 1 30); do
    if [ "$(pg_exec -d nossagrana_prod -At -c "select count(*) from pg_locks where mode = 'AccessExclusiveLock' and locktype = 'relation' and relation = 'familias'::regclass" 2>/dev/null)" = "1" ]; then
      return 0
    fi
    sleep 1
  done
  return 1
}

run_job_with_fixed_name() {
  JOB_OUTPUT="$(job_container \
    -e PGHOST="$PG_CT" -e PGUSER=backup_ro -e PGPASSWORD="$ROLE_PASSWORD" \
    -e PGDATABASE=nossagrana_prod -e BACKUP_REMOTE=/remote -e AGE_RECIPIENT="$AGE_RECIPIENT" \
    -e TMPDIR=/work -e HOME=/tmp -e UPLOAD_RETRY_DELAY_SECONDS=1 -e UPLOAD_ATTEMPTS=2 \
    -e BACKUP_TIMESTAMP="$BACKUP_STAMP" -e BACKUP_RUN_ID=fixo \
    "$JOB_IMAGE" sh /job/pg-dump-external.sh 2>&1)"
  JOB_EXIT=$?
}

echo "pg-dump-external (smoke, binários reais)"
if ! prepare_environment; then
  echo "  ✗ falha ao preparar imagem/PostgreSQL/chave age"
  exit 1
fi
test_full_cycle_restores_identical_data
test_wrong_password_fails_without_uploading
test_second_run_never_overwrites_first
test_dump_timeout_is_reported_as_timeout
echo
echo "$PASSED passaram, $FAILED falharam"
[ "$FAILED" -eq 0 ]
