# Testing

## TDD Obrigatório

Toda implementação segue o ciclo **Red → Green → Refactor**:

1. **Red**: escrever um teste que falhe (ou ajustar existente)
2. **Green**: implementar o mínimo para o teste passar
3. **Refactor**: melhorar o código mantendo os testes verdes

## Cobertura

- Meta mínima: **80%** de cobertura em linhas
- Verificar com `pnpm test:coverage`

## Backend — Testes Unitários

- Usar repositórios **InMemory** para isolar a lógica de negócio
- Padrão: `[modulo].repository.test.ts`, `[modulo].service.test.ts`
- Cada teste de service recebe um repositório InMemory injetado
- Testar isolamento multi-tenant: sempre validar que dados de outra `familia_id` não vazam

## Frontend — Testes Unitários

- Usar mocks para chamadas à API (`vi.mock`)
- Testar componentes com `@testing-library/react`
- Padrão: `[nome]-page.test.tsx`, `[nome].test.tsx`
- Testar estados: loading, sucesso, erro, vazio

## E2E — Playwright

- Usar fixtures do projeto: `authContext`, `familiaId`, `authenticatedPage`
- Import: `import { test, expect } from '../fixtures/base.js'`
- Testes em `apps/e2e/tests/`
- Helpers de API em `apps/e2e/helpers/`
- Preferir `getByRole`, `getByLabel` sobre `getByText` para evitar matches ambíguos

## Build de Types Antes de Testes

Ao alterar `packages/types/src`, rodar `pnpm --filter @nossagrana/types build` antes de executar testes em `api` ou `web`.
