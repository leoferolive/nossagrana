---
name: pre-commit
description: Checklist obrigatório ANTES de todo commit — roda lint, type-check, build, knip e testes para não ser reprovado pela CI
autoApply: false
---

# Pre-Commit Checklist

**OBRIGATÓRIO antes de todo `git commit`.** Rode cada etapa sequencialmente. Pare e corrija ao primeiro erro antes de continuar.

## Pré-requisito

Se alterou `packages/types/src/`, faça build dos types primeiro:

```bash
pnpm --filter @nossagrana/types build
```

## Pipeline

Um único comando roda tudo (Prettier nos arquivos staged é feito pelo Husky):

```bash
pnpm quality
```

O script imprime tabela `✓/✗` ao final. Se algo falhar, ele para no primeiro erro e mostra qual etapa quebrou. Etapas (na ordem):

1. Oxlint (rápido)
2. ESLint (com regras de complexidade)
3. Type-check
4. Testes API com cobertura
5. Testes Web (apenas local, não roda em `--ci`)
6. `coverage:changed-check` (se `CHANGED_FILES` setado)
7. Knip (dead code)
8. Ratchet de complexidade (compara com `quality-baseline.json`)

**Se o ratchet falhar:** você introduziu novas violações de complexidade. Refatore ou, se justificável (raro), rode `pnpm ratchet:update` para atualizar a baseline.

## Regras Críticas

1. **Schema da rota = contrato de tipos**: Todo `reply.code(N)` DEVE ter o código N declarado no `schema.response` da rota. O TypeScript do Fastify infere os códigos de resposta permitidos a partir do schema.

2. **Exports de `@nossagrana/types`**: Após alterar `packages/types/src/`, SEMPRE rodar `pnpm --filter @nossagrana/types build` antes de type-check. O CI faz isso automaticamente, mas localmente o cache pode estar stale.

3. **Arquivos não commitados**: O `tsconfig` inclui `src/**/*.ts`. Scripts avulsos em `src/scripts/` que usem dependências não instaladas vão quebrar o type-check. Excluir do tsconfig ou não commitá-los.

4. **Testes web são obrigatórios**: O CI não roda testes web (Pi ARM64), então problemas só aparecem em produção se não testar localmente.

## Se Tudo Passar

A tabela final mostra todos os `✓`. Pode commitar.
