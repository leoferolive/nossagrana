Execute o checklist pre-commit completo para garantir que a CI não reprove.

Rode TODAS as etapas na ordem. Pare e corrija ao primeiro erro antes de continuar.

## Pré-requisito

Se alterou `packages/types/src/`:

```bash
pnpm --filter @nossagrana/types build
```

## Fluxo: stage → `pnpm quality` → commit

### 1. Stage apenas os arquivos da mudança

```bash
git add <arquivos da mudança>   # ou: git add -u && git add <arquivos novos>
```

Não use `git add -A`: não stageie `planilha/`, rascunhos nem arquivos alheios à mudança.

### 2. Prettier (mesmo check do CI)

```bash
pnpm format:check:changed
```

Se falhar, formate com `pnpm exec prettier --write <arquivos>` e dê `git add` neles antes do gate. No commit, o `.husky/pre-commit` roda o lint-staged (prettier) antes de checar o marcador: se ele reformatar algo, o commit é bloqueado e o gate precisa rodar de novo.

### 3. Quality gate (lint, types, testes API + Web, cobertura, knip, ratchet, build)

```bash
CHANGED_FILES="$(git diff --cached --name-only origin/main)" pnpm quality
```

Com tudo verde, o gate grava o marcador exigido pelo `.husky/pre-commit` em commits do Claude Code (`CLAUDECODE=1`). Se mudar ou stagear algo depois, rode de novo.

## Resultado

- Se TUDO passou e o marcador foi gravado: "Pre-commit OK — pode commitar."
- Se algo falhou ou apareceu `⚠ Marcador ... NÃO gravado`: diagnosticar, corrigir e rodar o gate de novo.
