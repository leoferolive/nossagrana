# NossaGrana

PWA de gestão financeira familiar, self-hosted em Raspberry Pi 4B com K3s.

Permite que uma família registre receitas e despesas, acompanhe o saldo em
tempo real, controle cartões de crédito, gerencie orçamentos por categoria
e visualize relatórios e insights financeiros.

## Funcionalidades

- **Autenticação** — cadastro, login, refresh token automático
- **Família** — criar família, convidar membros por código, gerenciar solicitações e permissões
- **Transações** — registro de receitas e despesas com suporte a parcelamento e recorrência
- **Extrato** — lista cronológica com filtros e detalhes de parcelas/recorrências
- **Dashboard** — resumo do mês, gráficos por categoria e evolução de gastos, atualizado via WebSocket
- **Orçamento** — limites de gasto por categoria com alertas visuais de progresso
- **Relatórios** — distribuição por categoria, breakdown por membro e tendências mensais
- **Fatura do cartão** — visualização de gastos por cartão em determinado mês
- **Histórico** — meses anteriores com snapshot imutável e indicador de divergência
- **PWA** — instalável no celular, funciona com suporte offline básico
- **Guia in-app** — tour de primeira visita por tela e tooltips contextuais

## Stack

| Camada      | Tecnologia                               |
| ----------- | ---------------------------------------- |
| Backend     | Node.js + Fastify + TypeScript           |
| ORM         | Drizzle ORM + Drizzle Kit                |
| Banco       | PostgreSQL                               |
| Frontend    | React + Vite + TypeScript + Tailwind CSS |
| PWA         | vite-plugin-pwa                          |
| Tempo real  | WebSocket (fastify-websocket)            |
| Agendamento | node-cron                                |
| Auth        | JWT (15 min) + Refresh Token (7 dias)    |
| Monorepo    | pnpm workspaces + Turborepo              |

## Como iniciar localmente

### 1. Pré-requisitos

- Node.js 20+
- Corepack habilitado
- Docker (para o PostgreSQL local)

```bash
node -v
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm -v
```

### 2. Instalar dependências

```bash
pnpm install
```

### 3. Configurar variáveis de ambiente

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Edite `apps/api/.env` com os dados do banco e dos secrets JWT:

```env
DATABASE_URL=postgresql://nossagrana:nossagrana@localhost:5432/nossagrana
JWT_SECRET=troque-por-uma-chave-segura
REFRESH_TOKEN_SECRET=troque-por-outra-chave-segura
ADMIN_SECRET=troque-por-um-segredo-admin
```

### 4. Subir o PostgreSQL

```bash
docker run -d --name nossagrana-db \
  -e POSTGRES_USER=nossagrana \
  -e POSTGRES_PASSWORD=nossagrana \
  -e POSTGRES_DB=nossagrana \
  -p 5432:5432 \
  postgres:16
```

### 5. Rodar migrations

```bash
pnpm --filter api db:migrate
```

### 6. Subir em modo desenvolvimento

```bash
pnpm dev
```

- API: `http://localhost:3000`
- Web: `http://localhost:5173`

### 7. Verificar

```bash
curl http://localhost:3000/api/health
```

## Comandos úteis

```bash
pnpm lint          # ESLint em todo o monorepo
pnpm type-check    # tsc --noEmit em api e web
pnpm build         # build de produção de api e web
pnpm test          # testes unitários/integração de api e web
pnpm deps:check    # verificação de dependências desatualizadas
```

## Interface administrativa

Algumas operações de sistema admin requerem o header `X-Admin-Secret` com o
valor configurado em `ADMIN_SECRET`:

| Método | Rota                                   | Descrição                  |
| ------ | -------------------------------------- | -------------------------- |
| PATCH  | `/admin/familias/:familiaId/recuperar` | Recuperar família excluída |
| POST   | `/admin/usuarios/:userId/impersonar`   | Gerar JWT de impersonação  |

## Troubleshooting

| Sintoma                  | Solução                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| `pnpm` não encontrado    | `corepack enable && corepack prepare pnpm@9.15.0 --activate`                                |
| API falha ao iniciar     | Confirme `DATABASE_URL`, `JWT_SECRET` e `REFRESH_TOKEN_SECRET` em `apps/api/.env`           |
| Erro de conexão ao banco | Verifique host/porta/credenciais; confirme que o container `nossagrana-db` está em execução |
| Web não conecta na API   | Confirme `VITE_API_URL` e `VITE_WS_URL` em `apps/web/.env`                                  |
| Migrations pendentes     | `pnpm --filter api db:migrate`                                                              |

## Deploy (K3s no Raspberry Pi)

CI/CD via GitHub Actions com self-hosted runner. Ao fazer push em `main`:

1. Build das imagens Docker multi-stage (`linux/arm64`)
2. Push para GHCR (`ghcr.io/leoferolive/nossagrana-*`)
3. Aplicação dos manifests K8s no cluster K3s

Manifests em `k8s/`.

## Documentação

- `docs/PRD.md` — requisitos, modelo de dados e regras de negócio
- `docs/FLOWS.md` — 7 fluxos da aplicação em Mermaid
- `docs/USE_CASES.md` — 32 casos de uso detalhados
- `docs/DECISIONS.md` — decisões técnicas com justificativas
- `docs/DEPENDENCY_POLICY.md` — política de dependências
- `TASKS.md` — backlog completo por fase
