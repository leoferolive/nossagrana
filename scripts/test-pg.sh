#!/usr/bin/env bash
# Testes da API contra PostgreSQL real (issue #58: FKs compostas por família).
#
# Sobe um PostgreSQL descartável (mesma versão de produção) só em 127.0.0.1,
# roda `pnpm --filter api test:pg` e remove o container ao final. Nunca aponta
# para bancos de dev/produção: a URL é sempre a do container criado aqui.
#
# Uso: bash scripts/test-pg.sh   (requer Docker e `pnpm install`)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_IMAGE="postgres:17-alpine"
CONTAINER="ng-pg-test-$$"
PG_PASSWORD="pg-test-descartavel"

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD="$PG_PASSWORD" \
  -p 127.0.0.1::5432 "$PG_IMAGE" >/dev/null

ready=0
for _ in $(seq 1 60); do
  if docker exec "$CONTAINER" pg_isready -U postgres -h 127.0.0.1 >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [ "$ready" -ne 1 ]; then
  echo "PostgreSQL do container $CONTAINER não ficou pronto em 60s" >&2
  exit 1
fi

PORT="$(docker port "$CONTAINER" 5432/tcp | head -n1 | sed 's/.*://')"
export PG_TEST_ADMIN_URL="postgresql://postgres:$PG_PASSWORD@127.0.0.1:$PORT/postgres"

cd "$ROOT_DIR"
pnpm --filter api test:pg
