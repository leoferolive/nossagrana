# Cofrinhos (Reservas Financeiras) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar módulo completo de Cofrinhos — reservas financeiras familiares com aportes, retiradas, metas e aportes recorrentes, integrado ao extrato e dashboard existentes.

**Architecture:** Novo módulo backend `cofrinho/` seguindo o padrão routes→service→repository com 2 novas tabelas (cofrinhos, movimentacoes_cofrinho) + alterações em categorias (campo sistema) e transacoes (campo cofrinho_id). Frontend com nova store Zustand, service API, 2 pages e 4 modais, integrado à navegação existente via Sidebar/Configurações/Dashboard card.

**Tech Stack:** Drizzle ORM (schema + migration), Fastify (routes + Zod validation), Vitest + InMemory repositories (TDD), React + Zustand + Tailwind CSS, lucide-react (PiggyBank icon).

**Spec:** `docs/superpowers/specs/2026-03-22-cofrinhos-design.md`

---

## File Structure

### packages/types

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/types/src/index.ts` | Modify | Adicionar schemas Zod e types para Cofrinhos (request/response DTOs) |

### Backend (apps/api)

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/api/src/db/schema.ts` | Modify | Adicionar tabelas `cofrinhos`, `movimentacoes_cofrinho`, enums, campos `sistema` em categorias e `cofrinhoId` em transacoes |
| `apps/api/src/db/seeds/categorias-padrao.ts` | Modify | Adicionar constante CATEGORIA_SISTEMA_COFRINHO |
| `apps/api/src/modules/cofrinho/cofrinho.types.ts` | Create | Interfaces de domínio e CofrinhoRepository |
| `apps/api/src/modules/cofrinho/cofrinho.repository.ts` | Create | DrizzleCofrinhoRepository + InMemoryCofrinhoRepository |
| `apps/api/src/modules/cofrinho/cofrinho.service.ts` | Create | Lógica de negócio: criar, editar, aportar, retirar, encerrar |
| `apps/api/src/modules/cofrinho/cofrinho.service.test.ts` | Create | Testes unitários do service (TDD) |
| `apps/api/src/modules/cofrinho/cofrinho.schema.ts` | Create | Schemas Fastify (JSON Schema para docs/validação) |
| `apps/api/src/modules/cofrinho/cofrinho.routes.ts` | Create | 8 endpoints REST |
| `apps/api/src/modules/cofrinho/cofrinho.routes.test.ts` | Create | Testes de integração das rotas |
| `apps/api/src/modules/categoria/categoria.service.ts` | Modify | Adicionar proteção sistema=true em update/deactivate |
| `apps/api/src/modules/categoria/categoria.types.ts` | Modify | Adicionar campo `sistema` ao type Categoria |
| `apps/api/src/modules/categoria/categoria.repository.ts` | Modify | Incluir campo `sistema` nas queries |
| `apps/api/src/modules/familia/familia.service.ts` | Modify | Seed de categoria "Cofrinho" (sistema=true) ao criar família |
| `apps/api/src/app.ts` | Modify | Registrar cofrinhoRoutes |

### Frontend (apps/web)

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/web/src/services/cofrinho.service.ts` | Create | Chamadas à API de Cofrinhos |
| `apps/web/src/stores/cofrinho.store.ts` | Create | Estado global Zustand |
| `apps/web/src/pages/cofrinhos-page.tsx` | Create | Lista de cofrinhos + criar novo |
| `apps/web/src/pages/cofrinhos-page.test.tsx` | Create | Testes da página lista |
| `apps/web/src/pages/cofrinho-detalhe-page.tsx` | Create | Detalhe + histórico movimentações |
| `apps/web/src/pages/cofrinho-detalhe-page.test.tsx` | Create | Testes da página detalhe |
| `apps/web/src/components/cofrinho-modal.tsx` | Create | Modal criar/editar cofrinho |
| `apps/web/src/components/cofrinho-aporte-modal.tsx` | Create | Modal de aporte |
| `apps/web/src/components/cofrinho-retirada-modal.tsx` | Create | Modal de retirada |
| `apps/web/src/components/cofrinho-encerrar-modal.tsx` | Create | Modal de encerramento |
| `apps/web/src/App.tsx` | Modify | Adicionar screens 'cofrinhos' e 'cofrinho-detalhe' |
| `apps/web/src/components/sidebar.tsx` | Modify | Adicionar item "Cofrinhos" no grupo 2 |
| `apps/web/src/components/top-bar.tsx` | Modify | Adicionar título "Cofrinhos" ao screenTitles |
| `apps/web/src/pages/configuracoes-page.tsx` | Modify | Adicionar item "Cofrinhos" no menu |
| `apps/web/src/pages/dashboard-page.tsx` | Modify | Adicionar card de resumo dos cofrinhos |
| `apps/web/src/components/icons.tsx` | Modify | Adicionar IconCofrinho (PiggyBank) |

---

## Task 1: Shared Types — Schemas Zod para Cofrinhos

**Files:**
- Modify: `packages/types/src/index.ts` (após linha 750, seção final)

- [ ] **Step 1: Adicionar schemas Zod de Cofrinhos ao packages/types**

Adicionar ao final de `packages/types/src/index.ts`:

```typescript
// ─── Cofrinhos ───────────────────────────────────────────────────────────────

export const cofrinhoStatusSchema = z.enum(['ativo', 'encerrado']);
export type CofrinhoStatus = z.infer<typeof cofrinhoStatusSchema>;

export const movimentacaoCofrinhoTipoSchema = z.enum(['aporte', 'retirada']);
export type MovimentacaoCofrinhoTipo = z.infer<typeof movimentacaoCofrinhoTipoSchema>;

const cofrinhoSchema = z.object({
  id: z.string().uuid(),
  familiaId: z.string().uuid(),
  nome: z.string().min(1),
  emoji: z.string().nullable(),
  descricao: z.string().nullable(),
  metaValor: z.string().nullable(),
  saldoAtual: z.string(),
  status: cofrinhoStatusSchema,
  criadoPor: z.string().uuid(),
  criadoEm: z.string(),
  encerradoEm: z.string().nullable(),
});

export const cofrinhoCreateRequestSchema = z.object({
  nome: z.string().trim().min(1).max(100),
  emoji: z.string().max(10).optional().nullable(),
  descricao: z.string().trim().optional().nullable(),
  metaValor: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Valor inválido').optional().nullable(),
});
export type CofrinhoCreateRequest = z.infer<typeof cofrinhoCreateRequestSchema>;

export const cofrinhoCreateResponseSchema = z.object({ cofrinho: cofrinhoSchema });
export type CofrinhoCreateResponse = z.infer<typeof cofrinhoCreateResponseSchema>;

export const cofrinhoUpdateRequestSchema = z.object({
  nome: z.string().trim().min(1).max(100).optional(),
  emoji: z.string().max(10).optional().nullable(),
  descricao: z.string().trim().optional().nullable(),
  metaValor: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Valor inválido').optional().nullable(),
});
export type CofrinhoUpdateRequest = z.infer<typeof cofrinhoUpdateRequestSchema>;

export const cofrinhoParamsSchema = z.object({ id: z.string().uuid() });
export type CofrinhoParams = z.infer<typeof cofrinhoParamsSchema>;

export const cofrinhoListQuerySchema = z.object({
  status: cofrinhoStatusSchema.optional().default('ativo'),
});
export type CofrinhoListQuery = z.infer<typeof cofrinhoListQuerySchema>;

export const cofrinhoListResponseSchema = z.object({
  cofrinhos: z.array(cofrinhoSchema),
});
export type CofrinhoListResponse = z.infer<typeof cofrinhoListResponseSchema>;

const movimentacaoCofrinhoSchema = z.object({
  id: z.string().uuid(),
  cofrinhoId: z.string().uuid(),
  tipo: movimentacaoCofrinhoTipoSchema,
  valor: z.string(),
  descricao: z.string().nullable(),
  transacaoId: z.string().uuid().nullable(),
  registradoPor: z.string().uuid(),
  registradoEm: z.string(),
  mesReferencia: z.string(),
});

export const cofrinhoDetalheResponseSchema = z.object({
  cofrinho: cofrinhoSchema,
  movimentacoes: z.array(movimentacaoCofrinhoSchema),
  aporteRecorrenteAtivo: z.object({
    transacaoPaiId: z.string().uuid(),
    valor: z.string(),
    frequencia: transacaoFrequenciaSchema,
    dataFimRecorrencia: z.string().nullable(),
  }).nullable(),
});
export type CofrinhoDetalheResponse = z.infer<typeof cofrinhoDetalheResponseSchema>;

export const cofrinhoAporteRequestSchema = z.object({
  valor: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Valor inválido'),
  descricao: z.string().trim().optional().nullable(),
  recorrente: z.boolean().optional().default(false),
  frequencia: transacaoFrequenciaSchema.optional().nullable(),
  dataFimRecorrencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});
export type CofrinhoAporteRequest = z.infer<typeof cofrinhoAporteRequestSchema>;

export const cofrinhoAporteResponseSchema = z.object({
  movimentacao: movimentacaoCofrinhoSchema,
  cofrinho: cofrinhoSchema,
});
export type CofrinhoAporteResponse = z.infer<typeof cofrinhoAporteResponseSchema>;

export const cofrinhoRetiradaRequestSchema = z.object({
  valor: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Valor inválido'),
  descricao: z.string().trim().optional().nullable(),
  voltarAoSaldo: z.boolean(),
});
export type CofrinhoRetiradaRequest = z.infer<typeof cofrinhoRetiradaRequestSchema>;

export const cofrinhoRetiradaResponseSchema = cofrinhoAporteResponseSchema;
export type CofrinhoRetiradaResponse = z.infer<typeof cofrinhoRetiradaResponseSchema>;

export const cofrinhoEncerrarRequestSchema = z.object({
  voltarAoSaldo: z.boolean().optional().default(false),
});
export type CofrinhoEncerrarRequest = z.infer<typeof cofrinhoEncerrarRequestSchema>;

export const cofrinhoEncerrarResponseSchema = z.object({ cofrinho: cofrinhoSchema });
export type CofrinhoEncerrarResponse = z.infer<typeof cofrinhoEncerrarResponseSchema>;

export const cofrinhoResumoSchema = z.object({
  id: z.string().uuid(),
  nome: z.string(),
  emoji: z.string().nullable(),
  saldoAtual: z.string(),
  metaValor: z.string().nullable(),
  percentualMeta: z.number().nullable(),
});
export type CofrinhoResumo = z.infer<typeof cofrinhoResumoSchema>;

export const dashboardCofrinhoResponseSchema = z.object({
  cofrinhos: z.array(cofrinhoResumoSchema),
});
export type DashboardCofrinhoResponse = z.infer<typeof dashboardCofrinhoResponseSchema>;
```

- [ ] **Step 2: Build types para validar**

Run: `cd /home/leoferolive/projetos/nossagrana/.worktrees/feat-cofrinhos && pnpm --filter @nossagrana/types build`
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
git add packages/types/src/index.ts
git commit -m "feat(types): adicionar schemas Zod para módulo Cofrinhos"
```

---

## Task 2: Database Schema — Novas tabelas e campos

**Files:**
- Modify: `apps/api/src/db/schema.ts` (adicionar após linha 215)
- Modify: `apps/api/src/db/seeds/categorias-padrao.ts`

- [ ] **Step 1: Adicionar campo `sistema` à tabela categorias**

Em `apps/api/src/db/schema.ts`, adicionar o campo `sistema` à tabela `categorias` (após `ativo`, linha ~103):

```typescript
sistema: boolean('sistema').notNull().default(false),
```

- [ ] **Step 2: Adicionar enums e tabela cofrinhos ao schema**

Após a tabela `snapshotsMensais` (após linha 215), adicionar:

```typescript
export const cofrinhoStatus = pgEnum('cofrinho_status', ['ativo', 'encerrado']);
export const movimentacaoCofrinhoTipo = pgEnum('movimentacao_cofrinho_tipo', ['aporte', 'retirada']);

export const cofrinhos = pgTable(
  'cofrinhos',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    familiaId: uuid('familia_id')
      .notNull()
      .references(() => familias.id),
    nome: text('nome').notNull(),
    emoji: text('emoji'),
    descricao: text('descricao'),
    metaValor: numeric('meta_valor', { precision: 12, scale: 2 }),
    saldoAtual: numeric('saldo_atual', { precision: 12, scale: 2 }).notNull().default('0'),
    status: cofrinhoStatus('status').notNull().default('ativo'),
    criadoPor: uuid('criado_por')
      .notNull()
      .references(() => users.id),
    criadoEm: timestamp('criado_em', { withTimezone: true }).defaultNow().notNull(),
    encerradoEm: timestamp('encerrado_em', { withTimezone: true }),
  },
  (table) => [
    index('cofrinhos_familia_id_idx').on(table.familiaId),
  ],
);

export const movimentacoesCofrinhos = pgTable(
  'movimentacoes_cofrinho',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    cofrinhoId: uuid('cofrinho_id')
      .notNull()
      .references(() => cofrinhos.id),
    familiaId: uuid('familia_id')
      .notNull()
      .references(() => familias.id),
    tipo: movimentacaoCofrinhoTipo('tipo').notNull(),
    valor: numeric('valor', { precision: 12, scale: 2 }).notNull(),
    descricao: text('descricao'),
    transacaoId: uuid('transacao_id').references(() => transacoes.id),
    registradoPor: uuid('registrado_por')
      .notNull()
      .references(() => users.id),
    registradoEm: timestamp('registrado_em', { withTimezone: true }).defaultNow().notNull(),
    mesReferencia: text('mes_referencia').notNull(),
  },
  (table) => [
    index('movimentacoes_cofrinho_cofrinho_id_idx').on(table.cofrinhoId),
    index('movimentacoes_cofrinho_familia_id_idx').on(table.familiaId),
  ],
);
```

- [ ] **Step 3: Adicionar campo cofrinhoId à tabela transacoes**

Na tabela `transacoes`, após `transacaoPaiId` (linha ~167), adicionar:

```typescript
cofrinhoId: uuid('cofrinho_id').references(() => cofrinhos.id),
```

**Nota:** como `cofrinhos` é declarado após `transacoes` no arquivo, será necessário reordenar ou usar referência lazy. Se Drizzle não suportar referência forward, mover a declaração de `cofrinhos` para antes de `transacoes`, ou remover a FK constraint e apenas declarar o campo UUID simples.

- [ ] **Step 4: Adicionar constante de categoria sistema ao seed**

Em `apps/api/src/db/seeds/categorias-padrao.ts`, adicionar:

```typescript
export const CATEGORIA_SISTEMA_COFRINHO = 'Cofrinho' as const;
```

- [ ] **Step 5: Gerar migration**

Run: `cd /home/leoferolive/projetos/nossagrana/.worktrees/feat-cofrinhos && pnpm --filter api db:generate`
Expected: Nova migration gerada em `apps/api/src/db/migrations/`

- [ ] **Step 6: Verificar type-check**

Run: `pnpm type-check`
Expected: SUCCESS

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/db/ apps/api/src/db/seeds/
git commit -m "feat(db): adicionar tabelas cofrinhos, movimentacoes_cofrinho e campos sistema/cofrinhoId"
```

---

## Task 3: Backend — Proteção de categorias sistema

**Files:**
- Modify: `apps/api/src/modules/categoria/categoria.types.ts`
- Modify: `apps/api/src/modules/categoria/categoria.repository.ts`
- Modify: `apps/api/src/modules/categoria/categoria.service.ts`
- Modify: `apps/api/src/modules/categoria/categoria.routes.ts`
- Modify: `apps/api/src/modules/familia/familia.service.ts`

- [ ] **Step 1: Escrever teste — categoria sistema não pode ser editada/desativada**

Adicionar teste em `apps/api/src/modules/categoria/categoria.service.test.ts` (criar se não existe):

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { CategoriaService, CategoriaNotFoundError, CategoriaSistemaError } from './categoria.service.js';
import { InMemoryCategoriaRepository } from './categoria.repository.js';

describe('CategoriaService', () => {
  let service: CategoriaService;
  let repo: InMemoryCategoriaRepository;

  beforeEach(() => {
    repo = new InMemoryCategoriaRepository();
    service = new CategoriaService(repo);
  });

  it('deve rejeitar update de categoria sistema', async () => {
    const cat = await repo.create({
      familiaId: 'f1', nome: 'Cofrinho', tipo: 'despesa', criadoPor: 'u1', sistema: true,
    });
    await expect(
      service.update({ id: cat.id, familiaId: 'f1', nome: 'Outro', tipo: 'despesa' }),
    ).rejects.toThrow(CategoriaSistemaError);
  });

  it('deve rejeitar deactivate de categoria sistema', async () => {
    const cat = await repo.create({
      familiaId: 'f1', nome: 'Cofrinho', tipo: 'despesa', criadoPor: 'u1', sistema: true,
    });
    await expect(
      service.deactivate({ id: cat.id, familiaId: 'f1' }),
    ).rejects.toThrow(CategoriaSistemaError);
  });

  it('deve permitir update de categoria normal', async () => {
    const cat = await repo.create({
      familiaId: 'f1', nome: 'Lazer', tipo: 'despesa', criadoPor: 'u1',
    });
    const updated = await service.update({ id: cat.id, familiaId: 'f1', nome: 'Diversão', tipo: 'despesa' });
    expect(updated.nome).toBe('Diversão');
  });
});
```

- [ ] **Step 2: Rodar teste para confirmar que falha**

Run: `pnpm --filter api vitest run src/modules/categoria/categoria.service.test.ts`
Expected: FAIL — `CategoriaSistemaError` não existe ainda

- [ ] **Step 3: Adicionar campo `sistema` ao tipo Categoria**

Em `categoria.types.ts`, adicionar `sistema: boolean` à interface `Categoria` e ao `CategoriaRepository` (parâmetro create).

- [ ] **Step 4: Atualizar repository para incluir campo sistema**

Em `categoria.repository.ts`:
- `DrizzleCategoriaRepository`: incluir `sistema: categorias.sistema` em todas as queries (select, returning)
- `InMemoryCategoriaRepository`: incluir `sistema` no create (default false) e retornar em todas as operações
- Adicionar método `findById(input: { id: string; familiaId: string }): Promise<Categoria | null>`

- [ ] **Step 5: Implementar proteção no service**

Em `categoria.service.ts`:
- Adicionar `CategoriaSistemaError`
- Em `update()`: buscar categoria por id, se `sistema === true` → throw `CategoriaSistemaError`
- Em `deactivate()`: buscar categoria por id, se `sistema === true` → throw `CategoriaSistemaError`

```typescript
export class CategoriaSistemaError extends Error {
  constructor() {
    super('Categorias de sistema não podem ser editadas ou removidas');
  }
}
```

- [ ] **Step 6: Atualizar routes para tratar CategoriaSistemaError**

Em `categoria.routes.ts`, nos handlers de PATCH e DELETE, adicionar:

```typescript
if (error instanceof CategoriaSistemaError) {
  return reply.code(403).send({ message: error.message });
}
```

- [ ] **Step 7: Seed de categoria "Cofrinho" ao criar família**

Em `apps/api/src/modules/familia/familia.service.ts`, no método `createWithAdminMembership()`, após criar as categorias padrão, adicionar criação da categoria "Cofrinho" com `sistema: true`:

```typescript
// Após inserir categorias padrão (receita + despesa):
await categoriaRepo.create({
  familiaId: familia.id,
  nome: CATEGORIA_SISTEMA_COFRINHO,
  tipo: 'despesa',
  criadoPor: input.criadoPor,
  sistema: true,
});
```

- [ ] **Step 8: Rodar testes para confirmar que passam**

Run: `pnpm --filter api vitest run src/modules/categoria/`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/modules/categoria/ apps/api/src/modules/familia/ apps/api/src/db/seeds/
git commit -m "feat(api): proteger categorias sistema e seed 'Cofrinho' ao criar família"
```

---

## Task 4: Backend — Cofrinho types e repository

**Files:**
- Create: `apps/api/src/modules/cofrinho/cofrinho.types.ts`
- Create: `apps/api/src/modules/cofrinho/cofrinho.repository.ts`

- [ ] **Step 1: Criar cofrinho.types.ts**

```typescript
export interface Cofrinho {
  id: string;
  familiaId: string;
  nome: string;
  emoji: string | null;
  descricao: string | null;
  metaValor: string | null;
  saldoAtual: string;
  status: 'ativo' | 'encerrado';
  criadoPor: string;
  criadoEm: Date;
  encerradoEm: Date | null;
}

export interface MovimentacaoCofrinho {
  id: string;
  cofrinhoId: string;
  familiaId: string;
  tipo: 'aporte' | 'retirada';
  valor: string;
  descricao: string | null;
  transacaoId: string | null;
  registradoPor: string;
  registradoEm: Date;
  mesReferencia: string;
}

export interface CofrinhoRepository {
  list(input: { familiaId: string; status: 'ativo' | 'encerrado' }): Promise<Cofrinho[]>;
  findById(input: { id: string; familiaId: string }): Promise<Cofrinho | null>;
  create(input: {
    familiaId: string;
    nome: string;
    emoji?: string | null;
    descricao?: string | null;
    metaValor?: string | null;
    criadoPor: string;
  }): Promise<Cofrinho>;
  update(input: {
    id: string;
    familiaId: string;
    nome?: string;
    emoji?: string | null;
    descricao?: string | null;
    metaValor?: string | null;
  }): Promise<Cofrinho | null>;
  updateSaldo(input: { id: string; familiaId: string; novoSaldo: string }): Promise<Cofrinho | null>;
  encerrar(input: { id: string; familiaId: string }): Promise<Cofrinho | null>;
  createMovimentacao(input: {
    cofrinhoId: string;
    familiaId: string;
    tipo: 'aporte' | 'retirada';
    valor: string;
    descricao?: string | null;
    transacaoId?: string | null;
    registradoPor: string;
    mesReferencia: string;
  }): Promise<MovimentacaoCofrinho>;
  listMovimentacoes(input: { cofrinhoId: string; familiaId: string }): Promise<MovimentacaoCofrinho[]>;
}
```

- [ ] **Step 2: Criar InMemoryCofrinhoRepository**

Em `cofrinho.repository.ts`, implementar `InMemoryCofrinhoRepository` completo (seguindo o padrão do InMemoryCategoriaRepository):

```typescript
import { randomUUID } from 'node:crypto';
import type { Cofrinho, MovimentacaoCofrinho, CofrinhoRepository } from './cofrinho.types.js';

export class InMemoryCofrinhoRepository implements CofrinhoRepository {
  private cofrinhos: Cofrinho[] = [];
  private movimentacoes: MovimentacaoCofrinho[] = [];

  async list(input: { familiaId: string; status: 'ativo' | 'encerrado' }): Promise<Cofrinho[]> {
    return this.cofrinhos.filter(
      (c) => c.familiaId === input.familiaId && c.status === input.status,
    );
  }

  async findById(input: { id: string; familiaId: string }): Promise<Cofrinho | null> {
    return this.cofrinhos.find(
      (c) => c.id === input.id && c.familiaId === input.familiaId,
    ) ?? null;
  }

  async create(input: {
    familiaId: string; nome: string; emoji?: string | null;
    descricao?: string | null; metaValor?: string | null; criadoPor: string;
  }): Promise<Cofrinho> {
    const cofrinho: Cofrinho = {
      id: randomUUID(),
      familiaId: input.familiaId,
      nome: input.nome,
      emoji: input.emoji ?? null,
      descricao: input.descricao ?? null,
      metaValor: input.metaValor ?? null,
      saldoAtual: '0',
      status: 'ativo',
      criadoPor: input.criadoPor,
      criadoEm: new Date(),
      encerradoEm: null,
    };
    this.cofrinhos.push(cofrinho);
    return cofrinho;
  }

  async update(input: {
    id: string; familiaId: string;
    nome?: string; emoji?: string | null;
    descricao?: string | null; metaValor?: string | null;
  }): Promise<Cofrinho | null> {
    const idx = this.cofrinhos.findIndex(
      (c) => c.id === input.id && c.familiaId === input.familiaId && c.status === 'ativo',
    );
    if (idx === -1) return null;
    const c = this.cofrinhos[idx];
    this.cofrinhos[idx] = {
      ...c,
      nome: input.nome ?? c.nome,
      emoji: input.emoji !== undefined ? input.emoji : c.emoji,
      descricao: input.descricao !== undefined ? input.descricao : c.descricao,
      metaValor: input.metaValor !== undefined ? input.metaValor : c.metaValor,
    };
    return this.cofrinhos[idx];
  }

  async updateSaldo(input: { id: string; familiaId: string; novoSaldo: string }): Promise<Cofrinho | null> {
    const idx = this.cofrinhos.findIndex(
      (c) => c.id === input.id && c.familiaId === input.familiaId,
    );
    if (idx === -1) return null;
    this.cofrinhos[idx] = { ...this.cofrinhos[idx], saldoAtual: input.novoSaldo };
    return this.cofrinhos[idx];
  }

  async encerrar(input: { id: string; familiaId: string }): Promise<Cofrinho | null> {
    const idx = this.cofrinhos.findIndex(
      (c) => c.id === input.id && c.familiaId === input.familiaId && c.status === 'ativo',
    );
    if (idx === -1) return null;
    this.cofrinhos[idx] = {
      ...this.cofrinhos[idx],
      status: 'encerrado',
      encerradoEm: new Date(),
      saldoAtual: '0',
    };
    return this.cofrinhos[idx];
  }

  async createMovimentacao(input: {
    cofrinhoId: string; familiaId: string;
    tipo: 'aporte' | 'retirada'; valor: string;
    descricao?: string | null; transacaoId?: string | null;
    registradoPor: string; mesReferencia: string;
  }): Promise<MovimentacaoCofrinho> {
    const mov: MovimentacaoCofrinho = {
      id: randomUUID(),
      cofrinhoId: input.cofrinhoId,
      familiaId: input.familiaId,
      tipo: input.tipo,
      valor: input.valor,
      descricao: input.descricao ?? null,
      transacaoId: input.transacaoId ?? null,
      registradoPor: input.registradoPor,
      registradoEm: new Date(),
      mesReferencia: input.mesReferencia,
    };
    this.movimentacoes.push(mov);
    return mov;
  }

  async listMovimentacoes(input: { cofrinhoId: string; familiaId: string }): Promise<MovimentacaoCofrinho[]> {
    return this.movimentacoes.filter(
      (m) => m.cofrinhoId === input.cofrinhoId && m.familiaId === input.familiaId,
    );
  }
}
```

- [ ] **Step 3: Stub do DrizzleCofrinhoRepository**

Criar a classe `DrizzleCofrinhoRepository` com todos os métodos implementando queries Drizzle reais contra as tabelas `cofrinhos` e `movimentacoesCofrinhos`. Seguir o padrão de `DrizzleCategoriaRepository` — select, insert, update com returning, filtro por familiaId.

- [ ] **Step 4: Type-check**

Run: `pnpm type-check`
Expected: SUCCESS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/cofrinho/
git commit -m "feat(api): criar types e repository do módulo Cofrinho"
```

---

## Task 5: Backend — CofrinhoService (TDD)

**Files:**
- Create: `apps/api/src/modules/cofrinho/cofrinho.service.ts`
- Create: `apps/api/src/modules/cofrinho/cofrinho.service.test.ts`

- [ ] **Step 1: Escrever testes do service**

Criar `cofrinho.service.test.ts` com testes para:
1. `criar()` — cria cofrinho com nome, emoji, meta
2. `editar()` — atualiza nome/meta, rejeita se não encontrado
3. `aportar()` — cria transação de despesa + movimentação + incrementa saldo
4. `aportar()` — rejeita se cofrinho encerrado
5. `retirar()` com voltarAoSaldo=true — cria transação de receita + movimentação + decrementa saldo
6. `retirar()` com voltarAoSaldo=false — apenas movimentação, sem transação
7. `retirar()` — rejeita se saldo insuficiente
8. `encerrar()` com saldo 0 — muda status para encerrado
9. `encerrar()` com saldo > 0 e voltarAoSaldo=true — cria retirada total + encerra
10. `encerrar()` com saldo > 0 e voltarAoSaldo=false — zera saldo + encerra
11. `listar()` — filtra por status

O service precisa de um `TransacaoCreator` (interface simples) para criar transações no extrato, ao invés de depender diretamente de TransacaoService (separação de responsabilidade).

```typescript
interface TransacaoCreator {
  criar(input: {
    familiaId: string;
    tipo: 'receita' | 'despesa';
    valor: string;
    categoriaId: string;
    descricao: string | null;
    data: string;
    mesReferencia: string;
    usuarioRegistrouId: string;
    cofrinhoId: string;
  }): Promise<{ id: string }>;
}
```

- [ ] **Step 2: Rodar testes para confirmar que falham**

Run: `pnpm --filter api vitest run src/modules/cofrinho/cofrinho.service.test.ts`
Expected: FAIL — CofrinhoService não existe ainda

- [ ] **Step 3: Implementar CofrinhoService**

```typescript
export class CofrinhoNotFoundError extends Error {
  constructor() { super('Cofrinho nao encontrado'); }
}

export class CofrinhoEncerradoError extends Error {
  constructor() { super('Cofrinho esta encerrado'); }
}

export class SaldoInsuficienteError extends Error {
  constructor() { super('Saldo insuficiente para esta retirada'); }
}

export class CofrinhoService {
  constructor(
    private readonly repository: CofrinhoRepository,
    private readonly transacaoCreator: TransacaoCreator,
    private readonly getCategoriaCofrinho: (familiaId: string) => Promise<{ id: string }>,
  ) {}

  async listar(input: { familiaId: string; status?: 'ativo' | 'encerrado' }) { ... }
  async detalhe(input: { id: string; familiaId: string }) { ... }
  async criar(input: { familiaId: string; nome: string; emoji?: string | null; descricao?: string | null; metaValor?: string | null; criadoPor: string }) { ... }
  async editar(input: { id: string; familiaId: string; nome?: string; emoji?: string | null; descricao?: string | null; metaValor?: string | null }) { ... }
  async aportar(input: { cofrinhoId: string; familiaId: string; valor: string; descricao?: string | null; usuarioId: string }) { ... }
  async retirar(input: { cofrinhoId: string; familiaId: string; valor: string; descricao?: string | null; voltarAoSaldo: boolean; usuarioId: string }) { ... }
  async encerrar(input: { id: string; familiaId: string; voltarAoSaldo: boolean; usuarioId: string }) { ... }
}
```

Lógica-chave:
- `aportar()`: busca cofrinho → valida ativo → busca categoria "Cofrinho" → calcula mesReferencia (hoje) → cria transação despesa → cria movimentação aporte → incrementa saldo
- `retirar()`: busca cofrinho → valida saldo ≥ valor → se voltarAoSaldo: cria transação receita → cria movimentação → decrementa saldo
- `encerrar()`: se saldo > 0 e voltarAoSaldo → chama `retirar()` com valor = saldo. Depois seta status='encerrado'

- [ ] **Step 4: Rodar testes para confirmar que passam**

Run: `pnpm --filter api vitest run src/modules/cofrinho/cofrinho.service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/cofrinho/
git commit -m "feat(api): implementar CofrinhoService com TDD"
```

---

## Task 5b: Backend — Aporte Recorrente e Cancelamento (TDD)

**Files:**
- Modify: `apps/api/src/modules/cofrinho/cofrinho.service.ts`
- Modify: `apps/api/src/modules/cofrinho/cofrinho.service.test.ts`
- Modify: `apps/api/src/modules/cofrinho/cofrinho.types.ts`

- [ ] **Step 1: Escrever testes de aporte recorrente**

Adicionar ao `cofrinho.service.test.ts`:

```typescript
describe('aportar recorrente', () => {
  it('deve criar transação-pai recorrente + primeira movimentação', async () => {
    // Arrange: cofrinho ativo
    // Act: service.aportar({ ..., recorrente: true, frequencia: 'mensal' })
    // Assert: transação criada com recorrente=true, frequencia='mensal'
    // Assert: movimentação criada com tipo='aporte'
    // Assert: saldo incrementado
  });

  it('deve rejeitar aporte recorrente se já existe um ativo', async () => {
    // Arrange: cofrinho com aporte recorrente ativo
    // Act/Assert: service.aportar({ recorrente: true }) → throws AporteRecorrenteJaAtivoError
  });
});

describe('cancelarAporteRecorrente', () => {
  it('deve remover transações-filhas futuras e desativar recorrência na pai', async () => {
    // Arrange: cofrinho com aporte recorrente (transação-pai + filhas futuras)
    // Act: service.cancelarAporteRecorrente({ cofrinhoId, familiaId })
    // Assert: filhas futuras removidas, pai desativada
  });

  it('deve rejeitar se não há aporte recorrente ativo', async () => {
    // Act/Assert: throws AporteRecorrenteNotFoundError
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falha**

Run: `pnpm --filter api vitest run src/modules/cofrinho/cofrinho.service.test.ts`
Expected: FAIL

- [ ] **Step 3: Adicionar interface TransacaoRecorrenteCreator ao types**

Em `cofrinho.types.ts`, adicionar:

```typescript
export interface TransacaoRecorrenteCreator {
  criarRecorrente(input: {
    familiaId: string;
    tipo: 'receita' | 'despesa';
    valor: string;
    categoriaId: string;
    descricao: string | null;
    data: string;
    mesReferencia: string;
    usuarioRegistrouId: string;
    cofrinhoId: string;
    frequencia: 'mensal' | 'semanal' | 'quinzenal';
    dataFimRecorrencia?: string | null;
  }): Promise<{ id: string }>;
  cancelarRecorrencia(input: {
    transacaoPaiId: string;
    familiaId: string;
  }): Promise<void>;
}

export interface CofrinhoRepository {
  // ... (existente)
  findAporteRecorrenteAtivo(input: { cofrinhoId: string; familiaId: string }): Promise<{
    transacaoPaiId: string;
    valor: string;
    frequencia: 'mensal' | 'semanal' | 'quinzenal';
    dataFimRecorrencia: string | null;
  } | null>;
}
```

- [ ] **Step 4: Implementar no service**

Adicionar ao `CofrinhoService`:
- `aportar()` — se `recorrente=true`: usar `transacaoRecorrenteCreator.criarRecorrente()`, validar que não existe aporte recorrente ativo
- `cancelarAporteRecorrente()` — busca aporte ativo via repo, chama `transacaoRecorrenteCreator.cancelarRecorrencia()`

- [ ] **Step 5: Atualizar InMemory repository**

Adicionar `findAporteRecorrenteAtivo()` ao `InMemoryCofrinhoRepository`.

- [ ] **Step 6: Rodar testes para confirmar que passam**

Run: `pnpm --filter api vitest run src/modules/cofrinho/cofrinho.service.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/cofrinho/
git commit -m "feat(api): implementar aporte recorrente e cancelamento no CofrinhoService"
```

---

## Task 6: Backend — Routes e Schema Fastify

**Files:**
- Create: `apps/api/src/modules/cofrinho/cofrinho.schema.ts`
- Create: `apps/api/src/modules/cofrinho/cofrinho.routes.ts`
- Create: `apps/api/src/modules/cofrinho/cofrinho.routes.test.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Criar cofrinho.schema.ts**

Definir schemas Fastify para validação de request/response (seguindo padrão de `categoria.schema.ts`):

```typescript
export const cofrinhoListSchema = { /* querystring, response 200 */ };
export const cofrinhoDetalheSchema = { /* params, response 200 */ };
export const cofrinhoCreateSchema = { /* body, response 201 */ };
export const cofrinhoUpdateSchema = { /* params, body, response 200 */ };
export const cofrinhoAporteSchema = { /* params, body, response 201 */ };
export const cofrinhoRetiradaSchema = { /* params, body, response 201 */ };
export const cofrinhoEncerrarSchema = { /* params, body, response 200 */ };
```

- [ ] **Step 2: Criar cofrinho.routes.ts**

8 endpoints seguindo padrão existente (authenticate + requireFamiliaScope):

```typescript
export const cofrinhoRoutes: FastifyPluginAsync = async (fastify) => {
  const service = defaultCofrinhoService();

  fastify.get('/cofrinhos', { preHandler: [...], schema: cofrinhoListSchema }, handler);
  fastify.get('/cofrinhos/:id', { preHandler: [...], schema: cofrinhoDetalheSchema }, handler);
  fastify.post('/cofrinhos', { preHandler: [...], schema: cofrinhoCreateSchema }, handler);
  fastify.patch('/cofrinhos/:id', { preHandler: [...], schema: cofrinhoUpdateSchema }, handler);
  fastify.post('/cofrinhos/:id/aportes', { preHandler: [...], schema: cofrinhoAporteSchema }, handler);
  fastify.post('/cofrinhos/:id/retiradas', { preHandler: [...], schema: cofrinhoRetiradaSchema }, handler);
  fastify.post('/cofrinhos/:id/encerrar', { preHandler: [...], schema: cofrinhoEncerrarSchema }, handler);
  fastify.delete('/cofrinhos/:id/aporte-recorrente', { preHandler: [...] }, handler);
};
```

- [ ] **Step 3: Registrar rotas em app.ts**

Em `apps/api/src/app.ts`:

```typescript
import { cofrinhoRoutes } from './modules/cofrinho/cofrinho.routes.js';
// ...
app.register(cofrinhoRoutes, { prefix: '/api' });
```

- [ ] **Step 4: Escrever testes de rota**

Criar `cofrinho.routes.test.ts` com teste de integração (seguindo padrão existente — buildApp + inject):
- POST /api/cofrinhos → 201
- GET /api/cofrinhos → 200 com lista
- POST /api/cofrinhos/:id/aportes → 201
- POST /api/cofrinhos/:id/retiradas → 201

- [ ] **Step 5: Rodar todos os testes da API**

Run: `pnpm --filter api test`
Expected: PASS

- [ ] **Step 6: Verificar CI localmente**

Run: `pnpm lint && pnpm type-check && pnpm build && pnpm knip`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/cofrinho/ apps/api/src/app.ts
git commit -m "feat(api): adicionar rotas REST do módulo Cofrinho"
```

---

## Task 6b: Backend — Integração do Cron Job com Cofrinhos

**Files:**
- Modify: `apps/api/src/modules/historico/snapshot.job.ts` (ou onde transações recorrentes são geradas)
- Modify: `apps/api/src/modules/transacao/transacao.service.ts`
- Create: `apps/api/src/modules/cofrinho/cofrinho.cron-integration.test.ts`

> **Contexto:** Quando o cron job gera uma transação-filha recorrente e essa transação tem `cofrinho_id` preenchido (herdado da transação-pai), deve automaticamente criar uma `movimentacao_cofrinho` e incrementar o `saldo_atual` do cofrinho. Sem isso, aportes recorrentes não funcionam.

- [ ] **Step 1: Escrever teste da integração cron → cofrinho**

```typescript
describe('Integração: transação recorrente com cofrinho_id', () => {
  it('ao gerar filha recorrente com cofrinhoId, cria movimentacao e incrementa saldo', async () => {
    // Arrange: transacao-pai recorrente com cofrinhoId preenchido
    // Act: simular geração de filha (como o cron faz)
    // Assert: movimentacao_cofrinho criada com tipo='aporte'
    // Assert: cofrinho.saldoAtual incrementado pelo valor da filha
  });

  it('ao gerar filha recorrente sem cofrinhoId, não cria movimentacao', async () => {
    // Arrange: transacao-pai recorrente normal (sem cofrinhoId)
    // Act: simular geração de filha
    // Assert: nenhuma movimentacao_cofrinho criada
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falha**

Run: `pnpm --filter api vitest run src/modules/cofrinho/cofrinho.cron-integration.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar integração**

Na lógica de geração de transações-filhas recorrentes (em `TransacaoService` ou `snapshot.job.ts`):
- Após criar transação-filha, verificar se `transacaoPai.cofrinhoId` existe
- Se sim: buscar cofrinho, criar `movimentacao_cofrinho` (tipo='aporte', valor da filha, transacaoId=filha.id) e incrementar `saldoAtual`
- Usar injeção de dependência: receber `CofrinhoRepository` como parâmetro opcional

- [ ] **Step 4: Rodar testes**

Run: `pnpm --filter api vitest run src/modules/cofrinho/`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/cofrinho/ apps/api/src/modules/transacao/ apps/api/src/modules/historico/
git commit -m "feat(api): integrar cron job de recorrências com módulo Cofrinho"
```

---

## Task 6c: Backend — Filtro de Categorias Sistema nos Relatórios

**Files:**
- Modify: `apps/api/src/modules/relatorio/relatorio.service.ts` (ou repository)
- Modify: `apps/api/src/modules/relatorio/relatorio.service.test.ts` (ou criar)
- Modify: `apps/api/src/modules/dashboard/dashboard.service.ts` (ou repository)

> **Contexto:** A spec exige que transações com categoria `sistema=true` (como "Cofrinho") sejam filtradas dos gráficos de distribuição de despesas. Sem isso, aportes ao cofrinho distorcem os insights de consumo real.

- [ ] **Step 1: Escrever teste — categoria sistema excluída dos relatórios**

```typescript
describe('RelatorioService — filtro sistema', () => {
  it('deve excluir categorias com sistema=true da distribuição de despesas', async () => {
    // Arrange: transações com categorias normais + categoria "Cofrinho" (sistema=true)
    // Act: service.distribuicao(familiaId, mesReferencia)
    // Assert: resultado não contém "Cofrinho"
  });
});
```

- [ ] **Step 2: Rodar para confirmar que falha**

Expected: FAIL — "Cofrinho" aparece nos resultados

- [ ] **Step 3: Implementar filtro**

Na query de distribuição (repository ou service), adicionar JOIN/filtro:
- Excluir transações onde `categorias.sistema = true`
- Aplicar tanto em `relatorio.distribuicao()` quanto em `dashboard.getGraficos()`

- [ ] **Step 4: Rodar testes**

Run: `pnpm --filter api vitest run src/modules/relatorio/ src/modules/dashboard/`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/relatorio/ apps/api/src/modules/dashboard/
git commit -m "feat(api): excluir categorias sistema dos relatórios de despesas"
```

---

## Task 7: Frontend — Service e Store

**Files:**
- Create: `apps/web/src/services/cofrinho.service.ts`
- Create: `apps/web/src/stores/cofrinho.store.ts`
- Modify: `apps/web/src/components/icons.tsx`

- [ ] **Step 1: Criar cofrinho.service.ts**

Seguindo o padrão de `core-financeiro.service.ts`:

```typescript
import type {
  CofrinhoListResponse, CofrinhoCreateRequest, CofrinhoCreateResponse,
  CofrinhoDetalheResponse, CofrinhoUpdateRequest, CofrinhoAporteRequest,
  CofrinhoAporteResponse, CofrinhoRetiradaRequest, CofrinhoRetiradaResponse,
  CofrinhoEncerrarRequest, CofrinhoEncerrarResponse, DashboardCofrinhoResponse,
} from '@nossagrana/types';

export class CofrinhoService {
  constructor(private readonly apiClient: ApiClient) {}

  async listar(familiaId: string, status = 'ativo'): Promise<CofrinhoListResponse> { ... }
  async detalhe(familiaId: string, id: string): Promise<CofrinhoDetalheResponse> { ... }
  async criar(familiaId: string, payload: CofrinhoCreateRequest): Promise<CofrinhoCreateResponse> { ... }
  async editar(familiaId: string, id: string, payload: CofrinhoUpdateRequest): Promise<CofrinhoCreateResponse> { ... }
  async aportar(familiaId: string, id: string, payload: CofrinhoAporteRequest): Promise<CofrinhoAporteResponse> { ... }
  async retirar(familiaId: string, id: string, payload: CofrinhoRetiradaRequest): Promise<CofrinhoRetiradaResponse> { ... }
  async encerrar(familiaId: string, id: string, payload: CofrinhoEncerrarRequest): Promise<CofrinhoEncerrarResponse> { ... }
  async cancelarAporteRecorrente(familiaId: string, id: string): Promise<void> { ... }
  async resumoDashboard(familiaId: string): Promise<DashboardCofrinhoResponse> { ... }
}

export const cofrinhoService = new CofrinhoService(lazyApiClient);
```

- [ ] **Step 2: Criar cofrinho.store.ts**

```typescript
import { create } from 'zustand';
import type { CofrinhoListResponse, CofrinhoDetalheResponse } from '@nossagrana/types';
import { cofrinhoService } from '../services/cofrinho.service.js';

interface CofrinhoStore {
  cofrinhos: CofrinhoListResponse['cofrinhos'];
  cofrinhoSelecionado: CofrinhoDetalheResponse | null;
  carregando: boolean;
  erro: string | null;
  fetchAll: (familiaId: string) => Promise<void>;
  fetchDetalhe: (familiaId: string, cofrinhoId: string) => Promise<void>;
  reset: () => void;
}

export const useCofrinhoStore = create<CofrinhoStore>((set) => ({
  cofrinhos: [],
  cofrinhoSelecionado: null,
  carregando: false,
  erro: null,
  fetchAll: async (familiaId) => { ... },
  fetchDetalhe: async (familiaId, cofrinhoId) => { ... },
  reset: () => set({ cofrinhos: [], cofrinhoSelecionado: null, erro: null }),
}));
```

- [ ] **Step 3: Adicionar IconCofrinho em icons.tsx**

```typescript
import { PiggyBank } from 'lucide-react';
export const IconCofrinho = PiggyBank;
```

- [ ] **Step 4: Type-check**

Run: `pnpm type-check`
Expected: SUCCESS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/services/cofrinho.service.ts apps/web/src/stores/cofrinho.store.ts apps/web/src/components/icons.tsx
git commit -m "feat(web): criar service, store e ícone para Cofrinhos"
```

---

## Task 8: Frontend — Navegação (App.tsx, Sidebar, TopBar, Configurações)

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/sidebar.tsx`
- Modify: `apps/web/src/components/top-bar.tsx`
- Modify: `apps/web/src/pages/configuracoes-page.tsx`

- [ ] **Step 1: Adicionar screens ao App.tsx**

1. Adicionar `'cofrinhos' | 'cofrinho-detalhe'` ao type `Screen`
2. Adicionar estado `cofrinhoIdSelecionado`
3. No switch de renderização, adicionar:
   - `case 'cofrinhos'`: `<CofrinhosPage familiaId={familiaId} onNavigate={...} onVerDetalhe={(id) => { setCofrinhoIdSelecionado(id); setScreen('cofrinho-detalhe'); }} />`
   - `case 'cofrinho-detalhe'`: `<CofrinhoDetalhePage familiaId={familiaId} cofrinhoId={cofrinhoIdSelecionado} onBack={() => setScreen('cofrinhos')} />`

- [ ] **Step 2: Adicionar item na Sidebar**

Em `sidebar.tsx`, no `navGroups[1].items` (grupo com categorias, cartões, orçamento), adicionar:

```typescript
{ id: 'cofrinhos', icon: PiggyBank, label: 'Cofrinhos' },
```

- [ ] **Step 3: Adicionar título no TopBar**

Em `top-bar.tsx`, no `screenTitles`:

```typescript
cofrinhos: 'Cofrinhos',
'cofrinho-detalhe': 'Detalhe do Cofrinho',
```

- [ ] **Step 4: Adicionar item em Configurações**

Em `configuracoes-page.tsx`, adicionar novo item no menu entre "Orçamento Mensal" e "Família":

```typescript
{
  label: 'Cofrinhos',
  description: 'Gerencie suas reservas e metas',
  icon: PiggyBank,
  onClick: () => onNavigate('cofrinhos'),
},
```

- [ ] **Step 5: Type-check e lint**

Run: `pnpm type-check && pnpm lint`
Expected: SUCCESS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/components/sidebar.tsx apps/web/src/components/top-bar.tsx apps/web/src/pages/configuracoes-page.tsx
git commit -m "feat(web): integrar Cofrinhos à navegação (Sidebar, TopBar, Config)"
```

---

## Task 9: Frontend — Modais (criar, aporte, retirada, encerrar)

**Files:**
- Create: `apps/web/src/components/cofrinho-modal.tsx`
- Create: `apps/web/src/components/cofrinho-aporte-modal.tsx`
- Create: `apps/web/src/components/cofrinho-retirada-modal.tsx`
- Create: `apps/web/src/components/cofrinho-encerrar-modal.tsx`

- [ ] **Step 1: Criar cofrinho-modal.tsx (criar/editar)**

Seguir padrão de `transacao-modal.tsx` (bottom-sheet mobile / dialog desktop):
- Props: `open`, `familiaId`, `onClose`, `onSubmit`, `cofrinhoEditar?` (para edição)
- Campos: nome (required), emoji (seletor simples), meta (opcional), descrição (opcional)
- Overlay `bg-black/60`, container `bg-bg rounded-t-2xl md:rounded-2xl`
- Handle bar mobile

- [ ] **Step 2: Criar cofrinho-aporte-modal.tsx**

- Props: `open`, `onClose`, `onSubmit`, `cofrinhoNome`
- Campos: valor (required), descrição (opcional)
- Aviso: "Será registrado como saída no mês atual"
- Botão submit: "Aportar"

- [ ] **Step 3: Criar cofrinho-retirada-modal.tsx**

- Props: `open`, `onClose`, `onSubmit`, `cofrinhoNome`, `saldoAtual`
- Campos: valor (required, max = saldoAtual), descrição (opcional)
- Toggle: "Voltar ao saldo" / "Usar fora do sistema"
- Validação: valor ≤ saldoAtual

- [ ] **Step 4: Criar cofrinho-encerrar-modal.tsx**

- Props: `open`, `onClose`, `onConfirm`, `cofrinhoNome`, `saldoAtual`
- Se saldo > 0: toggle "Voltar ao saldo" / "Descartar"
- Mensagem de confirmação
- Se saldo = 0: apenas confirmação simples

- [ ] **Step 5: Type-check**

Run: `pnpm type-check`
Expected: SUCCESS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/cofrinho-*.tsx
git commit -m "feat(web): criar modais de Cofrinhos (criar, aporte, retirada, encerrar)"
```

---

## Task 10: Frontend — CofrinhosPage (lista)

**Files:**
- Create: `apps/web/src/pages/cofrinhos-page.tsx`
- Create: `apps/web/src/pages/cofrinhos-page.test.tsx`

- [ ] **Step 1: Escrever teste da page**

```typescript
describe('CofrinhosPage', () => {
  it('exibe empty state quando não há cofrinhos', () => { ... });
  it('exibe lista de cofrinhos ativos', () => { ... });
  it('exibe barra de progresso quando cofrinho tem meta', () => { ... });
  it('exibe badge "Meta atingida" quando saldo >= meta', () => { ... });
  it('abre modal de criar ao clicar botão', () => { ... });
});
```

- [ ] **Step 2: Rodar teste para confirmar que falha**

Run: `pnpm --filter web vitest run src/pages/cofrinhos-page.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implementar CofrinhosPage**

```typescript
interface CofrinhosPageProps {
  familiaId: string;
  onNavigate: (screen: string) => void;
  onVerDetalhe: (cofrinhoId: string) => void;
}
```

Componentes:
- Header com botão "+ Novo Cofrinho"
- Grid/lista de cards (nome, emoji, saldo, BudgetBar se tiver meta)
- Badge "Meta atingida" se saldo ≥ metaValor
- Click no card → `onVerDetalhe(id)`
- Empty state: "Sua família ainda não tem cofrinhos." + botão criar
- Toggle ativo/encerrado

- [ ] **Step 4: Rodar teste para confirmar que passa**

Run: `pnpm --filter web vitest run src/pages/cofrinhos-page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/cofrinhos-page.tsx apps/web/src/pages/cofrinhos-page.test.tsx
git commit -m "feat(web): implementar CofrinhosPage (lista de cofrinhos)"
```

---

## Task 11: Frontend — CofrinhoDetalhePage

**Files:**
- Create: `apps/web/src/pages/cofrinho-detalhe-page.tsx`
- Create: `apps/web/src/pages/cofrinho-detalhe-page.test.tsx`

- [ ] **Step 1: Escrever teste da page**

```typescript
describe('CofrinhoDetalhePage', () => {
  it('exibe nome, emoji, saldo e meta do cofrinho', () => { ... });
  it('exibe barra de progresso quando há meta', () => { ... });
  it('exibe lista de movimentações', () => { ... });
  it('botões Aportar e Retirar abrem modais', () => { ... });
  it('botão Encerrar abre modal de confirmação', () => { ... });
});
```

- [ ] **Step 2: Rodar teste para confirmar que falha**

Run: `pnpm --filter web vitest run src/pages/cofrinho-detalhe-page.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implementar CofrinhoDetalhePage**

```typescript
interface CofrinhoDetalhePageProps {
  familiaId: string;
  cofrinhoId: string;
  onBack: () => void;
}
```

Componentes:
- Header: nome + emoji, saldo atual (text-primary), meta (se houver)
- BudgetBar de progresso (se meta)
- Botões de ação: Aportar (success), Retirar (warning), Editar, Encerrar (danger)
- Histórico de movimentações: lista cronológica inversa
  - Cada item: tipo (aporte ↑ verde / retirada ↓ vermelho), valor, descrição, quem, quando
- Seção de aporte recorrente (se ativo: mostra valor/frequência + botão cancelar)

- [ ] **Step 4: Rodar teste para confirmar que passa**

Run: `pnpm --filter web vitest run src/pages/cofrinho-detalhe-page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/cofrinho-detalhe-page.tsx apps/web/src/pages/cofrinho-detalhe-page.test.tsx
git commit -m "feat(web): implementar CofrinhoDetalhePage (detalhe + movimentações)"
```

---

## Task 12: Frontend — Dashboard Card de Cofrinhos

**Files:**
- Modify: `apps/web/src/pages/dashboard-page.tsx`
- Modify: `apps/web/src/pages/dashboard-page.test.tsx`

- [ ] **Step 1: Escrever teste do card no dashboard**

Adicionar ao `dashboard-page.test.tsx`:

```typescript
it('exibe card de cofrinhos com resumo', () => { ... });
it('exibe empty state no card de cofrinhos quando não há cofrinhos', () => { ... });
it('exibe badge "Meta atingida" quando aplicável', () => { ... });
```

- [ ] **Step 2: Rodar teste para confirmar que falha**

Run: `pnpm --filter web vitest run src/pages/dashboard-page.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implementar card de cofrinhos no dashboard**

Após a seção de orçamento (BudgetBar), adicionar seção "Cofrinhos":
- Título com IconCofrinho
- Lista compacta: emoji + nome + saldo + BudgetBar mini (se meta)
- Botão "Aportar" rápido em cada item
- Link "Ver todos →" navega para screen cofrinhos
- Empty state compacto se não há cofrinhos

- [ ] **Step 4: Rodar teste para confirmar que passa**

Run: `pnpm --filter web vitest run src/pages/dashboard-page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/dashboard-page.tsx apps/web/src/pages/dashboard-page.test.tsx
git commit -m "feat(web): adicionar card de Cofrinhos ao Dashboard"
```

---

## Task 13: Integração final — CI, testes e cobertura

**Files:** Nenhum novo — validação final.

- [ ] **Step 1: Rodar CI completa localmente**

```bash
cd /home/leoferolive/projetos/nossagrana/.worktrees/feat-cofrinhos
pnpm lint
pnpm type-check
pnpm build
pnpm knip
pnpm test:coverage
```

- [ ] **Step 2: Verificar cobertura dos arquivos novos**

Run: `CHANGED_FILES="apps/api/src/modules/cofrinho/cofrinho.service.ts\napps/api/src/modules/cofrinho/cofrinho.repository.ts\napps/web/src/pages/cofrinhos-page.tsx\napps/web/src/pages/cofrinho-detalhe-page.tsx" pnpm coverage:changed-check`
Expected: Todos ≥ 80% lines

- [ ] **Step 3: Corrigir qualquer falha de CI**

Se algum step falhar, corrigir e re-executar.

- [ ] **Step 4: Commit final (se houve correções)**

```bash
git add -A
git commit -m "fix: ajustes finais de CI para módulo Cofrinhos"
```

---

## Task 14: Frontend — FirstTimeTour + FAQ para Cofrinhos

**Files:**
- Modify: `apps/web/src/pages/cofrinhos-page.tsx`
- Modify: `apps/web/src/pages/ajuda-page.tsx`

- [ ] **Step 1: Adicionar FirstTimeTour na CofrinhosPage**

Seguir padrão do `dashboard-page.tsx` — usar componente `FirstTimeTour` com `tourKey="cofrinhos"` e passos educativos:
1. "Bem-vindo aos Cofrinhos! Aqui você cria reservas para guardar dinheiro."
2. "Defina uma meta opcional para acompanhar seu progresso."
3. "Faça aportes manuais ou configure aportes automáticos mensais."
4. "Retire quando precisar — você escolhe se o valor volta ao saldo ou não."

- [ ] **Step 2: Adicionar entrada no FAQ (AjudaPage)**

Em `ajuda-page.tsx`, adicionar seção/pergunta sobre Cofrinhos:
- "O que são Cofrinhos?" — reservas financeiras da família
- "Como funciona um aporte?" — registrado como despesa no extrato
- "O que é 'voltar ao saldo'?" — receita no extrato vs uso fora do sistema
- "Posso configurar aportes automáticos?" — sim, com frequência mensal/semanal/quinzenal

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/cofrinhos-page.tsx apps/web/src/pages/ajuda-page.tsx
git commit -m "feat(web): adicionar FirstTimeTour e FAQ para Cofrinhos"
```

---

## Task 15: Push e criar PR

- [ ] **Step 1: Push e criar PR**

```bash
git push -u origin feat/cofrinhos
gh pr create --title "feat: módulo Cofrinhos (reservas financeiras)" --body "$(cat <<'EOF'
## Summary
- Adiciona módulo completo de Cofrinhos (reservas financeiras familiares)
- 2 novas tabelas: `cofrinhos`, `movimentacoes_cofrinho`
- 8 endpoints REST com TDD
- 2 novas páginas (lista + detalhe), 4 modais
- Integração com Dashboard, Sidebar, Configurações
- Categoria "Cofrinho" (sistema=true) protegida contra edição/exclusão
- Aportes geram transação de despesa no extrato, retiradas opcionalmente geram receita

Closes #16

## Test plan
- [ ] Criar cofrinho com nome, emoji e meta
- [ ] Aportar valor — verificar que aparece como despesa no extrato
- [ ] Retirar com "voltar ao saldo" — verificar receita no extrato
- [ ] Retirar sem "voltar ao saldo" — verificar que NÃO aparece no extrato
- [ ] Encerrar cofrinho com saldo > 0
- [ ] Verificar que categoria "Cofrinho" não pode ser editada/excluída
- [ ] Verificar card no Dashboard
- [ ] Verificar navegação via Sidebar e Configurações
- [ ] CI verde (lint, type-check, build, knip, testes, coverage)
EOF
)"
```
