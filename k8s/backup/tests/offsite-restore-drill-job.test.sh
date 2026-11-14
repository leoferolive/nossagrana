#!/usr/bin/env bash
# Invariantes do Job manual de drill offsite (issue #44).
#
# O Secret do restic offsite é a única credencial permitida; o pod nunca pode
# receber credencial do Postgres de produção nem rodar como root.
#
# Uso: bash k8s/backup/tests/offsite-restore-drill-job.test.sh (requer jq e python3 com PyYAML)
set -euo pipefail

JOB_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/offsite-restore-drill-job.yaml"
JOB_JSON="$(python3 -c 'import sys,json,yaml; print(json.dumps(yaml.safe_load(open(sys.argv[1]))))' "$JOB_FILE")"
POD='.spec.template.spec'
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

job_is() { jq -e "$1" <<<"$JOB_JSON" >/dev/null; }

is_manual_job_with_generated_name() {
  job_is '.kind == "Job" and .metadata.generateName == "nossagrana-offsite-drill-" and .metadata.name == null'
}
is_not_in_kustomization() { ! grep -q 'offsite-restore-drill-job' "$(dirname "$JOB_FILE")/kustomization.yaml"; }
has_no_retry_and_deadline() { job_is '.spec.backoffLimit == 0 and .spec.activeDeadlineSeconds > 0 and .spec.ttlSecondsAfterFinished > 0'; }
runs_as_non_root() { job_is "$POD.securityContext | (.runAsNonRoot == true and .runAsUser > 0)"; }
no_service_account_token() { job_is "$POD.automountServiceAccountToken == false"; }
all_containers_drop_caps() {
  job_is "[$POD.initContainers[], $POD.containers[]] | all(.securityContext.allowPrivilegeEscalation == false and .securityContext.capabilities.drop == [\"ALL\"])"
}
main_container_is_read_only_fs() { job_is "$POD.containers[0].securityContext.readOnlyRootFilesystem == true"; }
only_restic_secret() {
  job_is "[$POD.volumes[] | select(.secret != null) | .secret.secretName] == [\"restic-backup-secrets\"]" &&
    ! grep -Eq 'secretKeyRef|secretRef|PGPASSWORD|PGPASSFILE' "$JOB_FILE"
}
restic_secret_is_group_readable_only() { job_is "$POD.volumes[] | select(.secret != null) | .secret.defaultMode == 288"; }
pghost_is_loopback_only() {
  job_is "$POD.containers[0].env[] | select(.name == \"PGHOST\") | .value == \"127.0.0.1\"" &&
    ! grep -Eq 'svc\.cluster\.local|postgres\.database' "$JOB_FILE"
}
backup_is_scratch_and_read_only() {
  job_is "$POD.volumes[] | select(.name == \"backup\") | .emptyDir != null" &&
    job_is "$POD.containers[0].volumeMounts[] | select(.name == \"backup\") | .readOnly == true"
}
images_are_pinned_except_restic() {
  job_is "[$POD.initContainers[], $POD.containers[] | .image | select(startswith(\"restic/restic\") | not)] | all(test(\":[^:]+$\") and (endswith(\":latest\") | not))"
}
script_configmap_is_placeholder() { grep -q '__DRILL_SCRIPT_CONFIGMAP__' "$JOB_FILE"; }

echo "manifest offsite-restore-drill-job"
check "Job manual com generateName" is_manual_job_with_generated_name
check "fora do kustomization (não é aplicado por apply -k)" is_not_in_kustomization
check "sem retry, com deadline e TTL" has_no_retry_and_deadline
check "pod não roda como root" runs_as_non_root
check "sem token de ServiceAccount no pod" no_service_account_token
check "todos os containers sem escalada e sem capabilities" all_containers_drop_caps
check "container do drill com rootfs somente leitura" main_container_is_read_only_fs
check "único Secret é o do restic offsite, sem credencial do Postgres" only_restic_secret
check "Secret do restic com modo 0440" restic_secret_is_group_readable_only
check "PGHOST do drill é só o loopback do sidecar" pghost_is_loopback_only
check "volume backup é emptyDir e montado somente leitura no drill" backup_is_scratch_and_read_only
check "imagens com tag fixa (exceto restic, deliberado)" images_are_pinned_except_restic
check "ConfigMap do script usa o placeholder documentado" script_configmap_is_placeholder
echo
echo "$PASSED passaram, $FAILED falharam"
[ "$FAILED" -eq 0 ]
