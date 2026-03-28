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

## Pipeline (mesma ordem da CI)

### 1. Prettier — formato do código

```bash
pnpm format:check:changed
```

Se falhar, corrigir automaticamente:

```bash
git diff --name-only origin/main...HEAD | xargs pnpm exec prettier --write --ignore-unknown
```

### 2. Oxlint — lint rápido

```bash
pnpm lint:fast
```

### 3. ESLint

```bash
pnpm lint
```

Se falhar com erros de import não usado ou variável não usada, remover o código morto.

### 4. Type Check

```bash
pnpm type-check
```

**Erros comuns que causam reprovação:**

- `reply.code(X)` com código HTTP não declarado no schema da rota → adicionar o código ao schema (`response: { 200: ..., 400: ..., 404: ... }`)
- Import de membro inexportado de `@nossagrana/types` → verificar se `pnpm --filter @nossagrana/types build` foi executado
- `any` implícito → tipar explicitamente
- Arquivo fora do escopo do tsconfig sendo incluído → verificar `include`/`exclude` do tsconfig

### 5. Build

```bash
pnpm build
```

### 6. Dead Code (Knip)

```bash
pnpm knip
```

Se detectar exports não usados, remover. Se for falso positivo (ex: routes registradas dinamicamente), adicionar ao `knip.config.ts`.

### 7. Testes API

```bash
pnpm --filter api test -- --run
```

### 8. Testes Web (NÃO roda no CI — obrigatório local)

```bash
pnpm --filter web test -- --run
```

### 9. Coverage dos arquivos alterados (simular CI gate)

```bash
pnpm --filter api test:coverage
```

Verificar que arquivos alterados têm ≥80% de cobertura de linhas.

## Regras Críticas

1. **Schema da rota = contrato de tipos**: Todo `reply.code(N)` DEVE ter o código N declarado no `schema.response` da rota. O TypeScript do Fastify infere os códigos de resposta permitidos a partir do schema.

2. **Exports de `@nossagrana/types`**: Após alterar `packages/types/src/`, SEMPRE rodar `pnpm --filter @nossagrana/types build` antes de type-check. O CI faz isso automaticamente, mas localmente o cache pode estar stale.

3. **Arquivos não commitados**: O `tsconfig` inclui `src/**/*.ts`. Scripts avulsos em `src/scripts/` que usem dependências não instaladas vão quebrar o type-check. Excluir do tsconfig ou não commitá-los.

4. **Testes web são obrigatórios**: O CI não roda testes web (Pi ARM64), então problemas só aparecem em produção se não testar localmente.

## Se Tudo Passar

Pode commitar. Informar ao usuário: "CI simulation OK — todas as 9 etapas passaram."
