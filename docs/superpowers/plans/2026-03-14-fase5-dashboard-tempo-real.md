# Fase 5 — Dashboard e Tempo Real: Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar Dashboard financeiro com resumo, gráficos (Chart.js) e sincronização em tempo real via WebSocket, seguindo TDD e o padrão do projeto.

**Architecture:** Módulo `dashboard` no backend com 3 rotas REST (resumo, gráficos, orçamento) + infraestrutura WebSocket com `WebSocketManager`, `eventBus` (EventEmitter) e rota `GET /api/ws`. Frontend: `DashboardPage` substitui `HomePage`, com `useDashboardStore` e `useWebSocketStore` Zustand.

**Tech Stack:** Fastify + Drizzle ORM + PostgreSQL; React + Zustand + Chart.js + react-chartjs-2 + Tailwind; Vitest para testes.

**Spec:** `docs/superpowers/specs/2026-03-14-fase5-dashboard-tempo-real-design.md`

---

## Mapa de arquivos

### Criar
- `packages/types/src/index.ts` — adicionar schemas Zod de dashboard (DashboardResumo, DashboardGraficos, DashboardOrcamentoItem)
- `apps/api/src/modules/dashboard/dashboard.types.ts` — interfaces TS do módulo
- `apps/api/src/modules/dashboard/dashboard.repository.ts` — DrizzleDashboardRepository + InMemoryDashboardRepository
- `apps/api/src/modules/dashboard/dashboard.repository.test.ts`
- `apps/api/src/modules/dashboard/dashboard.service.ts` — DashboardService
- `apps/api/src/modules/dashboard/dashboard.service.test.ts`
- `apps/api/src/modules/dashboard/dashboard.schema.ts` — schemas Zod de rota
- `apps/api/src/modules/dashboard/dashboard.routes.ts`
- `apps/api/src/modules/ws/websocket-manager.ts` — WebSocketManager class
- `apps/api/src/modules/ws/websocket-manager.test.ts`
- `apps/api/src/modules/ws/ws.routes.ts` — rota GET /ws
- `apps/api/src/modules/ws/ws.routes.test.ts` — testes de autenticação WebSocket
- `apps/web/src/stores/dashboard.store.ts`
- `apps/web/src/stores/dashboard.store.test.ts`
- `apps/web/src/stores/websocket.store.ts`
- `apps/web/src/stores/websocket.store.test.ts`
- `apps/web/src/pages/dashboard-page.tsx`
- `apps/web/src/pages/dashboard-page.test.tsx`

### Modificar
- `apps/api/src/plugins/websocket.plugin.ts` — registrar eventBus + heartbeat
- `apps/api/src/app.ts` — registrar dashboardRoutes + wsRoutes
- `apps/api/src/app.test.ts` — adicionar testes de rota dashboard
- `apps/api/src/modules/transacao/transacao.routes.ts` — emitir eventBus após mutações
- `apps/web/src/contexts/auth-context-store.ts` — adicionar familiaIdAtiva ao AuthContextValue
- `apps/web/src/contexts/auth-context.tsx` — armazenar familiaIdAtiva, conectar WS
- `apps/web/src/App.tsx` — renomear 'home' → 'dashboard', renderizar DashboardPage

---

## Chunk 1: Backend — Módulo Dashboard

### Task 1: Tipos compartilhados em packages/types

**Files:**
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: Adicionar schemas Zod de Dashboard em packages/types**

Abrir `packages/types/src/index.ts` e acrescentar ao final:

```ts
// ─── Dashboard ────────────────────────────────────────────────────────────────

export const dashboardMesAnteriorSchema = z.object({
  mesReferencia: z.string(),
  totalReceitas: z.string(),
  totalDespesas: z.string(),
  saldo: z.string(),
  fonteSnapshot: z.boolean(),
});
export type DashboardMesAnterior = z.infer<typeof dashboardMesAnteriorSchema>;

export const dashboardResumoResponseSchema = z.object({
  mesReferencia: z.string(),
  totalReceitas: z.string(),
  totalDespesas: z.string(),
  saldo: z.string(),
  mesAnterior: dashboardMesAnteriorSchema.nullable(),
});
export type DashboardResumoResponse = z.infer<typeof dashboardResumoResponseSchema>;

export const dashboardDistribuicaoCategoriaSchema = z.object({
  categoriaId: z.string().uuid(),
  categoriaNome: z.string(),
  total: z.string(),
  percentual: z.number(),
});
export type DashboardDistribuicaoCategoria = z.infer<typeof dashboardDistribuicaoCategoriaSchema>;

export const dashboardEvolucaoDiariaSchema = z.object({
  dia: z.string(),
  totalDespesas: z.string(),
  totalReceitas: z.string(),
});
export type DashboardEvolucaoDiaria = z.infer<typeof dashboardEvolucaoDiariaSchema>;

export const dashboardGraficosResponseSchema = z.object({
  distribuicaoCategorias: z.array(dashboardDistribuicaoCategoriaSchema),
  evolucaoDiaria: z.array(dashboardEvolucaoDiariaSchema),
});
export type DashboardGraficosResponse = z.infer<typeof dashboardGraficosResponseSchema>;

export const dashboardOrcamentoItemSchema = z.object({
  categoriaId: z.string().uuid(),
  categoriaNome: z.string(),
  valorLimite: z.string(),
  totalGasto: z.string(),
  percentual: z.number(),
  status: z.enum(['ok', 'warning', 'exceeded']),
});
export type DashboardOrcamentoItem = z.infer<typeof dashboardOrcamentoItemSchema>;

export const dashboardOrcamentoResponseSchema = z.array(dashboardOrcamentoItemSchema);
export type DashboardOrcamentoResponse = z.infer<typeof dashboardOrcamentoResponseSchema>;

export const dashboardQuerySchema = z.object({
  mesReferencia: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
```

- [ ] **Step 2: Build do packages/types**

```bash
pnpm --filter @nossagrana/types build
```

Expected: sem erros de compilação.

- [ ] **Step 3: Commit**

```bash
git add packages/types/src/index.ts
git commit -m "feat(types): adicionar schemas Zod de Dashboard"
```

---

### Task 2: dashboard.types.ts

**Files:**
- Create: `apps/api/src/modules/dashboard/dashboard.types.ts`

- [ ] **Step 1: Criar arquivo de tipos**

```ts
// apps/api/src/modules/dashboard/dashboard.types.ts

export interface ResumoMes {
  totalReceitas: string;
  totalDespesas: string;
  saldo: string;
}

export interface SnapshotMes {
  totalReceitas: string;
  totalDespesas: string;
  saldo: string;
}

export interface CategoriaGasto {
  categoriaId: string;
  categoriaNome: string;
  total: string;
}

export interface DiaGasto {
  dia: string; // "YYYY-MM-DD"
  totalDespesas: string;
  totalReceitas: string;
}

export interface OrcamentoVigente {
  categoriaId: string;
  categoriaNome: string;
  valorLimite: string;
}

export interface GastoCategoria {
  categoriaId: string;
  totalGasto: string;
}

export interface DashboardRepository {
  getResumoMes(familiaId: string, mesReferencia: string): Promise<ResumoMes>;
  getSnapshotMes(familiaId: string, mesReferencia: string): Promise<SnapshotMes | null>;
  getDistribuicaoCategorias(familiaId: string, mesReferencia: string): Promise<CategoriaGasto[]>;
  getTransacoesPorDia(familiaId: string, mesReferencia: string): Promise<DiaGasto[]>;
  getOrcamentosVigentes(familiaId: string, mesReferencia: string): Promise<OrcamentoVigente[]>;
  getGastosPorCategoria(familiaId: string, mesReferencia: string): Promise<GastoCategoria[]>;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/dashboard/dashboard.types.ts
git commit -m "feat(dashboard): tipos do módulo dashboard"
```

---

### Task 3: InMemoryDashboardRepository + testes

**Files:**
- Create: `apps/api/src/modules/dashboard/dashboard.repository.ts`
- Create: `apps/api/src/modules/dashboard/dashboard.repository.test.ts`

- [ ] **Step 1: Escrever testes da InMemory (RED)**

```ts
// apps/api/src/modules/dashboard/dashboard.repository.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
}));
vi.mock('../../db/client.js', () => ({ db: mockDb }));

import {
  DrizzleDashboardRepository,
  InMemoryDashboardRepository,
} from './dashboard.repository.js';

describe('InMemoryDashboardRepository', () => {
  let repo: InMemoryDashboardRepository;

  beforeEach(() => {
    repo = new InMemoryDashboardRepository();
  });

  it('getResumoMes retorna zeros sem dados', async () => {
    const r = await repo.getResumoMes('f1', '2026-03');
    expect(r).toEqual({ totalReceitas: '0.00', totalDespesas: '0.00', saldo: '0.00' });
  });

  it('getResumoMes agrega receitas e despesas corretamente', async () => {
    repo.seed({
      transacoes: [
        { familiaId: 'f1', mesReferencia: '2026-03', tipo: 'receita', valor: '5000.00', data: '2026-03-05', categoriaId: 'c1' },
        { familiaId: 'f1', mesReferencia: '2026-03', tipo: 'despesa', valor: '1500.00', data: '2026-03-10', categoriaId: 'c2' },
        { familiaId: 'f1', mesReferencia: '2026-03', tipo: 'despesa', valor: '500.00', data: '2026-03-15', categoriaId: 'c1' },
        { familiaId: 'f2', mesReferencia: '2026-03', tipo: 'despesa', valor: '9999.00', data: '2026-03-01', categoriaId: 'c3' }, // outra familia
      ],
    });
    const r = await repo.getResumoMes('f1', '2026-03');
    expect(r.totalReceitas).toBe('5000.00');
    expect(r.totalDespesas).toBe('2000.00');
    expect(r.saldo).toBe('3000.00');
  });

  it('getSnapshotMes retorna null sem snapshot', async () => {
    const s = await repo.getSnapshotMes('f1', '2026-02');
    expect(s).toBeNull();
  });

  it('getSnapshotMes retorna snapshot quando existe', async () => {
    repo.seed({
      snapshots: [
        { familiaId: 'f1', mesReferencia: '2026-02', totalReceitas: '4000.00', totalDespesas: '3000.00', saldo: '1000.00' },
      ],
    });
    const s = await repo.getSnapshotMes('f1', '2026-02');
    expect(s).toMatchObject({ totalReceitas: '4000.00', totalDespesas: '3000.00', saldo: '1000.00' });
  });

  it('getDistribuicaoCategorias retorna apenas despesas, ordenadas por total desc', async () => {
    repo.seed({
      transacoes: [
        { familiaId: 'f1', mesReferencia: '2026-03', tipo: 'despesa', valor: '100.00', data: '2026-03-01', categoriaId: 'c1', categoriaNome: 'Alimentação' },
        { familiaId: 'f1', mesReferencia: '2026-03', tipo: 'despesa', valor: '400.00', data: '2026-03-02', categoriaId: 'c2', categoriaNome: 'Lazer' },
        { familiaId: 'f1', mesReferencia: '2026-03', tipo: 'receita', valor: '5000.00', data: '2026-03-01', categoriaId: 'c3', categoriaNome: 'Salário' },
      ],
    });
    const dist = await repo.getDistribuicaoCategorias('f1', '2026-03');
    expect(dist).toHaveLength(2);
    expect(dist[0].categoriaId).toBe('c2'); // maior primeiro
    expect(dist[0].total).toBe('400.00');
    expect(dist[1].total).toBe('100.00');
  });

  it('getDistribuicaoCategorias retorna [] sem despesas', async () => {
    const dist = await repo.getDistribuicaoCategorias('f1', '2026-03');
    expect(dist).toEqual([]);
  });

  it('getTransacoesPorDia retorna sparse (só dias com transações)', async () => {
    repo.seed({
      transacoes: [
        { familiaId: 'f1', mesReferencia: '2026-03', tipo: 'despesa', valor: '100.00', data: '2026-03-05', categoriaId: 'c1' },
        { familiaId: 'f1', mesReferencia: '2026-03', tipo: 'receita', valor: '200.00', data: '2026-03-05', categoriaId: 'c2' },
        { familiaId: 'f1', mesReferencia: '2026-03', tipo: 'despesa', valor: '50.00', data: '2026-03-10', categoriaId: 'c1' },
      ],
    });
    const dias = await repo.getTransacoesPorDia('f1', '2026-03');
    const dia5 = dias.find((d) => d.dia === '2026-03-05');
    const dia10 = dias.find((d) => d.dia === '2026-03-10');
    expect(dia5?.totalDespesas).toBe('100.00');
    expect(dia5?.totalReceitas).toBe('200.00');
    expect(dia10?.totalDespesas).toBe('50.00');
    expect(dias.length).toBe(2); // sparse — apenas dias com atividade; o DashboardService densifica
  });

  it('getOrcamentosVigentes filtra por vigência', async () => {
    repo.seed({
      orcamentos: [
        { familiaId: 'f1', categoriaId: 'c1', categoriaNome: 'Alimentação', valorLimite: '1000.00', vigenciaInicio: '2026-01', vigenciaFim: null },
        { familiaId: 'f1', categoriaId: 'c2', categoriaNome: 'Lazer', valorLimite: '500.00', vigenciaInicio: '2026-01', vigenciaFim: '2026-02' }, // expirado
        { familiaId: 'f1', categoriaId: 'c3', categoriaNome: 'Transporte', valorLimite: '300.00', vigenciaInicio: '2026-04', vigenciaFim: null }, // futuro
      ],
    });
    const orcamentos = await repo.getOrcamentosVigentes('f1', '2026-03');
    expect(orcamentos).toHaveLength(1);
    expect(orcamentos[0].categoriaId).toBe('c1');
  });

  it('getGastosPorCategoria agrega despesas por categoria no mês', async () => {
    repo.seed({
      transacoes: [
        { familiaId: 'f1', mesReferencia: '2026-03', tipo: 'despesa', valor: '300.00', data: '2026-03-01', categoriaId: 'c1' },
        { familiaId: 'f1', mesReferencia: '2026-03', tipo: 'despesa', valor: '200.00', data: '2026-03-10', categoriaId: 'c1' },
        { familiaId: 'f1', mesReferencia: '2026-03', tipo: 'despesa', valor: '100.00', data: '2026-03-15', categoriaId: 'c2' },
        { familiaId: 'f1', mesReferencia: '2026-03', tipo: 'receita', valor: '999.00', data: '2026-03-01', categoriaId: 'c1' }, // ignorar receita
      ],
    });
    const gastos = await repo.getGastosPorCategoria('f1', '2026-03');
    const c1 = gastos.find((g) => g.categoriaId === 'c1');
    expect(c1?.totalGasto).toBe('500.00');
  });
});

describe('DrizzleDashboardRepository — wiring', () => {
  it('getResumoMes chama db.select', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ totalReceitas: '0', totalDespesas: '0' }]),
      }),
    });
    const repo = new DrizzleDashboardRepository();
    await expect(repo.getResumoMes('f1', '2026-03')).resolves.toBeDefined();
  });
});
```

- [ ] **Step 2: Rodar testes para confirmar RED**

```bash
pnpm --filter api test -- --reporter=verbose dashboard.repository
```

Expected: FAIL — "Cannot find module './dashboard.repository.js'"

- [ ] **Step 3: Criar dashboard.repository.ts**

```ts
// apps/api/src/modules/dashboard/dashboard.repository.ts
import { and, eq, gte, lte, or, sql } from 'drizzle-orm';

import { db } from '../../db/client.js';
import { categorias, orcamentoCategoria, snapshotsMensais, transacoes } from '../../db/schema.js';
import type {
  CategoriaGasto,
  DashboardRepository,
  DiaGasto,
  GastoCategoria,
  OrcamentoVigente,
  ResumoMes,
  SnapshotMes,
} from './dashboard.types.js';

// ─── InMemory ─────────────────────────────────────────────────────────────────

interface SeedTransacao {
  familiaId: string;
  mesReferencia: string;
  tipo: 'receita' | 'despesa';
  valor: string;
  data: string;
  categoriaId: string;
  categoriaNome?: string;
}

interface SeedSnapshot {
  familiaId: string;
  mesReferencia: string;
  totalReceitas: string;
  totalDespesas: string;
  saldo: string;
}

interface SeedOrcamento {
  familiaId: string;
  categoriaId: string;
  categoriaNome: string;
  valorLimite: string;
  vigenciaInicio: string;
  vigenciaFim: string | null;
}

interface SeedData {
  transacoes?: SeedTransacao[];
  snapshots?: SeedSnapshot[];
  orcamentos?: SeedOrcamento[];
}

export class InMemoryDashboardRepository implements DashboardRepository {
  private _transacoes: SeedTransacao[] = [];
  private _snapshots: SeedSnapshot[] = [];
  private _orcamentos: SeedOrcamento[] = [];

  seed(data: SeedData) {
    if (data.transacoes) this._transacoes.push(...data.transacoes);
    if (data.snapshots) this._snapshots.push(...data.snapshots);
    if (data.orcamentos) this._orcamentos.push(...data.orcamentos);
  }

  async getResumoMes(familiaId: string, mesReferencia: string): Promise<ResumoMes> {
    const ts = this._transacoes.filter(
      (t) => t.familiaId === familiaId && t.mesReferencia === mesReferencia,
    );
    let totalReceitas = 0;
    let totalDespesas = 0;
    for (const t of ts) {
      if (t.tipo === 'receita') totalReceitas += parseFloat(t.valor);
      else totalDespesas += parseFloat(t.valor);
    }
    const saldo = totalReceitas - totalDespesas;
    return {
      totalReceitas: totalReceitas.toFixed(2),
      totalDespesas: totalDespesas.toFixed(2),
      saldo: saldo.toFixed(2),
    };
  }

  async getSnapshotMes(familiaId: string, mesReferencia: string): Promise<SnapshotMes | null> {
    const s = this._snapshots.find(
      (s) => s.familiaId === familiaId && s.mesReferencia === mesReferencia,
    );
    return s ?? null;
  }

  async getDistribuicaoCategorias(
    familiaId: string,
    mesReferencia: string,
  ): Promise<CategoriaGasto[]> {
    const despesas = this._transacoes.filter(
      (t) => t.familiaId === familiaId && t.mesReferencia === mesReferencia && t.tipo === 'despesa',
    );
    const map = new Map<string, { nome: string; total: number }>();
    for (const t of despesas) {
      const existing = map.get(t.categoriaId);
      if (existing) existing.total += parseFloat(t.valor);
      else map.set(t.categoriaId, { nome: t.categoriaNome ?? t.categoriaId, total: parseFloat(t.valor) });
    }
    return Array.from(map.entries())
      .map(([categoriaId, { nome, total }]) => ({
        categoriaId,
        categoriaNome: nome,
        total: total.toFixed(2),
      }))
      .sort((a, b) => parseFloat(b.total) - parseFloat(a.total));
  }

  async getTransacoesPorDia(familiaId: string, mesReferencia: string): Promise<DiaGasto[]> {
    const ts = this._transacoes.filter(
      (t) => t.familiaId === familiaId && t.mesReferencia === mesReferencia,
    );
    const map = new Map<string, { despesas: number; receitas: number }>();
    for (const t of ts) {
      const existing = map.get(t.data) ?? { despesas: 0, receitas: 0 };
      if (t.tipo === 'despesa') existing.despesas += parseFloat(t.valor);
      else existing.receitas += parseFloat(t.valor);
      map.set(t.data, existing);
    }
    return Array.from(map.entries()).map(([dia, { despesas, receitas }]) => ({
      dia,
      totalDespesas: despesas.toFixed(2),
      totalReceitas: receitas.toFixed(2),
    }));
  }

  async getOrcamentosVigentes(
    familiaId: string,
    mesReferencia: string,
  ): Promise<OrcamentoVigente[]> {
    return this._orcamentos.filter(
      (o) =>
        o.familiaId === familiaId &&
        o.vigenciaInicio <= mesReferencia &&
        (o.vigenciaFim === null || o.vigenciaFim >= mesReferencia),
    );
  }

  async getGastosPorCategoria(
    familiaId: string,
    mesReferencia: string,
  ): Promise<GastoCategoria[]> {
    const despesas = this._transacoes.filter(
      (t) => t.familiaId === familiaId && t.mesReferencia === mesReferencia && t.tipo === 'despesa',
    );
    const map = new Map<string, number>();
    for (const t of despesas) {
      map.set(t.categoriaId, (map.get(t.categoriaId) ?? 0) + parseFloat(t.valor));
    }
    return Array.from(map.entries()).map(([categoriaId, total]) => ({
      categoriaId,
      totalGasto: total.toFixed(2),
    }));
  }
}

// ─── Drizzle ──────────────────────────────────────────────────────────────────

export class DrizzleDashboardRepository implements DashboardRepository {
  async getResumoMes(familiaId: string, mesReferencia: string): Promise<ResumoMes> {
    const rows = await db
      .select({
        totalReceitas: sql<string>`COALESCE(SUM(CASE WHEN ${transacoes.tipo} = 'receita' THEN ${transacoes.valor}::numeric ELSE 0 END), 0)::text`,
        totalDespesas: sql<string>`COALESCE(SUM(CASE WHEN ${transacoes.tipo} = 'despesa' THEN ${transacoes.valor}::numeric ELSE 0 END), 0)::text`,
      })
      .from(transacoes)
      .where(
        and(
          eq(transacoes.familiaId, familiaId),
          eq(transacoes.mesReferencia, mesReferencia),
        ),
      );

    const row = rows[0] ?? { totalReceitas: '0', totalDespesas: '0' };
    const r = parseFloat(row.totalReceitas);
    const d = parseFloat(row.totalDespesas);
    return {
      totalReceitas: r.toFixed(2),
      totalDespesas: d.toFixed(2),
      saldo: (r - d).toFixed(2),
    };
  }

  async getSnapshotMes(familiaId: string, mesReferencia: string): Promise<SnapshotMes | null> {
    const rows = await db
      .select({
        totalReceitas: snapshotsMensais.totalReceitas,
        totalDespesas: snapshotsMensais.totalDespesas,
        saldo: snapshotsMensais.saldo,
      })
      .from(snapshotsMensais)
      .where(
        and(
          eq(snapshotsMensais.familiaId, familiaId),
          eq(snapshotsMensais.mesReferencia, mesReferencia),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async getDistribuicaoCategorias(
    familiaId: string,
    mesReferencia: string,
  ): Promise<CategoriaGasto[]> {
    return db
      .select({
        categoriaId: transacoes.categoriaId,
        categoriaNome: categorias.nome,
        total: sql<string>`SUM(${transacoes.valor}::numeric)::text`,
      })
      .from(transacoes)
      .innerJoin(categorias, eq(transacoes.categoriaId, categorias.id))
      .where(
        and(
          eq(transacoes.familiaId, familiaId),
          eq(transacoes.mesReferencia, mesReferencia),
          eq(transacoes.tipo, 'despesa'),
        ),
      )
      .groupBy(transacoes.categoriaId, categorias.nome)
      .orderBy(sql`SUM(${transacoes.valor}::numeric) DESC`);
  }

  async getTransacoesPorDia(familiaId: string, mesReferencia: string): Promise<DiaGasto[]> {
    return db
      .select({
        dia: transacoes.data,
        totalDespesas: sql<string>`COALESCE(SUM(CASE WHEN ${transacoes.tipo} = 'despesa' THEN ${transacoes.valor}::numeric ELSE 0 END), 0)::text`,
        totalReceitas: sql<string>`COALESCE(SUM(CASE WHEN ${transacoes.tipo} = 'receita' THEN ${transacoes.valor}::numeric ELSE 0 END), 0)::text`,
      })
      .from(transacoes)
      .where(
        and(
          eq(transacoes.familiaId, familiaId),
          eq(transacoes.mesReferencia, mesReferencia),
        ),
      )
      .groupBy(transacoes.data)
      .orderBy(transacoes.data);
  }

  async getOrcamentosVigentes(
    familiaId: string,
    mesReferencia: string,
  ): Promise<OrcamentoVigente[]> {
    return db
      .select({
        categoriaId: orcamentoCategoria.categoriaId,
        categoriaNome: categorias.nome,
        valorLimite: orcamentoCategoria.valorLimite,
      })
      .from(orcamentoCategoria)
      .innerJoin(categorias, eq(orcamentoCategoria.categoriaId, categorias.id))
      .where(
        and(
          eq(orcamentoCategoria.familiaId, familiaId),
          lte(orcamentoCategoria.vigenciaInicio, mesReferencia),
          or(
            sql`${orcamentoCategoria.vigenciaFim} IS NULL`,
            gte(orcamentoCategoria.vigenciaFim, mesReferencia),
          ),
        ),
      );
  }

  async getGastosPorCategoria(
    familiaId: string,
    mesReferencia: string,
  ): Promise<GastoCategoria[]> {
    return db
      .select({
        categoriaId: transacoes.categoriaId,
        totalGasto: sql<string>`SUM(${transacoes.valor}::numeric)::text`,
      })
      .from(transacoes)
      .where(
        and(
          eq(transacoes.familiaId, familiaId),
          eq(transacoes.mesReferencia, mesReferencia),
          eq(transacoes.tipo, 'despesa'),
        ),
      )
      .groupBy(transacoes.categoriaId);
  }
}
```

- [ ] **Step 4: Rodar testes — GREEN**

```bash
pnpm --filter api test -- --reporter=verbose dashboard.repository
```

Expected: todos PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/dashboard/
git commit -m "feat(dashboard): repository — InMemory + Drizzle"
```

---

### Task 4: DashboardService + testes

**Files:**
- Create: `apps/api/src/modules/dashboard/dashboard.service.ts`
- Create: `apps/api/src/modules/dashboard/dashboard.service.test.ts`

- [ ] **Step 1: Escrever testes do service (RED)**

```ts
// apps/api/src/modules/dashboard/dashboard.service.test.ts
import { describe, expect, it } from 'vitest';

import { InMemoryDashboardRepository } from './dashboard.repository.js';
import { DashboardService } from './dashboard.service.js';

const buildService = () => {
  const repo = new InMemoryDashboardRepository();
  const service = new DashboardService(repo);
  return { repo, service };
};

describe('DashboardService.getResumo', () => {
  it('retorna zeros e mesAnterior null quando sem dados', async () => {
    const { service } = buildService();
    const r = await service.getResumo('f1', '2026-03');
    expect(r.totalReceitas).toBe('0.00');
    expect(r.totalDespesas).toBe('0.00');
    expect(r.saldo).toBe('0.00');
    expect(r.mesAnterior).toBeNull();
  });

  it('usa snapshot para mês anterior quando disponível', async () => {
    const { repo, service } = buildService();
    repo.seed({
      snapshots: [
        { familiaId: 'f1', mesReferencia: '2026-02', totalReceitas: '4000.00', totalDespesas: '3000.00', saldo: '1000.00' },
      ],
    });
    const r = await service.getResumo('f1', '2026-03');
    expect(r.mesAnterior?.fonteSnapshot).toBe(true);
    expect(r.mesAnterior?.totalReceitas).toBe('4000.00');
  });

  it('re-agrega mês anterior quando sem snapshot', async () => {
    const { repo, service } = buildService();
    repo.seed({
      transacoes: [
        { familiaId: 'f1', mesReferencia: '2026-02', tipo: 'receita', valor: '3000.00', data: '2026-02-10', categoriaId: 'c1' },
      ],
    });
    const r = await service.getResumo('f1', '2026-03');
    expect(r.mesAnterior?.fonteSnapshot).toBe(false);
    expect(r.mesAnterior?.totalReceitas).toBe('3000.00');
  });

  it('mesAnterior null quando sem snapshot e sem transações no mês anterior', async () => {
    const { service } = buildService();
    const r = await service.getResumo('f1', '2026-03');
    expect(r.mesAnterior).toBeNull();
  });
});

describe('DashboardService.getGraficos', () => {
  it('retorna distribuicaoCategorias vazio quando sem despesas', async () => {
    const { service } = buildService();
    const g = await service.getGraficos('f1', '2026-03');
    expect(g.distribuicaoCategorias).toEqual([]);
  });

  it('calcula percentual corretamente', async () => {
    const { repo, service } = buildService();
    repo.seed({
      transacoes: [
        { familiaId: 'f1', mesReferencia: '2026-03', tipo: 'despesa', valor: '300.00', data: '2026-03-01', categoriaId: 'c1', categoriaNome: 'Alimentação' },
        { familiaId: 'f1', mesReferencia: '2026-03', tipo: 'despesa', valor: '700.00', data: '2026-03-02', categoriaId: 'c2', categoriaNome: 'Lazer' },
      ],
    });
    const g = await service.getGraficos('f1', '2026-03');
    const lazer = g.distribuicaoCategorias.find((d) => d.categoriaId === 'c2');
    const alim = g.distribuicaoCategorias.find((d) => d.categoriaId === 'c1');
    expect(lazer?.percentual).toBe(70);
    expect(alim?.percentual).toBe(30);
  });

  it('evolucaoDiaria é array denso com zeros para dias sem transação', async () => {
    const { repo, service } = buildService();
    repo.seed({
      transacoes: [
        { familiaId: 'f1', mesReferencia: '2026-03', tipo: 'despesa', valor: '100.00', data: '2026-03-15', categoriaId: 'c1' },
      ],
    });
    const g = await service.getGraficos('f1', '2026-03');
    // Março 2026 tem 31 dias
    expect(g.evolucaoDiaria).toHaveLength(31);
    const dia1 = g.evolucaoDiaria.find((d) => d.dia === '2026-03-01');
    expect(dia1?.totalDespesas).toBe('0.00');
    expect(dia1?.totalReceitas).toBe('0.00');
    const dia15 = g.evolucaoDiaria.find((d) => d.dia === '2026-03-15');
    expect(dia15?.totalDespesas).toBe('100.00');
  });
});

describe('DashboardService.getOrcamento', () => {
  it('retorna [] quando sem orçamentos', async () => {
    const { service } = buildService();
    const o = await service.getOrcamento('f1', '2026-03');
    expect(o).toEqual([]);
  });

  it('calcula percentual e status corretamente', async () => {
    const { repo, service } = buildService();
    repo.seed({
      orcamentos: [
        { familiaId: 'f1', categoriaId: 'c1', categoriaNome: 'Alimentação', valorLimite: '1000.00', vigenciaInicio: '2026-01', vigenciaFim: null },
        { familiaId: 'f1', categoriaId: 'c2', categoriaNome: 'Lazer', valorLimite: '500.00', vigenciaInicio: '2026-01', vigenciaFim: null },
        { familiaId: 'f1', categoriaId: 'c3', categoriaNome: 'Transporte', valorLimite: '300.00', vigenciaInicio: '2026-01', vigenciaFim: null },
      ],
      transacoes: [
        { familiaId: 'f1', mesReferencia: '2026-03', tipo: 'despesa', valor: '600.00', data: '2026-03-01', categoriaId: 'c1' }, // 60% → ok
        { familiaId: 'f1', mesReferencia: '2026-03', tipo: 'despesa', valor: '425.00', data: '2026-03-01', categoriaId: 'c2' }, // 85% → warning
        { familiaId: 'f1', mesReferencia: '2026-03', tipo: 'despesa', valor: '315.00', data: '2026-03-01', categoriaId: 'c3' }, // 105% → exceeded
      ],
    });
    const o = await service.getOrcamento('f1', '2026-03');
    expect(o.find((i) => i.categoriaId === 'c1')?.status).toBe('ok');
    expect(o.find((i) => i.categoriaId === 'c2')?.status).toBe('warning');
    expect(o.find((i) => i.categoriaId === 'c3')?.status).toBe('exceeded');
  });

  it('categoria com orçamento e zero gastos retorna totalGasto 0.00 e status ok', async () => {
    const { repo, service } = buildService();
    repo.seed({
      orcamentos: [
        { familiaId: 'f1', categoriaId: 'c1', categoriaNome: 'Poupança', valorLimite: '1000.00', vigenciaInicio: '2026-01', vigenciaFim: null },
      ],
    });
    const o = await service.getOrcamento('f1', '2026-03');
    expect(o[0].totalGasto).toBe('0.00');
    expect(o[0].percentual).toBe(0);
    expect(o[0].status).toBe('ok');
  });
});

describe('DashboardService.getMesReferencia', () => {
  it('retorna formato YYYY-MM para data conhecida', () => {
    const { service } = buildService();
    // Testar com data fixa para não depender do timezone real
    const mes = service.getMesReferenciaAtual(new Date('2026-03-14T15:00:00.000Z')); // 12:00 Sao Paulo
    expect(mes).toBe('2026-03');
  });
});
```

- [ ] **Step 2: Rodar — RED**

```bash
pnpm --filter api test -- --reporter=verbose dashboard.service
```

Expected: FAIL — "Cannot find module './dashboard.service.js'"

- [ ] **Step 3: Criar dashboard.service.ts**

```ts
// apps/api/src/modules/dashboard/dashboard.service.ts
import type { DashboardRepository } from './dashboard.types.js';
import type {
  DashboardGraficosResponse,
  DashboardOrcamentoItem,
  DashboardResumoResponse,
} from '@nossagrana/types';

/** Retorna número de dias do mês YYYY-MM */
function diasNoMes(mesReferencia: string): number {
  const [ano, mes] = mesReferencia.split('-').map(Number);
  return new Date(ano, mes, 0).getDate();
}

/** Subtrai 1 mês de YYYY-MM */
function mesAnterior(mesReferencia: string): string {
  const [ano, mes] = mesReferencia.split('-').map(Number);
  const d = new Date(Date.UTC(ano, mes - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function calcularStatus(percentual: number): 'ok' | 'warning' | 'exceeded' {
  if (percentual >= 100) return 'exceeded';
  if (percentual >= 80) return 'warning';
  return 'ok';
}

export class DashboardService {
  constructor(private readonly repo: DashboardRepository) {}

  getMesReferenciaAtual(now: Date = new Date()): string {
    const partes = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(now);
    const ano = partes.find((p) => p.type === 'year')!.value;
    const mes = partes.find((p) => p.type === 'month')!.value;
    return `${ano}-${mes}`;
  }

  async getResumo(familiaId: string, mesReferencia: string): Promise<DashboardResumoResponse> {
    const resumo = await this.repo.getResumoMes(familiaId, mesReferencia);
    const mesPrev = mesAnterior(mesReferencia);

    // Tenta snapshot primeiro
    const snapshot = await this.repo.getSnapshotMes(familiaId, mesPrev);
    if (snapshot) {
      return {
        ...resumo,
        mesReferencia,
        mesAnterior: {
          mesReferencia: mesPrev,
          totalReceitas: snapshot.totalReceitas,
          totalDespesas: snapshot.totalDespesas,
          saldo: snapshot.saldo,
          fonteSnapshot: true,
        },
      };
    }

    // Re-agrega quando sem snapshot
    const resumoPrev = await this.repo.getResumoMes(familiaId, mesPrev);
    const temDados =
      parseFloat(resumoPrev.totalReceitas) > 0 || parseFloat(resumoPrev.totalDespesas) > 0;

    return {
      ...resumo,
      mesReferencia,
      mesAnterior: temDados
        ? { mesReferencia: mesPrev, ...resumoPrev, fonteSnapshot: false }
        : null,
    };
  }

  async getGraficos(
    familiaId: string,
    mesReferencia: string,
  ): Promise<DashboardGraficosResponse> {
    const [categoriasRaw, diasRaw] = await Promise.all([
      this.repo.getDistribuicaoCategorias(familiaId, mesReferencia),
      this.repo.getTransacoesPorDia(familiaId, mesReferencia),
    ]);

    // Calcula percentual (guard: soma zero → return [])
    const somaTotal = categoriasRaw.reduce((acc, c) => acc + parseFloat(c.total), 0);
    const distribuicaoCategorias =
      somaTotal === 0
        ? []
        : categoriasRaw.map((c) => ({
            ...c,
            percentual: Math.round((parseFloat(c.total) / somaTotal) * 1000) / 10,
          }));

    // Preenche array denso
    const totalDias = diasNoMes(mesReferencia);
    const [ano, mes] = mesReferencia.split('-');
    const diasMap = new Map(diasRaw.map((d) => [d.dia, d]));
    const evolucaoDiaria = Array.from({ length: totalDias }, (_, i) => {
      const dia = `${ano}-${mes}-${String(i + 1).padStart(2, '0')}`;
      return diasMap.get(dia) ?? { dia, totalDespesas: '0.00', totalReceitas: '0.00' };
    });

    return { distribuicaoCategorias, evolucaoDiaria };
  }

  async getOrcamento(
    familiaId: string,
    mesReferencia: string,
  ): Promise<DashboardOrcamentoItem[]> {
    const [orcamentos, gastos] = await Promise.all([
      this.repo.getOrcamentosVigentes(familiaId, mesReferencia),
      this.repo.getGastosPorCategoria(familiaId, mesReferencia),
    ]);

    if (orcamentos.length === 0) return [];

    const gastosMap = new Map(gastos.map((g) => [g.categoriaId, g.totalGasto]));

    return orcamentos.map((o) => {
      const totalGasto = gastosMap.get(o.categoriaId) ?? '0.00';
      const percentual =
        parseFloat(o.valorLimite) === 0
          ? 0
          : Math.round((parseFloat(totalGasto) / parseFloat(o.valorLimite)) * 1000) / 10;
      return {
        categoriaId: o.categoriaId,
        categoriaNome: o.categoriaNome,
        valorLimite: o.valorLimite,
        totalGasto,
        percentual,
        status: calcularStatus(percentual),
      };
    });
  }
}
```

- [ ] **Step 4: Rodar — GREEN**

```bash
pnpm --filter api test -- --reporter=verbose dashboard.service
```

Expected: todos PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/dashboard/dashboard.service.ts apps/api/src/modules/dashboard/dashboard.service.test.ts
git commit -m "feat(dashboard): service — resumo, gráficos, orçamento"
```

---

### Task 5: Dashboard schema + routes + registro no app

**Files:**
- Create: `apps/api/src/modules/dashboard/dashboard.schema.ts`
- Create: `apps/api/src/modules/dashboard/dashboard.routes.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/app.test.ts`

- [ ] **Step 1: Escrever testes de rota no app.test.ts (RED)**

No `apps/api/src/app.test.ts`, antes do bloco de describe final, adicionar:

```ts
describe('Dashboard routes', () => {
  const app = buildApp();
  let accessToken: string;
  const familiaId = '00000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    await app.ready();
    // Registrar e logar para obter token
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { nome: 'Dash User', email: 'dash@example.com', senha: 'password123' },
    });
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'dash@example.com', senha: 'password123' },
    });
    accessToken = loginRes.json().accessToken;
  });

  afterAll(() => app.close());

  it('GET /api/dashboard sem JWT retorna 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/dashboard' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/dashboard sem X-Familia-Id retorna 400', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/dashboard',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /api/dashboard com família sem transações retorna zeros', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/dashboard?mesReferencia=2026-03',
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familiaId },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.totalReceitas).toBe('0.00');
    expect(body.totalDespesas).toBe('0.00');
    expect(body.mesAnterior).toBeNull();
  });

  it('GET /api/dashboard/graficos retorna estrutura correta', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/dashboard/graficos?mesReferencia=2026-03',
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familiaId },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('distribuicaoCategorias');
    expect(body).toHaveProperty('evolucaoDiaria');
    expect(Array.isArray(body.distribuicaoCategorias)).toBe(true);
    expect(body.evolucaoDiaria).toHaveLength(31); // Março tem 31 dias
  });

  it('GET /api/dashboard/orcamento sem orçamentos retorna []', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/dashboard/orcamento?mesReferencia=2026-03',
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familiaId },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar testes — confirmar RED**

```bash
pnpm --filter api test -- --reporter=verbose
```

Expected: FAIL com "Route GET:/api/dashboard not found" (404) — confirma que os testes falham antes das rotas existirem.

- [ ] **Step 3: Criar dashboard.schema.ts**

```ts
// apps/api/src/modules/dashboard/dashboard.schema.ts
import {
  dashboardGraficosResponseSchema,
  dashboardOrcamentoResponseSchema,
  dashboardQuerySchema,
  dashboardResumoResponseSchema,
} from '@nossagrana/types';
import { z } from 'zod';

const errorSchemas = {
  401: z.object({ message: z.literal('Nao autenticado') }),
  400: z.object({ message: z.string() }),
};

export const dashboardResumoSchema = {
  querystring: dashboardQuerySchema,
  response: {
    200: dashboardResumoResponseSchema,
    400: errorSchemas[400],
    401: errorSchemas[401],
  },
};

export const dashboardGraficosSchema = {
  querystring: dashboardQuerySchema,
  response: {
    200: dashboardGraficosResponseSchema,
    400: errorSchemas[400],
    401: errorSchemas[401],
  },
};

export const dashboardOrcamentoSchema = {
  querystring: dashboardQuerySchema,
  response: {
    200: dashboardOrcamentoResponseSchema,
    400: errorSchemas[400],
    401: errorSchemas[401],
  },
};
```

- [ ] **Step 4: Criar dashboard.routes.ts**

```ts
// apps/api/src/modules/dashboard/dashboard.routes.ts
import { dashboardQuerySchema } from '@nossagrana/types';
import type { FastifyPluginAsync } from 'fastify';

import { env } from '../../config/env.js';
import {
  DrizzleDashboardRepository,
  InMemoryDashboardRepository,
} from './dashboard.repository.js';
import {
  dashboardGraficosSchema,
  dashboardOrcamentoSchema,
  dashboardResumoSchema,
} from './dashboard.schema.js';
import { DashboardService } from './dashboard.service.js';

const defaultService = () => {
  const repo =
    env.NODE_ENV === 'test'
      ? new InMemoryDashboardRepository()
      : new DrizzleDashboardRepository();
  return new DashboardService(repo);
};

export const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  const service = defaultService();

  fastify.get(
    '/dashboard',
    { preHandler: [fastify.authenticate, fastify.requireFamiliaScope], schema: dashboardResumoSchema },
    async (request) => {
      const { mesReferencia: qMes } = dashboardQuerySchema.parse(request.query);
      const mes = qMes ?? service.getMesReferenciaAtual();
      return service.getResumo(request.familiaIdAtiva as string, mes);
    },
  );

  fastify.get(
    '/dashboard/graficos',
    { preHandler: [fastify.authenticate, fastify.requireFamiliaScope], schema: dashboardGraficosSchema },
    async (request) => {
      const { mesReferencia: qMes } = dashboardQuerySchema.parse(request.query);
      const mes = qMes ?? service.getMesReferenciaAtual();
      return service.getGraficos(request.familiaIdAtiva as string, mes);
    },
  );

  fastify.get(
    '/dashboard/orcamento',
    { preHandler: [fastify.authenticate, fastify.requireFamiliaScope], schema: dashboardOrcamentoSchema },
    async (request) => {
      const { mesReferencia: qMes } = dashboardQuerySchema.parse(request.query);
      const mes = qMes ?? service.getMesReferenciaAtual();
      return service.getOrcamento(request.familiaIdAtiva as string, mes);
    },
  );
};
```

- [ ] **Step 5: Registrar routes no app.ts**

Em `apps/api/src/app.ts`, adicionar após `import { transacaoRoutes }`:

```ts
import { dashboardRoutes } from './modules/dashboard/dashboard.routes.js';
```

E após `app.register(transacaoRoutes, { prefix: '/api' });`:

```ts
app.register(dashboardRoutes, { prefix: '/api' });
```

- [ ] **Step 6: Rodar testes — GREEN**

```bash
pnpm --filter api test -- --reporter=verbose
```

Expected: todos PASS (novos testes de rota passam porque `InMemoryDashboardRepository` é usado em test mode).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/dashboard/ apps/api/src/app.ts apps/api/src/app.test.ts
git commit -m "feat(dashboard): routes GET /dashboard, /dashboard/graficos, /dashboard/orcamento"
```

---

## Chunk 2: Backend — Infraestrutura WebSocket

### Task 6: WebSocketManager

**Files:**
- Create: `apps/api/src/modules/ws/websocket-manager.ts`
- Create: `apps/api/src/modules/ws/websocket-manager.test.ts`

- [ ] **Step 1: Escrever testes do WebSocketManager (RED)**

```ts
// apps/api/src/modules/ws/websocket-manager.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WebSocketManager } from './websocket-manager.js';

const mockSocket = (readyState = 1 /* OPEN */) => ({
  readyState,
  send: vi.fn(),
  close: vi.fn(),
  ping: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
});

describe('WebSocketManager', () => {
  let manager: WebSocketManager;

  beforeEach(() => {
    manager = new WebSocketManager();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('join adiciona socket ao room', () => {
    const ws = mockSocket() as any;
    manager.join('f1', ws);
    expect(manager.roomSize('f1')).toBe(1);
  });

  it('leave remove socket do room', () => {
    const ws = mockSocket() as any;
    manager.join('f1', ws);
    manager.leave('f1', ws);
    expect(manager.roomSize('f1')).toBe(0);
  });

  it('broadcast envia mensagem a todos sockets OPEN do room', () => {
    const ws1 = mockSocket() as any;
    const ws2 = mockSocket() as any;
    manager.join('f1', ws1);
    manager.join('f1', ws2);
    manager.broadcast('f1', { tipo: 'transacao:alterada' });
    expect(ws1.send).toHaveBeenCalledWith(JSON.stringify({ tipo: 'transacao:alterada' }));
    expect(ws2.send).toHaveBeenCalledWith(JSON.stringify({ tipo: 'transacao:alterada' }));
  });

  it('broadcast ignora sockets não-OPEN (readyState !== 1)', () => {
    const wsOpen = mockSocket(1) as any;
    const wsClosing = mockSocket(2) as any;
    manager.join('f1', wsOpen);
    manager.join('f1', wsClosing);
    manager.broadcast('f1', { tipo: 'test' });
    expect(wsOpen.send).toHaveBeenCalled();
    expect(wsClosing.send).not.toHaveBeenCalled();
  });

  it('broadcast não lança erro se room não existe', () => {
    expect(() => manager.broadcast('inexistente', { tipo: 'test' })).not.toThrow();
  });

  it('roomSize retorna 0 para room inexistente', () => {
    expect(manager.roomSize('inexistente')).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar — RED**

```bash
pnpm --filter api test -- --reporter=verbose websocket-manager
```

Expected: FAIL — "Cannot find module './websocket-manager.js'"

- [ ] **Step 3: Criar websocket-manager.ts**

```ts
// apps/api/src/modules/ws/websocket-manager.ts
import type WebSocket from 'ws';

export class WebSocketManager {
  private rooms = new Map<string, Set<WebSocket>>();

  join(familiaId: string, ws: WebSocket): void {
    if (!this.rooms.has(familiaId)) {
      this.rooms.set(familiaId, new Set());
    }
    this.rooms.get(familiaId)!.add(ws);
  }

  leave(familiaId: string, ws: WebSocket): void {
    this.rooms.get(familiaId)?.delete(ws);
  }

  broadcast(familiaId: string, payload: object): void {
    const room = this.rooms.get(familiaId);
    if (!room) return;
    const msg = JSON.stringify(payload);
    for (const ws of room) {
      if (ws.readyState === 1 /* OPEN */) {
        ws.send(msg);
      }
    }
  }

  roomSize(familiaId: string): number {
    return this.rooms.get(familiaId)?.size ?? 0;
  }
}
```

- [ ] **Step 4: Rodar — GREEN**

```bash
pnpm --filter api test -- --reporter=verbose websocket-manager
```

Expected: todos PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/ws/
git commit -m "feat(ws): WebSocketManager — rooms, broadcast, ignore zombie sockets"
```

---

### Task 7: websocket.plugin.ts + ws.routes.ts + eventBus + transacao emit

**Files:**
- Modify: `apps/api/src/plugins/websocket.plugin.ts`
- Create: `apps/api/src/modules/ws/ws.routes.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/modules/transacao/transacao.routes.ts`

- [ ] **Step 0: Escrever testes para ws.routes.ts — close codes 4001/4003 (RED)**

Criar `apps/api/src/modules/ws/ws.routes.test.ts`:

```ts
// apps/api/src/modules/ws/ws.routes.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../app.js';

describe('ws.routes — autenticação WebSocket', () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(() => app.close());

  it('fecha com 4001 quando token ausente', async () => {
    const ws = await app.injectWS('/api/ws?familiaId=00000000-0000-0000-0000-000000000001');
    const closeCode = await new Promise<number>((resolve) => {
      ws.on('close', (code) => resolve(code));
    });
    expect(closeCode).toBe(4001);
  });

  it('fecha com 4001 quando token inválido', async () => {
    const ws = await app.injectWS('/api/ws?token=token-invalido&familiaId=00000000-0000-0000-0000-000000000001');
    const closeCode = await new Promise<number>((resolve) => {
      ws.on('close', (code) => resolve(code));
    });
    expect(closeCode).toBe(4001);
  });

  it('fecha com 4001 quando familiaId ausente', async () => {
    // Registrar usuário e obter token válido
    await app.inject({ method: 'POST', url: '/api/auth/register',
      payload: { nome: 'WS User', email: 'ws@example.com', senha: 'password123' } });
    const loginRes = await app.inject({ method: 'POST', url: '/api/auth/login',
      payload: { email: 'ws@example.com', senha: 'password123' } });
    const token = loginRes.json().accessToken;

    const ws = await app.injectWS(`/api/ws?token=${token}`);
    const closeCode = await new Promise<number>((resolve) => {
      ws.on('close', (code) => resolve(code));
    });
    expect(closeCode).toBe(4001);
  });

  it('conecta com sucesso com token válido e familiaId UUID válido (NODE_ENV=test bypassa membership)', async () => {
    const loginRes = await app.inject({ method: 'POST', url: '/api/auth/login',
      payload: { email: 'ws@example.com', senha: 'password123' } });
    const token = loginRes.json().accessToken;

    const ws = await app.injectWS(`/api/ws?token=${token}&familiaId=00000000-0000-0000-0000-000000000001`);
    // Conexão estabelecida — não fecha com código de erro
    const isOpen = ws.readyState === 1; // OPEN
    ws.close();
    expect(isOpen).toBe(true);
  });
});
```

- [ ] **Step 0b: Rodar testes — confirmar RED**

```bash
pnpm --filter api test -- src/modules/ws/ws.routes.test.ts --reporter=verbose
```

Expected: FAIL com "Cannot find module" ou "Route not found" — confirma que os testes falham antes da implementação.

- [ ] **Step 1: Atualizar websocket.plugin.ts com eventBus + wsManager + heartbeat**

```ts
// apps/api/src/plugins/websocket.plugin.ts
import EventEmitter from 'node:events';

import fp from 'fastify-plugin';

import { WebSocketManager } from '../modules/ws/websocket-manager.js';

declare module 'fastify' {
  interface FastifyInstance {
    wsManager: WebSocketManager;
    eventBus?: EventEmitter;
  }
}

export const websocketPlugin = fp(async (fastify) => {
  await fastify.register(import('@fastify/websocket'));

  const wsManager = new WebSocketManager();
  const eventBus = new EventEmitter();

  fastify.decorate('wsManager', wsManager);
  fastify.decorate('eventBus', eventBus);

  // Ouve evento de negócio e faz broadcast para a família
  eventBus.on('transacao:alterada', ({ familiaId }: { familiaId: string }) => {
    wsManager.broadcast(familiaId, { tipo: 'transacao:alterada', familiaId });
  });

  // Heartbeat a cada 30s
  const HEARTBEAT_INTERVAL = 30_000;
  const PONG_TIMEOUT = 10_000;

  const heartbeatTimer = setInterval(() => {
    for (const [familiaId, room] of (wsManager as any).rooms as Map<string, Set<any>>) {
      for (const ws of room) {
        if (ws.readyState !== 1) {
          wsManager.leave(familiaId, ws);
          continue;
        }
        let alive = false;
        ws.once('pong', () => { alive = true; });
        ws.ping();
        setTimeout(() => {
          if (!alive) {
            ws.terminate?.();
            wsManager.leave(familiaId, ws);
          }
        }, PONG_TIMEOUT);
      }
    }
  }, HEARTBEAT_INTERVAL);

  fastify.addHook('onClose', () => clearInterval(heartbeatTimer));
});
```

- [ ] **Step 2: Criar ws.routes.ts**

```ts
// apps/api/src/modules/ws/ws.routes.ts
import { and, eq } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import type { WebSocket } from 'ws';

import { env } from '../../config/env.js';
import { db } from '../../db/client.js';
import { usuarioFamilia } from '../../db/schema.js';

export const wsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/ws', { websocket: true }, async (socket: WebSocket, request) => {
    const query = request.query as Record<string, string>;
    const token = query.token;
    const familiaId = query.familiaId;

    // Valida UUID básico
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!token || !familiaId || !uuidRegex.test(familiaId)) {
      socket.close(4001, 'Parametros invalidos');
      return;
    }

    // Valida JWT
    let userId: string;
    try {
      const payload = fastify.jwt.verify<{ sub: string }>(token);
      userId = payload.sub;
    } catch {
      socket.close(4001, 'Token invalido ou expirado');
      return;
    }

    // Verifica membership (bypass em test)
    if (env.NODE_ENV !== 'test') {
      const [membership] = await db
        .select({ usuarioId: usuarioFamilia.usuarioId })
        .from(usuarioFamilia)
        .where(and(eq(usuarioFamilia.usuarioId, userId), eq(usuarioFamilia.familiaId, familiaId)))
        .limit(1);

      if (!membership) {
        socket.close(4003, 'Usuario sem acesso a familia');
        return;
      }
    }

    fastify.wsManager.join(familiaId, socket);

    socket.on('close', () => {
      fastify.wsManager.leave(familiaId, socket);
    });
  });
};
```

- [ ] **Step 3: Registrar wsRoutes no app.ts**

```ts
// Em apps/api/src/app.ts, adicionar import:
import { wsRoutes } from './modules/ws/ws.routes.js';

// E após os outros registers:
app.register(wsRoutes, { prefix: '/api' });
```

- [ ] **Step 4: Emitir eventBus nas rotas de transação**

Em `apps/api/src/modules/transacao/transacao.routes.ts`, após cada resposta de sucesso em `POST`, `PATCH` e `DELETE /transacoes`, adicionar emissão do evento. Exemplo no `POST /transacoes`:

```ts
// Após: return reply.code(201).send({ transacao: mapTransacao(transacao) });
// Adicionar ANTES do return:
fastify.eventBus?.emit('transacao:alterada', { familiaId });
```

Fazer o mesmo para `PATCH /transacoes/:id` e `DELETE /transacoes/:id` (antes do `return reply`).

- [ ] **Step 5: Rodar todos os testes**

```bash
pnpm --filter api test -- --reporter=verbose
```

Expected: todos PASS. Os testes de transação existentes não são afetados (eventBus.emit é silencioso se eventBus não estiver disponível em mocks, ou verificar se `fastify.eventBus` existe antes de emitir).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/plugins/websocket.plugin.ts apps/api/src/modules/ws/ws.routes.ts apps/api/src/modules/ws/ws.routes.test.ts apps/api/src/app.ts apps/api/src/modules/transacao/transacao.routes.ts
git commit -m "feat(ws): plugin com eventBus + heartbeat, rota /ws, emissão de eventos em transações"
```

---

## Chunk 3: Frontend — AuthContext + Stores

### Task 8: Estender AuthContext com familiaIdAtiva

**Files:**
- Modify: `apps/web/src/contexts/auth-context-store.ts`
- Modify: `apps/web/src/contexts/auth-context.tsx`

- [ ] **Step 1: Atualizar auth-context-store.ts**

Abrir `apps/web/src/contexts/auth-context-store.ts` e adicionar `familiaIdAtiva` ao `AuthContextValue`:

```ts
// Adicionar ao interface AuthContextValue:
familiaIdAtiva: string | null;
// E ao login callback:
login: (session: { accessToken: string; refreshToken: string; familiaIdAtiva: string }) => void;
```

- [ ] **Step 2: Atualizar auth-context.tsx**

```ts
// Atualizar AuthSession para incluir familiaIdAtiva:
interface AuthSession {
  accessToken: string;
  refreshToken: string;
  familiaIdAtiva: string;
}

// Atualizar loadStoredSession para validar familiaIdAtiva:
// adicionar check de familiaIdAtiva no parse

// Atualizar value para incluir familiaIdAtiva:
familiaIdAtiva: session?.familiaIdAtiva ?? null,
```

- [ ] **Step 3: Rodar testes web para verificar sem regressão**

```bash
pnpm --filter web test -- --reporter=verbose
```

Expected: PASS (o `AuthContext` é apenas estendido, não quebrado).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/contexts/
git commit -m "feat(auth): adicionar familiaIdAtiva ao AuthContext"
```

---

### Task 9: useDashboardStore + testes

**Files:**
- Create: `apps/web/src/stores/dashboard.store.ts`
- Create: `apps/web/src/stores/dashboard.store.test.ts`
- Modify: `apps/web/src/services/core-financeiro.service.ts` (adicionar chamadas dashboard)

- [ ] **Step 1: Adicionar chamadas dashboard ao service existente**

Em `apps/web/src/services/core-financeiro.service.ts`, adicionar:

```ts
async getDashboardResumo(familiaId: string, mesReferencia?: string): Promise<DashboardResumoResponse> {
  const qs = mesReferencia ? `?mesReferencia=${mesReferencia}` : '';
  return this.apiClient.request<DashboardResumoResponse>(`/dashboard${qs}`, {
    headers: { 'X-Familia-Id': familiaId },
  });
}

async getDashboardGraficos(familiaId: string, mesReferencia?: string): Promise<DashboardGraficosResponse> {
  const qs = mesReferencia ? `?mesReferencia=${mesReferencia}` : '';
  return this.apiClient.request<DashboardGraficosResponse>(`/dashboard/graficos${qs}`, {
    headers: { 'X-Familia-Id': familiaId },
  });
}

async getDashboardOrcamento(familiaId: string, mesReferencia?: string): Promise<DashboardOrcamentoResponse> {
  const qs = mesReferencia ? `?mesReferencia=${mesReferencia}` : '';
  return this.apiClient.request<DashboardOrcamentoResponse>(`/dashboard/orcamento${qs}`, {
    headers: { 'X-Familia-Id': familiaId },
  });
}
```

- [ ] **Step 2: Escrever testes do dashboard store (RED)**

```ts
// apps/web/src/stores/dashboard.store.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockService = {
  getDashboardResumo: vi.fn(),
  getDashboardGraficos: vi.fn(),
  getDashboardOrcamento: vi.fn(),
};

vi.mock('../services/core-financeiro.service', () => ({
  coreFinanceiroService: mockService,
}));

import { act, renderHook } from '@testing-library/react';
import { useDashboardStore } from './dashboard.store';

describe('useDashboardStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDashboardStore.setState({ resumo: null, graficos: null, orcamento: [], loading: false, error: null });
  });

  it('estado inicial é null/vazio', () => {
    const { result } = renderHook(() => useDashboardStore());
    expect(result.current.resumo).toBeNull();
    expect(result.current.orcamento).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('fetchAll popula resumo, graficos e orcamento', async () => {
    const resumo = { mesReferencia: '2026-03', totalReceitas: '5000.00', totalDespesas: '3000.00', saldo: '2000.00', mesAnterior: null };
    const graficos = { distribuicaoCategorias: [], evolucaoDiaria: [] };
    const orcamento = [];
    mockService.getDashboardResumo.mockResolvedValue(resumo);
    mockService.getDashboardGraficos.mockResolvedValue(graficos);
    mockService.getDashboardOrcamento.mockResolvedValue(orcamento);

    const { result } = renderHook(() => useDashboardStore());
    await act(() => result.current.fetchAll('f1'));

    expect(result.current.resumo).toEqual(resumo);
    expect(result.current.graficos).toEqual(graficos);
    expect(result.current.loading).toBe(false);
  });

  it('fetchAll seta error em caso de falha', async () => {
    mockService.getDashboardResumo.mockRejectedValue(new Error('network'));
    mockService.getDashboardGraficos.mockRejectedValue(new Error('network'));
    mockService.getDashboardOrcamento.mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useDashboardStore());
    await act(() => result.current.fetchAll('f1'));

    expect(result.current.error).toBeTruthy();
  });
});
```

- [ ] **Step 3: Rodar — RED**

```bash
pnpm --filter web test -- --reporter=verbose dashboard.store
```

Expected: FAIL.

- [ ] **Step 4: Criar dashboard.store.ts**

```ts
// apps/web/src/stores/dashboard.store.ts
import { create } from 'zustand';

import type {
  DashboardGraficosResponse,
  DashboardOrcamentoResponse,
  DashboardResumoResponse,
} from '@nossagrana/types';
import { coreFinanceiroService } from '../services/core-financeiro.service';

interface DashboardStore {
  resumo: DashboardResumoResponse | null;
  graficos: DashboardGraficosResponse | null;
  orcamento: DashboardOrcamentoResponse;
  loading: boolean;
  error: string | null;
  fetchAll(familiaId: string, mesReferencia?: string): Promise<void>;
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  resumo: null,
  graficos: null,
  orcamento: [],
  loading: false,
  error: null,

  async fetchAll(familiaId, mesReferencia) {
    set({ loading: true, error: null });
    try {
      const [resumo, graficos, orcamento] = await Promise.all([
        coreFinanceiroService.getDashboardResumo(familiaId, mesReferencia),
        coreFinanceiroService.getDashboardGraficos(familiaId, mesReferencia),
        coreFinanceiroService.getDashboardOrcamento(familiaId, mesReferencia),
      ]);
      set({ resumo, graficos, orcamento, loading: false });
    } catch {
      set({ error: 'Erro ao carregar dashboard', loading: false });
    }
  },
}));
```

- [ ] **Step 5: Rodar — GREEN**

```bash
pnpm --filter web test -- --reporter=verbose dashboard.store
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/stores/dashboard.store.ts apps/web/src/stores/dashboard.store.test.ts apps/web/src/services/core-financeiro.service.ts
git commit -m "feat(web): useDashboardStore + chamadas de dashboard no service"
```

---

### Task 10: useWebSocketStore + testes

**Files:**
- Create: `apps/web/src/stores/websocket.store.ts`
- Create: `apps/web/src/stores/websocket.store.test.ts`

- [ ] **Step 1: Escrever testes do WebSocket store (RED)**

```ts
// apps/web/src/stores/websocket.store.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock global WebSocket
const mockWs = {
  close: vi.fn(),
  onopen: null as any,
  onclose: null as any,
  onmessage: null as any,
  readyState: 1,
};
vi.stubGlobal('WebSocket', vi.fn(() => mockWs));

const mockFetchAll = vi.fn();
vi.mock('./dashboard.store', () => ({
  useDashboardStore: { getState: () => ({ fetchAll: mockFetchAll }) },
}));

import { act, renderHook } from '@testing-library/react';
import { useWebSocketStore } from './websocket.store';

describe('useWebSocketStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    useWebSocketStore.setState({ socket: null, status: 'disconnected' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('estado inicial é disconnected', () => {
    const { result } = renderHook(() => useWebSocketStore());
    expect(result.current.status).toBe('disconnected');
    expect(result.current.socket).toBeNull();
  });

  it('connect muda status para connecting e cria WebSocket', () => {
    const { result } = renderHook(() => useWebSocketStore());
    act(() => {
      result.current.connect({
        getAccessToken: () => 'token123',
        familiaId: 'f1',
        clearSession: vi.fn(),
      });
    });
    expect(result.current.status).toBe('connecting');
    expect(WebSocket).toHaveBeenCalledWith(expect.stringContaining('token=token123'));
    expect(WebSocket).toHaveBeenCalledWith(expect.stringContaining('familiaId=f1'));
  });

  it('mensagem transacao:alterada chama fetchAll', () => {
    const { result } = renderHook(() => useWebSocketStore());
    act(() => {
      result.current.connect({
        getAccessToken: () => 'tok',
        familiaId: 'f1',
        clearSession: vi.fn(),
      });
      // Simula onopen
      mockWs.onopen?.({} as any);
      // Simula mensagem
      mockWs.onmessage?.({ data: JSON.stringify({ tipo: 'transacao:alterada', familiaId: 'f1' }) } as any);
    });
    expect(mockFetchAll).toHaveBeenCalledWith('f1');
  });

  it('disconnect fecha socket e limpa estado', () => {
    const { result } = renderHook(() => useWebSocketStore());
    act(() => {
      result.current.connect({ getAccessToken: () => 'tok', familiaId: 'f1', clearSession: vi.fn() });
      result.current.disconnect();
    });
    expect(mockWs.close).toHaveBeenCalled();
    expect(result.current.status).toBe('disconnected');
  });
});
```

- [ ] **Step 2: Rodar — RED**

```bash
pnpm --filter web test -- --reporter=verbose websocket.store
```

Expected: FAIL.

- [ ] **Step 3: Criar websocket.store.ts**

```ts
// apps/web/src/stores/websocket.store.ts
import { create } from 'zustand';

import { useDashboardStore } from './dashboard.store';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3000';
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 100;

interface ConnectOpts {
  getAccessToken: () => string | null;
  familiaId: string;
  clearSession: () => void;
}

interface WebSocketStore {
  socket: WebSocket | null;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  connect(opts: ConnectOpts): void;
  disconnect(): void;
}

export const useWebSocketStore = create<WebSocketStore>((set, get) => {
  let retryCount = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let currentOpts: ConnectOpts | null = null;

  const clearRetry = () => {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const doConnect = (opts: ConnectOpts) => {
    const token = opts.getAccessToken();
    if (!token) {
      set({ status: 'error' });
      return;
    }

    const url = `${WS_URL}/api/ws?token=${encodeURIComponent(token)}&familiaId=${encodeURIComponent(opts.familiaId)}`;
    const ws = new WebSocket(url);
    set({ socket: ws, status: 'connecting' });

    ws.onopen = () => {
      retryCount = 0;
      set({ status: 'connected' });
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.tipo === 'transacao:alterada') {
          useDashboardStore.getState().fetchAll(opts.familiaId);
        }
      } catch {
        // ignora mensagens malformadas
      }
    };

    ws.onclose = (event) => {
      set({ socket: null, status: 'disconnected' });

      if (event.code === 4001 || event.code === 4003) {
        // Token inválido ou acesso negado — não reconectar
        if (event.code === 4001 && retryCount >= MAX_RETRIES) {
          opts.clearSession();
          return;
        }
      }

      if (retryCount < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, retryCount);
        retryCount++;
        retryTimer = setTimeout(() => doConnect(opts), delay);
      } else {
        opts.clearSession();
        set({ status: 'error' });
      }
    };
  };

  return {
    socket: null,
    status: 'disconnected',

    connect(opts) {
      currentOpts = opts;
      retryCount = 0;
      clearRetry();
      const existing = get().socket;
      if (existing) existing.close();
      doConnect(opts);
    },

    disconnect() {
      clearRetry();
      retryCount = MAX_RETRIES; // evita reconexão após close manual
      const { socket } = get();
      if (socket) socket.close();
      set({ socket: null, status: 'disconnected' });
      currentOpts = null;
    },
  };
});
```

- [ ] **Step 4: Rodar — GREEN**

```bash
pnpm --filter web test -- --reporter=verbose websocket.store
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/stores/websocket.store.ts apps/web/src/stores/websocket.store.test.ts
git commit -m "feat(web): useWebSocketStore — connect, reconnect com back-off, broadcast handler"
```

---

## Chunk 4: Frontend — DashboardPage e navegação

### Task 11: Instalar Chart.js

- [ ] **Step 1: Instalar dependências**

```bash
pnpm --filter web add chart.js react-chartjs-2
```

Expected: sem erros.

- [ ] **Step 2: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): instalar chart.js e react-chartjs-2"
```

---

### Task 12: DashboardPage + testes

**Files:**
- Create: `apps/web/src/pages/dashboard-page.tsx`
- Create: `apps/web/src/pages/dashboard-page.test.tsx`

- [ ] **Step 1: Escrever testes da DashboardPage (RED)**

```tsx
// apps/web/src/pages/dashboard-page.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../stores/dashboard.store', () => ({
  useDashboardStore: vi.fn(),
}));
vi.mock('react-chartjs-2', () => ({
  Doughnut: () => <div data-testid="chart-doughnut" />,
  Line: () => <div data-testid="chart-line" />,
}));

import { useDashboardStore } from '../stores/dashboard.store';

const mockUseDashboard = useDashboardStore as unknown as ReturnType<typeof vi.fn>;

const resumoBase = {
  mesReferencia: '2026-03',
  totalReceitas: '5200.00',
  totalDespesas: '3800.00',
  saldo: '1400.00',
  mesAnterior: null,
};

describe('DashboardPage', () => {
  beforeEach(() => {
    mockUseDashboard.mockReturnValue({
      resumo: null,
      graficos: null,
      orcamento: [],
      loading: false,
      error: null,
      fetchAll: vi.fn(),
    });
  });

  it('exibe loading state', async () => {
    mockUseDashboard.mockReturnValue({ loading: true, resumo: null, graficos: null, orcamento: [], error: null, fetchAll: vi.fn() });
    const { DashboardPage } = await import('./dashboard-page');
    render(<DashboardPage familiaId="f1" onNovaTransacao={vi.fn()} />);
    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
  });

  it('exibe cards de resumo com dados', async () => {
    mockUseDashboard.mockReturnValue({
      resumo: resumoBase,
      graficos: { distribuicaoCategorias: [], evolucaoDiaria: [] },
      orcamento: [],
      loading: false,
      error: null,
      fetchAll: vi.fn(),
    });
    const { DashboardPage } = await import('./dashboard-page');
    render(<DashboardPage familiaId="f1" onNovaTransacao={vi.fn()} />);
    expect(screen.getByText('R$ 5.200,00')).toBeInTheDocument();
    expect(screen.getByText('R$ 3.800,00')).toBeInTheDocument();
    expect(screen.getByText('R$ 1.400,00')).toBeInTheDocument();
  });

  it('exibe mensagem de estado vazio sem transações', async () => {
    mockUseDashboard.mockReturnValue({
      resumo: { ...resumoBase, totalReceitas: '0.00', totalDespesas: '0.00', saldo: '0.00' },
      graficos: { distribuicaoCategorias: [], evolucaoDiaria: [] },
      orcamento: [],
      loading: false,
      error: null,
      fetchAll: vi.fn(),
    });
    const { DashboardPage } = await import('./dashboard-page');
    render(<DashboardPage familiaId="f1" onNovaTransacao={vi.fn()} />);
    expect(screen.getByText(/nenhuma transação registrada/i)).toBeInTheDocument();
  });

  it('exibe mensagem quando sem orçamentos', async () => {
    mockUseDashboard.mockReturnValue({
      resumo: resumoBase,
      graficos: { distribuicaoCategorias: [{ categoriaId: 'c1', categoriaNome: 'Alim', total: '100.00', percentual: 100 }], evolucaoDiaria: [] },
      orcamento: [],
      loading: false,
      error: null,
      fetchAll: vi.fn(),
    });
    const { DashboardPage } = await import('./dashboard-page');
    render(<DashboardPage familiaId="f1" onNovaTransacao={vi.fn()} />);
    expect(screen.getByText(/nenhum orçamento configurado/i)).toBeInTheDocument();
  });

  it('exibe barra de orçamento com status correto', async () => {
    mockUseDashboard.mockReturnValue({
      resumo: resumoBase,
      graficos: { distribuicaoCategorias: [], evolucaoDiaria: [] },
      orcamento: [
        { categoriaId: 'c1', categoriaNome: 'Alimentação', valorLimite: '1000.00', totalGasto: '600.00', percentual: 60, status: 'ok' },
        { categoriaId: 'c2', categoriaNome: 'Lazer', valorLimite: '500.00', totalGasto: '430.00', percentual: 86, status: 'warning' },
        { categoriaId: 'c3', categoriaNome: 'Transporte', valorLimite: '300.00', totalGasto: '315.00', percentual: 105, status: 'exceeded' },
      ],
      loading: false,
      error: null,
      fetchAll: vi.fn(),
    });
    const { DashboardPage } = await import('./dashboard-page');
    render(<DashboardPage familiaId="f1" onNovaTransacao={vi.fn()} />);
    expect(screen.getByText('Alimentação')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    // Verifica a existência das categorias de warning e exceeded
    expect(screen.getByText('Lazer')).toBeInTheDocument();
    expect(screen.getByText('Transporte')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar — RED**

```bash
pnpm --filter web test -- --reporter=verbose dashboard-page
```

Expected: FAIL.

- [ ] **Step 3: Criar dashboard-page.tsx**

```tsx
// apps/web/src/pages/dashboard-page.tsx
import {
  ArcElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { useEffect } from 'react';
import { Doughnut, Line } from 'react-chartjs-2';

import { useDashboardStore } from '../stores/dashboard.store';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Filler);

const formatBRL = (valor: string) =>
  parseFloat(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const statusColor: Record<string, string> = {
  ok: 'bg-success',
  warning: 'bg-warning',
  exceeded: 'bg-danger',
};

interface DashboardPageProps {
  familiaId: string;
  onNovaTransacao: () => void;
}

export const DashboardPage = ({ familiaId, onNovaTransacao }: DashboardPageProps) => {
  const { resumo, graficos, orcamento, loading, fetchAll } = useDashboardStore();

  useEffect(() => {
    fetchAll(familiaId);
  }, [familiaId, fetchAll]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-text-muted">Carregando...</p>
      </div>
    );
  }

  const temTransacoes =
    resumo && (parseFloat(resumo.totalReceitas) > 0 || parseFloat(resumo.totalDespesas) > 0);

  const mesLabel = resumo?.mesReferencia
    ? new Date(`${resumo.mesReferencia}-01`).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
    : '';

  // Dados para pizza
  const donutData = {
    labels: graficos?.distribuicaoCategorias.map((c) => c.categoriaNome) ?? [],
    datasets: [
      {
        data: graficos?.distribuicaoCategorias.map((c) => parseFloat(c.total)) ?? [],
        backgroundColor: ['#4ade80', '#60a5fa', '#f87171', '#facc15', '#a78bfa', '#fb923c'],
        borderWidth: 0,
      },
    ],
  };

  // Dados para linha
  const lineData = {
    labels: graficos?.evolucaoDiaria.map((d) => d.dia.slice(8)) ?? [],
    datasets: [
      {
        label: 'Despesas',
        data: graficos?.evolucaoDiaria.map((d) => parseFloat(d.totalDespesas)) ?? [],
        borderColor: '#f87171',
        backgroundColor: 'rgba(248, 113, 113, 0.1)',
        fill: true,
        tension: 0.3,
      },
      {
        label: 'Receitas',
        data: graficos?.evolucaoDiaria.map((d) => parseFloat(d.totalReceitas)) ?? [],
        borderColor: '#4ade80',
        backgroundColor: 'rgba(74, 222, 128, 0.1)',
        fill: true,
        tension: 0.3,
      },
    ],
  };

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-4 py-4">
        <div>
          <h1 className="text-xl font-bold text-text">NossaGrana</h1>
          <p className="text-sm capitalize text-text-muted">{mesLabel}</p>
        </div>
        <button
          type="button"
          onClick={onNovaTransacao}
          className="flex h-10 items-center gap-2 rounded-lg bg-success px-4 text-sm font-semibold text-white shadow hover:bg-success-strong"
        >
          + Nova
        </button>
      </header>

      <main className="flex flex-1 flex-col gap-4 p-4">
        {/* Cards + Pizza */}
        <div className="grid grid-cols-2 gap-3">
          {/* Cards coluna esquerda */}
          <div className="flex flex-col gap-2">
            <div className="rounded-xl border border-border bg-panel p-3">
              <p className="text-xs font-semibold text-success">RECEITAS</p>
              <p className="text-lg font-bold text-text">{formatBRL(resumo?.totalReceitas ?? '0')}</p>
            </div>
            <div className="rounded-xl border border-border bg-panel p-3">
              <p className="text-xs font-semibold text-danger">DESPESAS</p>
              <p className="text-lg font-bold text-text">{formatBRL(resumo?.totalDespesas ?? '0')}</p>
            </div>
            <div className="rounded-xl border border-border bg-panel p-3">
              <p className="text-xs font-semibold text-primary">SALDO</p>
              <p className="text-lg font-bold text-text">{formatBRL(resumo?.saldo ?? '0')}</p>
            </div>
          </div>

          {/* Pizza coluna direita */}
          <div className="flex items-center justify-center rounded-xl border border-border bg-panel p-3">
            {graficos && graficos.distribuicaoCategorias.length > 0 ? (
              <Doughnut
                data={donutData}
                options={{ plugins: { legend: { display: false } }, maintainAspectRatio: true }}
              />
            ) : (
              <p className="text-center text-xs text-text-muted">Nenhuma transação registrada</p>
            )}
          </div>
        </div>

        {/* Gráfico Linha */}
        {temTransacoes && (
          <div className="rounded-xl border border-border bg-panel p-3">
            <p className="mb-2 text-xs font-semibold text-text-muted">EVOLUÇÃO DO MÊS</p>
            <Line
              data={lineData}
              options={{
                scales: { x: { ticks: { maxTicksLimit: 10 } } },
                plugins: { legend: { position: 'bottom' } },
                maintainAspectRatio: true,
              }}
            />
          </div>
        )}

        {/* Orçamento */}
        <div className="rounded-xl border border-border bg-panel p-3">
          <p className="mb-3 text-xs font-semibold text-text-muted">ORÇAMENTO</p>
          {orcamento.length === 0 ? (
            <p className="text-sm text-text-muted">
              Nenhum orçamento configurado. Configure na tela de Orçamento.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {orcamento.map((item) => (
                <div key={item.categoriaId}>
                  <div className="mb-1 flex items-center justify-between text-xs text-text-muted">
                    <span>{item.categoriaNome}</span>
                    <span>
                      {item.percentual.toFixed(0)}% — {formatBRL(item.totalGasto)}/
                      {formatBRL(item.valorLimite)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-surface">
                    <div
                      className={`h-1.5 rounded-full ${statusColor[item.status]}`}
                      style={{ width: `${Math.min(item.percentual, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* FAB */}
      <button
        type="button"
        aria-label="Nova transação"
        onClick={onNovaTransacao}
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-success text-2xl font-bold text-white shadow-lg hover:bg-success-strong"
      >
        +
      </button>
    </div>
  );
};
```

- [ ] **Step 4: Rodar — GREEN**

```bash
pnpm --filter web test -- --reporter=verbose dashboard-page
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/dashboard-page.tsx apps/web/src/pages/dashboard-page.test.tsx
git commit -m "feat(web): DashboardPage — cards, pizza, linha, orçamento"
```

---

### Task 13: Atualizar App.tsx + AuthProvider com WebSocket

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/contexts/auth-context.tsx`

- [ ] **Step 1: Conectar WebSocket no AuthProvider**

Em `apps/web/src/contexts/auth-context.tsx`, adicionar `useEffect` que observa `isAuthenticated`:

```ts
// Importar no topo:
import { useWebSocketStore } from '../stores/websocket.store';

// Dentro do AuthProvider, após o useEffect de localStorage:
const wsConnect = useWebSocketStore((s) => s.connect);
const wsDisconnect = useWebSocketStore((s) => s.disconnect);

useEffect(() => {
  if (session && session.familiaIdAtiva) {
    wsConnect({
      getAccessToken: () => session.accessToken,
      familiaId: session.familiaIdAtiva,
      clearSession: logout,
    });
  } else {
    wsDisconnect();
  }
}, [session, wsConnect, wsDisconnect, logout]);
```

- [ ] **Step 2: Atualizar App.tsx**

Substituir `'home'` por `'dashboard'` e importar `DashboardPage`:

```ts
// Adicionar import:
import { DashboardPage } from '@/pages/dashboard-page';

// Atualizar tipo Screen: adicionar 'dashboard', remover 'home' se for substituição total.
// Mudar screen inicial de login para 'dashboard' após login.
// Renderizar DashboardPage no lugar de HomePage quando screen === 'dashboard'.
```

- [ ] **Step 3: Rodar todos os testes**

```bash
pnpm --filter web test -- --reporter=verbose
pnpm --filter api test -- --reporter=verbose
```

Expected: todos PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/contexts/auth-context.tsx apps/web/src/App.tsx
git commit -m "feat(web): integrar WebSocket no AuthProvider e DashboardPage no App"
```

---

### Task 14: CI local completo + atualizar TASKS.md

- [ ] **Step 1: Lint**

```bash
pnpm --filter api lint
pnpm --filter web lint
```

Expected: sem erros.

- [ ] **Step 2: Type-check**

```bash
pnpm --filter api typecheck
pnpm --filter web typecheck
```

Expected: sem erros.

- [ ] **Step 3: Testes completos com cobertura**

```bash
pnpm --filter api test
pnpm --filter web test
```

Expected: PASS.

- [ ] **Step 4: Atualizar TASKS.md**

Marcar todas as tasks da Fase 5 como `[x]`.

- [ ] **Step 5: Commit final**

```bash
git add TASKS.md
git commit -m "chore: marcar tasks da Fase 5 como concluídas"
```

- [ ] **Step 6: Push e abrir PR**

```bash
git push origin HEAD
gh pr create --title "feat: Fase 5 — Dashboard e Tempo Real" --body "$(cat <<'EOF'
## Summary
- Módulo `dashboard` com 3 rotas REST (resumo, gráficos, orçamento)
- WebSocket com rooms por família, heartbeat e eventBus desacoplado
- Frontend: DashboardPage com Chart.js (pizza + linha), barras de orçamento
- useWebSocketStore com reconexão exponencial integrada ao AuthContext

## Test plan
- [ ] Testar `GET /api/dashboard`, `/graficos`, `/orcamento` com JWT e sem JWT
- [ ] Verificar dashboard com zeros (família sem transações)
- [ ] Verificar orçamento com categorias em ok/warning/exceeded
- [ ] Conectar WebSocket e criar transação — verificar atualização automática
- [ ] Desconectar rede e verificar reconexão com back-off
EOF
)"
```

---

## Ordem de execução sugerida para agentes paralelos

As Tasks 1–5 (Chunk 1) e Tasks 6–7 (Chunk 2) são independentes entre si e podem ser executadas em paralelo. Tasks 8–10 (Chunk 3) dependem dos tipos de Chunk 1. Tasks 11–13 (Chunk 4) dependem de Chunks 1–3.

Sequência segura para agente único: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14.
