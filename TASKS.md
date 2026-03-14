# NossaGrana — Tasks

Backlog organizado por fase de desenvolvimento. Cada fase deve ser validada antes de avançar para a próxima.

**Legenda:** `[ ]` pendente · `[x]` concluído · `[~]` em progresso

---

## Fase 0 — Setup e Infraestrutura

- [x] Inicializar monorepo com pnpm workspaces + Turborepo
- [x] Configurar `apps/api` (Fastify + TypeScript)
- [x] Configurar `apps/web` (Vite + React + TypeScript + Tailwind)
- [x] Configurar `packages/types` (tipos e schemas Zod compartilhados)
- [x] Configurar ESLint + Prettier no monorepo
- [x] Dockerfile multi-stage para `apps/api` (target linux/arm64)
- [x] Dockerfile multi-stage para `apps/web` (nginx + build Vite)
- [x] Manifests K8s: Deployment, Service e Ingress para API
- [x] Manifests K8s: Deployment, Service e Ingress para Web
- [x] Manifest K8s: PostgreSQL (StatefulSet + PVC)
- [x] Configurar GitHub Actions (CI/CD via self-workflows)
- [x] Ajustar Ingress para Cloudflare Tunnel existente
- [x] Configurar variáveis de ambiente e secrets no K3s
- [x] Testar deploy end-to-end no Raspberry Pi

---

## Fase 1 — Banco de Dados

- [x] Instalar e configurar Drizzle ORM + Drizzle Kit
- [x] Schema: tabela `users`
- [x] Schema: tabela `familias`
- [x] Schema: tabela `usuario_familia`
- [x] Schema: tabela `convites`
- [x] Schema: tabela `solicitacoes_entrada`
- [x] Schema: tabela `categorias` (com seed de categorias padrão)
- [x] Schema: tabela `metodos_pagamento`
- [x] Schema: tabela `transacoes`
- [x] Schema: tabela `orcamento_categoria`
- [x] Schema: tabela `snapshots_mensais`
- [x] Criar índices: `familia_id`, `mes_referencia`, `usuario_id`
- [x] Configurar migration inicial e rodar no banco

---

## Fase 2 — Autenticação

### Backend
- [x] Rota `POST /auth/register` — cadastro de usuário (UC01)
- [x] Rota `POST /auth/login` — login com JWT + refresh token (UC02)
- [x] Rota `POST /auth/refresh` — renovar access token
- [x] Rota `POST /auth/logout` — invalidar refresh token
- [x] Plugin Fastify de autenticação (verificar JWT em rotas protegidas)
- [x] Middleware de isolamento por `familia_id`

### Frontend
- [x] Tela de login
- [x] Tela de cadastro
- [x] Lógica de refresh token automático (interceptor)
- [x] Contexto de autenticação (AuthContext)
- [x] Rota protegida (PrivateRoute)
- [x] Persistência de sessão (localStorage com token)

---

## Fase 3 — Família e Onboarding

### Backend
- [ ] Rota `POST /familias` — criar família (UC05)
- [ ] Rota `POST /familias/convites` — gerar código de convite (UC21)
- [ ] Rota `POST /familias/entrar/:codigo` — entrar via convite (UC03)
- [ ] Rota `POST /familias/solicitar` — solicitar entrada (UC04)
- [ ] Rota `GET /familias/solicitacoes` — listar solicitações pendentes (Admin)
- [ ] Rota `PATCH /familias/solicitacoes/:id` — aprovar/rejeitar (UC22)
- [ ] Rota `GET /familias/:id/membros` — listar membros
- [ ] Rota `DELETE /familias/:id/membros/:usuarioId` — remover membro (UC23)
- [ ] Rota `DELETE /familias/:id` — excluir família (UC24)
- [ ] Rota `POST /familias/alternar` — alternar família ativa (UC20)

### Frontend
- [ ] Fluxo de onboarding pós-cadastro (criar família / entrar com convite / solicitar)
- [ ] Tela de configurações da família (Admin)
- [ ] Listagem de membros com opção de remoção
- [ ] Gestão de solicitações pendentes (Admin)
- [ ] Geração e compartilhamento de código de convite
- [ ] Seletor de família ativa (para usuários com múltiplas famílias)

---

## Fase 4 — Core Financeiro

### Backend
- [ ] Rota `GET /categorias` — listar categorias da família
- [ ] Rota `POST /categorias` — criar categoria (UC17)
- [ ] Rota `PATCH /categorias/:id` — editar categoria
- [ ] Rota `DELETE /categorias/:id` — desativar categoria (soft delete)
- [ ] Seed de categorias padrão ao criar família
- [ ] Rota `GET /metodos-pagamento` — listar métodos da família
- [ ] Rota `POST /metodos-pagamento` — cadastrar método (UC18)
- [ ] Rota `PATCH /metodos-pagamento/:id` — editar método
- [ ] Rota `DELETE /metodos-pagamento/:id` — desativar método
- [ ] Serviço de cálculo de mês de referência (UC31)
- [ ] Rota `POST /transacoes` — registrar transação simples (UC06)
- [ ] Serviço de geração de parcelas futuras (UC07 + UC29)
- [ ] Serviço de geração de recorrências futuras (UC08 + UC30)
- [ ] Rota `GET /transacoes` — listar transações com filtros (UC13)
- [ ] Rota `GET /transacoes/:id` — detalhe da transação
- [ ] Rota `PATCH /transacoes/:id` — editar transação (UC09)
- [ ] Rota `DELETE /transacoes/:id` — excluir transação (UC10)
- [ ] Rota `POST /transacoes/:id/antecipar` — antecipar parcelas (UC11)

### Frontend
- [ ] Modal de nova transação (FAB — botão flutuante sempre visível)
- [ ] Campos: tipo, valor, categoria, descrição, data, método de pagamento
- [ ] Toggle parcelado (nº de parcelas + cálculo de valor da parcela)
- [ ] Toggle recorrente (frequência + data fim opcional)
- [ ] Tela de Extrato com lista cronológica
- [ ] Filtros de extrato: usuário, categoria, tipo, método
- [ ] Detalhe da transação (editar / excluir)
- [ ] Identificação visual de parcelas ("Parcela X/N") e recorrentes
- [ ] Tela de Categorias (listar, criar, editar, desativar)
- [ ] Tela de Cartões / Métodos de Pagamento

---

## Fase 5 — Dashboard e Tempo Real

### Backend
- [ ] Rota `GET /dashboard` — resumo do mês (receitas, despesas, saldo)
- [ ] Rota `GET /dashboard/graficos` — dados para gráficos
- [ ] Rota `GET /dashboard/orcamento` — orçamento vs gasto por categoria
- [ ] Plugin WebSocket no Fastify
- [ ] Emitir evento ao salvar/editar/excluir transação (UC32)
- [ ] Gerenciar rooms por `familia_id` no WebSocket

### Frontend
- [ ] Tela de Dashboard (tela principal)
- [ ] Cards de resumo: Receitas / Despesas / Saldo
- [ ] Gráfico de despesas por categoria (pizza/donut)
- [ ] Gráfico de evolução de gastos no mês (linha)
- [ ] Comparação com mês anterior
- [ ] Barras de progresso de orçamento com alertas visuais
- [ ] Conexão WebSocket no cliente
- [ ] Atualização automática do dashboard ao receber eventos

---

## Fase 6 — Orçamento e Relatórios

### Backend
- [ ] Rota `GET /orcamento` — listar orçamentos vigentes por categoria
- [ ] Rota `POST /orcamento/:categoriaId` — definir/alterar limite (UC19)
- [ ] Rota `GET /orcamento/:categoriaId/historico` — histórico de vigências
- [ ] Rota `GET /relatorios/distribuicao` — gastos por categoria (UC14)
- [ ] Rota `GET /relatorios/por-usuario` — gastos por membro
- [ ] Rota `GET /relatorios/tendencias` — comparação mensal e insights
- [ ] Rota `GET /cartoes/:id/fatura/:mesReferencia` — fatura do cartão (UC16)

### Frontend
- [ ] Tela de Orçamento (tabela categoria × limite × % utilizado)
- [ ] Formulário de edição de limite por categoria
- [ ] Histórico de alterações de limite
- [ ] Tela de Relatórios
- [ ] Gráfico de distribuição por categoria
- [ ] Breakdown por membro
- [ ] Tendências e insights automáticos
- [ ] Tela de Fatura do Cartão

---

## Fase 7 — Histórico e Snapshot

### Backend
- [ ] Rota `GET /historico` — listar meses com snapshots (UC15)
- [ ] Rota `GET /historico/:mesReferencia` — detalhe do mês
- [ ] Serviço de geração de snapshot mensal (UC27)
- [ ] Job agendado com node-cron (último dia do mês)
- [ ] Serviço de marcação de divergência (UC28)
- [ ] Trigger de divergência ao editar/excluir transação de mês com snapshot

### Frontend
- [ ] Tela de Histórico de Meses
- [ ] Gráfico de tendência (receita × despesa × saldo)
- [ ] Lista de meses com indicador de divergência
- [ ] Detalhe do mês: relatório completo + comparação snapshot vs atual

---

## Fase 8 — PWA e Guia In-App

### PWA
- [ ] Configurar vite-plugin-pwa (manifest + service worker)
- [ ] Ícones para instalação (192x192, 512x512)
- [ ] Estratégia de cache (assets estáticos)
- [ ] Suporte a instalação no celular (add to home screen)
- [ ] Testar offline básico

### Guia In-App
- [ ] Componente de First-time Tour (por tela, flag por usuário)
- [ ] Tours: Dashboard, Modal de Transação, Orçamento, Extrato, Histórico
- [ ] Componente de Tooltip contextual ("?")
- [ ] Tooltips: mês de referência, parcelado, recorrente, divergente
- [ ] Empty states educativos em todas as telas
- [ ] Tela de Ajuda / FAQ (Configurações > Ajuda)

---

## Fase 9 — System Admin e Polimento

- [ ] Interface administrativa para System Admin
- [ ] Rota de recuperação de família excluída (UC25)
- [ ] Rota de impersonação de usuário (UC26)
- [ ] Tela de Configurações gerais (perfil, conta)
- [ ] Revisão de mensagens de erro e feedback visual
- [ ] Testes de carga básicos no Raspberry Pi
- [ ] Revisão de segurança (isolamento multi-tenant)
- [ ] Documentação de uso (README atualizado)
