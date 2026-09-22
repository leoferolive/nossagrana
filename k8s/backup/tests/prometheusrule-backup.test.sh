#!/usr/bin/env bash
# Testa as regras de alerta de backup (issue #49) com `promtool test rules`.
# Extrai `.spec` do PrometheusRule (CRD) para o formato de rule file do Prometheus.
#
# Uso: bash k8s/backup/tests/prometheusrule-backup.test.sh
set -euo pipefail

BACKUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROMETHEUS_IMAGE="prom/prometheus:v3.5.0"
YQ_IMAGE="mikefarah/yq:4.47.1"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

docker run --rm -i "$YQ_IMAGE" '.spec' <"$BACKUP_DIR/prometheusrule-backup.yaml" >"$WORK_DIR/rules.yaml"
cp "$BACKUP_DIR/tests/prometheusrule-backup.test.yaml" "$WORK_DIR/"
# promtool roda como nobody; mktemp cria o diretório com 0700.
chmod -R a+rX "$WORK_DIR"

docker run --rm -v "$WORK_DIR:/rules:ro" -w /rules --entrypoint promtool "$PROMETHEUS_IMAGE" \
  check rules rules.yaml
docker run --rm -v "$WORK_DIR:/rules:ro" -w /rules --entrypoint promtool "$PROMETHEUS_IMAGE" \
  test rules prometheusrule-backup.test.yaml
