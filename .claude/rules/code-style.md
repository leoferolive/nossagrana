# Code Style

## Naming Conventions

- **TypeScript**: `camelCase` para variáveis e funções, `PascalCase` para tipos, interfaces e classes
- **Banco de dados**: `snake_case` para tabelas, colunas e constraints
- **Arquivos e pastas**: `kebab-case` (ex: `metodo-pagamento.service.ts`)
- **Rotas da API**: `kebab-case` (ex: `/metodos-pagamento`)

## Estrutura de Módulo Backend (`apps/api/src/modules/[modulo]/`)

Cada módulo segue a ordem:

```
[modulo].types.ts       # Tipos e interfaces do domínio
[modulo].schema.ts      # Schemas Zod para validação de input/output
[modulo].repository.ts  # Acesso a dados via Drizzle
[modulo].service.ts     # Lógica de negócio
[modulo].routes.ts      # Rotas Fastify com schemas
```

## Estrutura de Página Frontend (`apps/web/src/pages/`)

```
[nome]-page.tsx         # Componente da página
[nome]-page.test.tsx    # Testes da página
```

## Estrutura de Componente Frontend (`apps/web/src/components/`)

```
[nome].tsx              # Componente
[nome].test.tsx         # Testes do componente
```

## TypeScript Strict

- **Nunca** usar `any` — tipar explicitamente ou usar `unknown`
- Preferir `interface` para objetos, `type` para unions e aliases
- Usar tipos de `packages/types` para DTOs compartilhados entre API e Web
- Sempre exportar tipos que são usados por outros módulos

## Imports

- Imports relativos dentro do mesmo módulo/diretório
- Imports de `packages/types` via `@nossagrana/types`
- Ordenar: built-in → externo → interno → relativo

## Tokens Semânticos (Frontend)

Usar tokens do Tailwind config do projeto:

- Backgrounds: `bg-bg`, `bg-panel`, `bg-surface`
- Texto: `text-text`, `text-text-muted`
- Bordas: `border-border`

**Nunca** usar: `bg-background`, `bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`
