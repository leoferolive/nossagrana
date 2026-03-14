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

Os handlers de rota são registrados **sem** prefixo `/api` no arquivo de rotas (ex: `/dashboard`, `/dashboard/graficos`). O prefixo `/api` é aplicado no `app.ts` via `{ prefix: '/api' }`, conforme padrão existente em `transacao.routes.ts`.

#### Timezone

`mesReferencia` default (mês atual) é calculado no timezone **America/Sao_Paulo** (UTC-3). Isso evita que às 00:30 UTC (21:30 horário local) o servidor retorne dados do mês seguinte. Implementação: `Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' })` para obter ano/mês corrente.

#### Rotas

Todas requerem JWT válido (`fastify.authenticate`) e `familia_id` via header `X-Familia-Id` (`fastify.requireFamiliaScope`), seguindo o padrão existente.

---

**`GET /dashboard`**

Query param opcional: `mesReferencia` (formato `YYYY-MM`, default: mês atual em America/Sao_Paulo).

- Dados do mês atual: agrega `transacoes` em tempo real (sem snapshot — dashboard não depende de snapshot).
- Dados do mês anterior (`mesAnterior`): usa `snapshots_mensais` se existir registro para aquele mês; caso contrário, re-agrega de `transacoes`. Isso preserva consistência histórica quando o snapshot existe.

Resposta:
```ts
{
  mesReferencia: string;          // "YYYY-MM"
  totalReceitas: string;          // decimal como string
  totalDespesas: string;
  saldo: string;
  mesAnterior: {
    mesReferencia: string;
    totalReceitas: string;
    totalDespesas: string;
    saldo: string;
    fonteSnapshot: boolean;       // true se veio de snapshot, false se re-agregado
  } | null;                       // null se não houver dados nem snapshot
}
```

---

**`GET /dashboard/graficos`**

Query param opcional: `mesReferencia`.

- `distribuicaoCategorias`: filtra apenas transações do tipo `despesa`. Retorna array ordenado por `total` decrescente. Se não houver despesas no mês, retorna `[]`. O campo `percentual` é calculado como `(total / somaTotalDespesas) * 100`; quando `somaTotalDespesas = 0`, o array é `[]` e a divisão por zero nunca ocorre — a guard está no service, não só no output.
- `evolucaoDiaria`: array **denso** com todos os dias do mês (1 até último dia). Dias sem transações aparecem com `"0.00"`. Isso evita gaps no gráfico de linha do Chart.js.

Resposta:
```ts
{
  distribuicaoCategorias: Array<{
    categoriaId: string;
    categoriaNome: string;
    total: string;
    percentual: number;           // 0–100, arredondado 1 casa decimal
  }>;
  evolucaoDiaria: Array<{
    dia: string;                  // "YYYY-MM-DD"
    totalDespesas: string;        // "0.00" se sem transações
    totalReceitas: string;
  }>;
}
```

---

**`GET /dashboard/orcamento`**

Query param opcional: `mesReferencia`.

Filtra orçamentos vigentes: `vigencia_inicio <= mesReferencia AND (vigencia_fim IS NULL OR vigencia_fim >= mesReferencia)`.

Cruza com gastos reais do mês (soma de despesas por categoria). Se categoria tiver orçamento mas zero gastos, retorna `totalGasto: "0.00"` e `percentual: 0`.

Se a família não tiver orçamentos configurados para o mês, retorna `[]` (array vazio — frontend exibe estado vazio).

Resposta:
```ts
Array<{
  categoriaId: string;
  categoriaNome: string;
  valorLimite: string;
  totalGasto: string;
  percentual: number;             // totalGasto / valorLimite * 100
  status: 'ok' | 'warning' | 'exceeded'; // <80% | >=80% | >=100%
}>
```

---

### WebSocket

#### Autenticação e identificação da família

A rota WebSocket não pode receber headers customizados em browsers. Portanto usa query params:

```
GET /ws?token=<accessToken>&familiaId=<uuid>
```

O servidor:
1. Valida o JWT (`token`) — fecha com código `4001` se inválido/expirado
2. Verifica que o usuário é membro da família (`familiaId`) — fecha com `4003` se não autorizado
3. Registra o socket no room da família

A validação ocorre **apenas no handshake** (connect time). Após conexão estabelecida, o token não é re-verificado periodicamente — o cliente é responsável por reconectar com token fresco.

#### Reconexão no cliente

Ao receber evento `close`, o cliente (`useWebSocketStore`):
1. Lê o `accessToken` atual diretamente do `AuthContext` via `getAccessToken()` (closure injetada em `connect`) — o `ApiClient` já pode ter renovado o token via sua lógica interna de refresh-on-401; não há segundo caminho de refresh independente
2. Reconecta com back-off exponencial (100ms, 200ms, 400ms, máx 5 tentativas) usando o token disponível no momento de cada tentativa
3. Se o handshake falhar com `4001` (token expirado) em todas as tentativas, chama `clearSession()` (também injetada) para fazer logout coordenado — o mesmo fluxo que o `ApiClient` executa em falha de refresh

#### `WebSocketManager`

Classe singleton decorada no Fastify como `fastify.wsManager`:

```ts
class WebSocketManager {
  private rooms: Map<string, Set<WebSocket>>;
  join(familiaId: string, ws: WebSocket): void;
  leave(familiaId: string, ws: WebSocket): void;
  broadcast(familiaId: string, payload: object): void;
}
```

- `broadcast` ignora sockets com `readyState !== WebSocket.OPEN` (evita erro em conexões zombie)
- **Heartbeat:** servidor envia `ping` a cada 30s para todos os sockets. Sockets que não responderem com `pong` em 10s são removidos do room e fechados. Isso resolve conexões half-open (mobile network drop).

#### Desacoplamento: emissão de eventos via EventEmitter

Para evitar acoplar `TransacaoService` à camada de transporte, o Fastify instancia um `EventEmitter` interno (`fastify.eventBus`). O `TransacaoService` não conhece o `WebSocketManager`.

Fluxo:
1. Rota de transação chama `transacaoService.create/update/delete`
2. **A rota** (não o service) emite `eventBus.emit('transacao:alterada', { familiaId })`
3. O plugin WebSocket escuta `eventBus.on('transacao:alterada', ...)` e chama `wsManager.broadcast`

Isso preserva os testes existentes de `TransacaoService` sem modificações.

#### Rota WebSocket

Registrada em novo arquivo `ws.routes.ts` como `GET /ws` (prefixo `/api` aplicado em `app.ts`).

A rota **não reutiliza** `fastify.authenticate` nem `fastify.requireFamiliaScope` — ambos operam sobre headers HTTP que browsers não podem enviar em WebSocket. Em vez disso, o handler realiza inline:
1. `fastify.jwt.verify(token)` sobre o query param `token`
2. Consulta de membership equivalente ao `requireFamiliaScope`, porém lendo `familiaId` do query param

Em `NODE_ENV=test`, o handler usa um stub mockado que aceita qualquer UUID válido como `familiaId`, seguindo o mesmo padrão do `familiaScopePlugin` (que bypassa o check de DB em test mode).

#### Evento emitido aos clientes

```json
{ "tipo": "transacao:alterada", "familiaId": "uuid" }
```

O cliente ao receber refaz `fetchAll()` do `useDashboardStore`. Payload minimalista — sem dados da transação.

---

## Frontend

### Dependências

```bash
pnpm --filter web add chart.js react-chartjs-2
```

### `DashboardPage`

Substitui a `HomePage` atual (menu simples → dashboard real). Layout B aprovado:

```
┌─────────────────────────────────────────────┐
│  NossaGrana          Março 2026    [+ Nova] │
├──────────────────┬──────────────────────────┤
│  RECEITAS        │                          │
│  R$ 5.200        │    Donut chart           │
│  DESPESAS        │   (despesas/categoria)   │
│  R$ 3.800        │                          │
│  SALDO           │                          │
│  R$ 1.400        │                          │
├──────────────────┴──────────────────────────┤
│   Linha — evolução de gastos/receitas mês   │
├─────────────────────────────────────────────┤
│  ORÇAMENTO                                  │
│  Alimentação ████░░  60%  R$600/R$1000      │
│  Lazer       ███████ 85%  R$850/R$1000  ⚠️  │
│  Transporte  ████████103% R$515/R$500   🔴  │
└─────────────────────────────────────────────┘
```

**Cores de orçamento:**
- `< 80%` → classe `success` (verde)
- `>= 80%` → classe `warning` (amarelo)
- `>= 100%` → classe `danger` (vermelho)

**Comparação com mês anterior:** exibida nos cards como delta (ex: `↑ 12% vs fev`). Se `mesAnterior` for `null`, delta não é exibido.

**Estados vazios:**
- Sem transações no mês → cards mostram `R$ 0,00`, gráficos exibem mensagem "Nenhuma transação registrada"
- Sem orçamentos configurados → seção de orçamento exibe "Nenhum orçamento configurado. Configure na tela de Orçamento."

### `useDashboardStore` (Zustand)

```ts
interface DashboardStore {
  resumo: DashboardResumo | null;
  graficos: DashboardGraficos | null;
  orcamento: DashboardOrcamento[];
  loading: boolean;
  error: string | null;
  fetchAll(mesReferencia?: string): Promise<void>;
}
```

`fetchAll` dispara as 3 chamadas em paralelo via `Promise.all`.

### `familiaId` no estado do cliente

O `AuthContext` existente armazena apenas `accessToken` e `refreshToken`. Para suportar a Fase 5, o `login()` do `AuthContext` passa a aceitar também `familiaIdAtiva: string`, que é persistida junto com os tokens no `localStorage`. Isso torna o `familiaId` disponível para `useWebSocketStore` e para os headers `X-Familia-Id` de todas as chamadas HTTP, sem criar um segundo store.

### `useWebSocketStore` (Zustand)

```ts
interface WebSocketStore {
  socket: WebSocket | null;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  // Closures injetadas ao inicializar (via useEffect no AuthProvider)
  connect(opts: {
    getAccessToken: () => string | null;
    familiaId: string;
    clearSession: () => void;
  }): void;
  disconnect(): void;
}
```

- `connect`: abre `WebSocket` para `${WS_URL}/api/ws?token=<token>&familiaId=<familiaId>`, onde `token` é obtido chamando `getAccessToken()` no momento de cada tentativa (token pode ter sido renovado pelo `ApiClient`)
- Ao receber `{ tipo: "transacao:alterada" }`: chama `useDashboardStore.getState().fetchAll()`
- Ao receber `close`: executa reconexão com back-off exponencial; esgotadas as tentativas, chama `clearSession()` para logout coordenado
- `disconnect`: fecha socket, limpa back-off timers

**Quando é chamado:** `AuthProvider` usa `useEffect` para observar mudanças em `isAuthenticated`. Ao logar → `useWebSocketStore.connect(...)`. Ao deslogar → `useWebSocketStore.disconnect()`. Isso mantém o WebSocket alinhado ao ciclo de auth sem criar dependências circulares entre stores.

### Navegação

`App.tsx` renomeia screen `'home'` para `'dashboard'` e renderiza `DashboardPage`. Login redireciona para `'dashboard'`.

---

## Testes

### Backend

**`dashboard.repository.test.ts`**
- Agregação de receitas/despesas/saldo por `familia_id` e `mes_referencia`
- `evolucaoDiaria` retorna array denso com zeros para dias sem transação
- `distribuicaoCategorias` filtra apenas `despesa`
- Orçamento: filtro de vigência correto (`vigencia_inicio <= mes AND vigencia_fim IS NULL OR >= mes`)
- `mesAnterior`: usa snapshot quando disponível; re-agrega quando não há snapshot

**`dashboard.service.test.ts`**
- Cálculo de percentual e status (`ok` / `warning` / `exceeded`)
- Delta mês anterior: cálculo percentual e `null` quando sem dados
- Timezone: `mesReferencia` default em America/Sao_Paulo

**`app.test.ts` (rotas)**

Seguindo o padrão existente: testes usam `app.inject()` com `X-Familia-Id` como header. O `familiaScopePlugin` em `NODE_ENV=test` bypassa o check de DB e aceita qualquer UUID válido — o mesmo padrão atual em `transacao.routes.ts`. O `dashboard.repository` usa a mesma instância de `db` real (PostgreSQL em test) que os demais repositórios, sem need de `InMemoryDashboardRepository`.

Cenários:
- `GET /api/dashboard` com JWT válido + `X-Familia-Id` → 200
- `GET /api/dashboard` sem JWT → 401
- `GET /api/dashboard` sem `X-Familia-Id` → 400
- `GET /api/dashboard` com família sem transações → 200 com zeros e `mesAnterior: null`
- Mesmos cenários para `/graficos` e `/orcamento`
- `/orcamento` sem orçamentos configurados → 200 com `[]`

**`websocket-manager.test.ts`**
- `join` / `leave` / `broadcast` com sockets mockados
- `broadcast` ignora socket com `readyState !== OPEN`
- Token inválido no handshake → fecha com `4001`
- `familiaId` não autorizado → fecha com `4003`
- Heartbeat: socket que não responde pong é removido

### Frontend

**`dashboard-page.test.tsx`**
- Renderiza cards de resumo com dados mockados
- Exibe delta mês anterior quando disponível
- Estado vazio: sem transações → mensagem adequada
- Estado vazio: sem orçamentos → mensagem adequada
- Cores corretas nas barras de orçamento (ok / warning / exceeded)

**`use-websocket-store.test.ts`**
- Mensagem `transacao:alterada` aciona `fetchAll`
- Evento `close` aciona reconexão com back-off
- `disconnect` limpa socket e timers

---

## Fora de Escopo (Fase 5)

- Orçamento CRUD (Fase 6)
- Histórico/snapshots (Fase 7)
- Relatórios (Fase 6)
- Fatura de cartão (Fase 6)
