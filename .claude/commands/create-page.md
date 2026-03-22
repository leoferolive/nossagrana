Crie uma página React chamada "$ARGUMENTS" com TDD, store Zustand e tokens semânticos.

Use a skill `create-page` para guiar a implementação. Passos:

1. **Teste primeiro** — criar `apps/web/src/pages/$ARGUMENTS-page.test.tsx`:
   - Renderização do título
   - Estado de loading
   - Estado com dados
   - Estado vazio
   - Estado de erro

2. **Página** — criar `apps/web/src/pages/$ARGUMENTS-page.tsx`:
   - Componente funcional
   - Tokens semânticos obrigatórios (`bg-bg`, `text-text`, etc.)
   - Integração com store Zustand

3. **Store** (se necessário) — criar `apps/web/src/stores/$ARGUMENTS.store.ts`:
   - Estado: items, loading, error
   - Ações: fetch, create, update, delete

4. **Rota** — adicionar no roteamento do app

5. **Validar**:
   ```bash
   pnpm --filter web test -- src/pages/$ARGUMENTS-page.test.tsx
   pnpm --filter web type-check
   ```

Consulte páginas existentes em `apps/web/src/pages/` como referência.
