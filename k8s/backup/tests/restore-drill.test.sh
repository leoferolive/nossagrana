#!/usr/bin/env bash
# Testes de integração do restore drill (issue #48).
#
# Usa PostgreSQL real via Docker: um "source" (mesma imagem do CronJob
# pg-backup de produção, postgres:17-alpine) gera um pg_dumpall a partir das
# migrations reais da API; o drill roda na mesma imagem do CronJob
# (pgvector/pgvector:pg17) compartilhando a rede de um PostgreSQL descartável,
# exatamente como o sidecar do Job no cluster.
#
# Uso: bash k8s/backup/tests/restore-drill.test.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
DRILL_SCRIPT="$ROOT_DIR/k8s/backup/restore-drill.sh"
MIGRATIONS_DIR="$ROOT_DIR/apps/api/src/db/migrations"
SOURCE_IMAGE="postgres:17-alpine"
DRILL_IMAGE="pgvector/pgvector:pg17"
RUN_ID="ng-drill-test-$$"
SOURCE_CT="$RUN_ID-source"
SCRATCH_CT="$RUN_ID-scratch"
# Senha "canário": se aparecer em qualquer saída do drill, há vazamento de segredo.
ROLE_PASSWORD="canario-segredo-nao-pode-vazar"

WORK_DIR="$(mktemp -d)"
FIXTURE_DUMP="$WORK_DIR/fixture.sql.gz"
PASSED=0
FAILED=0

cleanup() {
  docker rm -f "$SOURCE_CT" "$SCRATCH_CT" >/dev/null 2>&1 || true
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

wait_ready() {
  local container="$1"
  for _ in $(seq 1 60); do
    if docker exec "$container" pg_isready -U postgres -h 127.0.0.1 >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "PostgreSQL do container $container não ficou pronto em 60s" >&2
  return 1
}

source_psql() {
  docker exec -i "$SOURCE_CT" psql -q -v ON_ERROR_STOP=1 -U postgres "$@"
}

apply_migrations() {
  local db="$1"
  local file
  for file in "$MIGRATIONS_DIR"/*.sql; do
    source_psql -d "$db" <"$file" >/dev/null
  done
  source_psql -d "$db" >/dev/null <<SQL
CREATE SCHEMA drizzle;
CREATE TABLE drizzle.__drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint);
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
  SELECT md5(g::text), 0 FROM generate_series(1, $(find "$MIGRATIONS_DIR" -maxdepth 1 -name '*.sql' | wc -l)) g;
SQL
}

# Três bancos num único dump, espelhando o pg_dumpall do Postgres compartilhado:
# - nossagrana_prod: schema completo + dados essenciais (caminho feliz)
# - nossagrana_vazio: schema completo sem dados (falha de dados)
# - nossagrana_parcial: só a tabela users (falha de schema)
build_fixture_dump() {
  docker run -d --name "$SOURCE_CT" -e POSTGRES_PASSWORD=postgres "$SOURCE_IMAGE" >/dev/null
  wait_ready "$SOURCE_CT"
  source_psql -d postgres >/dev/null <<SQL
CREATE ROLE nossagrana LOGIN PASSWORD '$ROLE_PASSWORD';
CREATE DATABASE nossagrana_prod OWNER nossagrana;
CREATE DATABASE nossagrana_vazio OWNER nossagrana;
CREATE DATABASE nossagrana_parcial OWNER nossagrana;
SQL
  apply_migrations nossagrana_prod
  apply_migrations nossagrana_vazio
  # Como em produção: ACL/config de nível de banco citando o nome original
  # (ex.: GRANT CONNECT ... TO grafana_ro), que o restore precisa redirecionar.
  source_psql -d postgres >/dev/null <<'SQL'
CREATE ROLE grafana_ro;
GRANT CONNECT ON DATABASE nossagrana_prod TO grafana_ro;
ALTER DATABASE nossagrana_prod SET timezone TO 'America/Sao_Paulo';
COMMENT ON DATABASE nossagrana_prod IS 'Banco de produção';
SQL
  source_psql -d nossagrana_prod >/dev/null <<'SQL'
INSERT INTO users (nome, email, senha_hash) VALUES ('Fulano', 'fulano@example.com', 'hash');
INSERT INTO familias (nome) VALUES ('Família Teste');
-- Dado que parece DDL: o extrator não pode reescrevê-lo (fica dentro de COPY).
INSERT INTO familias (nome) VALUES ('Minha DATABASE nossagrana_prod ;');
ALTER TABLE users OWNER TO nossagrana;
SQL
  source_psql -d nossagrana_parcial >/dev/null <<'SQL'
CREATE TABLE users (id uuid PRIMARY KEY);
SQL
  docker exec "$SOURCE_CT" pg_dumpall -U postgres | gzip -9 >"$FIXTURE_DUMP"
}

start_scratch() {
  docker run -d --name "$SCRATCH_CT" -e POSTGRES_HOST_AUTH_METHOD=trust "$DRILL_IMAGE" \
    -c listen_addresses=127.0.0.1 >/dev/null
  wait_ready "$SCRATCH_CT"
}

# Cria um diretório de backup novo por caso de teste (F.I.R.S.T.: independente).
new_backup_dir() {
  local dir
  dir="$(mktemp -d "$WORK_DIR/backup.XXXX")"
  chmod 755 "$dir"
  echo "$dir"
}

# Roda o drill; saída combinada em $DRILL_OUTPUT e exit code em $DRILL_EXIT.
run_drill() {
  local backup_dir="$1"
  shift
  # A fixture tem ~9 KB; o mínimo de produção (10 KB) é coberto pelo teste de tamanho.
  local env_args=(-e MIN_BACKUP_BYTES=1024)
  local kv
  for kv in "$@"; do env_args+=(-e "$kv"); done
  set +e
  DRILL_OUTPUT="$(docker run --rm --network "container:$SCRATCH_CT" \
    -v "$backup_dir:/backup:ro" -v "$(dirname "$DRILL_SCRIPT"):/drill:ro" \
    -e PGHOST=127.0.0.1 -e PGUSER=postgres "${env_args[@]}" \
    "$DRILL_IMAGE" sh /drill/restore-drill.sh 2>&1)"
  DRILL_EXIT=$?
  set -e
}

pass() {
  PASSED=$((PASSED + 1))
  echo "  ✓ $1"
}

fail() {
  FAILED=$((FAILED + 1))
  echo "  ✗ $1"
  echo "    exit=$DRILL_EXIT"
  local line
  while IFS= read -r line; do echo "    | $line"; done <<<"$DRILL_OUTPUT"
}

expect_failure_at_stage() {
  local name="$1" stage="$2"
  if [ "$DRILL_EXIT" -ne 0 ] &&
    echo "$DRILL_OUTPUT" | grep -q "\"result\":\"failure\",\"stage\":\"$stage\""; then
    pass "$name"
  else
    fail "$name (esperado falha no estágio '$stage')"
  fi
}

copy_fixture() {
  local dir="$1" name="$2"
  cp "$FIXTURE_DUMP" "$dir/$name"
}

test_success_restores_and_reports() {
  local dir
  dir="$(new_backup_dir)"
  copy_fixture "$dir" "pg-all-2026-09-20.sql.gz"
  touch -d '2 days ago' "$dir/pg-all-2026-09-20.sql.gz"
  copy_fixture "$dir" "pg-all-2026-09-22.sql.gz"
  run_drill "$dir"
  if [ "$DRILL_EXIT" -eq 0 ] &&
    echo "$DRILL_OUTPUT" | grep -q '"result":"success"' &&
    echo "$DRILL_OUTPUT" | grep -q '"artifact":"pg-all-2026-09-22.sql.gz"' &&
    echo "$DRILL_OUTPUT" | grep -q '"sha256":"[0-9a-f]\{64\}"' &&
    echo "$DRILL_OUTPUT" | grep -q '"migrations":9' &&
    echo "$DRILL_OUTPUT" | grep -q '"users":1' &&
    echo "$DRILL_OUTPUT" | grep -q '"familias":2'; then
    pass "restaura o backup mais recente e publica relatório com checksum, migrations e contagens"
  else
    fail "restaura o backup mais recente e publica relatório com checksum, migrations e contagens"
  fi
}

test_rerun_is_idempotent() {
  local dir
  dir="$(new_backup_dir)"
  copy_fixture "$dir" "pg-all-2026-09-22.sql.gz"
  run_drill "$dir"
  run_drill "$dir"
  if [ "$DRILL_EXIT" -eq 0 ]; then
    pass "reexecução recria o banco descartável sem falhar"
  else
    fail "reexecução recria o banco descartável sem falhar"
  fi
}

test_does_not_leak_secrets() {
  local dir
  dir="$(new_backup_dir)"
  copy_fixture "$dir" "pg-all-2026-09-22.sql.gz"
  run_drill "$dir"
  if [ "$DRILL_EXIT" -eq 0 ] &&
    ! echo "$DRILL_OUTPUT" | grep -q -e "$ROLE_PASSWORD" -e 'SCRAM-SHA-256' -e 'fulano@example.com'; then
    pass "não expõe senhas, hashes de role nem dados financeiros/pessoais nos logs"
  else
    fail "não expõe senhas, hashes de role nem dados financeiros/pessoais nos logs"
  fi
}

test_fails_without_backup() {
  run_drill "$(new_backup_dir)"
  expect_failure_at_stage "falha quando não há backup no diretório" "select"
}

test_fails_when_backup_is_stale() {
  local dir
  dir="$(new_backup_dir)"
  copy_fixture "$dir" "pg-all-2026-09-20.sql.gz"
  touch -d '30 hours ago' "$dir/pg-all-2026-09-20.sql.gz"
  run_drill "$dir" MAX_BACKUP_AGE_HOURS=26
  expect_failure_at_stage "falha quando o backup mais recente excede o RPO" "freshness"
}

test_fails_when_backup_is_too_small() {
  local dir
  dir="$(new_backup_dir)"
  echo "quase nada" | gzip >"$dir/pg-all-2026-09-22.sql.gz"
  run_drill "$dir"
  expect_failure_at_stage "falha quando o backup é menor que o tamanho mínimo" "size"
}

test_fails_when_gzip_is_corrupted() {
  local dir
  dir="$(new_backup_dir)"
  copy_fixture "$dir" "pg-all-2026-09-22.sql.gz"
  # Trunca o final do gzip: tamanho ok, integridade quebrada.
  truncate -s -64 "$dir/pg-all-2026-09-22.sql.gz"
  run_drill "$dir"
  expect_failure_at_stage "falha quando o gzip está corrompido" "integrity"
}

test_fails_when_checksum_sidecar_mismatches() {
  local dir
  dir="$(new_backup_dir)"
  copy_fixture "$dir" "pg-all-2026-09-22.sql.gz"
  printf '%064d  pg-all-2026-09-22.sql.gz\n' 0 >"$dir/pg-all-2026-09-22.sql.gz.sha256"
  run_drill "$dir"
  expect_failure_at_stage "falha quando o checksum .sha256 não confere" "checksum"
}

test_accepts_matching_checksum_sidecar() {
  local dir
  dir="$(new_backup_dir)"
  copy_fixture "$dir" "pg-all-2026-09-22.sql.gz"
  (cd "$dir" && sha256sum pg-all-2026-09-22.sql.gz >pg-all-2026-09-22.sql.gz.sha256)
  run_drill "$dir"
  if [ "$DRILL_EXIT" -eq 0 ] && echo "$DRILL_OUTPUT" | grep -q '"checksum_verified":true'; then
    pass "valida checksum .sha256 quando presente"
  else
    fail "valida checksum .sha256 quando presente"
  fi
}

test_fails_when_database_missing_from_dump() {
  local dir
  dir="$(new_backup_dir)"
  copy_fixture "$dir" "pg-all-2026-09-22.sql.gz"
  run_drill "$dir" SOURCE_DB_NAME=banco_inexistente
  expect_failure_at_stage "falha quando o banco alvo não está no dump" "extract"
}

test_fails_when_schema_incomplete() {
  local dir
  dir="$(new_backup_dir)"
  copy_fixture "$dir" "pg-all-2026-09-22.sql.gz"
  run_drill "$dir" SOURCE_DB_NAME=nossagrana_parcial
  expect_failure_at_stage "falha quando faltam tabelas obrigatórias" "schema"
}

test_fails_when_essential_data_empty() {
  local dir
  dir="$(new_backup_dir)"
  copy_fixture "$dir" "pg-all-2026-09-22.sql.gz"
  run_drill "$dir" SOURCE_DB_NAME=nossagrana_vazio
  expect_failure_at_stage "falha quando tabelas essenciais estão vazias" "data"
}

test_extract_rewrites_ddl_but_never_data() {
  local sql
  sql="$(docker run --rm -v "$FIXTURE_DUMP:/fixture.sql.gz:ro" \
    -v "$(dirname "$DRILL_SCRIPT"):/drill:ro" "$DRILL_IMAGE" \
    sh /drill/extract-database.sh /fixture.sql.gz nossagrana_prod banco_destino)"
  DRILL_EXIT=$?
  DRILL_OUTPUT="$(echo "$sql" | grep -e 'ON DATABASE' -e 'DATABASE nossagrana_prod' || true)"
  if echo "$sql" | grep -q 'GRANT CONNECT ON DATABASE banco_destino TO grafana_ro;' &&
    echo "$sql" | grep -q 'Minha DATABASE nossagrana_prod ;' &&
    ! echo "$sql" | grep -q '^CREATE DATABASE' &&
    ! echo "$sql" | grep -q '^\\connect'; then
    pass "extract-database.sh redireciona DDL de banco, preserva dados e não vaza bancos vizinhos"
  else
    fail "extract-database.sh redireciona DDL de banco, preserva dados e não vaza bancos vizinhos"
  fi
}

main() {
  echo "Preparando fixtures (PostgreSQL real via Docker)…"
  build_fixture_dump
  start_scratch
  echo "restore-drill.sh"
  test_extract_rewrites_ddl_but_never_data
  test_success_restores_and_reports
  test_rerun_is_idempotent
  test_does_not_leak_secrets
  test_fails_without_backup
  test_fails_when_backup_is_stale
  test_fails_when_backup_is_too_small
  test_fails_when_gzip_is_corrupted
  test_fails_when_checksum_sidecar_mismatches
  test_accepts_matching_checksum_sidecar
  test_fails_when_database_missing_from_dump
  test_fails_when_schema_incomplete
  test_fails_when_essential_data_empty
  echo
  echo "$PASSED passaram, $FAILED falharam"
  [ "$FAILED" -eq 0 ]
}

main
