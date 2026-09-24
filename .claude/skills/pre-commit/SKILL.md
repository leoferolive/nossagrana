---
name: pre-commit
description: Checklist obrigatório ANTES de todo commit — roda lint, type-check, build, knip e testes para não ser reprovado pela CI
autoApply: false
---

# Pre-Commit Checklist

**OBRIGATÓRIO antes de todo `git commit`.** Fluxo: **stage → `pnpm quality` → commit**.

O `.husky/pre-commit` bloqueia commits do Claude Code (`CLAUDECODE=1`) se o `pnpm quality` não tiver passado para exatamente o conteúdo staged (marcador por `git write-tree`). Detalhes em `.claude/rules/quality-gate.md`.

## Pré-requisito

Se alterou `packages/types/src/`, faça build dos types primeiro:

```bash
pnpm --filter @nossagrana/types build
```

## Pipeline

1. Stage apenas os arquivos da mudança — `git add <arquivos>` (ou `git add -u` + arquivos novos). **Não** use `git add -A`: não stageie `planilha/` nem rascunhos.
2. Formate **antes** do gate: `pnpm exec prettier --write <arquivos>` + `git add <arquivos>`. O Husky roda o lint-staged (prettier) no commit **antes** de checar o marcador; se ele reformatar algo, o commit é bloqueado e o gate precisa rodar de novo.
3. Rode o gate:

```bash
CHANGED_FILES="$(git diff --cached --name-only origin/main)" pnpm quality
```

4. Se passou e gravou o marcador, `git commit`. Se alterar/stagear algo depois, rode o gate de novo.

O script imprime tabela `✓/✗` ao final. Se algo falhar, ele para no primeiro erro e mostra qual etapa quebrou. Etapas (na ordem):

1. Oxlint (rápido)
2. ESLint (com regras de complexidade)
3. Type-check
4. Testes API com cobertura
5. Testes Web (apenas local, não roda em `--ci`)
6. `coverage:changed-check` (se `CHANGED_FILES` setado)
7. Knip (dead code)
8. Ratchet de complexidade (compara com `quality-baseline.json`)
9. Build

**Se o ratchet falhar:** você introduziu novas violações de complexidade. Refatore ou, se justificável (raro), rode `pnpm ratchet:update` para atualizar a baseline.

## Regras Críticas

1. **Schema da rota = contrato de tipos**: Todo `reply.code(N)` DEVE ter o código N declarado no `schema.response` da rota. O TypeScript do Fastify infere os códigos de resposta permitidos a partir do schema.

2. **Exports de `@nossagrana/types`**: Após alterar `packages/types/src/`, SEMPRE rodar `pnpm --filter @nossagrana/types build` antes de type-check. O CI faz isso automaticamente, mas localmente o cache pode estar stale.

3. **Arquivos não commitados**: O `tsconfig` inclui `src/**/*.ts`. Scripts avulsos em `src/scripts/` que usem dependências não instaladas vão quebrar o type-check. Excluir do tsconfig ou não commitá-los.

4. **Testes web são obrigatórios**: O CI não roda testes web (Pi ARM64), então problemas só aparecem em produção se não testar localmente.

## Se Tudo Passar

A tabela final mostra todos os `✓` e a linha `Marcador do quality gate gravado para a árvore <hash>`. Pode commitar. Se aparecer `⚠ Marcador ... NÃO gravado`, siga o motivo indicado (ex.: `git add` pendente, não rastreado em `apps/`, índice mudou durante o gate) e rode o gate de novo.
