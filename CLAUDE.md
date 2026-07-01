# NossaGrana — Instruções para Claude Code

Este arquivo contém instruções e contexto para auxiliar o desenvolvimento do NossaGrana.
Leia este arquivo antes de qualquer implementação.

---

## O que é o NossaGrana

PWA de gestão financeira familiar, self-hosted em Raspberry Pi 4B com K3s.
Permite que uma família registre receitas e despesas, acompanhe saldo em tempo real,
controle cartões de crédito e visualize relatórios e insights financeiros.

---

## Entidades e Módulos Principais

Domínio: **gestão financeira familiar** — cada usuário pertence a uma ou mais
**famílias**, e todos os dados financeiros são isolados por `familia_id` (multi-tenant).

### Entidades (tabelas Drizzle em `apps/api/src/db/schema.ts`)

| Entidade                | Descrição                                                                 |
| ----------------------- | ------------------------------------------------------------------------- |
| `users`                 | Usuários (nome, email, hash de senha)                                     |
| `familias`              | Família (unidade de isolamento; suporta soft delete via `deleted_at`)     |
| `usuario_familia`       | Vínculo usuário↔família com papel (`admin`/`membro`)                       |
| `convites`              | Convites por código para entrar numa família                              |
| `solicitacoes_entrada`  | Pedidos de entrada em família (pendente/aprovada/rejeitada)               |
| `categorias`            | Categorias de `receita`/`despesa` (algumas de sistema)                     |
| `metodos_pagamento`     | Métodos: `credito`/`debito`/`pix`/`dinheiro` (cartão tem fechamento/venc.) |
| `transacoes`            | Lançamentos (receita/despesa) com parcelamento e recorrência              |
| `orcamento_categoria`   | Limites de gasto por categoria com vigência                               |
| `snapshots_mensais`     | Snapshot imutável do fechamento mensal (com flag `divergente`)            |
| `cofrinhos`             | Cofrinhos/metas de poupança com saldo e status (`ativo`/`encerrado`)      |
| `movimentacoes_cofrinho`| Aportes e retiradas de cofrinho                                           |
| `templates_transacao`   | Modelos reutilizáveis de lançamento                                       |
| `password_reset_tokens` / `revoked_refresh_tokens` | Suporte a auth (reset de senha, revogação de refresh) |

### Módulos da API (`apps/api/src/modules/`)

`auth`, `familia`, `categoria`, `metodo-pagamento`, `transacao` (inclui
`mes-referencia`), `orcamento`, `cofrinho`, `dashboard`, `relatorio`, `historico`,
`template-transacao`, `email`, `admin`, `health`, `ws` (WebSocket em tempo real).

### Telas da Web (`apps/web/src/pages/`)

login, sign-up, onboarding, familia-selector, dashboard, lancamentos, extrato,
orcamento, categorias, metodos-pagamento, cofrinhos (+ detalhe), fatura, relatorios,
historico, perfil, configuracoes, family-settings, ajuda.

**Documentação completa em `/docs/`:**

- `PRD.md` — requisitos completos, modelo de dados e regras de negócio
- `FLOWS.md` — 7 fluxos da aplicação em Mermaid
- `USE_CASES.md` — 32 casos de uso detalhados
- `DECISIONS.md` — decisões técnicas com justificativas
- `TASKS.md` — backlog completo por fase

---

## Stack

| Camada      | Tecnologia                                        |
| ----------- | ------------------------------------------------- |
| Backend     | Node.js + Fastify + TypeScript                    |
| ORM         | Drizzle ORM + Drizzle Kit                         |
| Banco       | PostgreSQL                                        |
| Validação   | Zod (schemas compartilhados em `packages/types`)  |
| Frontend    | React + Vite + TypeScript                         |
| Estilo      | Tailwind CSS                                      |
| PWA         | vite-plugin-pwa                                   |
| Monorepo    | pnpm workspaces + Turborepo                       |
| Tempo real  | WebSocket (fastify-websocket)                     |
| Agendamento | node-cron                                         |
| Auth        | JWT (access token 15min) + Refresh Token (7 dias) |
| Hash senha  | bcrypt                                            |

---

## Estrutura do Projeto

```
nossagrana/
├── apps/
│   ├── api/src/
│   │   ├── config/         # env, constantes
│   │   ├── db/             # schema Drizzle, migrations
│   │   ├── modules/        # domínios (auth, familia, transacao, etc.)
│   │   │   └── [modulo]/
│   │   │       ├── [modulo].routes.ts
│   │   │       ├── [modulo].service.ts
│   │   │       ├── [modulo].repository.ts
│   │   │       ├── [modulo].schema.ts   # Zod
│   │   │       └── [modulo].types.ts
│   │   └── plugins/        # plugins Fastify
│   └── web/src/
│       ├── components/     # componentes reutilizáveis
│       ├── pages/          # telas
│       ├── hooks/          # custom hooks
│       ├── stores/         # estado global (Zustand)
│       └── services/       # chamadas à API
├── packages/types/         # DTOs e schemas Zod compartilhados
├── k8s/                    # manifests Kubernetes
├── docs/                   # documentação
└── .github/workflows/      # CI/CD GitHub Actions
```

---

## Padrões de Código

### Processo de Desenvolvimento

- Sempre começar implementações por TDD (Red -> Green -> Refactor)
- Antes de alterar código de produção, escrever ou ajustar primeiro um teste que falhe
- Rodar os testes e simular a esteira CI antes de fechar a task
- Fazer commit ao final de cada task concluída, antes de iniciar a próxima

### Nomenclatura

- TypeScript: `camelCase` para variáveis/funções, `PascalCase` para tipos/interfaces/classes
- Banco de dados: `snake_case` para tabelas e colunas
- Arquivos e pastas: `kebab-case`
- Rotas da API: `kebab-case` (ex: `/metodos-pagamento`)

### TypeScript

- Sempre tipado — evitar `any`
- Usar tipos de `packages/types` para DTOs compartilhados
- Preferir `interface` para objetos, `type` para unions e aliases

### Backend (Fastify)

- Toda rota deve ter schema Zod para validação de input e output
- Separar concerns: routes → service → repository
- Toda query ao banco via Drizzle (sem SQL raw a não ser que necessário)
- Autenticar rotas via plugin de JWT
- Sempre validar que `familia_id` do recurso pertence ao usuário autenticado

### Frontend (React)

- Componentes funcionais com hooks
- Sem prop drilling: usar Zustand para estado global
- Tailwind para estilos — sem CSS modules ou styled-components
- Centralizar paleta semântica e estilos em tokens (theme do Tailwind/CSS variables), evitando valores hardcoded espalhados
- Usar uma única biblioteca de ícones em toda a aplicação, com mapeamento semântico consistente por contexto/tela
- Axios ou fetch nativo para chamadas à API

---

## Regras de Negócio Críticas

### Isolamento Multi-Tenant

**Toda query que acessa dados financeiros DEVE filtrar por `familia_id`.**
Nunca retornar dados de outra família.

### Mês de Referência (UC31)

```typescript
// Para cartão de crédito:
// Se dia da transação > dia de fechamento → próximo mês
// Se dia da transação <= dia de fechamento → mês atual
// Para outros métodos: mês da data da transação
```

### Snapshot Mensal

- Gerado por job (node-cron) no último dia de cada mês
- Snapshot original NUNCA é recalculado
- Ao editar/excluir transação de mês com snapshot → setar `divergente = true`

### Parcelas

- `valor_parcela = valor_total / numero_parcelas` (arredondar para 2 casas)
- Cada parcela tem `transacao_pai_id` apontando para a original
- Parcelas usam a regra de mês de referência do cartão

### Recorrências

- Gerar até `data_fim_recorrencia` ou indefinidamente se null
- Cancelar = remover lançamentos futuros ainda não processados
- Edição: opção "só esta" ou "esta e as futuras"

---

## O que NÃO fazer

- Não usar `any` no TypeScript
- Não fazer queries sem filtrar por `familia_id`
- Não usar SQL raw sem necessidade justificada
- Não recalcular snapshots gerados
- Não criar componentes de classe no React
- Não usar CSS Modules ou styled-components (apenas Tailwind)
- Não expor o banco PostgreSQL fora da rede interna
- Não commitar arquivos `.env` reais ou secrets

---

## Variáveis de Ambiente

### API (`apps/api/.env`)

```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/nossagrana
JWT_SECRET=
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=
REFRESH_TOKEN_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:5173
```

### Web (`apps/web/.env`)

```
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

---

## Como Rodar Localmente

```bash
# Instalar dependências
pnpm install

# Subir banco de dados (PostgreSQL local via Docker)
docker run -d --name nossagrana-db \
  -e POSTGRES_USER=nossagrana \
  -e POSTGRES_PASSWORD=nossagrana \
  -e POSTGRES_DB=nossagrana \
  -p 5432:5432 postgres:16

# Rodar migrations
pnpm --filter api db:migrate

# Rodar em desenvolvimento
pnpm dev
```

---

## Deploy (K3s no Raspberry Pi)

O CI/CD é feito via GitHub Actions usando o self-workflows.
Ao fazer push na branch `main`, o workflow:

1. Faz build das imagens Docker (multi-stage, target `linux/arm64`)
2. Faz push para GHCR (`ghcr.io/leoferolive/nossagrana-*`)
3. Aplica os manifests K8s no cluster K3s

**Manifests em `/k8s/`.**

---

## Referências Rápidas

- PRD completo: `docs/PRD.md`
- Fluxos: `docs/FLOWS.md`
- Casos de uso: `docs/USE_CASES.md`
- Decisões técnicas: `docs/DECISIONS.md`
- Backlog de tasks: `docs/TASKS.md`
