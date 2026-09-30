#!/bin/sh
# Dump cifrado do NossaGrana para storage externo (issue #47, epic #44).
#
# Fluxo: pg_dump (formato custom) -> valida tamanho e TOC (pg_restore --list)
# -> cifra com age para um recipient PÚBLICO -> sha256 -> upload imutável
# (artefato + .sha256, conferidos; só então o .meta.json, marcador de backup
# completo) -> baixa de volta e compara -> retenção.
#
# A chave privada age NUNCA entra no cluster: só o recipient público. Quem
# consegue ler o storage ou o Job não consegue decifrar os dumps. Guarde a
# chave privada fora do cluster (docs/backup/RUNBOOK.md).
#
# Nenhum segredo é logado nem vai em argumentos: a senha do banco vem por
# PGPASSWORD (Secret -> env) e a credencial do storage por RCLONE_CONFIG
# (Secret montado como arquivo).
#
# Saída: linhas JSON. A última é `{"event":"pg_dump_external","result":...}`
# (coletada pelo Loki). Exit code != 0 em qualquer falha de conexão, dump,
# cifragem, upload ou verificação -> Job falha -> alertas do PrometheusRule.
# O temporário (com o dump em claro) é removido em sucesso, falha e SIGTERM.
#
# Variáveis: ver k8s/backup/pg-dump-external/base/cronjob.yaml e o runbook.
# BACKUP_TIMESTAMP e BACKUP_RUN_ID existem para reexecução determinística
# (testes); em produção o padrão (UTC agora + nome do pod) evita colisões.
set -eu
umask 077

PGDATABASE="${PGDATABASE:-nossagrana_prod}"
DUMP_TIMEOUT_SECONDS="${DUMP_TIMEOUT_SECONDS:-600}"
UPLOAD_TIMEOUT_SECONDS="${UPLOAD_TIMEOUT_SECONDS:-300}"
UPLOAD_ATTEMPTS="${UPLOAD_ATTEMPTS:-3}"
UPLOAD_RETRY_DELAY_SECONDS="${UPLOAD_RETRY_DELAY_SECONDS:-10}"
MIN_DUMP_BYTES="${MIN_DUMP_BYTES:-10240}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
RETENTION_MIN_KEEP="${RETENTION_MIN_KEEP:-7}"
BACKUP_RUN_ID="${BACKUP_RUN_ID:-$(hostname)}"
BACKUP_TIMESTAMP="${BACKUP_TIMESTAMP:-$(date -u +%Y%m%dT%H%M%SZ)}"
# Falha de conexão precisa virar erro em segundos, não travar até o timeout do dump.
export PGDATABASE
export PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-15}"
# Só erros do rclone no log (sem NOTICE por chamada); nunca DEBUG, que imprime
# cabeçalhos/credenciais do backend.
export RCLONE_LOG_LEVEL="${RCLONE_LOG_LEVEL:-ERROR}"

STARTED_AT="$(date +%s)"
BOUNDED_TIMED_OUT="false"
STAGE="config"
REASON=""
WORK_DIR=""
CHILD_PID=""
ARTIFACT=""
REMOTE=""
SHA256=""
ENC_BYTES=0
RETENTION_OK="true"
RETENTION_DELETED=0

# Remove aspas/barras/quebras para manter a linha JSON válida.
json_safe() {
  printf '%s' "$1" | tr '"\\\n' "''  " | cut -c1-300
}

elapsed_seconds() {
  echo $(($(date +%s) - STARTED_AT))
}

log_step() {
  printf '{"event":"pg_dump_external_step","stage":"%s","message":"%s"}\n' "$STAGE" "$(json_safe "$1")"
}

log_warning() {
  printf '{"event":"pg_dump_external_step","level":"warning","stage":"%s","message":"%s"}\n' "$STAGE" "$(json_safe "$1")"
}

emit_failure() {
  printf '{"event":"pg_dump_external","result":"failure","stage":"%s","artifact":"%s","reason":"%s","duration_seconds":%s}\n' \
    "$STAGE" "$ARTIFACT" "$(json_safe "${REASON:-exit code $1}")" "$(elapsed_seconds)"
}

emit_success() {
  printf '{"event":"pg_dump_external","result":"success","artifact":"%s","bytes":%s,"sha256":"%s","retention_ok":%s,"retention_deleted":%s,"duration_seconds":%s}\n' \
    "$ARTIFACT" "$ENC_BYTES" "$SHA256" "$RETENTION_OK" "$RETENTION_DELETED" "$(elapsed_seconds)"
}

# Roda em sucesso, falha e sinal: remove o temporário (contém o dump em claro),
# encerra filho pendente e publica o relatório de falha.
on_exit() {
  rc=$?
  trap - EXIT
  [ -z "$CHILD_PID" ] || kill "$CHILD_PID" 2>/dev/null || true
  [ -z "$WORK_DIR" ] || rm -rf "$WORK_DIR"
  [ "$rc" -eq 0 ] || emit_failure "$rc"
  exit "$rc"
}
trap on_exit EXIT
trap 'REASON="interrompido por SIGTERM"; exit 143' TERM
trap 'REASON="interrompido por SIGINT"; exit 130' INT

fail_stage() {
  STAGE="$1"
  REASON="$2"
  exit 1
}

# Executa em background + wait para o trap de sinal agir na hora (um filho em
# foreground adiaria o trap até terminar). Marca BOUNDED_TIMED_OUT (ver
# is_timeout_exit).
run_bounded() {
  limit="$1"
  shift
  bounded_start="$(date +%s)"
  timeout -k 10 "$limit" "$@" &
  CHILD_PID=$!
  bounded_rc=0
  wait "$CHILD_PID" || bounded_rc=$?
  CHILD_PID=""
  BOUNDED_TIMED_OUT="false"
  if [ "$bounded_rc" -ne 0 ] && [ $(($(date +%s) - bounded_start)) -ge "$limit" ]; then
    BOUNDED_TIMED_OUT="true"
  fi
  return "$bounded_rc"
}

# O exit code do `timeout` não basta para reconhecer o estouro: o do GNU sai com
# 124, o do BusyBox (imagem alpine de produção, 1.37) com 143 (128 + SIGTERM) e,
# pior, o pg_dump trata o SIGTERM e sai com 1 ("terminated by user"), o que
# parece erro de conexão. Por isso também vale o tempo decorrido: falha depois de
# >= limite segundos é timeout (o piso em segundos inteiros nunca dá falso
# negativo). 137 = precisou de SIGKILL (-k). O SIGTERM do próprio job cai no
# trap e nunca passa por esta checagem.
is_timeout_exit() {
  [ "$BOUNDED_TIMED_OUT" = "true" ] || [ "$1" -eq 124 ] || [ "$1" -eq 137 ]
}

require_value() {
  eval "value=\${$1:-}"
  [ -n "$value" ] || fail_stage config "variável $1 ausente, esperado: $2"
}

require_uint() {
  eval "value=\${$1:-}"
  case "$value" in
    '' | *[!0-9]*) fail_stage config "variável $1 inválida: recebido \"$value\", esperado inteiro >= 0" ;;
  esac
}

validate_recipient() {
  case "$AGE_RECIPIENT" in
    AGE-SECRET-KEY-*)
      fail_stage config "AGE_RECIPIENT contém uma chave PRIVADA age (valor não exibido); esperado a chave pública 'age1...'"
      ;;
    age1*[!a-z0-9]* | age1) fail_stage config "AGE_RECIPIENT malformado (valor não exibido); esperado chave pública 'age1' + caracteres a-z0-9" ;;
    age1*) ;;
    *) fail_stage config "AGE_RECIPIENT malformado (valor não exibido); esperado chave pública começando com 'age1'" ;;
  esac
}

validate_config() {
  require_value PGHOST "host do PostgreSQL"
  require_value PGUSER "usuário de leitura (ex.: backup_ro)"
  require_value PGPASSWORD "senha do usuário (vinda de Secret)"
  require_value BACKUP_REMOTE "destino rclone, ex.: gdrive:backups/nossagrana-pgdump"
  require_value AGE_RECIPIENT "chave pública age (age1...)"
  validate_recipient
  for var in DUMP_TIMEOUT_SECONDS UPLOAD_TIMEOUT_SECONDS UPLOAD_ATTEMPTS UPLOAD_RETRY_DELAY_SECONDS MIN_DUMP_BYTES RETENTION_DAYS RETENTION_MIN_KEEP; do
    require_uint "$var"
  done
  [ "$UPLOAD_ATTEMPTS" -ge 1 ] || fail_stage config "UPLOAD_ATTEMPTS inválido: recebido \"$UPLOAD_ATTEMPTS\", esperado >= 1"
  # Retenção nunca pode apagar todos os backups: o mínimo protege contra RETENTION_DAYS=0.
  [ "$RETENTION_MIN_KEEP" -ge 1 ] || fail_stage config "RETENTION_MIN_KEEP inválido: recebido \"$RETENTION_MIN_KEEP\", esperado >= 1"
  case "$PGDATABASE" in
    '' | *[!A-Za-z0-9_]*) fail_stage config "PGDATABASE inválido: recebido \"$PGDATABASE\", esperado [A-Za-z0-9_]+" ;;
  esac
  case "$BACKUP_RUN_ID$BACKUP_TIMESTAMP" in
    *[!A-Za-z0-9.-]*) fail_stage config "BACKUP_RUN_ID/BACKUP_TIMESTAMP inválidos: recebido \"$BACKUP_RUN_ID\"/\"$BACKUP_TIMESTAMP\", esperado [A-Za-z0-9.-]+" ;;
  esac
  REMOTE="${BACKUP_REMOTE%/}"
  # Nome único por execução (timestamp + pod): execuções concorrentes nunca
  # escrevem no mesmo objeto; checagem prévia + --ignore-existing cobrem a colisão residual.
  ARTIFACT="${PGDATABASE}-${BACKUP_TIMESTAMP}-${BACKUP_RUN_ID}.dump.age"
}

dump_database() {
  STAGE="dump"
  log_step "pg_dump de ${PGDATABASE} (timeout ${DUMP_TIMEOUT_SECONDS}s)"
  rc=0
  run_bounded "$DUMP_TIMEOUT_SECONDS" pg_dump --format=custom --no-password \
    --lock-wait-timeout=60s --file="$WORK_DIR/dump.pgdump" || rc=$?
  [ "$rc" -eq 0 ] && return 0
  is_timeout_exit "$rc" && fail_stage dump "timeout após ${DUMP_TIMEOUT_SECONDS}s"
  fail_stage dump "pg_dump terminou com exit ${rc} (conexão/permissão; ver stderr acima)"
}

verify_dump() {
  STAGE="verify_dump"
  dump_bytes="$(stat -c %s "$WORK_DIR/dump.pgdump")"
  [ "$dump_bytes" -ge "$MIN_DUMP_BYTES" ] ||
    fail_stage verify_dump "dump com ${dump_bytes} bytes, esperado >= ${MIN_DUMP_BYTES} bytes"
  pg_restore --list "$WORK_DIR/dump.pgdump" >/dev/null 2>"$WORK_DIR/pg_restore.err" ||
    fail_stage verify_dump "pg_restore --list não leu o dump: $(head -n 1 "$WORK_DIR/pg_restore.err")"
  log_step "dump válido: ${dump_bytes} bytes"
}

encrypt_dump() {
  STAGE="encrypt"
  rc=0
  run_bounded "$DUMP_TIMEOUT_SECONDS" age -r "$AGE_RECIPIENT" -o "$WORK_DIR/$ARTIFACT" "$WORK_DIR/dump.pgdump" || rc=$?
  # O dump em claro sai do disco assim que existe a versão cifrada (ou falhou).
  rm -f "$WORK_DIR/dump.pgdump"
  [ "$rc" -eq 0 ] || fail_stage encrypt "age terminou com exit ${rc}"
  [ -s "$WORK_DIR/$ARTIFACT" ] || fail_stage encrypt "artefato cifrado vazio"
  ENC_BYTES="$(stat -c %s "$WORK_DIR/$ARTIFACT")"
}

write_checksum_and_metadata() {
  STAGE="checksum"
  (cd "$WORK_DIR" && sha256sum "$ARTIFACT" >"$ARTIFACT.sha256") ||
    fail_stage checksum "sha256sum falhou para ${ARTIFACT}"
  SHA256="$(cut -d' ' -f1 "$WORK_DIR/$ARTIFACT.sha256")"
  printf '{"database":"%s","artifact":"%s","created_at":"%s","run_id":"%s","bytes":%s,"sha256":"%s","format":"pg_dump-custom","encryption":"age","pg_dump":"%s"}\n' \
    "$PGDATABASE" "$ARTIFACT" "$BACKUP_TIMESTAMP" "$BACKUP_RUN_ID" "$ENC_BYTES" "$SHA256" \
    "$(json_safe "$(pg_dump --version)")" >"$WORK_DIR/$ARTIFACT.meta.json"
}

# Tentativas limitadas: $1 = origem, $2 = destino. --ignore-existing: nunca
# toca um objeto que já existe (backup válido é preservado). Não usamos
# --immutable: no rclone 1.74 `copyto --immutable --checksum` sobrescreveu um
# destino diferente em vez de falhar (verificado em 2026-09-30), e sem
# --checksum ignorou a divergência em silêncio. A divergência de conteúdo é
# pega por checagem prévia + verify_upload.
copy_with_retry() {
  attempt=1
  while :; do
    rc=0
    run_bounded "$UPLOAD_TIMEOUT_SECONDS" rclone copyto --ignore-existing --retries=1 --low-level-retries=3 "$1" "$2" || rc=$?
    [ "$rc" -ne 0 ] || return 0
    log_warning "rclone copyto falhou (exit ${rc}), tentativa ${attempt}/${UPLOAD_ATTEMPTS}"
    [ "$attempt" -lt "$UPLOAD_ATTEMPTS" ] || return 1
    attempt=$((attempt + 1))
    run_bounded 120 sleep "$UPLOAD_RETRY_DELAY_SECONDS" || true
  done
}

# rclone lsf sai com 3 quando o diretório de destino ainda não existe (1º backup).
ensure_artifact_absent() {
  rc=0
  run_bounded "$UPLOAD_TIMEOUT_SECONDS" rclone lsf --files-only "$REMOTE" >"$WORK_DIR/remote.existing" 2>/dev/null || rc=$?
  [ "$rc" -eq 0 ] || [ "$rc" -eq 3 ] || fail_stage upload "não foi possível listar ${REMOTE} (rclone exit ${rc})"
  ! grep -qxF "$ARTIFACT" "$WORK_DIR/remote.existing" ||
    fail_stage upload "${ARTIFACT} já existe no storage; backups nunca são sobrescritos"
}

# Sobe os objetos na ordem recebida; cada um com tentativas limitadas.
upload_objects() {
  STAGE="upload"
  for name in "$@"; do
    copy_with_retry "$WORK_DIR/$name" "$REMOTE/$name" ||
      fail_stage upload "upload de ${name} falhou após ${UPLOAD_ATTEMPTS} tentativa(s) (ou objeto existente diferente)"
  done
}

# Baixa de volta cada objeto e compara byte a byte com o enviado.
verify_objects() {
  STAGE="verify_upload"
  mkdir -p "$WORK_DIR/verify"
  for name in "$@"; do
    copy_with_retry "$REMOTE/$name" "$WORK_DIR/verify/$name" ||
      fail_stage verify_upload "não foi possível baixar ${name} para verificação"
    cmp -s "$WORK_DIR/$name" "$WORK_DIR/verify/$name" ||
      fail_stage verify_upload "${name} no storage difere do enviado (corrupção no upload)"
  done
}

# O .meta.json é o marcador de artefato COMPLETO E VERIFICADO: só sobe depois de
# artefato + .sha256 estarem no storage e conferidos. Falha em qualquer etapa
# anterior deixa um órfão sem .meta.json, que a retenção não conta como backup
# (prune_remote) e remove depois de RETENTION_DAYS. Não apagamos o que acabou de
# subir na falha: numa colisão de nome o objeto pode ser o backup válido de
# outra execução.
publish_artifact() {
  STAGE="upload"
  ensure_artifact_absent
  upload_objects "$ARTIFACT" "$ARTIFACT.sha256"
  verify_objects "$ARTIFACT" "$ARTIFACT.sha256"
  (cd "$WORK_DIR/verify" && sha256sum -c "$ARTIFACT.sha256" >/dev/null 2>&1) ||
    fail_stage verify_upload "sha256 do artefato baixado não confere com ${ARTIFACT}.sha256"
  upload_objects "$ARTIFACT.meta.json"
  verify_objects "$ARTIFACT.meta.json"
  log_step "upload verificado: ${ARTIFACT}"
}

timestamp_to_epoch() {
  stamp="$1"
  date -u -d "$(printf '%s' "$stamp" | cut -c1-4)-$(printf '%s' "$stamp" | cut -c5-6)-$(printf '%s' "$stamp" | cut -c7-8) $(printf '%s' "$stamp" | cut -c10-11):$(printf '%s' "$stamp" | cut -c12-13):$(printf '%s' "$stamp" | cut -c14-15)" +%s
}

# rclone deletefile sai com 4 quando o objeto não existe.
RCLONE_EXIT_OBJECT_NOT_FOUND=4

# Apaga o .meta.json primeiro: sem ele o artefato deixa de contar como backup
# completo. Só "não encontrado" é tolerado (órfãos nunca tiveram .meta.json e o
# .sha256 pode faltar); qualquer outra falha (rede, permissão) aborta ANTES de
# apagar o payload, senão sobraria um marcador sem artefato que nenhuma execução
# futura limparia (a descoberta parte dos .dump.age). Codex P2, PR #143.
delete_remote_artifact() {
  for name in "$1.meta.json" "$1" "$1.sha256"; do
    rc=0
    run_bounded "$UPLOAD_TIMEOUT_SECONDS" rclone deletefile "$REMOTE/$name" >/dev/null 2>&1 || rc=$?
    [ "$rc" -eq 0 ] || [ "$rc" -eq "$RCLONE_EXIT_OBJECT_NOT_FOUND" ] || return 1
  done
  return 0
}

# Por nome (timestamp UTC no nome), não por mtime: independe do backend.
# Remove só artefatos deste banco, mais antigos que RETENTION_DAYS, e nunca
# deixa menos que RETENTION_MIN_KEEP artefatos COMPLETOS (com .meta.json, que
# só sobe depois da verificação; o recém-enviado conta). Órfãos (upload parcial
# ou artefato que falhou na verificação) não contam para o mínimo e são
# removidos quando passam de RETENTION_DAYS, para que falhas em sequência
# nunca formem o "mínimo" com artefatos inválidos.
prune_remote() {
  cutoff=$(($(date +%s) - RETENTION_DAYS * 86400))
  run_bounded "$UPLOAD_TIMEOUT_SECONDS" rclone lsf --files-only "$REMOTE" >"$WORK_DIR/remote.list" 2>/dev/null || return 1
  split_remote_artifacts
  delete_expired "$WORK_DIR/remote.orphans" || return 1
  prunable=$(($(wc -l <"$WORK_DIR/remote.complete") - RETENTION_MIN_KEEP))
  [ "$prunable" -gt 0 ] || return 0
  head -n "$prunable" "$WORK_DIR/remote.complete" >"$WORK_DIR/remote.candidates"
  delete_expired "$WORK_DIR/remote.candidates"
}

# Separa os artefatos deste banco em completos (com .meta.json) e órfãos,
# ambos ordenados por nome (= por timestamp).
split_remote_artifacts() {
  grep -E "^${PGDATABASE}-[0-9]{8}T[0-9]{6}Z-[A-Za-z0-9.-]+\.dump\.age$" "$WORK_DIR/remote.list" | sort >"$WORK_DIR/remote.matched" || true
  : >"$WORK_DIR/remote.complete"
  : >"$WORK_DIR/remote.orphans"
  while IFS= read -r name; do
    if grep -qxF "$name.meta.json" "$WORK_DIR/remote.list"; then
      echo "$name" >>"$WORK_DIR/remote.complete"
    else
      echo "$name" >>"$WORK_DIR/remote.orphans"
    fi
  done <"$WORK_DIR/remote.matched"
}

# Apaga os artefatos listados em $1 (um por linha) mais antigos que o cutoff.
delete_expired() {
  while IFS= read -r name; do
    [ "$name" != "$ARTIFACT" ] || continue
    stamp="${name#"${PGDATABASE}"-}"
    stamp="${stamp%%-*}"
    epoch="$(timestamp_to_epoch "$stamp")" || continue
    [ "$epoch" -lt "$cutoff" ] || continue
    delete_remote_artifact "$name" || return 1
    RETENTION_DELETED=$((RETENTION_DELETED + 1))
  done <"$1"
}

# Retenção é higiene, não backup: falhar aqui não invalida um backup já
# verificado. Fica visível no relatório (retention_ok=false) e no log.
apply_retention() {
  STAGE="retention"
  prune_remote || {
    RETENTION_OK="false"
    log_warning "retenção não concluída; backup atual está íntegro (retention_ok=false)"
  }
}

main() {
  validate_config
  WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/pg-dump-external.XXXXXX")"
  dump_database
  verify_dump
  encrypt_dump
  write_checksum_and_metadata
  publish_artifact
  apply_retention
  STAGE="done"
  emit_success
}

main
