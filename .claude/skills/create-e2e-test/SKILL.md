---
name: create-e2e-test
description: Criar teste E2E Playwright usando fixtures do projeto (authContext, authenticatedPage)
autoApply: false
---

# Create E2E Test

Cria um teste end-to-end com Playwright para o NossaGrana.

## Input

- `$FEATURE_NAME` — nome da feature em kebab-case (ex: `transacoes`)

## Fixtures Disponíveis

O projeto fornece fixtures em `apps/e2e/fixtures/base.ts`:

| Fixture | Descrição |
|---------|-----------|
| `authContext` | Usuário registrado e autenticado com tokens |
| `familiaId` | Família criada para o usuário autenticado |
| `authenticatedPage` | Página Playwright com auth tokens no localStorage |

### Import

```typescript
import { test, expect } from '../fixtures/base.js';
```

## Passos

### 1. Criar Teste — `apps/e2e/tests/$FEATURE_NAME.spec.ts`

```typescript
import { test, expect } from '../fixtures/base.js';

test.describe('Feature Name', () => {
  test('deve completar o fluxo principal', async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    // Navegar para a página
    await page.getByRole('link', { name: /feature/i }).click();

    // Interagir com elementos
    await page.getByRole('button', { name: /criar/i }).click();

    // Preencher formulário
    await page.getByLabel('Nome').fill('Teste E2E');

    // Submeter
    await page.getByRole('button', { name: /salvar/i }).click();

    // Verificar resultado
    await expect(page.getByText('Teste E2E')).toBeVisible();
  });
});
```

### 2. Helpers de API (se necessário) — `apps/e2e/helpers/`

Se o teste precisa de setup de dados via API:

```typescript
// apps/e2e/helpers/api-client.ts
export async function criarItem(token: string, data: object) {
  const response = await fetch(`${API_URL}/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  return response.json();
}
```

### 3. Boas Práticas

- **Seletores**: preferir `getByRole` e `getByLabel` sobre `getByText`
- **Waits**: usar `expect(...).toBeVisible()` com timeout ao invés de `waitForTimeout`
- **Isolamento**: cada teste cria seus próprios dados via fixtures
- **Cleanup**: fixtures fazem cleanup automático (deleteAccount)
- **Tours**: `authenticatedPage` já suprime first-time tours

### 4. Rodar

```bash
# Rodar todos os E2E
pnpm --filter e2e test

# Rodar teste específico
pnpm --filter e2e test -- tests/$FEATURE_NAME.spec.ts

# Com UI mode
pnpm --filter e2e test -- --ui

# Com headed browser
pnpm --filter e2e test -- --headed
```

### 5. Debug

Se o teste falhar:

1. Verificar `apps/e2e/playwright-report/` para screenshots e traces
2. Rodar com `--headed` para ver o browser
3. Verificar console do browser para erros JS
4. Verificar network requests para erros de API
