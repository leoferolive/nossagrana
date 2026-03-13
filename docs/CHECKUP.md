# Checkup Geral da Codebase (2026-03-12)

Checkup executado com criterio agressivo para eliminar redundancias tecnicas, mantendo o roadmap de fases futuras.

## Necessario agora

- Monorepo `pnpm` + `turbo` com workspaces (`apps/api`, `apps/web`, `packages/types`)
- Pipeline de qualidade (`pnpm lint`, `pnpm type-check`, `pnpm build`)
- Workflows ativos de CI/release/deploy em `.github/workflows/`
- Stack de runtime atual (Fastify, React, Tailwind, Zod, JWT, WebSocket, PWA)
- Documentacao de produto e backlog (`docs/PRD.md`, `docs/FLOWS.md`, `docs/USE_CASES.md`, `TASKS.md`)

## Necessario depois (manter)

- Documentacao de regras de negocio e decisoes arquiteturais (`docs/DECISIONS.md`)
- Estrutura de deploy para ambientes `dev` e `prod` em `k8s/`
- Workflows de release/deploy mesmo antes da Fase 1 completa

## Nao necessario (removido neste checkup)

- `apps/web/src/stores/app.store.js` (arquivo JS compilado/duplicado da versao TS)
- `apps/web/vite.config.js` (arquivo JS compilado/duplicado da versao TS)
- `apps/web/vite.config.d.ts` (declaracao gerada sem necessidade de versionamento)
- Arquivos JS gerados no frontend (`apps/web/src/**/*.js`) agora bloqueados no `.gitignore`
- Emissao de JS pelo `tsc -b` no web foi desativada com `noEmit: true` em `tsconfig.app.json` e `tsconfig.node.json`
- Dependencia web sem uso atual removida: `@nossagrana/types`

## Inconsistencias corrigidas

- README referenciava workflow inexistente (`ci-cd.yml`): atualizado para `ci.yml`
- Fluxo de release simplificado: `release.yml` agora chama `deploy-environment.yml` direto para `dev`
- `apps/api` script `db:migrate` deixou de ser placeholder e passou a usar Drizzle real
- Politica de dependencias formalizada em `docs/DEPENDENCY_POLICY.md` com workflow semanal de drift

## Candidatos a revisao futura (nao removidos agora)

- `apps/web` dependencia `workbox-window` pode ser reavaliada quando a estrategia PWA estiver fechada
- Dependencias e scripts de deploy devem ser reavaliados quando houver mais modulos e testes

## Validacao aplicada

- `pnpm lint`
- `pnpm type-check`
- `pnpm build`
