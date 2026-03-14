# Fase 5 — Dashboard e Tempo Real: Design

**Data:** 2026-03-14
**Escopo:** Fase 5 do NossaGrana — Dashboard financeiro + sincronização via WebSocket

---

## Contexto

O NossaGrana possui as Fases 0–4 completas. A Fase 5 adiciona:
- Tela principal de Dashboard com resumo financeiro e gráficos
- Sincronização em tempo real entre membros da mesma família via WebSocket

Stack existente relevante: Fastify + Drizzle ORM + PostgreSQL no backend; React + Zustand + Tailwind no frontend. Plugin `@fastify/websocket` já registrado, mas sem handlers.

---

## Backend

### Módulo `dashboard`

Novo módulo em `apps/api/src/modules/dashboard/` seguindo o padrão `routes → service → repository`.

#### Rotas

Todas requerem JWT válido e filtram obrigatoriamente por `familia_id` do usuário autenticado.

**`GET /api/dashboard`**
- Query param opcional: `mesReferencia` (formato `YYYY-MM`, default: mês atual)
- Retorna:
  ```ts
  {
    mesReferencia: string;
    totalReceitas: string;
    totalDespesas: string;
    saldo: string;
    mesAnterior: {
      totalReceitas: string;
      totalDespesas: string;
      saldo: string;
    };
  }
  ```

**`GET /api/dashboard/graficos`**
- Query param opcional: `mesReferencia`
- Retorna:
  ```ts
  {
    distribuicaoCategorias: Array<{
      categoriaId: string;
      categoriaNome: string;
      total: string;
      percentual: number;
    }>;
    evolucaoDiaria: Array<{
      dia: string; // "YYYY-MM-DD"
      totalDespesas: string;
      totalReceitas: string;
    }>;
  }
  ```

**`GET /api/dashboard/orcamento`**
- Query param opcional: `mesReferencia`
- Retorna orçamento vigente cruzado com gastos do mês:
  ```ts
  Array<{
    categoriaId: string;
    categoriaNome: string;
    valorLimite: string;
    totalGasto: string;
    percentual: number; // totalGasto / valorLimite * 100
    status: 'ok' | 'warning' | 'exceeded'; // <80% | >=80% | >=100%
  }>
  ```

#### WebSocket — Rooms por família

**`WebSocketManager`** — classe singleton decorada no Fastify via plugin:
- Mantém `Map<familiaId, Set<WebSocket>>` em memória
- Métodos: `join(familiaId, ws)`, `leave(familiaId, ws)`, `broadcast(familiaId, payload)`
- Limpeza automática ao fechar conexão

**Rota WebSocket:** `GET /api/ws`
- Requer JWT via query param `?token=<accessToken>` (WebSocket não suporta headers customizados)
- Ao conectar: registra socket no room da `familia_id` do usuário
- Ao desconectar: remove do room

**Evento emitido ao mutacionar transação:**
```json
{ "tipo": "transacao:alterada", "familiaId": "uuid" }
```
O cliente refaz fetch do dashboard ao receber — sem dados completos no payload.

**Pontos de emissão:** `transacaoService.create`, `transacaoService.update`, `transacaoService.delete` — injetam o `WebSocketManager` e chamam `broadcast` após persistência bem-sucedida.

---

## Frontend

### Biblioteca de gráficos

**Chart.js + react-chartjs-2** — instalação via `pnpm --filter web add chart.js react-chartjs-2`.

### `DashboardPage`

Substitui a `HomePage` atual (menu simples). Layout B aprovado:

```
┌─────────────────────────────────────────────┐
│  NossaGrana          Março 2026    [+ Nova] │
├──────────────────┬──────────────────────────┤
│  RECEITAS        │                          │
│  R$ 5.200        │    Donut chart           │
│  DESPESAS        │   (por categoria)        │
│  R$ 3.800        │                          │
│  SALDO           │                          │
│  R$ 1.400        │                          │
├──────────────────┴──────────────────────────┤
│   Linha — evolução de gastos no mês         │
├─────────────────────────────────────────────┤
│  ORÇAMENTO                                  │
│  Alimentação ████░░  60%  R$600/R$1000      │
│  Lazer       ███████ 85%  R$850/R$1000  ⚠️  │
│  Transporte  ████████103% R$515/R$500   🔴  │
└─────────────────────────────────────────────┘
```

**Cores de orçamento** (conforme PRD):
- `< 80%` → verde (`success`)
- `>= 80%` → amarelo (`warning`)
- `>= 100%` → vermelho (`danger`)

**Comparação com mês anterior:** exibida nos cards de resumo como delta percentual (ex: `↑ 12% vs mês anterior`).

### `useWebSocketStore` (Zustand)

```ts
interface WebSocketStore {
  socket: WebSocket | null;
  connect: (token: string, familiaId: string) => void;
  disconnect: () => void;
}
```

- `connect`: abre `WebSocket` para `/api/ws?token=<token>`, registra handler `onmessage`
- Ao receber `{ tipo: "transacao:alterada" }`: chama `fetchDashboard()` do `useDashboardStore`
- `disconnect`: fecha socket e limpa referência
- Chamado no login/logout via `AuthContext` ou `useAuthStore`

### `useDashboardStore` (Zustand)

Gerencia estado e fetches das 3 rotas do dashboard:
- `fetchDashboard()`, `fetchGraficos()`, `fetchOrcamento()`
- Estados: `loading`, `error`, dados das 3 rotas
- `fetchAll()` dispara as 3 em paralelo (`Promise.all`)

### Navegação

`App.tsx` adiciona screen `'dashboard'` que renderiza `DashboardPage`. A screen `'home'` é removida ou passa a ser `'dashboard'`. Rota de login redireciona para `'dashboard'`.

---

## Testes

### Backend
- `dashboard.repository.test.ts` — queries de agregação por `familia_id` e `mes_referencia`
- `dashboard.service.test.ts` — lógica de cálculo de percentual, status de orçamento, delta mês anterior
- `app.test.ts` — rotas GET com JWT válido/inválido e sem dados (arrays vazios)
- WebSocket: teste de integração de join/leave/broadcast no `WebSocketManager`

### Frontend
- `dashboard-page.test.tsx` — mock das stores, renderiza cards e seções de orçamento
- `use-websocket-store.test.ts` — simula mensagem recebida e verifica chamada a `fetchDashboard`

---

## Fora de Escopo (Fase 5)

- Orçamento CRUD (Fase 6)
- Histórico/snapshots (Fase 7)
- Relatórios (Fase 6)
