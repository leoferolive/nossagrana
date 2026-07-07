# Napkin Runbook

## Curation Rules

- Re-prioritize on every read.
- Keep recurring, high-value notes only.
- Max 10 items per category.
- Each item includes date + "Do instead".

## Execution & Validation (Highest Priority)

1. **[2026-07-07] Validar alinhamento tag↔ref antes de qualquer deploy manual**
   Do instead: `git rev-list -n1 <tag>` deve ser igual a `git rev-parse <ref>`; "tag está na main" = `git merge-base --is-ancestor $(git rev-list -n1 <tag>) origin/main`. O reusable `deploy-environment.yml` builda do `ref` e rotula com `tag` — divergência gera imagem errada sob rótulo estável (guard automático no job `prepare`; skill `verify-deploy` para conferência local).
2. **[2026-07-07] release.yml pode criar várias tags de uma vez**
   Do instead: antes do deploy-prod, confirmar que a tag passada CONTÉM a mudança desejada (`git merge-base --is-ancestor <commit> <tag>`), não apenas usar "a mais nova".
3. **[2026-03-15] Prettier antes do push: formatar TODOS os arquivos alterados desde main**
   Do instead: `git diff --name-only origin/main...HEAD | xargs pnpm exec prettier --write --ignore-unknown` — a CI checa todos os arquivos do PR, não só o último commit.
4. **[2026-03-14] Sempre fazer `git fetch origin && git log origin/main` antes de iniciar qualquer task**
   Do instead: verificar o estado real do `origin/main` no início de cada sessão para não reimplementar trabalho já mergeado.
5. **[2026-03-12] `tsc -b` no frontend pode gerar JS em `src/` se `noEmit` nao estiver ativo**
   Do instead: usar `tsc --noEmit` nos scripts de build/type-check do web para evitar artefatos versionaveis.
6. **[2026-03-11] Validate critical flows after every meaningful code change**
   Do instead: run the smallest relevant automated checks first, then broaden only if needed.

## Shell & Command Reliability

1. **[2026-03-12] `kubectl apply --dry-run=client` can still require cluster API access**
   Do instead: validate YAML syntax offline first and treat cluster-backed dry-run as optional in sandboxed sessions.
2. **[2026-03-13] Em workspace, novos exports de `packages/types` exigem build antes de testes filtrados**
   Do instead: após alterar `packages/types/src`, rodar `pnpm --filter @nossagrana/types build` antes de `pnpm --filter api test`.
3. **[2026-03-13] `pnpm audit` pode falhar por DNS/rede restrita no sandbox**
   Do instead: rodar a esteira local completa e registrar explicitamente que o audit depende de conectividade externa.
4. **[2026-03-11] `pnpm` may be unavailable in fresh environments**
   Do instead: run `corepack enable && corepack prepare pnpm@9.15.0 --activate` before install/build checks.
5. **[2026-03-11] Prefer fast, scoped search commands**
   Do instead: use `rg`/`rg --files` with directory scoping before broader shell patterns.

## Domain Behavior Guardrails

1. **[2026-07-07] DATABASE_URL de prod é in-cluster: `postgres.database.svc.cluster.local:5432/nossagrana_prod`**
   Do instead: nunca NodePort/IP do host (pods novos não roteiam NodePort do próprio nó → EHOSTUNREACH → crash na migração Drizzle no startup). Secret `nossagrana-api-secrets` foi criado out-of-band — deploys não sobrescrevem secrets.
2. **[2026-07-07] Deploy prod roda em runner self-hosted ARM64 com environment `production` (gate manual)**
   Do instead: aguardar a aprovação do environment; imagens são linux/arm64 — não validar build amd64 e assumir paridade.
3. **[2026-03-14] Usar tokens semânticos do projeto em novas páginas/componentes**
   Do instead: usar `bg-bg`, `bg-panel`, `bg-surface`, `text-text`, `text-text-muted`, `border-border` — nunca `bg-background`, `bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground` (não existem no tailwind.config).
4. **[2026-03-14] `getByText` falha com múltiplos matches em seções + títulos de FAQ**
   Do instead: usar `getAllByText(...).length` ou buscar por role/label mais específico quando há duplicatas esperadas.
5. **[2026-03-12] Frontend `apps/web` deve versionar apenas fontes TS/TSX**
   Do instead: remover artefatos JS gerados (`src/**/*.js`, `vite.config.js`, `.d.ts` gerado) e bloquear no `.gitignore`.
6. **[2026-03-11] Preserve unrelated local changes**
   Do instead: edit only task-related files and never revert existing user changes unless explicitly requested.

## User Directives

1. **[2026-03-12] Sempre iniciar implementação por TDD**
   Do instead: começar cada task escrevendo/ajustando um teste que falhe, depois implementar para passar, e só então refatorar.
2. **[2026-03-13] Fechar cada task com simulação da CI e commit**
   Do instead: após dev, rodar fluxo local de CI (lint, type-check, build, testes/cobertura e audit quando rede permitir) e só então commitar antes da próxima task.
3. **[2026-03-11] Keep response style concise and action-oriented**
   Do instead: summarize outcome first, include only necessary details, and list next steps only when useful.
