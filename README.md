# NossaGrana

PWA de gestão financeira familiar, self-hosted em Raspberry Pi 4B com K3s.

## Stack

- Backend: Node.js + Fastify + TypeScript
- ORM: Drizzle ORM + Drizzle Kit
- Banco: PostgreSQL
- Frontend: React + Vite + TypeScript + Tailwind CSS
- Monorepo: pnpm workspaces + Turborepo

## Rodando localmente

```bash
pnpm install

docker run -d --name nossagrana-db \
  -e POSTGRES_USER=nossagrana \
  -e POSTGRES_PASSWORD=nossagrana \
  -e POSTGRES_DB=nossagrana \
  -p 5432:5432 postgres:16

pnpm --filter api db:migrate
pnpm dev
```

## Documentação

- `docs/PRD.md`
- `docs/FLOWS.md`
- `docs/USE_CASES.md`
- `docs/DECISIONS.md`
- `TASKS.md`
