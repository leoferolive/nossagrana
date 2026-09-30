#!/usr/bin/env bash
# shellcheck disable=SC2016 # os `bash -c` dos checks usam aspas simples de propósito (expandem no subshell)
# Testes do job de dump cifrado para storage externo (issue #47).
#
# Executa k8s/backup/pg-dump-external/base/pg-dump-external.sh com fakes nomeadas
# (k8s/backup/tests/fakes/) no lugar de pg_dump, pg_restore, age e rclone — sem
# Docker, sem rede. O smoke com binários reais está em pg-dump-external.smoke.test.sh.
#
# Uso: bash k8s/backup/tests/pg-dump-external.test.sh
set -uo pipefail

TESTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JOB_SCRIPT="$TESTS_DIR/../pg-dump-external/base/pg-dump-external.sh"
FAKES_DIR="$TESTS_DIR/fakes"
# Senha "canário": se aparecer em qualquer saída ou argumento, há vazamento.
CANARY_PASSWORD="canario-senha-nao-pode-vazar"
RECIPIENT="age1qyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqs"
WORK_ROOT="$(mktemp -d)"
PASSED=0
FAILED=0

trap 'rm -rf "$WORK_ROOT"' EXIT

# Ambiente novo por caso (F.I.R.S.T.: independente). Define CASE_DIR, REMOTE,
# TMPDIR_CASE e FAKE_STATE.
new_case() {
  CASE_DIR="$(mktemp -d "$WORK_ROOT/case.XXXX")"
  REMOTE="$CASE_DIR/remote"
  TMPDIR_CASE="$CASE_DIR/tmp"
  FAKE_STATE="$CASE_DIR/state"
  mkdir -p "$REMOTE" "$TMPDIR_CASE" "$FAKE_STATE"
  : >"$FAKE_STATE/calls.log"
}

# Roda o job; saída combinada em $OUTPUT e exit code em $EXIT_CODE.
# Argumentos: pares VAR=valor que sobrescrevem o ambiente base.
run_job() {
  OUTPUT="$(env -i PATH="$FAKES_DIR:$PATH" HOME="$CASE_DIR" TMPDIR="$TMPDIR_CASE" \
    FAKE_STATE="$FAKE_STATE" BACKUP_REMOTE="$REMOTE" AGE_RECIPIENT="$RECIPIENT" \
    PGHOST=db.invalid PGUSER=backup_ro PGPASSWORD="$CANARY_PASSWORD" PGDATABASE=nossagrana_prod \
    BACKUP_RUN_ID=job-a UPLOAD_RETRY_DELAY_SECONDS=0 DUMP_TIMEOUT_SECONDS=20 \
    "$@" sh "$JOB_SCRIPT" 2>&1)"
  EXIT_CODE=$?
}

pass() {
  PASSED=$((PASSED + 1))
  echo "  ✓ $1"
}

fail() {
  FAILED=$((FAILED + 1))
  echo "  ✗ $1"
  echo "    exit=${EXIT_CODE:-?}"
  local line
  while IFS= read -r line; do echo "    | $line"; done <<<"${OUTPUT:-}"
}

check() {
  local name="$1"
  shift
  if "$@"; then pass "$name"; else fail "$name"; fi
}

final_json() {
  grep '^{"event":"pg_dump_external"' <<<"$OUTPUT" | tail -n 1
}

failed_at_stage() {
  [ "$EXIT_CODE" -ne 0 ] &&
    final_json | jq -e --arg s "$1" '.result == "failure" and .stage == $s' >/dev/null
}

remote_files() {
  find "$REMOTE" -maxdepth 1 -type f | sort
}

remote_artifact() {
  find "$REMOTE" -maxdepth 1 -name '*.dump.age' | head -n 1
}

leftovers_in_tmp() {
  [ -z "$(ls -A "$TMPDIR_CASE")" ]
}

# Semeia um artefato (+ sidecars) no remoto com o timestamp do nome.
seed_artifact() {
  local prefix="$1" stamp="$2" name
  name="$prefix-$stamp-old.dump.age"
  echo "cifrado" >"$REMOTE/$name"
  echo "hash  $name" >"$REMOTE/$name.sha256"
  echo '{}' >"$REMOTE/$name.meta.json"
}

test_success_uploads_encrypted_artifact_with_checksum_and_metadata() {
  new_case
  run_job
  local artifact name
  artifact="$(remote_artifact)"
  name="$(basename "${artifact:-none}")"
  check "sucesso: sai com 0 e publica relatório JSON com checksum e bytes" \
    bash -c '[ "$1" -eq 0 ] && jq -e ".result == \"success\" and (.sha256 | test(\"^[0-9a-f]{64}$\")) and .bytes > 0" <<<"$2" >/dev/null' \
    _ "$EXIT_CODE" "$(final_json)"
  check "sucesso: remoto tem artefato .dump.age, .sha256 e .meta.json" \
    test "$(remote_files | wc -l)" -eq 3 -a -f "$REMOTE/$name.sha256" -a -f "$REMOTE/$name.meta.json"
  check "sucesso: artefato está cifrado (não é o dump em claro)" \
    bash -c 'head -n 1 "$1" | grep -q "^age-encryption.org/v1"' _ "$artifact"
  check "sucesso: .sha256 confere com o artefato remoto" \
    bash -c 'cd "$1" && sha256sum -c "$2.sha256" >/dev/null' _ "$REMOTE" "$name"
  check "sucesso: metadata é JSON sem segredo" \
    bash -c 'jq -e ".database == \"nossagrana_prod\" and .encryption == \"age\" and .format == \"pg_dump-custom\"" "$1" >/dev/null' \
    _ "$REMOTE/$name.meta.json"
  check "sucesso: dump usa formato custom e o upload usa --ignore-existing" \
    bash -c 'grep -q -- "pg_dump --format=custom" "$1" && grep -q -- "--ignore-existing" "$1"' _ "$FAKE_STATE/calls.log"
  check "sucesso: cifra para o recipient público configurado" \
    grep -q -- "age -r $RECIPIENT" "$FAKE_STATE/calls.log"
  check "sucesso: nenhum segredo em saída ou argumentos" bash -c '! grep -q "$1" <<<"$2" && ! grep -q "$1" "$3"' \
    _ "$CANARY_PASSWORD" "$OUTPUT" "$FAKE_STATE/calls.log"
  check "sucesso: diretório temporário removido" leftovers_in_tmp
  check "sucesso: toda linha JSON do log é válida" \
    bash -c 'grep "^{" <<<"$1" | jq -e . >/dev/null' _ "$OUTPUT"
}

test_dump_failure_fails_job_and_cleans_up() {
  new_case
  run_job FAKE_PG_DUMP_FAIL=1
  check "falha de pg_dump: job falha no estágio dump" failed_at_stage dump
  check "falha de pg_dump: nada é enviado ao remoto" test -z "$(remote_files)"
  check "falha de pg_dump: temporário removido" leftovers_in_tmp
}

test_dump_timeout_fails_job() {
  new_case
  local started ended
  started="$(date +%s)"
  run_job FAKE_PG_DUMP_SLEEP=30 DUMP_TIMEOUT_SECONDS=1
  ended="$(date +%s)"
  check "timeout do pg_dump: falha no estágio dump citando timeout" \
    bash -c 'jq -e ".stage == \"dump\" and (.reason | test(\"timeout\"))" <<<"$1" >/dev/null' _ "$(final_json)"
  check "timeout do pg_dump: interrompe em segundos, não espera o sleep" test $((ended - started)) -lt 20
  check "timeout do pg_dump: temporário removido" leftovers_in_tmp
}

# A imagem de produção é alpine: o `timeout` do BusyBox sai com 143 (não 124);
# o reconhecimento pelo tempo decorrido cobre também o pg_dump real (smoke).
test_dump_timeout_is_recognized_with_busybox_exit_code() {
  new_case
  mkdir -p "$CASE_DIR/busybox-bin"
  ln -s "$FAKES_DIR/timeout-busybox" "$CASE_DIR/busybox-bin/timeout"
  run_job PATH="$CASE_DIR/busybox-bin:$FAKES_DIR:$PATH" FAKE_PG_DUMP_SLEEP=30 DUMP_TIMEOUT_SECONDS=1
  check "timeout com exit 143 (BusyBox): falha no estágio dump citando timeout" \
    bash -c 'jq -e ".stage == \"dump\" and (.reason | test(\"timeout após 1s\"))" <<<"$1" >/dev/null' _ "$(final_json)"
  check "timeout com exit 143 (BusyBox): não é reportado como erro de conexão/permissão" \
    bash -c '! grep -q "conexão/permissão" <<<"$1"' _ "$(final_json)"
}

# O pg_dump real trata o SIGTERM do `timeout` e sai com 1: só o tempo decorrido
# distingue isso de falha de conexão (smoke real cobre o mesmo com o binário).
test_dump_timeout_is_recognized_when_pg_dump_exits_one_on_term() {
  new_case
  run_job FAKE_PG_DUMP_SLEEP=30 FAKE_PG_DUMP_EXIT_ON_TERM=1 DUMP_TIMEOUT_SECONDS=1
  check "timeout com pg_dump saindo 1 no SIGTERM: reportado como timeout no estágio dump" \
    bash -c 'jq -e ".stage == \"dump\" and (.reason | test(\"timeout após 1s\"))" <<<"$1" >/dev/null' _ "$(final_json)"
  new_case
  run_job FAKE_PG_DUMP_FAIL=1
  check "falha imediata do pg_dump continua reportada como conexão/permissão" \
    bash -c 'jq -e ".stage == \"dump\" and (.reason | test(\"conexão/permissão\"))" <<<"$1" >/dev/null' _ "$(final_json)"
}

test_tiny_or_corrupt_dump_is_rejected() {
  new_case
  run_job FAKE_DUMP_BYTES=100
  check "dump menor que o mínimo: falha no estágio verify_dump" failed_at_stage verify_dump
  check "dump menor que o mínimo: nada é enviado" test -z "$(remote_files)"
  new_case
  run_job FAKE_PG_RESTORE_FAIL=1
  check "dump ilegível pelo pg_restore --list: falha no estágio verify_dump" failed_at_stage verify_dump
  check "dump ilegível: nada é enviado" test -z "$(remote_files)"
}

test_encryption_failure_never_uploads_plaintext() {
  new_case
  run_job FAKE_AGE_FAIL=1
  check "falha de cifragem: job falha no estágio encrypt" failed_at_stage encrypt
  check "falha de cifragem: nada é enviado ao remoto" test -z "$(remote_files)"
  check "falha de cifragem: temporário (com o dump em claro) removido" leftovers_in_tmp
}

test_upload_retries_are_limited() {
  new_case
  run_job FAKE_RCLONE_FAIL_UPLOADS=2 UPLOAD_ATTEMPTS=3
  check "upload: sucesso após 2 falhas transitórias (3 tentativas)" test "$EXIT_CODE" -eq 0
  new_case
  run_job FAKE_RCLONE_FAIL_ALWAYS=1 UPLOAD_ATTEMPTS=3
  check "upload sempre falhando: job falha no estágio upload" failed_at_stage upload
  check "upload sempre falhando: exatamente UPLOAD_ATTEMPTS tentativas" \
    test "$(cat "$FAKE_STATE/upload-attempts")" -eq 3
  check "upload sempre falhando: temporário removido" leftovers_in_tmp
}

test_corrupted_upload_is_detected() {
  new_case
  run_job FAKE_RCLONE_CORRUPT_UPLOAD=1
  check "upload corrompido: verificação pós-upload falha o job (verify_upload)" failed_at_stage verify_upload
  check "upload corrompido: sem .meta.json (artefato não verificado nunca parece completo)" \
    test -z "$(find "$REMOTE" -name '*.meta.json')"
}

test_partial_upload_leaves_no_meta_and_fails() {
  new_case
  run_job FAKE_RCLONE_FAIL_SUFFIX=.meta.json UPLOAD_ATTEMPTS=2
  check "upload parcial (.meta.json falha): job falha no estágio upload" failed_at_stage upload
  check "upload parcial: artefato órfão fica sem .meta.json" \
    test -n "$(remote_artifact)" -a -z "$(find "$REMOTE" -name '*.meta.json')"
}

test_orphans_do_not_count_toward_retention_minimum() {
  new_case
  seed_artifact nossagrana_prod 20200101T000000Z
  seed_artifact nossagrana_prod 20200102T000000Z
  seed_artifact nossagrana_prod 20200103T000000Z
  # Órfão (sem .meta.json) mais novo que os completos: não pode formar o mínimo.
  echo "cifrado" >"$REMOTE/nossagrana_prod-20200104T000000Z-old.dump.age"
  run_job RETENTION_DAYS=30 RETENTION_MIN_KEEP=3
  check "órfãos na retenção: sucesso" test "$EXIT_CODE" -eq 0
  check "órfãos na retenção: mínimo de 3 completos preservado (2 antigos + o novo)" \
    test -e "$REMOTE/nossagrana_prod-20200102T000000Z-old.dump.age" -a -e "$REMOTE/nossagrana_prod-20200103T000000Z-old.dump.age" -a "$(find "$REMOTE" -name '*.meta.json' | wc -l)" -eq 3
  check "órfãos na retenção: o mais antigo completo excedente é removido" \
    test ! -e "$REMOTE/nossagrana_prod-20200101T000000Z-old.dump.age"
  check "órfãos na retenção: órfão expirado é removido" \
    test ! -e "$REMOTE/nossagrana_prod-20200104T000000Z-old.dump.age"
}

test_recent_orphan_is_kept() {
  new_case
  # Órfão recente pode ser upload em andamento de outra execução: não apagar.
  echo "cifrado" >"$REMOTE/nossagrana_prod-$(date -u +%Y%m%dT%H%M%SZ)-outro.dump.age"
  run_job
  check "órfão recente: sucesso e órfão preservado" \
    test "$EXIT_CODE" -eq 0 -a "$(find "$REMOTE" -name '*-outro.dump.age' | wc -l)" -eq 1
}

test_never_overwrites_existing_artifact() {
  new_case
  run_job BACKUP_TIMESTAMP=20260101T000000Z BACKUP_RUN_ID=job-a
  local artifact before
  artifact="$(remote_artifact)"
  before="$(sha256sum "$artifact" | cut -d' ' -f1)"
  # Mesmo nome, conteúdo diferente: outro dump com o mesmo timestamp/run id.
  run_job BACKUP_TIMESTAMP=20260101T000000Z BACKUP_RUN_ID=job-a FAKE_DUMP_BYTES=30000
  check "colisão de nome: segunda execução falha antes de enviar (estágio upload)" failed_at_stage upload
  check "colisão de nome: backup válido anterior permanece intacto" \
    test "$(sha256sum "$artifact" | cut -d' ' -f1)" = "$before"
  # Corrida: outro job cria o mesmo objeto entre a checagem e o upload (lsf não o vê).
  # --ignore-existing não sobrescreve e o verify_upload detecta a divergência.
  run_job BACKUP_TIMESTAMP=20260101T000000Z BACKUP_RUN_ID=job-a FAKE_DUMP_BYTES=30000 FAKE_RCLONE_LSF_HIDE=1
  check "corrida no upload: divergência detectada no verify_upload" failed_at_stage verify_upload
  check "corrida no upload: backup válido anterior continua intacto" \
    test "$(sha256sum "$artifact" | cut -d' ' -f1)" = "$before"
}

test_concurrent_runs_use_distinct_names() {
  new_case
  run_job BACKUP_RUN_ID=job-a
  run_job BACKUP_RUN_ID=job-b
  check "execuções distintas: dois artefatos coexistem" \
    test "$(find "$REMOTE" -name '*.dump.age' | wc -l)" -eq 2
}

test_retention_prunes_old_but_keeps_minimum() {
  new_case
  seed_artifact nossagrana_prod 20200101T000000Z
  seed_artifact nossagrana_prod 20200102T000000Z
  seed_artifact nossagrana_prod 20200103T000000Z
  seed_artifact outro_banco 20200101T000000Z
  run_job RETENTION_DAYS=30 RETENTION_MIN_KEEP=3
  check "retenção: sucesso" test "$EXIT_CODE" -eq 0
  check "retenção: artefato antigo além do mínimo é removido com sidecars" \
    test ! -e "$REMOTE/nossagrana_prod-20200101T000000Z-old.dump.age" -a ! -e "$REMOTE/nossagrana_prod-20200101T000000Z-old.dump.age.sha256" -a ! -e "$REMOTE/nossagrana_prod-20200101T000000Z-old.dump.age.meta.json"
  check "retenção: os 2 antigos mais novos + o novo (mínimo 3) permanecem" \
    test -e "$REMOTE/nossagrana_prod-20200102T000000Z-old.dump.age" -a -e "$REMOTE/nossagrana_prod-20200103T000000Z-old.dump.age"
  check "retenção: artefato de outro banco não é tocado" \
    test -e "$REMOTE/outro_banco-20200101T000000Z-old.dump.age"
  check "retenção: relatório informa remoções" \
    bash -c 'jq -e ".retention_deleted == 1" <<<"$1" >/dev/null' _ "$(final_json)"
}

test_retention_failure_does_not_fail_backup() {
  new_case
  seed_artifact nossagrana_prod 20200101T000000Z
  # 1ª listagem = checagem prévia do upload; a 2ª = retenção.
  run_job FAKE_RCLONE_LSF_FAIL_FROM_CALL=2
  check "retenção falhando: backup já verificado continua sucesso" test "$EXIT_CODE" -eq 0
  check "retenção falhando: relatório sinaliza retention_ok=false" \
    bash -c 'jq -e ".retention_ok == false" <<<"$1" >/dev/null' _ "$(final_json)"
}

test_config_is_validated_without_echoing_secrets() {
  new_case
  run_job BACKUP_REMOTE=
  check "sem BACKUP_REMOTE: falha no estágio config" failed_at_stage config
  new_case
  run_job AGE_RECIPIENT=AGE-SECRET-KEY-1ABCDEFSEGREDO
  check "AGE_RECIPIENT com chave privada: falha no estágio config" failed_at_stage config
  check "AGE_RECIPIENT com chave privada: valor não é ecoado" \
    bash -c '! grep -q "SEGREDO" <<<"$1"' _ "$OUTPUT"
  new_case
  run_job DUMP_TIMEOUT_SECONDS=abc
  check "timeout não numérico: falha no estágio config citando o valor recebido" \
    bash -c 'jq -e ".stage == \"config\" and (.reason | test(\"abc\"))" <<<"$1" >/dev/null' _ "$(final_json)"
  check "config inválida: nenhum pg_dump executado" \
    bash -c '! grep -q "^pg_dump" "$1"' _ "$FAKE_STATE/calls.log"
}

test_sigterm_cleans_up_and_exits_fast() {
  new_case
  local pid started ended
  env -i PATH="$FAKES_DIR:$PATH" HOME="$CASE_DIR" TMPDIR="$TMPDIR_CASE" FAKE_STATE="$FAKE_STATE" \
    BACKUP_REMOTE="$REMOTE" AGE_RECIPIENT="$RECIPIENT" PGHOST=db.invalid PGUSER=backup_ro \
    PGPASSWORD="$CANARY_PASSWORD" PGDATABASE=nossagrana_prod BACKUP_RUN_ID=job-a \
    DUMP_TIMEOUT_SECONDS=60 FAKE_PG_DUMP_SLEEP=60 sh "$JOB_SCRIPT" >"$CASE_DIR/out.log" 2>&1 &
  pid=$!
  for _ in $(seq 1 50); do
    grep -q '^pg_dump --format' "$FAKE_STATE/calls.log" && break
    sleep 0.1
  done
  started="$(date +%s)"
  kill -TERM "$pid"
  wait "$pid"
  EXIT_CODE=$?
  ended="$(date +%s)"
  OUTPUT="$(cat "$CASE_DIR/out.log")"
  check "SIGTERM: sai com 143 rapidamente" test "$EXIT_CODE" -eq 143 -a $((ended - started)) -lt 8
  check "SIGTERM: temporário removido" leftovers_in_tmp
  check "SIGTERM: nada enviado ao remoto" test -z "$(remote_files)"
  check "SIGTERM: relatório de falha emitido" \
    bash -c 'grep "^{" <<<"$1" | jq -e "select(.result == \"failure\")" >/dev/null' _ "$OUTPUT"
}

echo "pg-dump-external (fakes)"
test_success_uploads_encrypted_artifact_with_checksum_and_metadata
test_dump_failure_fails_job_and_cleans_up
test_dump_timeout_fails_job
test_dump_timeout_is_recognized_with_busybox_exit_code
test_dump_timeout_is_recognized_when_pg_dump_exits_one_on_term
test_tiny_or_corrupt_dump_is_rejected
test_encryption_failure_never_uploads_plaintext
test_upload_retries_are_limited
test_corrupted_upload_is_detected
test_partial_upload_leaves_no_meta_and_fails
test_orphans_do_not_count_toward_retention_minimum
test_recent_orphan_is_kept
test_never_overwrites_existing_artifact
test_concurrent_runs_use_distinct_names
test_retention_prunes_old_but_keeps_minimum
test_retention_failure_does_not_fail_backup
test_config_is_validated_without_echoing_secrets
test_sigterm_cleans_up_and_exits_fast
echo
echo "$PASSED passaram, $FAILED falharam"
[ "$FAILED" -eq 0 ]
