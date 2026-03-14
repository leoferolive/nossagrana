# Fase 6 — Orçamento e Relatórios — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Orçamento CRUD, Relatórios (distribuição, por-usuário, tendências) and Fatura do Cartão — backend routes + frontend pages — completing Fase 6 of TASKS.md.

**Architecture:** Three new backend modules (`orcamento`, `relatorio`) plus one new route in `metodo-pagamento`. Shared Zod schemas added to `packages/types`. Three new frontend pages (`OrcamentoPage`, `RelatoriosPage`, `FaturaPage`) with navigation wired in `App.tsx`. No new Zustand stores — pages use local `useState`+`useEffect` calling services directly.

**Tech Stack:** Fastify + Drizzle ORM + Zod (backend), React + Tailwind + @testing-library/react + Vitest (frontend), shared types in `packages/types`.

---

## Chunk 1: Types + Orçamento Module

### Task 1: Add Orçamento + Relatórios + Fatura shared types

**Files:**
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: Add schemas to `packages/types/src/index.ts`**

Append after the existing dashboard section:

```typescript
// ─── Orçamento ────────────────────────────────────────────────────────────────

export const orcamentoQuerySchema = z.object({
  mesReferencia: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});
export type OrcamentoQuery = z.infer<typeof orcamentoQuerySchema>;

export const orcamentoCategoriaParamsSchema = z.object({
  categoriaId: z.string().uuid(),
});
export type OrcamentoCategoriaParams = z.infer<typeof orcamentoCategoriaParamsSchema>;

export const orcamentoSetRequestSchema = z.object({
  valorLimite: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Valor inválido'),
  vigenciaInicio: z.string().regex(/^\d{4}-\d{2}$/, 'Mês no formato YYYY-MM'),
});
export type OrcamentoSetRequest = z.infer<typeof orcamentoSetRequestSchema>;

export const orcamentoItemSchema = z.object({
  id: z.string().uuid(),
  categoriaId: z.string().uuid(),
  categoriaNome: z.string(),
  valorLimite: z.string(),
  vigenciaInicio: z.string(),
  vigenciaFim: z.string().nullable(),
  totalGasto: z.string(),
  percentual: z.number(),
  status: z.enum(['ok', 'warning', 'exceeded']),
});
export type OrcamentoItem = z.infer<typeof orcamentoItemSchema>;

export const orcamentoListResponseSchema = z.object({
  orcamentos: z.array(orcamentoItemSchema),
});
export type OrcamentoListResponse = z.infer<typeof orcamentoListResponseSchema>;

export const orcamentoHistoricoItemSchema = z.object({
  id: z.string().uuid(),
  valorLimite: z.string(),
  vigenciaInicio: z.string(),
  vigenciaFim: z.string().nullable(),
  criadoEm: z.string(),
});
export type OrcamentoHistoricoItem = z.infer<typeof orcamentoHistoricoItemSchema>;

export const orcamentoHistoricoResponseSchema = z.object({
  historico: z.array(orcamentoHistoricoItemSchema),
});
export type OrcamentoHistoricoResponse = z.infer<typeof orcamentoHistoricoResponseSchema>;

export const orcamentoSetResponseSchema = z.object({
  orcamento: orcamentoHistoricoItemSchema,
});
export type OrcamentoSetResponse = z.infer<typeof orcamentoSetResponseSchema>;

// ─── Relatórios ───────────────────────────────────────────────────────────────

export const relatorioQuerySchema = z.object({
  mesReferencia: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});
export type RelatorioQuery = z.infer<typeof relatorioQuerySchema>;

export const relatorioTendenciasQuerySchema = z.object({
  meses: z.coerce.number().int().min(1).max(24).optional().default(6),
});
export type RelatorioTendenciasQuery = z.infer<typeof relatorioTendenciasQuerySchema>;

export const relatorioDistribuicaoItemSchema = z.object({
  categoriaId: z.string().uuid(),
  categoriaNome: z.string(),
  total: z.string(),
  percentual: z.number(),
});
export type RelatorioDistribuicaoItem = z.infer<typeof relatorioDistribuicaoItemSchema>;

export const relatorioDistribuicaoResponseSchema = z.object({
  mesReferencia: z.string(),
  distribuicao: z.array(relatorioDistribuicaoItemSchema),
});
export type RelatorioDistribuicaoResponse = z.infer<typeof relatorioDistribuicaoResponseSchema>;

export const relatorioPorUsuarioItemSchema = z.object({
  usuarioId: z.string().uuid(),
  usuarioNome: z.string(),
  total: z.string(),
  percentual: z.number(),
});
export type RelatorioPorUsuarioItem = z.infer<typeof relatorioPorUsuarioItemSchema>;

export const relatorioPorUsuarioResponseSchema = z.object({
  mesReferencia: z.string(),
  porUsuario: z.array(relatorioPorUsuarioItemSchema),
});
export type RelatorioPorUsuarioResponse = z.infer<typeof relatorioPorUsuarioResponseSchema>;

export const relatorioTendenciaMesSchema = z.object({
  mesReferencia: z.string(),
  totalReceitas: z.string(),
  totalDespesas: z.string(),
  saldo: z.string(),
});
export type RelatorioTendenciaMes = z.infer<typeof relatorioTendenciaMesSchema>;

export const relatorioTendenciasResponseSchema = z.object({
  meses: z.array(relatorioTendenciaMesSchema),
});
export type RelatorioTendenciasResponse = z.infer<typeof relatorioTendenciasResponseSchema>;

// ─── Fatura ───────────────────────────────────────────────────────────────────

export const faturaParamsSchema = z.object({
  id: z.string().uuid(),
  mesReferencia: z.string().regex(/^\d{4}-\d{2}$/, 'Mês no formato YYYY-MM'),
});
export type FaturaParams = z.infer<typeof faturaParamsSchema>;

export const faturaItemSchema = z.object({
  id: z.string().uuid(),
  descricao: z.string().nullable(),
  valor: z.string(),
  data: z.string(),
  categoriaId: z.string().uuid(),
  categoriaNome: z.string(),
  usuarioNome: z.string(),
  parcelaAtual: z.number().nullable(),
  numeroParcelas: z.number().nullable(),
});
export type FaturaItem = z.infer<typeof faturaItemSchema>;

export const faturaResponseSchema = z.object({
  metodoPagamentoId: z.string().uuid(),
  mesReferencia: z.string(),
  total: z.string(),
  transacoes: z.array(faturaItemSchema),
});
export type FaturaResponse = z.infer<typeof faturaResponseSchema>;
```

- [ ] **Step 2: Build types package**

```bash
pnpm --filter @nossagrana/types build
```
Expected: success, no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/types/src/index.ts
git commit -m "feat(types): adicionar schemas de orcamento, relatorios e fatura"
```

---

### Task 2: Orçamento module — types and repository

**Files:**
- Create: `apps/api/src/modules/orcamento/orcamento.types.ts`
- Create: `apps/api/src/modules/orcamento/orcamento.repository.ts`

- [ ] **Step 1: Write failing service test (stub — repository interface not yet defined)**

Create `apps/api/src/modules/orcamento/orcamento.service.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from 'vitest';

import { InMemoryOrcamentoRepository } from './orcamento.repository.js';
import { OrcamentoService } from './orcamento.service.js';

describe('OrcamentoService', () => {
  let repo: InMemoryOrcamentoRepository;
  let service: OrcamentoService;
  const familiaId = 'fam-1';
  const categoriaId = 'cat-1';
  const usuarioId = 'usr-1';

  beforeEach(() => {
    repo = new InMemoryOrcamentoRepository();
    service = new OrcamentoService(repo);
  });

  it('retorna lista vazia quando nao ha orcamentos', async () => {
    const result = await service.list(familiaId, '2026-03');
    expect(result.orcamentos).toEqual([]);
  });

  it('define orcamento para categoria e retorna na listagem', async () => {
    await service.set({ familiaId, categoriaId, usuarioId, valorLimite: '500.00', vigenciaInicio: '2026-03' });
    const result = await service.list(familiaId, '2026-03');
    expect(result.orcamentos).toHaveLength(1);
    expect(result.orcamentos[0].categoriaId).toBe(categoriaId);
    expect(result.orcamentos[0].valorLimite).toBe('500.00');
    expect(result.orcamentos[0].totalGasto).toBe('0.00');
    expect(result.orcamentos[0].percentual).toBe(0);
    expect(result.orcamentos[0].status).toBe('ok');
  });

  it('calcula percentual e status warning quando gasto >= 80%', async () => {
    repo.seedTransacao({ familiaId, categoriaId, mesReferencia: '2026-03', valor: '420.00' });
    await service.set({ familiaId, categoriaId, usuarioId, valorLimite: '500.00', vigenciaInicio: '2026-03' });
    const result = await service.list(familiaId, '2026-03');
    expect(result.orcamentos[0].percentual).toBe(84);
    expect(result.orcamentos[0].status).toBe('warning');
  });

  it('calcula status exceeded quando gasto >= 100%', async () => {
    repo.seedTransacao({ familiaId, categoriaId, mesReferencia: '2026-03', valor: '600.00' });
    await service.set({ familiaId, categoriaId, usuarioId, valorLimite: '500.00', vigenciaInicio: '2026-03' });
    const result = await service.list(familiaId, '2026-03');
    expect(result.orcamentos[0].status).toBe('exceeded');
  });

  it('encerra orcamento anterior ao definir novo com vigencia futura', async () => {
    await service.set({ familiaId, categoriaId, usuarioId, valorLimite: '500.00', vigenciaInicio: '2026-01' });
    await service.set({ familiaId, categoriaId, usuarioId, valorLimite: '800.00', vigenciaInicio: '2026-03' });
    const historico = await service.historico(familiaId, categoriaId);
    expect(historico.historico).toHaveLength(2);
    // Anterior deve ter sido encerrado em 2026-02
    const anterior = historico.historico.find((h) => h.valorLimite === '500.00');
    expect(anterior?.vigenciaFim).toBe('2026-02');
    // Novo deve estar aberto
    const novo = historico.historico.find((h) => h.valorLimite === '800.00');
    expect(novo?.vigenciaFim).toBeNull();
  });

  it('retorna historico por categoria ordenado por vigenciaInicio desc', async () => {
    await service.set({ familiaId, categoriaId, usuarioId, valorLimite: '300.00', vigenciaInicio: '2026-01' });
    await service.set({ familiaId, categoriaId, usuarioId, valorLimite: '500.00', vigenciaInicio: '2026-03' });
    const result = await service.historico(familiaId, categoriaId);
    expect(result.historico[0].valorLimite).toBe('500.00');
    expect(result.historico[1].valorLimite).toBe('300.00');
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm --filter api test -- --reporter=verbose orcamento.service
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create `orcamento.types.ts`**

```typescript
import type { OrcamentoHistoricoResponse, OrcamentoItem, OrcamentoListResponse } from '@nossagrana/types';

export interface OrcamentoVigenteRow {
  id: string;
  categoriaId: string;
  categoriaNome: string;
  valorLimite: string;
  vigenciaInicio: string;
  vigenciaFim: string | null;
}

export interface OrcamentoHistoricoRow {
  id: string;
  valorLimite: string;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  criadoEm: Date;
}

export interface OrcamentoSetInput {
  familiaId: string;
  categoriaId: string;
  usuarioId: string;
  valorLimite: string;
  vigenciaInicio: string;
}

export interface OrcamentoRepository {
  listVigentes(familiaId: string, mesReferencia: string): Promise<OrcamentoVigenteRow[]>;
  getGastosPorCategoria(familiaId: string, mesReferencia: string): Promise<Map<string, string>>;
  findAberto(familiaId: string, categoriaId: string): Promise<OrcamentoHistoricoRow | null>;
  encerrar(id: string, vigenciaFim: string): Promise<void>;
  insert(input: OrcamentoSetInput): Promise<OrcamentoHistoricoRow>;
  listHistorico(familiaId: string, categoriaId: string): Promise<OrcamentoHistoricoRow[]>;
}

export type { OrcamentoHistoricoResponse, OrcamentoItem, OrcamentoListResponse };
```

- [ ] **Step 4: Create `orcamento.repository.ts`** (InMemory only — Drizzle added after service tests pass)

```typescript
import { and, eq, gte, isNull, lte, or, sql } from 'drizzle-orm';

import { db } from '../../db/client.js';
import { categorias, orcamentoCategoria, transacoes } from '../../db/schema.js';
import type {
  OrcamentoHistoricoRow,
  OrcamentoRepository,
  OrcamentoSetInput,
  OrcamentoVigenteRow,
} from './orcamento.types.js';

interface SeedTransacaoInput {
  familiaId: string;
  categoriaId: string;
  mesReferencia: string;
  valor: string;
}

// ─── InMemory ─────────────────────────────────────────────────────────────────

export class InMemoryOrcamentoRepository implements OrcamentoRepository {
  private _orcamentos: (OrcamentoHistoricoRow & {
    familiaId: string;
    categoriaId: string;
    categoriaNome: string;
    criadoPor: string;
  })[] = [];
  private _transacoes: SeedTransacaoInput[] = [];
  private _idCounter = 1;

  seedTransacao(t: SeedTransacaoInput) {
    this._transacoes.push(t);
  }

  async listVigentes(familiaId: string, mesReferencia: string): Promise<OrcamentoVigenteRow[]> {
    return this._orcamentos
      .filter(
        (o) =>
          o.familiaId === familiaId &&
          o.vigenciaInicio <= mesReferencia &&
          (o.vigenciaFim === null || o.vigenciaFim >= mesReferencia),
      )
      .map((o) => ({
        id: o.id,
        categoriaId: o.categoriaId,
        categoriaNome: o.categoriaNome,
        valorLimite: o.valorLimite,
        vigenciaInicio: o.vigenciaInicio,
        vigenciaFim: o.vigenciaFim,
      }));
  }

  async getGastosPorCategoria(familiaId: string, mesReferencia: string): Promise<Map<string, string>> {
    const map = new Map<string, number>();
    for (const t of this._transacoes) {
      if (t.familiaId === familiaId && t.mesReferencia === mesReferencia) {
        map.set(t.categoriaId, (map.get(t.categoriaId) ?? 0) + parseFloat(t.valor));
      }
    }
    return new Map(Array.from(map.entries()).map(([k, v]) => [k, v.toFixed(2)]));
  }

  async findAberto(familiaId: string, categoriaId: string): Promise<OrcamentoHistoricoRow | null> {
    const found = this._orcamentos.find(
      (o) => o.familiaId === familiaId && o.categoriaId === categoriaId && o.vigenciaFim === null,
    );
    return found ?? null;
  }

  async encerrar(id: string, vigenciaFim: string): Promise<void> {
    const o = this._orcamentos.find((o) => o.id === id);
    if (o) o.vigenciaFim = vigenciaFim;
  }

  async insert(input: OrcamentoSetInput): Promise<OrcamentoHistoricoRow> {
    const row = {
      id: `orcamento-${this._idCounter++}`,
      familiaId: input.familiaId,
      categoriaId: input.categoriaId,
      categoriaNome: input.categoriaId, // simplified for InMemory
      criadoPor: input.usuarioId,
      valorLimite: input.valorLimite,
      vigenciaInicio: input.vigenciaInicio,
      vigenciaFim: null,
      criadoEm: new Date(),
    };
    this._orcamentos.push(row);
    return row;
  }

  async listHistorico(familiaId: string, categoriaId: string): Promise<OrcamentoHistoricoRow[]> {
    return this._orcamentos
      .filter((o) => o.familiaId === familiaId && o.categoriaId === categoriaId)
      .sort((a, b) => b.vigenciaInicio.localeCompare(a.vigenciaInicio))
      .map((o) => ({
        id: o.id,
        valorLimite: o.valorLimite,
        vigenciaInicio: o.vigenciaInicio,
        vigenciaFim: o.vigenciaFim,
        criadoEm: o.criadoEm,
      }));
  }
}

// ─── Drizzle ──────────────────────────────────────────────────────────────────

export class DrizzleOrcamentoRepository implements OrcamentoRepository {
  async listVigentes(familiaId: string, mesReferencia: string): Promise<OrcamentoVigenteRow[]> {
    return db
      .select({
        id: orcamentoCategoria.id,
        categoriaId: orcamentoCategoria.categoriaId,
        categoriaNome: categorias.nome,
        valorLimite: orcamentoCategoria.valorLimite,
        vigenciaInicio: orcamentoCategoria.vigenciaInicio,
        vigenciaFim: orcamentoCategoria.vigenciaFim,
      })
      .from(orcamentoCategoria)
      .innerJoin(categorias, eq(orcamentoCategoria.categoriaId, categorias.id))
      .where(
        and(
          eq(orcamentoCategoria.familiaId, familiaId),
          lte(orcamentoCategoria.vigenciaInicio, mesReferencia),
          or(isNull(orcamentoCategoria.vigenciaFim), gte(orcamentoCategoria.vigenciaFim, mesReferencia)),
        ),
      );
  }

  async getGastosPorCategoria(familiaId: string, mesReferencia: string): Promise<Map<string, string>> {
    const rows = await db
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
    return new Map(rows.map((r) => [r.categoriaId, r.totalGasto]));
  }

  async findAberto(familiaId: string, categoriaId: string): Promise<OrcamentoHistoricoRow | null> {
    const rows = await db
      .select({
        id: orcamentoCategoria.id,
        valorLimite: orcamentoCategoria.valorLimite,
        vigenciaInicio: orcamentoCategoria.vigenciaInicio,
        vigenciaFim: orcamentoCategoria.vigenciaFim,
        criadoEm: orcamentoCategoria.criadoEm,
      })
      .from(orcamentoCategoria)
      .where(
        and(
          eq(orcamentoCategoria.familiaId, familiaId),
          eq(orcamentoCategoria.categoriaId, categoriaId),
          isNull(orcamentoCategoria.vigenciaFim),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async encerrar(id: string, vigenciaFim: string): Promise<void> {
    await db
      .update(orcamentoCategoria)
      .set({ vigenciaFim })
      .where(eq(orcamentoCategoria.id, id));
  }

  async insert(input: OrcamentoSetInput): Promise<OrcamentoHistoricoRow> {
    const rows = await db
      .insert(orcamentoCategoria)
      .values({
        familiaId: input.familiaId,
        categoriaId: input.categoriaId,
        valorLimite: input.valorLimite,
        vigenciaInicio: input.vigenciaInicio,
        vigenciaFim: null,
        criadoPor: input.usuarioId,
      })
      .returning({
        id: orcamentoCategoria.id,
        valorLimite: orcamentoCategoria.valorLimite,
        vigenciaInicio: orcamentoCategoria.vigenciaInicio,
        vigenciaFim: orcamentoCategoria.vigenciaFim,
        criadoEm: orcamentoCategoria.criadoEm,
      });
    return rows[0];
  }

  async listHistorico(familiaId: string, categoriaId: string): Promise<OrcamentoHistoricoRow[]> {
    return db
      .select({
        id: orcamentoCategoria.id,
        valorLimite: orcamentoCategoria.valorLimite,
        vigenciaInicio: orcamentoCategoria.vigenciaInicio,
        vigenciaFim: orcamentoCategoria.vigenciaFim,
        criadoEm: orcamentoCategoria.criadoEm,
      })
      .from(orcamentoCategoria)
      .where(
        and(
          eq(orcamentoCategoria.familiaId, familiaId),
          eq(orcamentoCategoria.categoriaId, categoriaId),
        ),
      )
      .orderBy(sql`${orcamentoCategoria.vigenciaInicio} DESC`);
  }
}
```

- [ ] **Step 5: Run test — still failing (service not yet created)**

```bash
pnpm --filter api test -- --reporter=verbose orcamento.service
```
Expected: FAIL — OrcamentoService not found.

---

### Task 3: Orçamento service

**Files:**
- Create: `apps/api/src/modules/orcamento/orcamento.service.ts`

- [ ] **Step 1: Create `orcamento.service.ts`**

Helper — mês anterior de YYYY-MM:
```typescript
function mesAnterior(mes: string): string {
  const [ano, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(ano, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function calcularStatus(percentual: number): 'ok' | 'warning' | 'exceeded' {
  if (percentual >= 100) return 'exceeded';
  if (percentual >= 80) return 'warning';
  return 'ok';
}
```

Full service:
```typescript
import type { OrcamentoHistoricoResponse, OrcamentoListResponse, OrcamentoSetInput } from '@nossagrana/types';

import type { OrcamentoRepository } from './orcamento.types.js';

function mesAnterior(mes: string): string {
  const [ano, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(ano, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function calcularStatus(percentual: number): 'ok' | 'warning' | 'exceeded' {
  if (percentual >= 100) return 'exceeded';
  if (percentual >= 80) return 'warning';
  return 'ok';
}

export class OrcamentoService {
  constructor(private readonly repo: OrcamentoRepository) {}

  async list(familiaId: string, mesReferencia: string): Promise<OrcamentoListResponse> {
    const [vigentes, gastos] = await Promise.all([
      this.repo.listVigentes(familiaId, mesReferencia),
      this.repo.getGastosPorCategoria(familiaId, mesReferencia),
    ]);

    const orcamentos = vigentes.map((o) => {
      const totalGasto = gastos.get(o.categoriaId) ?? '0.00';
      const percentual =
        parseFloat(o.valorLimite) === 0
          ? 0
          : Math.round((parseFloat(totalGasto) / parseFloat(o.valorLimite)) * 1000) / 10;
      return {
        id: o.id,
        categoriaId: o.categoriaId,
        categoriaNome: o.categoriaNome,
        valorLimite: o.valorLimite,
        vigenciaInicio: o.vigenciaInicio,
        vigenciaFim: o.vigenciaFim,
        totalGasto,
        percentual,
        status: calcularStatus(percentual),
      };
    });

    return { orcamentos };
  }

  async set(input: OrcamentoSetInput & { familiaId: string; categoriaId: string; usuarioId: string }): Promise<void> {
    const aberto = await this.repo.findAberto(input.familiaId, input.categoriaId);
    if (aberto) {
      await this.repo.encerrar(aberto.id, mesAnterior(input.vigenciaInicio));
    }
    await this.repo.insert(input);
  }

  async historico(familiaId: string, categoriaId: string): Promise<OrcamentoHistoricoResponse> {
    const rows = await this.repo.listHistorico(familiaId, categoriaId);
    return {
      historico: rows.map((r) => ({
        id: r.id,
        valorLimite: r.valorLimite,
        vigenciaInicio: r.vigenciaInicio,
        vigenciaFim: r.vigenciaFim,
        criadoEm: r.criadoEm.toISOString(),
      })),
    };
  }
}
```

Note: `OrcamentoSetInput` needs to include `familiaId`, `categoriaId`, `usuarioId`. The interface in types is simpler. Use the types.ts `OrcamentoSetInput` interface (from `orcamento.types.ts`, not `@nossagrana/types`).

Correct import — use the interface from `orcamento.types.ts`:
```typescript
import type { OrcamentoHistoricoResponse, OrcamentoListResponse } from '@nossagrana/types';
import type { OrcamentoRepository, OrcamentoSetInput } from './orcamento.types.js';
```

- [ ] **Step 2: Run service tests — should pass**

```bash
pnpm --filter api test -- --reporter=verbose orcamento.service
```
Expected: all 6 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/orcamento/
git commit -m "feat(api): adicionar OrcamentoService com InMemory e Drizzle repositories"
```

---

### Task 4: Orçamento routes + schema + app registration

**Files:**
- Create: `apps/api/src/modules/orcamento/orcamento.schema.ts`
- Create: `apps/api/src/modules/orcamento/orcamento.routes.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Create `orcamento.schema.ts`**

```typescript
import { z } from 'zod';

const orcamentoItemZod = z.object({
  id: z.string().uuid(),
  categoriaId: z.string().uuid(),
  categoriaNome: z.string(),
  valorLimite: z.string(),
  vigenciaInicio: z.string(),
  vigenciaFim: z.string().nullable(),
  totalGasto: z.string(),
  percentual: z.number(),
  status: z.enum(['ok', 'warning', 'exceeded']),
});

const orcamentoHistoricoItemZod = z.object({
  id: z.string().uuid(),
  valorLimite: z.string(),
  vigenciaInicio: z.string(),
  vigenciaFim: z.string().nullable(),
  criadoEm: z.string(),
});

export const orcamentoListSchema = {
  querystring: z.object({ mesReferencia: z.string().regex(/^\d{4}-\d{2}$/).optional() }),
  response: { 200: z.object({ orcamentos: z.array(orcamentoItemZod) }) },
};

export const orcamentoSetSchema = {
  params: z.object({ categoriaId: z.string().uuid() }),
  body: z.object({
    valorLimite: z.string().regex(/^\d+(\.\d{1,2})?$/),
    vigenciaInicio: z.string().regex(/^\d{4}-\d{2}$/),
  }),
  response: { 200: z.object({ orcamento: orcamentoHistoricoItemZod }) },
};

export const orcamentoHistoricoSchema = {
  params: z.object({ categoriaId: z.string().uuid() }),
  response: { 200: z.object({ historico: z.array(orcamentoHistoricoItemZod) }) },
};
```

- [ ] **Step 2: Create `orcamento.routes.ts`**

```typescript
import {
  orcamentoCategoriaParamsSchema,
  orcamentoQuerySchema,
  orcamentoSetRequestSchema,
} from '@nossagrana/types';
import type { FastifyPluginAsync } from 'fastify';

import { env } from '../../config/env.js';
import {
  DrizzleOrcamentoRepository,
  InMemoryOrcamentoRepository,
} from './orcamento.repository.js';
import {
  orcamentoHistoricoSchema,
  orcamentoListSchema,
  orcamentoSetSchema,
} from './orcamento.schema.js';
import { OrcamentoService } from './orcamento.service.js';

const defaultService = () => {
  const repo =
    env.NODE_ENV === 'test'
      ? new InMemoryOrcamentoRepository()
      : new DrizzleOrcamentoRepository();
  return new OrcamentoService(repo);
};

export const orcamentoRoutes: FastifyPluginAsync = async (fastify) => {
  const service = defaultService();

  fastify.get(
    '/orcamento',
    { preHandler: [fastify.authenticate, fastify.requireFamiliaScope], schema: orcamentoListSchema },
    async (request) => {
      const { mesReferencia: qMes } = orcamentoQuerySchema.parse(request.query);
      const mes = qMes ?? getCurrentMes();
      return service.list(request.familiaIdAtiva as string, mes);
    },
  );

  fastify.post(
    '/orcamento/:categoriaId',
    { preHandler: [fastify.authenticate, fastify.requireFamiliaScope], schema: orcamentoSetSchema },
    async (request, reply) => {
      const { categoriaId } = orcamentoCategoriaParamsSchema.parse(request.params);
      const { valorLimite, vigenciaInicio } = orcamentoSetRequestSchema.parse(request.body);
      await service.set({
        familiaId: request.familiaIdAtiva as string,
        categoriaId,
        usuarioId: request.user.sub,
        valorLimite,
        vigenciaInicio,
      });
      const historico = await service.historico(request.familiaIdAtiva as string, categoriaId);
      return reply.code(200).send({ orcamento: historico.historico[0] });
    },
  );

  fastify.get(
    '/orcamento/:categoriaId/historico',
    { preHandler: [fastify.authenticate, fastify.requireFamiliaScope], schema: orcamentoHistoricoSchema },
    async (request) => {
      const { categoriaId } = orcamentoCategoriaParamsSchema.parse(request.params);
      return service.historico(request.familiaIdAtiva as string, categoriaId);
    },
  );
};

function getCurrentMes(): string {
  const now = new Date();
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const ano = partes.find((p) => p.type === 'year')!.value;
  const mes = partes.find((p) => p.type === 'month')!.value;
  return `${ano}-${mes}`;
}
```

- [ ] **Step 3: Register in `app.ts`**

Add imports and registration:
```typescript
import { orcamentoRoutes } from './modules/orcamento/orcamento.routes.js';
// ...
app.register(orcamentoRoutes, { prefix: '/api' });
```

- [ ] **Step 4: Write integration tests for orçamento routes in `app.test.ts`**

Append a new `describe` block:
```typescript
describe('Orçamento routes', () => {
  const app = buildApp();
  let accessToken: string;
  let familiaId: string;
  let categoriaId: string;

  beforeAll(async () => {
    await app.ready();
    ({ accessToken, familiaId, categoriaId } = await setupUserFamilyAndCategory('orc@example.com'));
  });

  afterAll(() => app.close());

  it('GET /api/orcamento retorna lista vazia inicialmente', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/orcamento?mesReferencia=2026-03',
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familiaId },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().orcamentos).toEqual([]);
  });

  it('GET /api/orcamento sem JWT retorna 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/orcamento' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/orcamento/:categoriaId define limite e retorna orcamento', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/orcamento/${categoriaId}`,
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familiaId },
      payload: { valorLimite: '500.00', vigenciaInicio: '2026-03' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().orcamento.valorLimite).toBe('500.00');
    expect(res.json().orcamento.vigenciaInicio).toBe('2026-03');
  });

  it('GET /api/orcamento/:categoriaId/historico retorna historico', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/orcamento/${categoriaId}/historico`,
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familiaId },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().historico.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 5: Run all API tests**

```bash
pnpm --filter api test
```
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/orcamento/ apps/api/src/app.ts apps/api/src/app.test.ts
git commit -m "feat(api): adicionar rotas de orcamento (GET/POST/historico)"
```

---

## Chunk 2: Relatórios + Fatura Backend

### Task 5: Relatórios module

**Files:**
- Create: `apps/api/src/modules/relatorio/relatorio.types.ts`
- Create: `apps/api/src/modules/relatorio/relatorio.repository.ts`
- Create: `apps/api/src/modules/relatorio/relatorio.service.ts`
- Create: `apps/api/src/modules/relatorio/relatorio.service.test.ts`
- Create: `apps/api/src/modules/relatorio/relatorio.schema.ts`
- Create: `apps/api/src/modules/relatorio/relatorio.routes.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Write failing service test**

Create `apps/api/src/modules/relatorio/relatorio.service.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from 'vitest';

import { InMemoryRelatorioRepository } from './relatorio.repository.js';
import { RelatorioService } from './relatorio.service.js';

describe('RelatorioService', () => {
  let repo: InMemoryRelatorioRepository;
  let service: RelatorioService;
  const familiaId = 'fam-1';

  beforeEach(() => {
    repo = new InMemoryRelatorioRepository();
    service = new RelatorioService(repo);
  });

  it('distribuicao retorna lista vazia quando nao ha despesas', async () => {
    const result = await service.distribuicao(familiaId, '2026-03');
    expect(result.distribuicao).toEqual([]);
    expect(result.mesReferencia).toBe('2026-03');
  });

  it('distribuicao calcula percentual por categoria', async () => {
    repo.seed({
      transacoes: [
        { familiaId, tipo: 'despesa', valor: '200.00', categoriaId: 'cat-1', categoriaNome: 'Alimentação', mesReferencia: '2026-03', usuarioId: 'usr-1', usuarioNome: 'Leo' },
        { familiaId, tipo: 'despesa', valor: '100.00', categoriaId: 'cat-2', categoriaNome: 'Lazer', mesReferencia: '2026-03', usuarioId: 'usr-1', usuarioNome: 'Leo' },
      ],
    });
    const result = await service.distribuicao(familiaId, '2026-03');
    expect(result.distribuicao).toHaveLength(2);
    const alimentacao = result.distribuicao.find((d) => d.categoriaNome === 'Alimentação')!;
    expect(alimentacao.percentual).toBeCloseTo(66.7, 0);
  });

  it('porUsuario retorna gastos agrupados por usuario', async () => {
    repo.seed({
      transacoes: [
        { familiaId, tipo: 'despesa', valor: '300.00', categoriaId: 'cat-1', categoriaNome: 'Alimentação', mesReferencia: '2026-03', usuarioId: 'usr-1', usuarioNome: 'Leo' },
        { familiaId, tipo: 'despesa', valor: '100.00', categoriaId: 'cat-1', categoriaNome: 'Alimentação', mesReferencia: '2026-03', usuarioId: 'usr-2', usuarioNome: 'Ana' },
      ],
    });
    const result = await service.porUsuario(familiaId, '2026-03');
    expect(result.porUsuario).toHaveLength(2);
    const leo = result.porUsuario.find((u) => u.usuarioNome === 'Leo')!;
    expect(leo.total).toBe('300.00');
    expect(leo.percentual).toBe(75);
  });

  it('tendencias retorna N meses regressivos com totais', async () => {
    repo.seed({
      transacoes: [
        { familiaId, tipo: 'receita', valor: '5000.00', categoriaId: 'cat-1', categoriaNome: 'Salário', mesReferencia: '2026-03', usuarioId: 'usr-1', usuarioNome: 'Leo' },
        { familiaId, tipo: 'despesa', valor: '2000.00', categoriaId: 'cat-2', categoriaNome: 'Alimentação', mesReferencia: '2026-03', usuarioId: 'usr-1', usuarioNome: 'Leo' },
      ],
    });
    const result = await service.tendencias(familiaId, '2026-03', 3);
    expect(result.meses).toHaveLength(3);
    const marco = result.meses.find((m) => m.mesReferencia === '2026-03')!;
    expect(marco.totalReceitas).toBe('5000.00');
    expect(marco.totalDespesas).toBe('2000.00');
    expect(marco.saldo).toBe('3000.00');
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm --filter api test -- --reporter=verbose relatorio.service
```
Expected: FAIL.

- [ ] **Step 3: Create `relatorio.types.ts`**

```typescript
import type {
  RelatorioDistribuicaoResponse,
  RelatorioPorUsuarioResponse,
  RelatorioTendenciasResponse,
} from '@nossagrana/types';

export interface RelatorioTransacaoRow {
  familiaId: string;
  tipo: 'receita' | 'despesa';
  valor: string;
  categoriaId: string;
  categoriaNome: string;
  mesReferencia: string;
  usuarioId: string;
  usuarioNome: string;
}

export interface RelatorioRepository {
  getTransacoes(familiaId: string, mesReferencia: string): Promise<RelatorioTransacaoRow[]>;
}

export type {
  RelatorioDistribuicaoResponse,
  RelatorioPorUsuarioResponse,
  RelatorioTendenciasResponse,
};
```

- [ ] **Step 4: Create `relatorio.repository.ts`**

```typescript
import { and, eq, sql } from 'drizzle-orm';

import { db } from '../../db/client.js';
import { categorias, transacoes, users } from '../../db/schema.js';
import type { RelatorioRepository, RelatorioTransacaoRow } from './relatorio.types.js';

interface SeedTransacaoInput {
  familiaId: string;
  tipo: 'receita' | 'despesa';
  valor: string;
  categoriaId: string;
  categoriaNome: string;
  mesReferencia: string;
  usuarioId: string;
  usuarioNome: string;
}

// ─── InMemory ─────────────────────────────────────────────────────────────────

export class InMemoryRelatorioRepository implements RelatorioRepository {
  private _transacoes: SeedTransacaoInput[] = [];

  seed(data: { transacoes?: SeedTransacaoInput[] }) {
    if (data.transacoes) this._transacoes.push(...data.transacoes);
  }

  async getTransacoes(familiaId: string, mesReferencia: string): Promise<RelatorioTransacaoRow[]> {
    return this._transacoes.filter(
      (t) => t.familiaId === familiaId && t.mesReferencia === mesReferencia,
    );
  }
}

// ─── Drizzle ──────────────────────────────────────────────────────────────────

export class DrizzleRelatorioRepository implements RelatorioRepository {
  async getTransacoes(familiaId: string, mesReferencia: string): Promise<RelatorioTransacaoRow[]> {
    return db
      .select({
        familiaId: transacoes.familiaId,
        tipo: transacoes.tipo,
        valor: transacoes.valor,
        categoriaId: transacoes.categoriaId,
        categoriaNome: categorias.nome,
        mesReferencia: transacoes.mesReferencia,
        usuarioId: transacoes.usuarioRegistrouId,
        usuarioNome: users.nome,
      })
      .from(transacoes)
      .innerJoin(categorias, eq(transacoes.categoriaId, categorias.id))
      .innerJoin(users, eq(transacoes.usuarioRegistrouId, users.id))
      .where(
        and(
          eq(transacoes.familiaId, familiaId),
          eq(transacoes.mesReferencia, mesReferencia),
        ),
      );
  }
}
```

- [ ] **Step 5: Create `relatorio.service.ts`**

```typescript
import type {
  RelatorioDistribuicaoResponse,
  RelatorioPorUsuarioResponse,
  RelatorioTendenciasResponse,
} from '@nossagrana/types';

import type { RelatorioRepository } from './relatorio.types.js';

function mesAnteriorN(mesReferencia: string, n: number): string {
  const [ano, mes] = mesReferencia.split('-').map(Number);
  const d = new Date(Date.UTC(ano, mes - 1 - n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export class RelatorioService {
  constructor(private readonly repo: RelatorioRepository) {}

  async distribuicao(familiaId: string, mesReferencia: string): Promise<RelatorioDistribuicaoResponse> {
    const transacoes = await this.repo.getTransacoes(familiaId, mesReferencia);
    const despesas = transacoes.filter((t) => t.tipo === 'despesa');

    const map = new Map<string, { nome: string; total: number }>();
    for (const t of despesas) {
      const existing = map.get(t.categoriaId);
      if (existing) existing.total += parseFloat(t.valor);
      else map.set(t.categoriaId, { nome: t.categoriaNome, total: parseFloat(t.valor) });
    }

    const total = Array.from(map.values()).reduce((acc, v) => acc + v.total, 0);

    const distribuicao = Array.from(map.entries())
      .map(([categoriaId, { nome, total: cat }]) => ({
        categoriaId,
        categoriaNome: nome,
        total: cat.toFixed(2),
        percentual: total === 0 ? 0 : Math.round((cat / total) * 1000) / 10,
      }))
      .sort((a, b) => parseFloat(b.total) - parseFloat(a.total));

    return { mesReferencia, distribuicao };
  }

  async porUsuario(familiaId: string, mesReferencia: string): Promise<RelatorioPorUsuarioResponse> {
    const transacoes = await this.repo.getTransacoes(familiaId, mesReferencia);
    const despesas = transacoes.filter((t) => t.tipo === 'despesa');

    const map = new Map<string, { nome: string; total: number }>();
    for (const t of despesas) {
      const existing = map.get(t.usuarioId);
      if (existing) existing.total += parseFloat(t.valor);
      else map.set(t.usuarioId, { nome: t.usuarioNome, total: parseFloat(t.valor) });
    }

    const total = Array.from(map.values()).reduce((acc, v) => acc + v.total, 0);

    const porUsuario = Array.from(map.entries())
      .map(([usuarioId, { nome, total: u }]) => ({
        usuarioId,
        usuarioNome: nome,
        total: u.toFixed(2),
        percentual: total === 0 ? 0 : Math.round((u / total) * 1000) / 10,
      }))
      .sort((a, b) => parseFloat(b.total) - parseFloat(a.total));

    return { mesReferencia, porUsuario };
  }

  async tendencias(familiaId: string, mesReferencia: string, meses: number): Promise<RelatorioTendenciasResponse> {
    const mesRefs = Array.from({ length: meses }, (_, i) =>
      mesAnteriorN(mesReferencia, meses - 1 - i),
    );

    const resultados = await Promise.all(
      mesRefs.map(async (mes) => {
        const transacoes = await this.repo.getTransacoes(familiaId, mes);
        let totalReceitas = 0;
        let totalDespesas = 0;
        for (const t of transacoes) {
          if (t.tipo === 'receita') totalReceitas += parseFloat(t.valor);
          else totalDespesas += parseFloat(t.valor);
        }
        return {
          mesReferencia: mes,
          totalReceitas: totalReceitas.toFixed(2),
          totalDespesas: totalDespesas.toFixed(2),
          saldo: (totalReceitas - totalDespesas).toFixed(2),
        };
      }),
    );

    return { meses: resultados };
  }
}
```

- [ ] **Step 6: Run service tests — should pass**

```bash
pnpm --filter api test -- --reporter=verbose relatorio.service
```
Expected: all 4 tests PASS.

- [ ] **Step 7: Create `relatorio.schema.ts`**

```typescript
import { z } from 'zod';

const distribuicaoItemZod = z.object({
  categoriaId: z.string().uuid(),
  categoriaNome: z.string(),
  total: z.string(),
  percentual: z.number(),
});

const porUsuarioItemZod = z.object({
  usuarioId: z.string().uuid(),
  usuarioNome: z.string(),
  total: z.string(),
  percentual: z.number(),
});

const tendenciaMesZod = z.object({
  mesReferencia: z.string(),
  totalReceitas: z.string(),
  totalDespesas: z.string(),
  saldo: z.string(),
});

export const relatorioDistribuicaoSchema = {
  querystring: z.object({ mesReferencia: z.string().regex(/^\d{4}-\d{2}$/).optional() }),
  response: {
    200: z.object({
      mesReferencia: z.string(),
      distribuicao: z.array(distribuicaoItemZod),
    }),
  },
};

export const relatorioPorUsuarioSchema = {
  querystring: z.object({ mesReferencia: z.string().regex(/^\d{4}-\d{2}$/).optional() }),
  response: {
    200: z.object({
      mesReferencia: z.string(),
      porUsuario: z.array(porUsuarioItemZod),
    }),
  },
};

export const relatorioTendenciasSchema = {
  querystring: z.object({ meses: z.coerce.number().int().min(1).max(24).optional() }),
  response: { 200: z.object({ meses: z.array(tendenciaMesZod) }) },
};
```

- [ ] **Step 8: Create `relatorio.routes.ts`**

```typescript
import { relatorioQuerySchema, relatorioTendenciasQuerySchema } from '@nossagrana/types';
import type { FastifyPluginAsync } from 'fastify';

import { env } from '../../config/env.js';
import {
  DrizzleRelatorioRepository,
  InMemoryRelatorioRepository,
} from './relatorio.repository.js';
import {
  relatorioDistribuicaoSchema,
  relatorioPorUsuarioSchema,
  relatorioTendenciasSchema,
} from './relatorio.schema.js';
import { RelatorioService } from './relatorio.service.js';

const defaultService = () => {
  const repo =
    env.NODE_ENV === 'test'
      ? new InMemoryRelatorioRepository()
      : new DrizzleRelatorioRepository();
  return new RelatorioService(repo);
};

function getCurrentMes(): string {
  const now = new Date();
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const ano = partes.find((p) => p.type === 'year')!.value;
  const mes = partes.find((p) => p.type === 'month')!.value;
  return `${ano}-${mes}`;
}

export const relatorioRoutes: FastifyPluginAsync = async (fastify) => {
  const service = defaultService();

  fastify.get(
    '/relatorios/distribuicao',
    { preHandler: [fastify.authenticate, fastify.requireFamiliaScope], schema: relatorioDistribuicaoSchema },
    async (request) => {
      const { mesReferencia: qMes } = relatorioQuerySchema.parse(request.query);
      return service.distribuicao(request.familiaIdAtiva as string, qMes ?? getCurrentMes());
    },
  );

  fastify.get(
    '/relatorios/por-usuario',
    { preHandler: [fastify.authenticate, fastify.requireFamiliaScope], schema: relatorioPorUsuarioSchema },
    async (request) => {
      const { mesReferencia: qMes } = relatorioQuerySchema.parse(request.query);
      return service.porUsuario(request.familiaIdAtiva as string, qMes ?? getCurrentMes());
    },
  );

  fastify.get(
    '/relatorios/tendencias',
    { preHandler: [fastify.authenticate, fastify.requireFamiliaScope], schema: relatorioTendenciasSchema },
    async (request) => {
      const { meses } = relatorioTendenciasQuerySchema.parse(request.query);
      return service.tendencias(request.familiaIdAtiva as string, getCurrentMes(), meses);
    },
  );
};
```

- [ ] **Step 9: Register in `app.ts`**

```typescript
import { relatorioRoutes } from './modules/relatorio/relatorio.routes.js';
// ...
app.register(relatorioRoutes, { prefix: '/api' });
```

- [ ] **Step 10: Add integration tests in `app.test.ts`**

```typescript
describe('Relatorio routes', () => {
  const app = buildApp();
  let accessToken: string;
  let familiaId: string;

  beforeAll(async () => {
    await app.ready();
    ({ accessToken, familiaId } = await setupUserFamilyAndCategory('relatorio@example.com'));
  });

  afterAll(() => app.close());

  it('GET /api/relatorios/distribuicao retorna 200', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/relatorios/distribuicao?mesReferencia=2026-03',
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familiaId },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ mesReferencia: '2026-03', distribuicao: [] });
  });

  it('GET /api/relatorios/por-usuario retorna 200', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/relatorios/por-usuario?mesReferencia=2026-03',
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familiaId },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ mesReferencia: '2026-03', porUsuario: [] });
  });

  it('GET /api/relatorios/tendencias retorna 200 com N meses', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/relatorios/tendencias?meses=3',
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familiaId },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().meses).toHaveLength(3);
  });

  it('GET /api/relatorios/distribuicao sem JWT retorna 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/relatorios/distribuicao' });
    expect(res.statusCode).toBe(401);
  });
});
```

- [ ] **Step 11: Run all API tests**

```bash
pnpm --filter api test
```
Expected: all pass.

- [ ] **Step 12: Commit**

```bash
git add apps/api/src/modules/relatorio/ apps/api/src/app.ts apps/api/src/app.test.ts
git commit -m "feat(api): adicionar rotas de relatorios (distribuicao, por-usuario, tendencias)"
```

---

### Task 6: Fatura route

**Files:**
- Modify: `apps/api/src/modules/metodo-pagamento/metodo-pagamento.routes.ts`
- Modify: `apps/api/src/modules/metodo-pagamento/metodo-pagamento.repository.ts`
- Modify: `apps/api/src/modules/metodo-pagamento/metodo-pagamento.types.ts`
- Modify: `apps/api/src/modules/metodo-pagamento/metodo-pagamento.service.ts`
- Modify: `apps/api/src/modules/metodo-pagamento/metodo-pagamento.schema.ts`
- Modify: `apps/api/src/app.test.ts`

- [ ] **Step 1: Add fatura types to `metodo-pagamento.types.ts`**

Append to the existing types file:
```typescript
export interface FaturaTransacaoRow {
  id: string;
  descricao: string | null;
  valor: string;
  data: string;
  categoriaId: string;
  categoriaNome: string;
  usuarioNome: string;
  parcelaAtual: number | null;
  numeroParcelas: number | null;
}
```

- [ ] **Step 2: Add `getFatura` to the repository interface in `metodo-pagamento.types.ts`**

Append to `MetodoPagamentoRepository` interface:
```typescript
getFatura(familiaId: string, metodoPagamentoId: string, mesReferencia: string): Promise<FaturaTransacaoRow[]>;
```

- [ ] **Step 3: Implement `getFatura` in `InMemoryMetodoPagamentoRepository`**

Add seed struct and method to InMemory:
```typescript
// In InMemory class, add:
private _fatura: FaturaTransacaoRow & { familiaId: string; metodoPagamentoId: string; mesReferencia: string }[] = [];

seedFatura(t: FaturaTransacaoRow & { familiaId: string; metodoPagamentoId: string; mesReferencia: string }) {
  this._fatura.push(t);
}

async getFatura(familiaId: string, metodoPagamentoId: string, mesReferencia: string): Promise<FaturaTransacaoRow[]> {
  return this._fatura.filter(
    (t) => t.familiaId === familiaId && t.metodoPagamentoId === metodoPagamentoId && t.mesReferencia === mesReferencia,
  );
}
```

- [ ] **Step 4: Implement `getFatura` in `DrizzleMetodoPagamentoRepository`**

```typescript
async getFatura(familiaId: string, metodoPagamentoId: string, mesReferencia: string): Promise<FaturaTransacaoRow[]> {
  return db
    .select({
      id: transacoes.id,
      descricao: transacoes.descricao,
      valor: transacoes.valor,
      data: transacoes.data,
      categoriaId: transacoes.categoriaId,
      categoriaNome: categorias.nome,
      usuarioNome: users.nome,
      parcelaAtual: transacoes.parcelaAtual,
      numeroParcelas: transacoes.numeroParcelas,
    })
    .from(transacoes)
    .innerJoin(categorias, eq(transacoes.categoriaId, categorias.id))
    .innerJoin(users, eq(transacoes.usuarioRegistrouId, users.id))
    .where(
      and(
        eq(transacoes.familiaId, familiaId),
        eq(transacoes.metodoPagamentoId, metodoPagamentoId),
        eq(transacoes.mesReferencia, mesReferencia),
        eq(transacoes.tipo, 'despesa'),
      ),
    )
    .orderBy(transacoes.data);
}
```

Note: add imports `categorias`, `users`, `and`, `eq` to the Drizzle repository file as needed.

- [ ] **Step 5: Add `getFatura` method to `MetodoPagamentoService`**

```typescript
async getFatura(familiaId: string, metodoPagamentoId: string, mesReferencia: string): Promise<FaturaResponse> {
  // First verify the metodo belongs to the family
  const metodo = await this.repo.findById({ id: metodoPagamentoId, familiaId });
  if (!metodo) throw new MetodoPagamentoNotFoundError();

  const rows = await this.repo.getFatura(familiaId, metodoPagamentoId, mesReferencia);
  const total = rows.reduce((acc, r) => acc + parseFloat(r.valor), 0).toFixed(2);

  return {
    metodoPagamentoId,
    mesReferencia,
    total,
    transacoes: rows,
  };
}
```

Import `FaturaResponse` from `@nossagrana/types`.

- [ ] **Step 6: Add fatura schema to `metodo-pagamento.schema.ts`**

```typescript
export const metodoPagamentoFaturaSchema = {
  params: z.object({
    id: z.string().uuid(),
    mesReferencia: z.string().regex(/^\d{4}-\d{2}$/),
  }),
  response: {
    200: z.object({
      metodoPagamentoId: z.string().uuid(),
      mesReferencia: z.string(),
      total: z.string(),
      transacoes: z.array(
        z.object({
          id: z.string().uuid(),
          descricao: z.string().nullable(),
          valor: z.string(),
          data: z.string(),
          categoriaId: z.string().uuid(),
          categoriaNome: z.string(),
          usuarioNome: z.string(),
          parcelaAtual: z.number().nullable(),
          numeroParcelas: z.number().nullable(),
        }),
      ),
    }),
  },
};
```

- [ ] **Step 7: Add fatura route to `metodo-pagamento.routes.ts`**

```typescript
fastify.get(
  '/cartoes/:id/fatura/:mesReferencia',
  {
    preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
    schema: metodoPagamentoFaturaSchema,
  },
  async (request, reply) => {
    try {
      const { id, mesReferencia } = faturaParamsSchema.parse(request.params);
      const fatura = await service.getFatura(
        request.familiaIdAtiva as string,
        id,
        mesReferencia,
      );
      return reply.code(200).send(fatura);
    } catch (error) {
      if (error instanceof MetodoPagamentoNotFoundError) {
        return reply.code(404).send({ message: error.message });
      }
      throw error;
    }
  },
);
```

Import `faturaParamsSchema` from `@nossagrana/types`.

- [ ] **Step 8: Write integration test for fatura in `app.test.ts`**

Add to the existing metodo-pagamento describe block, or create a new one:
```typescript
describe('Fatura routes', () => {
  const app = buildApp();
  let accessToken: string;
  let familiaId: string;
  let metodoPagamentoId: string;

  beforeAll(async () => {
    await app.ready();
    const setup = await setupUserFamilyAndCategory('fatura@example.com');
    accessToken = setup.accessToken;
    familiaId = setup.familiaId;

    const mpRes = await app.inject({
      method: 'POST',
      url: '/api/metodos-pagamento',
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familiaId },
      payload: { nome: 'Visa', tipo: 'credito', dataFechamento: 15, dataVencimento: 22 },
    });
    metodoPagamentoId = mpRes.json().metodoPagamento.id;
  });

  afterAll(() => app.close());

  it('GET /api/cartoes/:id/fatura/:mesReferencia retorna fatura vazia', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/cartoes/${metodoPagamentoId}/fatura/2026-03`,
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familiaId },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      metodoPagamentoId,
      mesReferencia: '2026-03',
      total: '0.00',
      transacoes: [],
    });
  });

  it('GET /api/cartoes/:id/fatura retorna 404 para metodo inexistente', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/cartoes/00000000-0000-0000-0000-000000000000/fatura/2026-03`,
      headers: { authorization: `Bearer ${accessToken}`, 'x-familia-id': familiaId },
    });
    expect(res.statusCode).toBe(404);
  });
});
```

- [ ] **Step 9: Run all API tests**

```bash
pnpm --filter api test
```
Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/modules/metodo-pagamento/ apps/api/src/app.test.ts
git commit -m "feat(api): adicionar rota GET /cartoes/:id/fatura/:mesReferencia"
```

---

## Chunk 3: Frontend Pages + Navigation

### Task 7: Frontend service methods for Orçamento, Relatórios e Fatura

**Files:**
- Modify: `apps/web/src/services/core-financeiro.service.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/web/src/services/core-financeiro.service.test.ts` (or check if it exists):

Add to the existing test file (or create it):
```typescript
// Add to existing tests or create new file
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ... test pattern matching existing service tests
```

Actually, since the services call `ApiClient.request`, and tests mock the service at the store level, keep it simple — extend the service without new tests at the service layer (the integration tests cover the routes, and component tests mock the service).

- [ ] **Step 1: Extend `core-financeiro.service.ts` with new methods**

Append methods to `DashboardService` (or rename the class to `CoreFinanceiroService` if preferred — but keep backwards compat with the existing export):

```typescript
// Add to class DashboardService:

async getOrcamentos(familiaId: string, mesReferencia?: string): Promise<OrcamentoListResponse> {
  const qs = mesReferencia ? `?mesReferencia=${mesReferencia}` : '';
  return this.api.request<OrcamentoListResponse>(`/api/orcamento${qs}`, {
    headers: familiaHeader(familiaId),
  });
}

async setOrcamento(
  familiaId: string,
  categoriaId: string,
  payload: OrcamentoSetRequest,
): Promise<OrcamentoSetResponse> {
  return this.api.request<OrcamentoSetResponse>(`/api/orcamento/${categoriaId}`, {
    method: 'POST',
    headers: { ...familiaHeader(familiaId), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async getOrcamentoHistorico(familiaId: string, categoriaId: string): Promise<OrcamentoHistoricoResponse> {
  return this.api.request<OrcamentoHistoricoResponse>(
    `/api/orcamento/${categoriaId}/historico`,
    { headers: familiaHeader(familiaId) },
  );
}

async getRelatorioDistribuicao(familiaId: string, mesReferencia?: string): Promise<RelatorioDistribuicaoResponse> {
  const qs = mesReferencia ? `?mesReferencia=${mesReferencia}` : '';
  return this.api.request<RelatorioDistribuicaoResponse>(`/api/relatorios/distribuicao${qs}`, {
    headers: familiaHeader(familiaId),
  });
}

async getRelatorioPorUsuario(familiaId: string, mesReferencia?: string): Promise<RelatorioPorUsuarioResponse> {
  const qs = mesReferencia ? `?mesReferencia=${mesReferencia}` : '';
  return this.api.request<RelatorioPorUsuarioResponse>(`/api/relatorios/por-usuario${qs}`, {
    headers: familiaHeader(familiaId),
  });
}

async getRelatorioTendencias(familiaId: string, meses?: number): Promise<RelatorioTendenciasResponse> {
  const qs = meses ? `?meses=${meses}` : '';
  return this.api.request<RelatorioTendenciasResponse>(`/api/relatorios/tendencias${qs}`, {
    headers: familiaHeader(familiaId),
  });
}

async getFatura(familiaId: string, metodoPagamentoId: string, mesReferencia: string): Promise<FaturaResponse> {
  return this.api.request<FaturaResponse>(
    `/api/cartoes/${metodoPagamentoId}/fatura/${mesReferencia}`,
    { headers: familiaHeader(familiaId) },
  );
}
```

Import the new types from `@nossagrana/types`.

- [ ] **Step 2: Type-check**

```bash
pnpm --filter web exec tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/services/core-financeiro.service.ts
git commit -m "feat(web): adicionar metodos de servico para orcamento, relatorios e fatura"
```

---

### Task 8: OrcamentoPage

**Files:**
- Create: `apps/web/src/pages/orcamento-page.tsx`
- Create: `apps/web/src/pages/orcamento-page.test.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/web/src/pages/orcamento-page.test.tsx`:

```typescript
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockService = vi.hoisted(() => ({
  getOrcamentos: vi.fn(),
  setOrcamento: vi.fn(),
  getOrcamentoHistorico: vi.fn(),
}));

vi.mock('../services/core-financeiro.service', () => ({
  coreFinanceiroService: mockService,
}));

import { OrcamentoPage } from './orcamento-page';

const familiaId = 'fam-1';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  mockService.getOrcamentos.mockResolvedValue({ orcamentos: [] });
});

describe('OrcamentoPage', () => {
  it('renders heading', async () => {
    render(<OrcamentoPage familiaId={familiaId} onBack={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /orcamento/i })).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockService.getOrcamentos.mockReturnValue(new Promise(() => {}));
    render(<OrcamentoPage familiaId={familiaId} onBack={vi.fn()} />);
    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
  });

  it('renders orcamento rows after load', async () => {
    mockService.getOrcamentos.mockResolvedValue({
      orcamentos: [
        {
          id: 'o1',
          categoriaId: 'c1',
          categoriaNome: 'Alimentação',
          valorLimite: '500.00',
          vigenciaInicio: '2026-03',
          vigenciaFim: null,
          totalGasto: '250.00',
          percentual: 50,
          status: 'ok',
        },
      ],
    });
    render(<OrcamentoPage familiaId={familiaId} onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Alimentação')).toBeInTheDocument());
    expect(screen.getByText(/500/)).toBeInTheDocument();
    expect(screen.getByText(/50%/)).toBeInTheDocument();
  });

  it('calls onBack when back button clicked', async () => {
    const onBack = vi.fn();
    render(<OrcamentoPage familiaId={familiaId} onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it('opens edit form and submits new limit', async () => {
    mockService.getOrcamentos.mockResolvedValue({
      orcamentos: [
        {
          id: 'o1',
          categoriaId: 'c1',
          categoriaNome: 'Alimentação',
          valorLimite: '500.00',
          vigenciaInicio: '2026-03',
          vigenciaFim: null,
          totalGasto: '250.00',
          percentual: 50,
          status: 'ok',
        },
      ],
    });
    mockService.setOrcamento.mockResolvedValue({ orcamento: {} });
    mockService.getOrcamentos.mockResolvedValueOnce({ orcamentos: [] }).mockResolvedValue({
      orcamentos: [
        {
          id: 'o1', categoriaId: 'c1', categoriaNome: 'Alimentação',
          valorLimite: '800.00', vigenciaInicio: '2026-03', vigenciaFim: null,
          totalGasto: '250.00', percentual: 31.3, status: 'ok',
        },
      ],
    });

    render(<OrcamentoPage familiaId={familiaId} onBack={vi.fn()} />);
    await waitFor(() => screen.getByText('Alimentação'));
    fireEvent.click(screen.getByRole('button', { name: /editar limite/i }));
    const input = screen.getByLabelText(/novo limite/i);
    fireEvent.change(input, { target: { value: '800' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    await waitFor(() => expect(mockService.setOrcamento).toHaveBeenCalledWith(
      familiaId, 'c1', expect.objectContaining({ valorLimite: '800' }),
    ));
  });
});
```

- [ ] **Step 2: Run test — should fail**

```bash
pnpm --filter web test -- --reporter=verbose orcamento-page
```
Expected: FAIL.

- [ ] **Step 3: Create `orcamento-page.tsx`**

```typescript
import { useEffect, useState } from 'react';

import type { OrcamentoItem } from '@nossagrana/types';

import { coreFinanceiroService } from '../services/core-financeiro.service';

interface OrcamentoPageProps {
  familiaId: string;
  onBack: () => void;
}

const statusColor: Record<string, string> = {
  ok: 'bg-success',
  warning: 'bg-warning',
  exceeded: 'bg-danger',
};

export const OrcamentoPage = ({ familiaId, onBack }: OrcamentoPageProps) => {
  const [orcamentos, setOrcamentos] = useState<OrcamentoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [novoLimite, setNovoLimite] = useState('');
  const [mesAtual] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const loadOrcamentos = async () => {
    setLoading(true);
    try {
      const data = await coreFinanceiroService.getOrcamentos(familiaId);
      setOrcamentos(data.orcamentos);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrcamentos();
  }, [familiaId]);

  const handleSave = async (categoriaId: string) => {
    await coreFinanceiroService.setOrcamento(familiaId, categoriaId, {
      valorLimite: novoLimite,
      vigenciaInicio: mesAtual,
    });
    setEditingId(null);
    setNovoLimite('');
    await loadOrcamentos();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-text-muted">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg p-4">
      <div className="mb-4 flex items-center gap-2">
        <button onClick={onBack} className="text-text-muted hover:text-text" aria-label="Voltar">
          ← Voltar
        </button>
        <h1 className="text-xl font-bold text-text">Orçamento</h1>
      </div>

      {orcamentos.length === 0 ? (
        <p className="text-text-muted">Nenhum orçamento definido.</p>
      ) : (
        <div className="space-y-3">
          {orcamentos.map((o) => (
            <div key={o.id} className="rounded-lg bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-text">{o.categoriaNome}</span>
                <button
                  aria-label="Editar limite"
                  onClick={() => { setEditingId(o.id); setNovoLimite(o.valorLimite); }}
                  className="text-sm text-primary"
                >
                  Editar limite
                </button>
              </div>
              <div className="mt-2 flex items-center gap-4 text-sm text-text-muted">
                <span>Limite: R$ {parseFloat(o.valorLimite).toFixed(2).replace('.', ',')}</span>
                <span>Gasto: R$ {parseFloat(o.totalGasto).toFixed(2).replace('.', ',')}</span>
                <span>{o.percentual.toFixed(0)}%</span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-bg">
                <div
                  className={`h-2 rounded-full ${statusColor[o.status]}`}
                  style={{ width: `${Math.min(o.percentual, 100)}%` }}
                />
              </div>

              {editingId === o.id && (
                <div className="mt-3 flex items-center gap-2">
                  <label htmlFor={`novo-limite-${o.id}`} className="sr-only">
                    Novo limite
                  </label>
                  <input
                    id={`novo-limite-${o.id}`}
                    aria-label="Novo limite"
                    type="number"
                    value={novoLimite}
                    onChange={(e) => setNovoLimite(e.target.value)}
                    className="rounded border border-border bg-bg px-2 py-1 text-sm text-text"
                    placeholder="Novo limite"
                  />
                  <button
                    onClick={() => handleSave(o.categoriaId)}
                    className="rounded bg-primary px-3 py-1 text-sm text-white"
                    aria-label="Salvar"
                  >
                    Salvar
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-sm text-text-muted"
                    aria-label="Cancelar"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Run tests — should pass**

```bash
pnpm --filter web test -- --reporter=verbose orcamento-page
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/orcamento-page.tsx apps/web/src/pages/orcamento-page.test.tsx
git commit -m "feat(web): adicionar OrcamentoPage com edição de limites"
```

---

### Task 9: RelatoriosPage

**Files:**
- Create: `apps/web/src/pages/relatorios-page.tsx`
- Create: `apps/web/src/pages/relatorios-page.test.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/web/src/pages/relatorios-page.test.tsx`:

```typescript
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-chartjs-2', () => ({
  Doughnut: () => <canvas data-testid="doughnut" />,
  Bar: () => <canvas data-testid="bar" />,
  Line: () => <canvas data-testid="line" />,
}));

const mockService = vi.hoisted(() => ({
  getRelatorioDistribuicao: vi.fn(),
  getRelatorioPorUsuario: vi.fn(),
  getRelatorioTendencias: vi.fn(),
}));

vi.mock('../services/core-financeiro.service', () => ({
  coreFinanceiroService: mockService,
}));

import { RelatoriosPage } from './relatorios-page';

const familiaId = 'fam-1';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  mockService.getRelatorioDistribuicao.mockResolvedValue({
    mesReferencia: '2026-03',
    distribuicao: [],
  });
  mockService.getRelatorioPorUsuario.mockResolvedValue({
    mesReferencia: '2026-03',
    porUsuario: [],
  });
  mockService.getRelatorioTendencias.mockResolvedValue({ meses: [] });
});

describe('RelatoriosPage', () => {
  it('renders heading', async () => {
    render(<RelatoriosPage familiaId={familiaId} onBack={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /relatorios/i })).toBeInTheDocument();
  });

  it('calls onBack when back button clicked', () => {
    const onBack = vi.fn();
    render(<RelatoriosPage familiaId={familiaId} onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it('shows distribuicao tab by default with chart', async () => {
    mockService.getRelatorioDistribuicao.mockResolvedValue({
      mesReferencia: '2026-03',
      distribuicao: [
        { categoriaId: 'c1', categoriaNome: 'Alimentação', total: '300.00', percentual: 60 },
        { categoriaId: 'c2', categoriaNome: 'Lazer', total: '200.00', percentual: 40 },
      ],
    });
    render(<RelatoriosPage familiaId={familiaId} onBack={vi.fn()} />);
    await waitFor(() => screen.getByText('Alimentação'));
    expect(screen.getByTestId('doughnut')).toBeInTheDocument();
  });

  it('switches to por-usuario tab', async () => {
    mockService.getRelatorioPorUsuario.mockResolvedValue({
      mesReferencia: '2026-03',
      porUsuario: [
        { usuarioId: 'u1', usuarioNome: 'Leo', total: '400.00', percentual: 80 },
      ],
    });
    render(<RelatoriosPage familiaId={familiaId} onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: /por membro/i }));
    await waitFor(() => screen.getByText('Leo'));
    expect(screen.getByText(/400/)).toBeInTheDocument();
  });

  it('switches to tendencias tab', async () => {
    mockService.getRelatorioTendencias.mockResolvedValue({
      meses: [
        { mesReferencia: '2026-01', totalReceitas: '5000.00', totalDespesas: '3000.00', saldo: '2000.00' },
        { mesReferencia: '2026-02', totalReceitas: '4500.00', totalDespesas: '3200.00', saldo: '1300.00' },
        { mesReferencia: '2026-03', totalReceitas: '5200.00', totalDespesas: '2800.00', saldo: '2400.00' },
      ],
    });
    render(<RelatoriosPage familiaId={familiaId} onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: /tendencias/i }));
    await waitFor(() => screen.getByTestId('line'));
  });
});
```

- [ ] **Step 2: Run test — should fail**

```bash
pnpm --filter web test -- --reporter=verbose relatorios-page
```
Expected: FAIL.

- [ ] **Step 3: Create `relatorios-page.tsx`**

```typescript
import { ArcElement, CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js';
import { useEffect, useState } from 'react';
import { Doughnut, Line } from 'react-chartjs-2';

import type {
  RelatorioDistribuicaoItem,
  RelatorioPorUsuarioItem,
  RelatorioTendenciaMes,
} from '@nossagrana/types';

import { coreFinanceiroService } from '../services/core-financeiro.service';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Filler);

type Tab = 'distribuicao' | 'por-usuario' | 'tendencias';

interface RelatoriosPageProps {
  familiaId: string;
  onBack: () => void;
}

const CHART_COLORS = ['#4ade80', '#60a5fa', '#f87171', '#facc15', '#a78bfa', '#fb923c'];

export const RelatoriosPage = ({ familiaId, onBack }: RelatoriosPageProps) => {
  const [tab, setTab] = useState<Tab>('distribuicao');
  const [distribuicao, setDistribuicao] = useState<RelatorioDistribuicaoItem[]>([]);
  const [porUsuario, setPorUsuario] = useState<RelatorioPorUsuarioItem[]>([]);
  const [tendencias, setTendencias] = useState<RelatorioTendenciaMes[]>([]);
  const [loading, setLoading] = useState(true);
  const [mesReferencia] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [dist, usr, tend] = await Promise.all([
          coreFinanceiroService.getRelatorioDistribuicao(familiaId),
          coreFinanceiroService.getRelatorioPorUsuario(familiaId),
          coreFinanceiroService.getRelatorioTendencias(familiaId, 6),
        ]);
        setDistribuicao(dist.distribuicao);
        setPorUsuario(usr.porUsuario);
        setTendencias(tend.meses);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [familiaId]);

  return (
    <div className="min-h-screen bg-bg p-4">
      <div className="mb-4 flex items-center gap-2">
        <button onClick={onBack} className="text-text-muted hover:text-text" aria-label="Voltar">
          ← Voltar
        </button>
        <h1 className="text-xl font-bold text-text">Relatórios</h1>
      </div>

      <div className="mb-4 flex gap-2" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'distribuicao'}
          onClick={() => setTab('distribuicao')}
          className={`rounded px-3 py-1 text-sm ${tab === 'distribuicao' ? 'bg-primary text-white' : 'bg-card text-text-muted'}`}
        >
          Distribuição
        </button>
        <button
          role="tab"
          aria-selected={tab === 'por-usuario'}
          onClick={() => setTab('por-usuario')}
          className={`rounded px-3 py-1 text-sm ${tab === 'por-usuario' ? 'bg-primary text-white' : 'bg-card text-text-muted'}`}
        >
          Por Membro
        </button>
        <button
          role="tab"
          aria-selected={tab === 'tendencias'}
          onClick={() => setTab('tendencias')}
          className={`rounded px-3 py-1 text-sm ${tab === 'tendencias' ? 'bg-primary text-white' : 'bg-card text-text-muted'}`}
        >
          Tendências
        </button>
      </div>

      {loading ? (
        <p className="text-text-muted">Carregando...</p>
      ) : (
        <>
          {tab === 'distribuicao' && (
            <div>
              {distribuicao.length === 0 ? (
                <p className="text-text-muted">Sem despesas no período.</p>
              ) : (
                <>
                  <Doughnut
                    data={{
                      labels: distribuicao.map((d) => d.categoriaNome),
                      datasets: [{ data: distribuicao.map((d) => parseFloat(d.total)), backgroundColor: CHART_COLORS }],
                    }}
                  />
                  <ul className="mt-4 space-y-1">
                    {distribuicao.map((d) => (
                      <li key={d.categoriaId} className="flex justify-between text-sm text-text">
                        <span>{d.categoriaNome}</span>
                        <span>R$ {parseFloat(d.total).toFixed(2).replace('.', ',')} ({d.percentual.toFixed(0)}%)</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {tab === 'por-usuario' && (
            <div>
              {porUsuario.length === 0 ? (
                <p className="text-text-muted">Sem despesas no período.</p>
              ) : (
                <ul className="space-y-2">
                  {porUsuario.map((u) => (
                    <li key={u.usuarioId} className="flex justify-between rounded-lg bg-card p-3 text-text">
                      <span>{u.usuarioNome}</span>
                      <span>R$ {parseFloat(u.total).toFixed(2).replace('.', ',')} ({u.percentual.toFixed(0)}%)</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === 'tendencias' && (
            <div>
              {tendencias.length === 0 ? (
                <p className="text-text-muted">Sem dados de tendência.</p>
              ) : (
                <Line
                  data={{
                    labels: tendencias.map((m) => m.mesReferencia),
                    datasets: [
                      {
                        label: 'Receitas',
                        data: tendencias.map((m) => parseFloat(m.totalReceitas)),
                        borderColor: '#4ade80',
                        fill: false,
                      },
                      {
                        label: 'Despesas',
                        data: tendencias.map((m) => parseFloat(m.totalDespesas)),
                        borderColor: '#f87171',
                        fill: false,
                      },
                    ],
                  }}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Run tests — should pass**

```bash
pnpm --filter web test -- --reporter=verbose relatorios-page
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/relatorios-page.tsx apps/web/src/pages/relatorios-page.test.tsx
git commit -m "feat(web): adicionar RelatoriosPage com abas distribuicao, por-membro, tendencias"
```

---

### Task 10: FaturaPage

**Files:**
- Create: `apps/web/src/pages/fatura-page.tsx`
- Create: `apps/web/src/pages/fatura-page.test.tsx`

- [ ] **Step 1: Write failing test**

Create `apps/web/src/pages/fatura-page.test.tsx`:

```typescript
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockService = vi.hoisted(() => ({
  getFatura: vi.fn(),
}));

vi.mock('../services/core-financeiro.service', () => ({
  coreFinanceiroService: mockService,
}));

import { FaturaPage } from './fatura-page';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('FaturaPage', () => {
  const props = {
    familiaId: 'fam-1',
    metodoPagamentoId: 'mp-1',
    metodoPagamentoNome: 'Visa',
    mesReferencia: '2026-03',
    onBack: vi.fn(),
  };

  beforeEach(() => {
    mockService.getFatura.mockResolvedValue({
      metodoPagamentoId: 'mp-1',
      mesReferencia: '2026-03',
      total: '0.00',
      transacoes: [],
    });
  });

  it('renders heading with card name and month', async () => {
    render(<FaturaPage {...props} />);
    await waitFor(() => expect(screen.getByRole('heading', { name: /fatura.*visa/i })).toBeInTheDocument());
    expect(screen.getByText(/2026-03/)).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockService.getFatura.mockReturnValue(new Promise(() => {}));
    render(<FaturaPage {...props} />);
    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
  });

  it('shows empty state', async () => {
    render(<FaturaPage {...props} />);
    await waitFor(() => screen.getByRole('heading', { name: /fatura.*visa/i }));
    expect(screen.getByText(/nenhuma transacao/i)).toBeInTheDocument();
  });

  it('renders transactions', async () => {
    mockService.getFatura.mockResolvedValue({
      metodoPagamentoId: 'mp-1',
      mesReferencia: '2026-03',
      total: '350.00',
      transacoes: [
        {
          id: 't1',
          descricao: 'Mercado',
          valor: '200.00',
          data: '2026-03-10',
          categoriaId: 'c1',
          categoriaNome: 'Alimentação',
          usuarioNome: 'Leo',
          parcelaAtual: null,
          numeroParcelas: null,
        },
        {
          id: 't2',
          descricao: 'Cinema',
          valor: '150.00',
          data: '2026-03-15',
          categoriaId: 'c2',
          categoriaNome: 'Lazer',
          usuarioNome: 'Ana',
          parcelaAtual: 1,
          numeroParcelas: 3,
        },
      ],
    });
    render(<FaturaPage {...props} />);
    await waitFor(() => screen.getByText('Mercado'));
    expect(screen.getByText('Cinema')).toBeInTheDocument();
    expect(screen.getByText(/parcela 1\/3/i)).toBeInTheDocument();
    expect(screen.getByText(/total.*350/i)).toBeInTheDocument();
  });

  it('calls onBack when back button clicked', async () => {
    const onBack = vi.fn();
    render(<FaturaPage {...{ ...props, onBack }} />);
    await waitFor(() => screen.getByRole('button', { name: /voltar/i }));
    screen.getByRole('button', { name: /voltar/i }).click();
    expect(onBack).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test — should fail**

```bash
pnpm --filter web test -- --reporter=verbose fatura-page
```
Expected: FAIL.

- [ ] **Step 3: Create `fatura-page.tsx`**

```typescript
import { useEffect, useState } from 'react';

import type { FaturaItem } from '@nossagrana/types';

import { coreFinanceiroService } from '../services/core-financeiro.service';

interface FaturaPageProps {
  familiaId: string;
  metodoPagamentoId: string;
  metodoPagamentoNome: string;
  mesReferencia: string;
  onBack: () => void;
}

export const FaturaPage = ({
  familiaId,
  metodoPagamentoId,
  metodoPagamentoNome,
  mesReferencia,
  onBack,
}: FaturaPageProps) => {
  const [transacoes, setTransacoes] = useState<FaturaItem[]>([]);
  const [total, setTotal] = useState('0.00');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await coreFinanceiroService.getFatura(familiaId, metodoPagamentoId, mesReferencia);
        setTransacoes(data.transacoes);
        setTotal(data.total);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [familiaId, metodoPagamentoId, mesReferencia]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-text-muted">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg p-4">
      <div className="mb-4 flex items-center gap-2">
        <button onClick={onBack} className="text-text-muted hover:text-text" aria-label="Voltar">
          ← Voltar
        </button>
        <h1 className="text-xl font-bold text-text">
          Fatura — {metodoPagamentoNome}
        </h1>
      </div>
      <p className="mb-4 text-sm text-text-muted">{mesReferencia}</p>

      {transacoes.length === 0 ? (
        <p className="text-text-muted">Nenhuma transação nesta fatura.</p>
      ) : (
        <>
          <ul className="space-y-2">
            {transacoes.map((t) => (
              <li key={t.id} className="rounded-lg bg-card p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-text">{t.descricao ?? '—'}</p>
                    <p className="text-xs text-text-muted">
                      {t.categoriaNome} · {t.usuarioNome} · {t.data}
                      {t.parcelaAtual != null && t.numeroParcelas != null && (
                        <> · Parcela {t.parcelaAtual}/{t.numeroParcelas}</>
                      )}
                    </p>
                  </div>
                  <span className="font-semibold text-danger">
                    R$ {parseFloat(t.valor).toFixed(2).replace('.', ',')}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between rounded-lg bg-card p-3 font-bold text-text">
            <span>Total</span>
            <span>R$ {parseFloat(total).toFixed(2).replace('.', ',')}</span>
          </div>
        </>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Run tests — should pass**

```bash
pnpm --filter web test -- --reporter=verbose fatura-page
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/fatura-page.tsx apps/web/src/pages/fatura-page.test.tsx
git commit -m "feat(web): adicionar FaturaPage"
```

---

### Task 11: Navigation integration

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.test.tsx`

- [ ] **Step 1: Update `App.tsx`**

Add new screens to the `Screen` type and wire navigation:

```typescript
type Screen =
  | 'login'
  | 'sign-up'
  | 'onboarding'
  | 'family-settings'
  | 'dashboard'
  | 'extrato'
  | 'categorias'
  | 'metodos-pagamento'
  | 'orcamento'
  | 'relatorios'
  | 'fatura';
```

Fix existing `'home'` references (lines ~73, ~87, ~91) to `'dashboard'`.

Add imports:
```typescript
import { FaturaPage } from '@/pages/fatura-page';
import { OrcamentoPage } from '@/pages/orcamento-page';
import { RelatoriosPage } from '@/pages/relatorios-page';
```

Add state for fatura navigation:
```typescript
const [faturaMetodoId, setFaturaMetodoId] = useState<string | null>(null);
const [faturaMetodoNome, setFaturaMetodoNome] = useState<string>('');
const [faturaMes, setFaturaMes] = useState<string>('');
```

Add screen blocks:
```typescript
if (screen === 'orcamento') {
  return <OrcamentoPage familiaId={DEMO_FAMILIA_ID} onBack={() => setScreen('dashboard')} />;
}

if (screen === 'relatorios') {
  return <RelatoriosPage familiaId={DEMO_FAMILIA_ID} onBack={() => setScreen('dashboard')} />;
}

if (screen === 'fatura' && faturaMetodoId) {
  return (
    <FaturaPage
      familiaId={DEMO_FAMILIA_ID}
      metodoPagamentoId={faturaMetodoId}
      metodoPagamentoNome={faturaMetodoNome}
      mesReferencia={faturaMes}
      onBack={() => setScreen('dashboard')}
    />
  );
}
```

Fix `onBack` in `extrato`, `categorias`, and `metodos-pagamento` from `() => setScreen('home')` to `() => setScreen('dashboard')`.

- [ ] **Step 2: Update `App.test.tsx`**

Add navigation tests:
```typescript
it('navega para tela de orcamento via dashboard', () => {
  // This test verifies screen type is valid — basic smoke test
  // OrcamentoPage is rendered when screen === 'orcamento'
  // Full coverage is in orcamento-page.test.tsx
});
```

Actually, since the App.test.tsx uses mocked stores and DashboardPage doesn't expose buttons to navigate to orcamento/relatorios yet, keep App.test.tsx changes minimal — only fix the TypeScript error from `'home'` references if any tests broke.

Verify existing App tests still pass after the Screen type change.

- [ ] **Step 3: Type-check**

```bash
pnpm --filter web exec tsc --noEmit
```
Expected: no errors (the `'home'` references are now `'dashboard'`).

- [ ] **Step 4: Run all frontend tests**

```bash
pnpm --filter web test
```
Expected: all pass.

- [ ] **Step 5: Run full CI simulation**

```bash
# Type check both apps
pnpm --filter api exec tsc --noEmit
pnpm --filter web exec tsc --noEmit
# Lint
pnpm --filter api lint
pnpm --filter web lint
# Tests
pnpm --filter api test
pnpm --filter web test
```
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/App.test.tsx
git commit -m "feat(web): integrar OrcamentoPage, RelatoriosPage e FaturaPage na navegacao"
```

---

## Final verification

- [ ] Run full monorepo CI simulation:

```bash
pnpm --filter @nossagrana/types build
pnpm --filter api exec tsc --noEmit
pnpm --filter web exec tsc --noEmit
pnpm --filter api lint
pnpm --filter web lint
pnpm --filter api test
pnpm --filter web test
```

- [ ] Verify TASKS.md Fase 6 checkboxes — all should be completable after this plan.

- [ ] Push and create PR for Fase 6.
