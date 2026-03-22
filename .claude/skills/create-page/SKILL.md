---
name: create-page
description: Criar página React com teste, store opcional, tokens semânticos do projeto
autoApply: false
---

# Create Page

Cria uma página React completa com TDD para o NossaGrana.

## Input

- `$PAGE_NAME` — nome da página em kebab-case (ex: `configuracoes`)

## Passos

### 1. Teste — `apps/web/src/pages/$PAGE_NAME-page.test.tsx`

Escrever testes RED:

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PageNamePage } from './$PAGE_NAME-page';

describe('PageNamePage', () => {
  it('deve renderizar o título da página', () => {
    render(<PageNamePage />);
    expect(screen.getByRole('heading', { name: /título/i })).toBeInTheDocument();
  });

  it('deve exibir estado de loading', () => { /* ... */ });
  it('deve exibir dados quando carregados', () => { /* ... */ });
  it('deve exibir mensagem quando vazio', () => { /* ... */ });
  it('deve exibir erro quando falhar', () => { /* ... */ });
});
```

### 2. Página — `apps/web/src/pages/$PAGE_NAME-page.tsx`

Implementar componente (GREEN):

```typescript
export function PageNamePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-text">Título</h1>
      {/* conteúdo */}
    </div>
  );
}
```

**Tokens obrigatórios:**
- `bg-bg` para fundo principal
- `bg-panel` para cards/painéis
- `bg-surface` para superfícies elevadas
- `text-text` para texto principal
- `text-text-muted` para texto secundário
- `border-border` para bordas

### 3. Store (se necessário) — `apps/web/src/stores/$PAGE_NAME.store.ts`

Criar Zustand store se a página precisa de estado global:

```typescript
import { create } from 'zustand';

interface PageNameState {
  items: Item[];
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
}

export const usePageNameStore = create<PageNameState>((set) => ({
  items: [],
  loading: false,
  error: null,
  fetch: async () => {
    set({ loading: true, error: null });
    try {
      // chamada à API
      set({ items: data, loading: false });
    } catch (err) {
      set({ error: 'Erro ao carregar', loading: false });
    }
  },
}));
```

### 4. Rota

Adicionar a página no roteamento do app (verificar `App.tsx` ou router config).

### 5. Validate

```bash
pnpm --filter web test -- src/pages/$PAGE_NAME-page.test.tsx
pnpm --filter web type-check
```
