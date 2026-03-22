Execute a simulação completa de CI para o NossaGrana.

## Pipeline

Rode cada etapa sequencialmente. Pare ao primeiro erro.

### 1. Format Check

```bash
pnpm format:check:changed
```

### 2. Lint

```bash
pnpm lint:fast
```

### 3. Type Check

```bash
pnpm type-check
```

### 4. Build

```bash
pnpm build
```

### 5. Dead Code (Knip)

```bash
pnpm knip
```

### 6. Tests

```bash
pnpm test
```

### 7. Security Audit

```bash
pnpm security:audit
```

(Pode falhar por falta de rede — registrar e seguir)

## Análise

- Se todas as etapas passarem: reportar sucesso com tempo total
- Se alguma falhar: diagnosticar a causa, sugerir correção, e perguntar se deve corrigir automaticamente
- Prettier: se format check falhar, oferecer rodar `git diff --name-only origin/main...HEAD | xargs pnpm exec prettier --write --ignore-unknown`
