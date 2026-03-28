Execute o checklist pre-commit completo para garantir que a CI não reprove.

Rode TODAS as etapas na ordem. Pare e corrija ao primeiro erro antes de continuar.

## Pré-requisito

Se alterou `packages/types/src/`:

```bash
pnpm --filter @nossagrana/types build
```

## Pipeline (mesma ordem da CI)

### 1. Prettier

```bash
pnpm format:check:changed
```

Se falhar:

```bash
git diff --name-only origin/main...HEAD | xargs pnpm exec prettier --write --ignore-unknown
```

### 2. Oxlint

```bash
pnpm lint:fast
```

### 3. ESLint

```bash
pnpm lint
```

### 4. Type Check

```bash
pnpm type-check
```

### 5. Build

```bash
pnpm build
```

### 6. Knip (dead code)

```bash
pnpm knip
```

### 7. Testes API

```bash
pnpm --filter api test -- --run
```

### 8. Testes Web (obrigatório — não roda no CI)

```bash
pnpm --filter web test -- --run
```

## Resultado

- Se TUDO passou: "Pre-commit OK - todas as 8 etapas passaram."
- Se algo falhou: diagnosticar, corrigir, e re-rodar a etapa que falhou antes de continuar.
