# Imagem do CronJob `pg-dump-external` (issue #47): só as ferramentas. O script
# (pg-dump-external.sh) entra como ConfigMap gerado pelo kustomize, então mudar a
# lógica não exige rebuild da imagem.
#
# Versão do pg_dump = versão do servidor (pgvector/pgvector:pg17); pg_dump
# recusa servidor mais novo que o cliente.
#
# Build/push (linux/arm64, Raspberry Pi) — passo a passo em docs/backup/RUNBOOK.md:
#   docker buildx build --platform linux/arm64 \
#     -t ghcr.io/leoferolive/nossagrana-pg-dump-external:1.0.0 --push k8s/backup/pg-dump-external
FROM alpine:3.22

RUN apk add --no-cache postgresql17-client age rclone \
  && adduser -D -u 10001 -h /nonexistent -s /sbin/nologin backup

USER 10001:10001
WORKDIR /tmp
