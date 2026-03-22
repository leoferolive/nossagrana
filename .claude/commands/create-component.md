Crie um componente React chamado "$ARGUMENTS" com TDD.

Passos:

1. **Teste primeiro** — criar `apps/web/src/components/$ARGUMENTS.test.tsx`:
   - Teste de renderização
   - Teste de props
   - Teste de interação (se aplicável)
   - Teste de estados (loading, erro, vazio — se aplicável)

2. **Componente** — criar `apps/web/src/components/$ARGUMENTS.tsx`:
   - Componente funcional com TypeScript
   - Props tipadas com interface
   - Tokens semânticos: `bg-bg`, `bg-panel`, `bg-surface`, `text-text`, `text-text-muted`, `border-border`
   - Tailwind para estilos — sem CSS modules

3. **Validar**:
   ```bash
   pnpm --filter web test -- src/components/$ARGUMENTS.test.tsx
   pnpm --filter web type-check
   ```

Consulte componentes existentes em `apps/web/src/components/` como referência.
