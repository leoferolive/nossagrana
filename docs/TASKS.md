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

- [x] Rota `POST /familias` — criar família (UC05)
- [x] Rota `POST /familias/convites` — gerar código de convite (UC21)
- [x] Rota `POST /familias/entrar/:codigo` — entrar via convite (UC03)
- [x] Rota `POST /familias/solicitar` — solicitar entrada (UC04)
- [x] Rota `GET /familias/solicitacoes` — listar solicitações pendentes (Admin)
- [x] Rota `PATCH /familias/solicitacoes/:id` — aprovar/rejeitar (UC22)
- [x] Rota `GET /familias/:id/membros` — listar membros
- [x] Rota `DELETE /familias/:id/membros/:usuarioId` — remover membro (UC23)
- [x] Rota `DELETE /familias/:id` — excluir família (UC24)
- [x] Rota `POST /familias/alternar` — alternar família ativa (UC20)

### Frontend

- [x] Fluxo de onboarding pós-cadastro (criar família / entrar com convite / buscar família e solicitar)
- [x] Tela de configurações da família (Admin)
- [x] Listagem de membros com opção de remoção
- [x] Gestão de solicitações pendentes (Admin)
- [x] Geração e compartilhamento de código de convite
- [x] Seletor de família ativa (para usuários com múltiplas famílias)

---

## Fase 4 — Core Financeiro

### Backend

- [x] Rota `GET /categorias` — listar categorias da família
- [x] Rota `POST /categorias` — criar categoria (UC17)
- [x] Rota `PATCH /categorias/:id` — editar categoria
- [x] Rota `DELETE /categorias/:id` — desativar categoria (soft delete)
- [x] Seed de categorias padrão ao criar família
- [x] Rota `GET /metodos-pagamento` — listar métodos da família
- [x] Rota `POST /metodos-pagamento` — cadastrar método (UC18)
- [x] Rota `PATCH /metodos-pagamento/:id` — editar método
- [x] Rota `DELETE /metodos-pagamento/:id` — desativar método
- [x] Serviço de cálculo de mês de referência (UC31)
- [x] Rota `POST /transacoes` — registrar transação simples (UC06)
- [x] Serviço de geração de parcelas futuras (UC07 + UC29)
- [x] Serviço de geração de recorrências futuras (UC08 + UC30)
- [x] Rota `GET /transacoes` — listar transações com filtros (UC13)
- [x] Rota `GET /transacoes/:id` — detalhe da transação
- [x] Rota `PATCH /transacoes/:id` — editar transação (UC09)
- [x] Rota `DELETE /transacoes/:id` — excluir transação (UC10)
- [x] Rota `POST /transacoes/:id/antecipar` — antecipar parcelas (UC11)

### Frontend

- [x] Ação de nova transação sempre visível (`+`) em telas principais (FAB no mobile, botão fixo no desktop)
- [x] Campos: tipo, valor, categoria, descrição, data, método de pagamento
- [x] Toggle parcelado (nº de parcelas + cálculo de valor da parcela)
- [x] Toggle recorrente (frequência + data fim opcional)
- [x] Tela de Extrato com lista cronológica
- [x] Filtros de extrato: tipo (receita/despesa)
- [x] Detalhe da transação (modal de visualização)
- [x] Identificação visual de parcelas ("Parcela X/N") e recorrentes
- [x] Tela de Categorias (listar, criar, editar, desativar)
- [x] Tela de Cartões / Métodos de Pagamento

---

## Fase 5 — Dashboard e Tempo Real

### Backend

- [x] Rota `GET /dashboard` — resumo do mês (receitas, despesas, saldo)
- [x] Rota `GET /dashboard/graficos` — dados para gráficos
- [x] Rota `GET /dashboard/orcamento` — orçamento vs gasto por categoria
- [x] Plugin WebSocket no Fastify
- [x] Emitir evento ao salvar/editar/excluir transação (UC32)
- [x] Gerenciar rooms por `familia_id` no WebSocket

### Frontend

- [x] Tela de Dashboard (tela principal)
- [x] Cards de resumo: Receitas / Despesas / Saldo
- [x] Gráfico de despesas por categoria (pizza/donut)
- [x] Gráfico de evolução de gastos no mês (linha)
- [x] Comparação com mês anterior
- [x] Barras de progresso de orçamento com alertas visuais
- [x] Conexão WebSocket no cliente
- [x] Atualização automática do dashboard ao receber eventos

---

## Fase 6 — Orçamento e Relatórios

### Backend

- [x] Rota `GET /orcamento` — listar orçamentos vigentes por categoria
- [x] Rota `POST /orcamento/:categoriaId` — definir/alterar limite (UC19)
- [x] Rota `GET /orcamento/:categoriaId/historico` — histórico de vigências
- [x] Rota `GET /relatorios/distribuicao` — gastos por categoria (UC14)
- [x] Rota `GET /relatorios/por-usuario` — gastos por membro
- [x] Rota `GET /relatorios/tendencias` — comparação mensal e insights
- [x] Rota `GET /cartoes/:id/fatura/:mesReferencia` — fatura do cartão (UC16)

### Frontend

- [x] Tela de Orçamento (tabela categoria × limite × % utilizado)
- [x] Formulário de edição de limite por categoria
- [x] Histórico de alterações de limite
- [x] Tela de Relatórios
- [x] Gráfico de distribuição por categoria
- [x] Breakdown por membro
- [x] Tendências e insights automáticos
- [x] Tela de Fatura do Cartão

---

## Fase 7 — Histórico e Snapshot

### Backend

- [x] Rota `GET /historico` — listar meses com snapshots (UC15)
- [x] Rota `GET /historico/:mesReferencia` — detalhe do mês
- [x] Serviço de geração de snapshot mensal (UC27)
- [x] Job agendado com node-cron (último dia do mês)
- [x] Serviço de marcação de divergência (UC28)
- [x] Trigger de divergência ao editar/excluir transação de mês com snapshot

### Frontend

- [x] Tela de Histórico de Meses
- [x] Gráfico de tendência (receita × despesa × saldo)
- [x] Lista de meses com indicador de divergência
- [x] Detalhe do mês: relatório completo + comparação snapshot vs atual

---

## Fase 8 — PWA e Guia In-App

### PWA

- [x] Configurar vite-plugin-pwa (manifest + service worker)
- [x] Ícones para instalação (192x192, 512x512)
- [x] Estratégia de cache (assets estáticos)
- [x] Suporte a instalação no celular (add to home screen)
- [ ] Testar offline básico

### Guia In-App

- [x] Componente de First-time Tour (por tela, flag por usuário)
- [x] Tours: Dashboard, Modal de Transação, Orçamento, Extrato, Histórico
- [x] Componente de Tooltip contextual ("?")
- [x] Tooltips: mês de referência, parcelado, recorrente, divergente
- [x] Empty states educativos em todas as telas
- [x] Tela de Ajuda / FAQ (Configurações > Ajuda)

---

## Fase 9 — System Admin e Polimento

- [x] Interface administrativa para System Admin
- [x] Rota de recuperação de família excluída (UC25)
- [x] Rota de impersonação de usuário (UC26)
- [x] Definir e aplicar design tokens globais (paleta semântica, tipografia, espaçamento, raio e sombras) no frontend
- [x] Padronizar biblioteca de ícones e mapear ícones por domínio/tela (dashboard, extrato, orçamento, família, ajuda)
- [x] Hub de Configurações (mobile): atalhos para categorias, cartões/pagamentos, orçamento, família, histórico, perfil e ajuda
- [x] Tela de Configurações gerais (perfil, conta)
- [x] Revisão de mensagens de erro e feedback visual
- [ ] Testes de carga básicos no Raspberry Pi
- [x] Revisão de segurança (isolamento multi-tenant)
- [x] Documentação de uso (README atualizado)
