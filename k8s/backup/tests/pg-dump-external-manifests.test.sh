#!/usr/bin/env bash
# Invariantes de segurança do CronJob pg-dump-external (issue #47).
#
# Critério de aceite: sem credencial em YAML, argumentos ou logs; execuções
# concorrentes não sobrescrevem backup válido; rollout nasce suspenso e o estado
# habilitado é um overlay próprio (reaplicar nunca suspende um backup ativo).
#
# Uso: bash k8s/backup/tests/pg-dump-external-manifests.test.sh (requer kubectl, jq e docker)
set -euo pipefail

JOB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../pg-dump-external" && pwd)"
YQ_IMAGE="mikefarah/yq:4.47.1"

# Renderiza um overlay; yq converte cada documento YAML em JSON, jq -s junta num array.
render_overlay_json() {
  kubectl kustomize "$JOB_DIR/$1" |
    docker run --rm -i "$YQ_IMAGE" -o=json -I=0 "." |
    jq -s "."
}

SUSPENDED_JSON="$(render_overlay_json suspended)"
# Estado estacionário (o que se reaplica no dia a dia): os checks gerais valem
# para ele; "overlays_differ_only_in_suspend" estende a cobertura ao suspenso.
RENDERED_JSON="$(render_overlay_json enabled)"
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

# Aplica um filtro jq ao CronJob renderizado; sai 0 se o resultado for verdadeiro.
cronjob_is() {
  jq -e --arg f "$1" '.[] | select(.kind == "CronJob") | '"$1" <<<"$RENDERED_JSON" >/dev/null
}

POD='.spec.jobTemplate.spec.template.spec'
CONTAINER="$POD.containers[0]"

suspend_of() { jq -r '.[] | select(.kind == "CronJob") | .spec.suspend' <<<"$1"; }
rollout_overlay_is_suspended() { [ "$(suspend_of "$SUSPENDED_JSON")" = "true" ]; }
enabled_overlay_is_not_suspended() { [ "$(suspend_of "$RENDERED_JSON")" = "false" ]; }
# Garante que habilitar não muda mais nada além de spec.suspend.
overlays_differ_only_in_suspend() {
  local suspended enabled
  suspended="$(jq -S 'map(del(.spec.suspend))' <<<"$SUSPENDED_JSON")"
  enabled="$(jq -S 'map(del(.spec.suspend))' <<<"$RENDERED_JSON")"
  [ "$suspended" = "$enabled" ]
}
# `kubectl apply -k k8s/backup/pg-dump-external` (sem overlay) tem de falhar em
# vez de suspender/habilitar silenciosamente (Codex P1 no PR #143).
root_is_not_applicable() {
  [ ! -e "$JOB_DIR/kustomization.yaml" ] && [ -f "$JOB_DIR/base/kustomization.yaml" ]
}
forbids_concurrency() { cronjob_is '.spec.concurrencyPolicy == "Forbid"'; }
has_explicit_timezone() { cronjob_is '.spec.timeZone == "America/Sao_Paulo"'; }
has_deadline_and_backoff() {
  cronjob_is '.spec.jobTemplate.spec.activeDeadlineSeconds > 0 and .spec.jobTemplate.spec.backoffLimit != null'
}
has_no_api_token() {
  cronjob_is "$POD.automountServiceAccountToken == false" &&
    jq -e '.[] | select(.kind == "ServiceAccount") | .automountServiceAccountToken == false' <<<"$RENDERED_JSON" >/dev/null
}
has_hardened_container() {
  cronjob_is "$CONTAINER.securityContext | (.allowPrivilegeEscalation == false and .readOnlyRootFilesystem == true and .capabilities.drop == [\"ALL\"])" &&
    cronjob_is "$POD.securityContext.runAsNonRoot == true and $POD.securityContext.runAsUser > 0"
}
secrets_only_via_secret_key_ref() {
  local sensitive
  for sensitive in PGUSER PGPASSWORD AGE_RECIPIENT BACKUP_REMOTE; do
    cronjob_is "$CONTAINER.env[] | select(.name == \"$sensitive\") | (.value == null and .valueFrom.secretKeyRef.name != null)" || return 1
  done
}
command_has_no_arguments_with_secrets() {
  cronjob_is "$CONTAINER.command == [\"sh\", \"/job/pg-dump-external.sh\"] and ($CONTAINER.args == null)"
}
image_is_pinned() {
  cronjob_is "$CONTAINER.image | (test(\":[0-9]+\\\\.[0-9]+\\\\.[0-9]+\$\") and (test(\":latest\") | not))"
}
storage_secret_is_read_only() {
  cronjob_is "$CONTAINER.volumeMounts[] | select(.name == \"storage-config\") | .readOnly == true"
}
script_comes_from_generated_configmap() {
  local generated referenced
  generated="$(jq -r '.[] | select(.kind == "ConfigMap") | .metadata.name' <<<"$RENDERED_JSON")"
  referenced="$(jq -r ".[] | select(.kind == \"CronJob\") | $POD.volumes[] | select(.name == \"job-script\") | .configMap.name" <<<"$RENDERED_JSON")"
  [[ "$generated" =~ ^pg-dump-external-script-[a-z0-9]{10}$ ]] && [ "$generated" = "$referenced" ]
}
has_no_rbac() {
  ! jq -e '.[] | select(.kind == "Role" or .kind == "RoleBinding" or .kind == "ClusterRole" or .kind == "ClusterRoleBinding")' <<<"$RENDERED_JSON" >/dev/null
}
# Só CronJob/ServiceAccount: o ConfigMap do script cita "AGE-SECRET-KEY" no código de validação.
has_no_credential_material() {
  ! jq -c '.[] | select(.kind != "ConfigMap")' <<<"$RENDERED_JSON" |
    grep -Eq 'AGE-SECRET-KEY|BEGIN [A-Z ]*PRIVATE KEY|postgres://[^ ]*:[^ ]*@|access_key_id|client_secret'
}
runs_in_database_namespace() {
  ! jq -e '.[] | select(.metadata.namespace != "database")' <<<"$RENDERED_JSON" >/dev/null
}
dockerfile_is_pinned_and_non_root() {
  grep -Eq '^FROM alpine:[0-9]+\.[0-9]+' "$JOB_DIR/Dockerfile" &&
    ! grep -Eq ':latest' "$JOB_DIR/Dockerfile" &&
    grep -Eq '^USER [0-9]+' "$JOB_DIR/Dockerfile"
}

echo "manifests k8s/backup/pg-dump-external"
check "overlay suspended (rollout) nasce suspenso: habilitar só após inspeção do artefato" rollout_overlay_is_suspended
check "overlay enabled define spec.suspend=false explícito (reaplicar não suspende)" enabled_overlay_is_not_suspended
check "overlays diferem apenas em spec.suspend" overlays_differ_only_in_suspend
check "raiz sem kustomization.yaml (apply -k sem overlay falha)" root_is_not_applicable
check "concurrencyPolicy Forbid (sem execuções concorrentes)" forbids_concurrency
check "timeZone explícito" has_explicit_timezone
check "activeDeadlineSeconds e backoffLimit definidos" has_deadline_and_backoff
check "sem token de ServiceAccount no pod nem na ServiceAccount" has_no_api_token
check "container endurecido (non-root, rootfs somente leitura, sem capabilities)" has_hardened_container
check "usuário, senha, recipient e destino só via secretKeyRef (nunca value literal)" secrets_only_via_secret_key_ref
check "comando sem argumentos (nada sensível em argv)" command_has_no_arguments_with_secrets
check "imagem com tag semver fixa (não latest)" image_is_pinned
check "Secret de configuração do storage montado somente leitura" storage_secret_is_read_only
check "script vem do ConfigMap gerado pelo kustomize" script_comes_from_generated_configmap
check "sem Role/RoleBinding (menor privilégio)" has_no_rbac
check "nenhum material de credencial nos manifests" has_no_credential_material
check "todos os recursos no namespace database" runs_in_database_namespace
check "Dockerfile com base fixada e USER não-root" dockerfile_is_pinned_and_non_root
echo
echo "$PASSED passaram, $FAILED falharam"
[ "$FAILED" -eq 0 ]
