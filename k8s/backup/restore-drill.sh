#!/bin/sh
# Restore drill do NossaGrana (issue #48).
#
# Restaura o banco de produção a partir do pg_dumpall mais recente gerado pelo
# CronJob `pg-backup` (namespace `database`) num PostgreSQL DESCARTÁVEL que
# escuta só em 127.0.0.1 (sidecar do mesmo pod) e valida schema e dados.
#
# Nunca conecta na produção: o pod não recebe credenciais do Postgres real e
# o PGHOST é o loopback do sidecar. Backup sem restore testado não é backup.
#
# Saída: uma linha JSON `{"event":"restore_drill","result":...}` no final
# (coletada pelo Loki). Exit code != 0 em qualquer falha → Job falha →
# alerta `KubeJobFailed` / `NossaGranaRestoreDrillStale`.
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backup}"
SOURCE_DB_NAME="${SOURCE_DB_NAME:-nossagrana_prod}"
DRILL_DB_NAME="${DRILL_DB_NAME:-restore_drill}"
MAX_BACKUP_AGE_HOURS="${MAX_BACKUP_AGE_HOURS:-26}"
MIN_BACKUP_BYTES="${MIN_BACKUP_BYTES:-10240}"
MIN_MIGRATIONS="${MIN_MIGRATIONS:-1}"
PG_READY_TIMEOUT_SECONDS="${PG_READY_TIMEOUT_SECONDS:-60}"
REQUIRED_TABLES="${REQUIRED_TABLES:-users familias usuario_familia convites categorias metodos_pagamento transacoes orcamento_categoria snapshots_mensais cofrinhos movimentacoes_cofrinho templates_transacao}"
NON_EMPTY_TABLES="${NON_EMPTY_TABLES:-users familias}"

# Sem NOTICE (ex.: "database does not exist, skipping") poluindo o log do Job.
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STARTED_AT="$(date +%s)"
WORK_DIR="$(mktemp -d)"
ARTIFACT=""

cleanup() {
  rm -rf "$WORK_DIR"
  psql_admin -c "DROP DATABASE IF EXISTS \"$DRILL_DB_NAME\"" >/dev/null 2>&1 || true
}
trap cleanup EXIT

log() {
  echo "[restore-drill] $*" >&2
}

# Remove aspas/barras para manter a linha JSON válida.
json_safe() {
  printf '%s' "$1" | tr '"\\\n' "''  " | cut -c1-300
}

fail_stage() {
  printf '{"event":"restore_drill","result":"failure","stage":"%s","artifact":"%s","reason":"%s","duration_seconds":%s}\n' \
    "$1" "$ARTIFACT" "$(json_safe "$2")" "$(($(date +%s) - STARTED_AT))"
  exit 1
}

psql_admin() {
  psql -X -q -v ON_ERROR_STOP=1 -d postgres "$@"
}

psql_drill() {
  psql -X -q -A -t -v ON_ERROR_STOP=1 -d "$DRILL_DB_NAME" "$@"
}

select_latest_backup() {
  latest="$(find "$BACKUP_DIR" -maxdepth 1 -name 'pg-all-*.sql.gz' 2>/dev/null | sort | tail -n 1 || true)"
  [ -n "$latest" ] || fail_stage select "nenhum arquivo pg-all-*.sql.gz em $BACKUP_DIR"
  BACKUP_FILE="$latest"
  ARTIFACT="$(basename "$latest")"
}

check_freshness() {
  BACKUP_AGE_HOURS=$((($(date +%s) - $(stat -c %Y "$BACKUP_FILE")) / 3600))
  [ "$BACKUP_AGE_HOURS" -le "$MAX_BACKUP_AGE_HOURS" ] ||
    fail_stage freshness "backup com ${BACKUP_AGE_HOURS}h, esperado <= ${MAX_BACKUP_AGE_HOURS}h (RPO)"
}

check_size() {
  BACKUP_BYTES="$(stat -c %s "$BACKUP_FILE")"
  [ "$BACKUP_BYTES" -ge "$MIN_BACKUP_BYTES" ] ||
    fail_stage size "backup com ${BACKUP_BYTES} bytes, esperado >= ${MIN_BACKUP_BYTES} bytes"
}

# Um `<arquivo>.sha256` ao lado do dump é opcional; quando existe, tem de bater.
check_checksum() {
  BACKUP_SHA256="$(sha256sum "$BACKUP_FILE" | cut -d' ' -f1)"
  CHECKSUM_VERIFIED=false
  [ -f "$BACKUP_FILE.sha256" ] || return 0
  expected="$(cut -d' ' -f1 <"$BACKUP_FILE.sha256")"
  [ "$expected" = "$BACKUP_SHA256" ] ||
    fail_stage checksum "sha256 calculado $BACKUP_SHA256, esperado $expected (arquivo .sha256)"
  CHECKSUM_VERIFIED=true
}

check_integrity() {
  gzip -t "$BACKUP_FILE" 2>/dev/null || fail_stage integrity "gzip -t falhou: arquivo truncado ou corrompido"
}

wait_scratch_postgres() {
  waited=0
  until pg_isready -q -t 2 -d postgres; do
    waited=$((waited + 2))
    [ "$waited" -lt "$PG_READY_TIMEOUT_SECONDS" ] ||
      fail_stage scratch "PostgreSQL descartável em ${PGHOST:-localhost} indisponível após ${PG_READY_TIMEOUT_SECONDS}s"
    sleep 2
  done
}

# Lógica de extração compartilhada com o restore manual (RUNBOOK.md).
extract_database_section() {
  sh "$SCRIPT_DIR/extract-database.sh" "$BACKUP_FILE" "$SOURCE_DB_NAME" "$DRILL_DB_NAME" \
    >"$WORK_DIR/database.sql" ||
    fail_stage extract "banco $SOURCE_DB_NAME não encontrado em $ARTIFACT"
}

# Só os CREATE ROLE (sem ALTER ROLE ... PASSWORD): basta para OWNER/GRANT
# funcionarem e nenhum hash de senha é tocado. "já existe" é esperado.
restore_roles() {
  gzip -dc "$BACKUP_FILE" | grep '^CREATE ROLE ' >"$WORK_DIR/roles.sql" || true
  psql -X -q -d postgres -f "$WORK_DIR/roles.sql" >/dev/null 2>&1 || true
}

# Só a primeira linha ERROR do psql vai para o relatório: DETAIL/CONTEXT
# podem ecoar valores de linhas (dados pessoais/financeiros).
restore_database() {
  psql_admin -c "DROP DATABASE IF EXISTS \"$DRILL_DB_NAME\"" -c "CREATE DATABASE \"$DRILL_DB_NAME\"" >/dev/null
  if ! psql_drill --single-transaction -f "$WORK_DIR/database.sql" >/dev/null 2>"$WORK_DIR/restore.err"; then
    fail_stage restore "$(grep -m1 'ERROR' "$WORK_DIR/restore.err" || echo 'psql falhou sem mensagem ERROR')"
  fi
}

check_schema() {
  missing="$(psql_drill -v tables="$(echo "$REQUIRED_TABLES" | tr ' ' ',')" <<'SQL'
SELECT coalesce(string_agg(t, ','), '')
FROM unnest(string_to_array(:'tables', ',')) AS t
WHERE to_regclass(format('public.%I', t)) IS NULL;
SQL
)"
  [ -z "$missing" ] || fail_stage schema "tabelas ausentes: $missing; esperado: $REQUIRED_TABLES"
}

check_migrations() {
  MIGRATIONS="$(psql_drill -c 'SELECT count(*) FROM drizzle.__drizzle_migrations' 2>/dev/null)" ||
    fail_stage migrations "tabela drizzle.__drizzle_migrations ausente"
  [ "$MIGRATIONS" -ge "$MIN_MIGRATIONS" ] ||
    fail_stage migrations "$MIGRATIONS migrations aplicadas, esperado >= $MIN_MIGRATIONS"
}

count_rows() {
  psql_drill -c "SELECT count(*) FROM public.\"$1\""
}

check_essential_data() {
  for table in $NON_EMPTY_TABLES; do
    [ "$(count_rows "$table")" -gt 0 ] || fail_stage data "tabela $table vazia, esperado >= 1 linha"
  done
}

# Só contagens: nenhum valor de linha sai do pod.
row_counts_json() {
  json=""
  for table in $REQUIRED_TABLES; do
    json="$json${json:+,}\"$table\":$(count_rows "$table")"
  done
  printf '{%s}' "$json"
}

report_success() {
  printf '{"event":"restore_drill","result":"success","artifact":"%s","sha256":"%s","checksum_verified":%s,"size_bytes":%s,"backup_age_hours":%s,"source_db":"%s","migrations":%s,"row_counts":%s,"duration_seconds":%s}\n' \
    "$ARTIFACT" "$BACKUP_SHA256" "$CHECKSUM_VERIFIED" "$BACKUP_BYTES" "$BACKUP_AGE_HOURS" \
    "$SOURCE_DB_NAME" "$MIGRATIONS" "$(row_counts_json)" "$(($(date +%s) - STARTED_AT))"
}

main() {
  select_latest_backup
  log "artefato selecionado: $ARTIFACT"
  check_freshness
  check_size
  check_checksum
  check_integrity
  wait_scratch_postgres
  extract_database_section
  restore_roles
  log "restaurando $SOURCE_DB_NAME em $DRILL_DB_NAME (descartável)"
  restore_database
  check_schema
  check_migrations
  check_essential_data
  report_success
}

main
