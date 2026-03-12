# NossaGrana

PWA de gestao financeira familiar, self-hosted em Raspberry Pi 4B com K3s.

## Stack

- Backend: Node.js + Fastify + TypeScript
- ORM: Drizzle ORM + Drizzle Kit
- Banco: PostgreSQL
- Frontend: React + Vite + TypeScript + Tailwind CSS
- Monorepo: pnpm workspaces + Turborepo

## Setup local (Fase 0)

1. Ativar pnpm via corepack (uma vez):

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
```

2. Instalar dependencias:

```bash
pnpm install
```

3. Criar envs locais:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

4. Rodar em desenvolvimento:

```bash
pnpm dev
```

## Comandos uteis

```bash
pnpm lint
pnpm type-check
pnpm build
```

## Infra de deploy (base)

- Dockerfiles: `apps/api/Dockerfile`, `apps/web/Dockerfile`
- Kubernetes: `k8s/`
- CI/CD: `.github/workflows/ci-cd.yml`

## Documentacao

- `docs/PRD.md`
- `docs/FLOWS.md`
- `docs/USE_CASES.md`
- `docs/DECISIONS.md`
- `TASKS.md`
