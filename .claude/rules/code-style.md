# Code Style

## Tamanho e Responsabilidade

- **Funções**: 4-20 linhas. Se passar disso, extrair sub-função.
- **Arquivos**: até 500 linhas. Dividir por responsabilidade quando ultrapassar.
  Débito conhecido (sinalização, não gate retroativo): `familia.repository.ts`
  (551 linhas) e `cofrinho.repository.ts` (489 linhas) — não bloquear PRs que
  apenas tocam esses arquivos, mas evitar crescê-los; ao mexer neles, avaliar
  se a mudança pode ser uma oportunidade de split.
- **SRP**: uma responsabilidade por módulo. Um `service` não deve fazer acesso
  a dados diretamente (isso é papel do `repository`), nem uma `route` deve
  conter lógica de negócio (isso é papel do `service`).

## Naming Conventions

- **TypeScript**: `camelCase` para variáveis e funções, `PascalCase` para tipos, interfaces e classes
- **Banco de dados**: `snake_case` para tabelas, colunas e constraints
- **Arquivos e pastas**: `kebab-case` (ex: `metodo-pagamento.service.ts`)
- **Rotas da API**: `kebab-case` (ex: `/metodos-pagamento`)
- **Nomes específicos e únicos**: evitar nomes genéricos como `data`, `handler`,
  `Manager`, `util`. Preferir nomes que, ao dar `grep` no repo, retornem poucos
  resultados (idealmente <5) — isso indica que o nome é específico o bastante
  para ser encontrado sem ambiguidade.

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

## Estado e Ícones (Frontend)

- Sem prop drilling: estado compartilhado entre componentes vai em Zustand
  (`apps/web/src/stores/`), não repassado por props em cadeia.
- Usar uma única biblioteca de ícones em toda a aplicação, com mapeamento
  semântico consistente por contexto/tela (não misturar bibliotecas de ícones
  diferentes entre páginas).

## Duplicação de Código

- Não duplicar lógica entre módulos ou entre `service`/`repository`. Extrair
  para uma função ou módulo compartilhado (ex: `apps/api/src/shared/` no
  backend, `apps/web/src/hooks/` ou `apps/web/src/services/` no frontend).
- Regras de negócio repetidas em mais de um módulo (ex: cálculo de mês de
  referência do cartão) devem viver em um único lugar e ser importadas, nunca
  reescritas.

## Controle de Fluxo

- Early return em vez de `if` aninhado — retornar/lançar erro cedo e manter o
  caminho feliz no nível mais raso da função.
- Máximo de 2 níveis de indentação por função. Se precisar de um terceiro,
  extrair a lógica interna para uma função nomeada.

## Mensagens de Erro

Toda exceção lançada por validação ou regra de negócio deve incluir o valor
recebido e o shape esperado, para que o erro seja acionável sem precisar
reproduzir o request:

```typescript
// Ruim
throw new Error('Categoria inválida');

// Bom
throw new ValidationError(
  `Categoria inválida: recebido "${categoriaId}", esperado um UUID de categoria existente na família ${familiaId}`,
);
```

**Exceção:** para senha, token (JWT, refresh token), header `Authorization` ou
qualquer outro segredo, não incluir o valor recebido na mensagem — descrever
o formato esperado sem ecoar o valor (ex. "token ausente ou malformado"). Ver
`.claude/rules/security.md` (nunca logar secrets, tokens ou senhas).

Ao validar com Zod, o formato de resposta de erro é o definido em
`.claude/rules/api-design.md` (`{ error: { message, code? } }`). Se o
handler de erro futuramente precisar expor detalhes por campo (path +
mensagem do Zod), isso é uma mudança de contrato de API — atualizar
`api-design.md` e o handler de erro junto, não assumir que já existe.

## Comentários

- **Preservar comentários existentes em refactors** — eles carregam intenção e
  proveniência que nem sempre são óbvias pelo código. Não remover um comentário
  só porque o código ao redor mudou de lugar.
- Escrever o **porquê**, não o **o quê**. O código já diz o que faz; o
  comentário só vale a pena quando explica uma decisão não óbvia, uma
  restrição externa ou um workaround.
- Funções públicas exportadas (usadas por outros módulos) ganham um docstring
  curto com intenção + um exemplo de uso quando a assinatura não for
  autoexplicativa.
- Quando uma linha existe por causa de um bug específico ou de uma restrição
  upstream, referenciar a issue ou o commit SHA no comentário.

## Dependências

- Injetar dependências via construtor/parâmetro, não importar singleton
  global. É o mesmo padrão já usado nos testes com repositório `InMemory`
  (ver `.claude/rules/testing.md`) — o service recebe o repository injetado
  em vez de importá-lo diretamente, o que mantém produção e teste consistentes.
- Bibliotecas de terceiros (ex: cliente Drizzle, Axios) não devem vazar
  diretamente para `service`/componentes React sem passar por uma camada fina
  própria do projeto (o `repository` já cumpre esse papel no backend para o
  Drizzle; no frontend, centralizar chamadas HTTP em `apps/web/src/services/`).

## Logging

- Logs de observabilidade da API (Fastify) em **JSON estruturado** — usar o
  logger do Fastify (`request.log` / `app.log`), nunca `console.log`.
- Texto plano apenas em saída de CLI/scripts (ex: `pnpm --filter api db:migrate`),
  onde o consumidor é humano, não um agregador de logs.

## Formatting

- Formatter é o **Prettier** (`prettier.config.cjs`) — rodar `pnpm format` ou
  `pnpm format:check`.
- Lint com **ESLint** (`pnpm lint`) e o fast-pass **Oxlint** (`pnpm lint:fast`).
- Não discutir estilo além do que o formatter/linter já impõem.
