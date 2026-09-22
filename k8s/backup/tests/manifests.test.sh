#!/usr/bin/env bash
# Invariantes de segurança dos manifests de backup (issues #48/#49).
#
# O restore drill nunca pode conseguir falar com o Postgres de produção: como
# a NetworkPolicy não é aplicada no cluster atual, a garantia é o pod não
# receber credencial alguma e só apontar para o sidecar em 127.0.0.1.
#
# Uso: bash k8s/backup/tests/manifests.test.sh (requer kubectl no PATH)
set -euo pipefail

BACKUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RENDERED="$(kubectl kustomize "$BACKUP_DIR")"
PASSED=0
FAILED=0

check() {
  local name="$1"
  shift
  if "$@"; then
    PASSED=$((PASSED + 1))
    echo "  ✓ $name"
  else
    FAILED=$((FAILED + 1))
    echo "  ✗ $name"
  fi
}

no_secret_references() {
  ! grep -Eq 'secretKeyRef|secretRef|secretName|PGPASSWORD|PGPASSFILE' <<<"$RENDERED"
}

pghost_is_loopback_only() {
  [ "$(grep -A1 -- '- name: PGHOST' <<<"$RENDERED" | grep -c 'value: 127.0.0.1')" -eq 1 ] &&
    ! grep -Eq 'svc\.cluster\.local|postgres\.database' <<<"$RENDERED"
}

scratch_listens_on_loopback() {
  grep -q 'listen_addresses=127.0.0.1' <<<"$RENDERED"
}

backup_volume_is_read_only() {
  grep -A2 'claimName: postgres-backup' <<<"$RENDERED" | grep -q 'readOnly: true'
}

no_service_account_token() {
  grep -q 'automountServiceAccountToken: false' <<<"$RENDERED"
}

script_configmap_is_generated() {
  grep -Eq 'name: nossagrana-restore-drill-script-[a-z0-9]{10}$' <<<"$RENDERED"
}

rules_are_selected_by_prometheus() {
  grep -A5 'kind: PrometheusRule' <<<"$RENDERED" | grep -q 'release: kps'
}

echo "manifests k8s/backup"
check "restore drill não referencia nenhum Secret nem senha" no_secret_references
check "PGHOST do drill é só o loopback do sidecar" pghost_is_loopback_only
check "PostgreSQL descartável escuta só em 127.0.0.1" scratch_listens_on_loopback
check "PVC de backup montado somente leitura" backup_volume_is_read_only
check "sem token de ServiceAccount no pod" no_service_account_token
check "script vem do ConfigMap gerado pelo kustomize" script_configmap_is_generated
check "PrometheusRule tem o label exigido pelo ruleSelector (release: kps)" rules_are_selected_by_prometheus
echo
echo "$PASSED passaram, $FAILED falharam"
[ "$FAILED" -eq 0 ]
