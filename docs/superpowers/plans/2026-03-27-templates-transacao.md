# Templates de Transação — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar um sistema de templates de transações com tela "Lançamentos do Mês" onde o usuário preenche valores e cria transações em lote, incluindo aportes em cofrinhos.

**Architecture:** Nova tabela `templates_transacao` + módulo backend completo (CRUD + endpoint `aplicar`) + tela frontend com agrupamento por categoria + seed script. O endpoint `aplicar` cria transações normais ou chama `CofrinhoService.aportar()` para templates vinculados a cofrinhos. Requer extensão do `aportar()` para aceitar `mesReferencia`/`data` opcionais.

**Tech Stack:** Drizzle ORM (schema + migration), Fastify (routes), Zod (validation em `packages/types`), React + Zustand + Tailwind (frontend), Vitest (testes)

**Spec:** `docs/superpowers/specs/2026-03-27-templates-transacao-design.md`

**Worktree:** `.worktrees/templates-transacao` (branch `feature/templates-transacao`)

---

## File Map

### Novos Arquivos

| Arquivo                                                                         | Responsabilidade                          |
| ------------------------------------------------------------------------------- | ----------------------------------------- |
| `packages/types/src/template-transacao.ts`                                      | Zod schemas e tipos compartilhados        |
| `apps/api/src/db/migrations/0007_*.sql`                                         | Migration da tabela `templates_transacao` |
| `apps/api/src/modules/template-transacao/template-transacao.types.ts`           | Interfaces do domínio                     |
| `apps/api/src/modules/template-transacao/template-transacao.schema.ts`          | Schemas Fastify                           |
| `apps/api/src/modules/template-transacao/template-transacao.repository.ts`      | Drizzle + InMemory repos                  |
| `apps/api/src/modules/template-transacao/template-transacao.service.ts`         | Lógica de negócio                         |
| `apps/api/src/modules/template-transacao/template-transacao.routes.ts`          | Endpoints Fastify                         |
| `apps/api/src/modules/template-transacao/template-transacao.service.test.ts`    | Testes do service                         |
| `apps/api/src/modules/template-transacao/template-transacao.repository.test.ts` | Testes do repository                      |
| `apps/api/src/scripts/seed-templates.ts`                                        | Seed dos 51 templates da planilha         |
| `apps/web/src/services/template-transacao.service.ts`                           | Chamadas à API                            |
| `apps/web/src/stores/template-transacao.store.ts`                               | Zustand store                             |
| `apps/web/src/pages/lancamentos-page.tsx`                                       | Página principal                          |
| `apps/web/src/pages/lancamentos-page.test.tsx`                                  | Testes da página                          |
| `apps/web/src/components/template-grupo.tsx`                                    | Grupo de templates por categoria          |
| `apps/web/src/components/template-valor-input.tsx`                              | Input de valor por template               |
| `apps/web/src/components/lancamentos-resumo.tsx`                                | Card de totais                            |

### Arquivos Modificados

| Arquivo                                                             | Mudança                                                 |
| ------------------------------------------------------------------- | ------------------------------------------------------- |
| `apps/api/src/db/schema.ts`                                         | Adicionar tabela `templatesTransacao`                   |
| `apps/api/src/app.ts:17,70`                                         | Registrar `templateTransacaoRoutes`                     |
| `apps/api/src/modules/cofrinho/cofrinho.service.ts:108-117,132-133` | Aceitar `mesReferencia`/`data` opcionais no `aportar()` |
| `apps/api/src/modules/cofrinho/cofrinho.service.test.ts`            | Teste do `aportar()` com `mesReferencia`                |
| `packages/types/src/index.ts`                                       | Re-exportar `template-transacao.ts`                     |
| `apps/web/src/App.tsx:39-57`                                        | Adicionar Screen `'lancamentos'` e rota                 |
| `apps/web/src/components/sidebar.tsx:25-48`                         | Adicionar item "Lançamentos"                            |

---

## Task 1: Shared Types (packages/types)

**Files:**

- Create: `packages/types/src/template-transacao.ts`
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: Criar schemas Zod e tipos**

```typescript
// packages/types/src/template-transacao.ts
import { z } from 'zod';

// --- Entity ---
export const templateTransacaoSchema = z.object({
  id: z.string().uuid(),
  familiaId: z.string().uuid(),
  nome: z.string().min(1),
  tipo: z.enum(['receita', 'despesa']),
  categoriaId: z.string().uuid().nullable(),
  metodoPagamentoId: z.string().uuid().nullable(),
  cofrinhoId: z.string().uuid().nullable(),
  ordem: z.number().int(),
  valorPadrao: z.string().nullable(),
  ativo: z.boolean(),
  criadoPor: z.string().uuid(),
  criadoEm: z.string(),
  atualizadoEm: z.string(),
});
export type TemplateTransacao = z.infer<typeof templateTransacaoSchema>;

// --- List response (com joins) ---
export const templateTransacaoListItemSchema = templateTransacaoSchema.extend({
  categoriaNome: z.string().nullable(),
  metodoPagamentoNome: z.string().nullable(),
  cofrinhoNome: z.string().nullable(),
  cofrinhoEmoji: z.string().nullable(),
});
export type TemplateTransacaoListItem = z.infer<typeof templateTransacaoListItemSchema>;

export const templateTransacaoListResponseSchema = z.object({
  templates: z.array(templateTransacaoListItemSchema),
});
export type TemplateTransacaoListResponse = z.infer<typeof templateTransacaoListResponseSchema>;

// --- Create request ---
export const templateTransacaoCreateRequestSchema = z.object({
  nome: z.string().trim().min(1).max(200),
  tipo: z.enum(['receita', 'despesa']),
  categoriaId: z.string().uuid().nullable().optional(),
  metodoPagamentoId: z.string().uuid().nullable().optional(),
  cofrinhoId: z.string().uuid().nullable().optional(),
  valorPadrao: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .nullable()
    .optional(),
  ordem: z.number().int().min(0).optional().default(0),
});
export type TemplateTransacaoCreateRequest = z.infer<typeof templateTransacaoCreateRequestSchema>;

export const templateTransacaoCreateResponseSchema = z.object({
  template: templateTransacaoSchema,
});
export type TemplateTransacaoCreateResponse = z.infer<typeof templateTransacaoCreateResponseSchema>;

// --- Update request ---
export const templateTransacaoUpdateRequestSchema = z.object({
  nome: z.string().trim().min(1).max(200).optional(),
  categoriaId: z.string().uuid().nullable().optional(),
  metodoPagamentoId: z.string().uuid().nullable().optional(),
  cofrinhoId: z.string().uuid().nullable().optional(),
  valorPadrao: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .nullable()
    .optional(),
  ordem: z.number().int().min(0).optional(),
});
export type TemplateTransacaoUpdateRequest = z.infer<typeof templateTransacaoUpdateRequestSchema>;

export const templateTransacaoUpdateParamsSchema = z.object({
  id: z.string().uuid(),
});

export const templateTransacaoDeleteParamsSchema = z.object({
  id: z.string().uuid(),
});

// --- Aplicar request ---
export const templateTransacaoAplicarItemSchema = z.object({
  templateId: z.string().uuid(),
  valor: z.string().regex(/^\d+(\.\d{1,2})?$/),
});

export const templateTransacaoAplicarRequestSchema = z.object({
  mesReferencia: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  itens: z.array(templateTransacaoAplicarItemSchema).min(1),
});
export type TemplateTransacaoAplicarRequest = z.infer<typeof templateTransacaoAplicarRequestSchema>;

export const templateTransacaoAplicarResponseSchema = z.object({
  transacoesCriadas: z.number().int(),
  aportesCriados: z.number().int(),
  total: z.number().int(),
});
export type TemplateTransacaoAplicarResponse = z.infer<
  typeof templateTransacaoAplicarResponseSchema
>;

// --- Reordenar request ---
export const templateTransacaoReordenarItemSchema = z.object({
  id: z.string().uuid(),
  ordem: z.number().int().min(0),
});

export const templateTransacaoReordenarRequestSchema = z.object({
  itens: z.array(templateTransacaoReordenarItemSchema).min(1),
});
export type TemplateTransacaoReordenarRequest = z.infer<
  typeof templateTransacaoReordenarRequestSchema
>;

// --- List query ---
export const templateTransacaoListQuerySchema = z.object({
  tipo: z.enum(['receita', 'despesa']).optional(),
});
```

- [ ] **Step 2: Exportar no index.ts**

Adicionar ao final de `packages/types/src/index.ts`:

```typescript
export * from './template-transacao.js';
```

- [ ] **Step 3: Build types**

Run: `pnpm --filter @nossagrana/types build`
Expected: Build com sucesso

- [ ] **Step 4: Commit**

```bash
git add packages/types/src/template-transacao.ts packages/types/src/index.ts
git commit -m "feat(types): schemas e tipos para template-transacao"
```

---

## Task 2: Schema Drizzle + Migration

**Files:**

- Modify: `apps/api/src/db/schema.ts`
- Create: migration via `drizzle-kit generate`

- [ ] **Step 1: Adicionar tabela ao schema Drizzle**

Adicionar ao final de `apps/api/src/db/schema.ts`. **Nota:** adicionar `eq` ao import de `drizzle-orm/pg-core` no topo do arquivo se não estiver presente, ou importar de `drizzle-orm`:

```typescript
import { eq } from 'drizzle-orm'; // se necessário para o partial index

export const templatesTransacao = pgTable(
  'templates_transacao',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    familiaId: uuid('familia_id')
      .notNull()
      .references(() => familias.id),
    nome: text('nome').notNull(),
    tipo: transacaoTipo('tipo').notNull(),
    categoriaId: uuid('categoria_id').references(() => categorias.id),
    metodoPagamentoId: uuid('metodo_pagamento_id').references(() => metodosPagamento.id),
    cofrinhoId: uuid('cofrinho_id').references(() => cofrinhos.id),
    ordem: integer('ordem').notNull().default(0),
    valorPadrao: numeric('valor_padrao', { precision: 14, scale: 2 }),
    ativo: boolean('ativo').notNull().default(true),
    criadoPor: uuid('criado_por')
      .notNull()
      .references(() => users.id),
    criadoEm: timestamp('criado_em', { withTimezone: true }).defaultNow().notNull(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_templates_transacao_familia_id').on(table.familiaId),
    // Partial unique: só entre templates ativos (permite recriar após desativar)
    uniqueIndex('uq_templates_transacao_familia_nome_tipo')
      .on(table.familiaId, table.nome, table.tipo)
      .where(eq(table.ativo, true)),
  ],
);
```

- [ ] **Step 2: Gerar migration**

Run: `pnpm --filter api exec drizzle-kit generate`
Expected: Cria arquivo em `apps/api/src/db/migrations/0007_*.sql`

- [ ] **Step 3: Revisar SQL gerado**

Verificar que o SQL contém:

- `CREATE TABLE templates_transacao` com todas as colunas
- FKs para `familias`, `categorias`, `metodos_pagamento`, `cofrinhos`, `users`
- Índice em `familia_id`
- Unique constraint em `(familia_id, nome, tipo)`
- Tipo reutiliza enum `transacao_tipo` (sem criar novo enum)

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/db/schema.ts apps/api/src/db/migrations/
git commit -m "feat(db): tabela templates_transacao com migration"
```

---

## Task 3: Backend Types + InMemory Repository

**Files:**

- Create: `apps/api/src/modules/template-transacao/template-transacao.types.ts`
- Create: `apps/api/src/modules/template-transacao/template-transacao.repository.ts`
- Create: `apps/api/src/modules/template-transacao/template-transacao.repository.test.ts`

- [ ] **Step 1: Criar types**

```typescript
// apps/api/src/modules/template-transacao/template-transacao.types.ts

export interface TemplateTransacao {
  id: string;
  familiaId: string;
  nome: string;
  tipo: 'receita' | 'despesa';
  categoriaId: string | null;
  metodoPagamentoId: string | null;
  cofrinhoId: string | null;
  ordem: number;
  valorPadrao: string | null;
  ativo: boolean;
  criadoPor: string;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface TemplateTransacaoWithJoins extends TemplateTransacao {
  categoriaNome: string | null;
  metodoPagamentoNome: string | null;
  cofrinhoNome: string | null;
  cofrinhoEmoji: string | null;
}

export interface CreateTemplateTransacaoInput {
  familiaId: string;
  nome: string;
  tipo: 'receita' | 'despesa';
  categoriaId?: string | null;
  metodoPagamentoId?: string | null;
  cofrinhoId?: string | null;
  ordem?: number;
  valorPadrao?: string | null;
  criadoPor: string;
}

export interface UpdateTemplateTransacaoInput {
  id: string;
  familiaId: string;
  nome?: string;
  categoriaId?: string | null;
  metodoPagamentoId?: string | null;
  cofrinhoId?: string | null;
  ordem?: number;
  valorPadrao?: string | null;
}

export interface ReordenarItem {
  id: string;
  ordem: number;
}

export interface TemplateTransacaoRepository {
  listByFamiliaId(input: {
    familiaId: string;
    tipo?: 'receita' | 'despesa';
  }): Promise<TemplateTransacaoWithJoins[]>;

  findById(input: { id: string; familiaId: string }): Promise<TemplateTransacao | null>;

  findByIds(input: { ids: string[]; familiaId: string }): Promise<TemplateTransacao[]>;

  create(input: CreateTemplateTransacaoInput): Promise<TemplateTransacao>;

  update(input: UpdateTemplateTransacaoInput): Promise<TemplateTransacao | null>;

  deactivate(input: { id: string; familiaId: string }): Promise<TemplateTransacao | null>;

  reordenar(input: { familiaId: string; itens: ReordenarItem[] }): Promise<void>;
}
```

- [ ] **Step 2: Criar InMemoryTemplateTransacaoRepository**

```typescript
// apps/api/src/modules/template-transacao/template-transacao.repository.ts
import { randomUUID } from 'node:crypto';

import type {
  CreateTemplateTransacaoInput,
  ReordenarItem,
  TemplateTransacao,
  TemplateTransacaoRepository,
  TemplateTransacaoWithJoins,
  UpdateTemplateTransacaoInput,
} from './template-transacao.types.js';

export class InMemoryTemplateTransacaoRepository implements TemplateTransacaoRepository {
  private templates: TemplateTransacao[] = [];

  async listByFamiliaId(input: {
    familiaId: string;
    tipo?: 'receita' | 'despesa';
  }): Promise<TemplateTransacaoWithJoins[]> {
    return this.templates
      .filter(
        (t) => t.familiaId === input.familiaId && t.ativo && (!input.tipo || t.tipo === input.tipo),
      )
      .sort((a, b) => a.ordem - b.ordem)
      .map((t) => ({
        ...t,
        categoriaNome: null,
        metodoPagamentoNome: null,
        cofrinhoNome: null,
        cofrinhoEmoji: null,
      }));
  }

  async findById(input: { id: string; familiaId: string }): Promise<TemplateTransacao | null> {
    return this.templates.find((t) => t.id === input.id && t.familiaId === input.familiaId) ?? null;
  }

  async findByIds(input: { ids: string[]; familiaId: string }): Promise<TemplateTransacao[]> {
    return this.templates.filter(
      (t) => input.ids.includes(t.id) && t.familiaId === input.familiaId && t.ativo,
    );
  }

  async create(input: CreateTemplateTransacaoInput): Promise<TemplateTransacao> {
    const template: TemplateTransacao = {
      id: randomUUID(),
      familiaId: input.familiaId,
      nome: input.nome,
      tipo: input.tipo,
      categoriaId: input.categoriaId ?? null,
      metodoPagamentoId: input.metodoPagamentoId ?? null,
      cofrinhoId: input.cofrinhoId ?? null,
      ordem: input.ordem ?? 0,
      valorPadrao: input.valorPadrao ?? null,
      ativo: true,
      criadoPor: input.criadoPor,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    };

    this.templates.push(template);
    return template;
  }

  async update(input: UpdateTemplateTransacaoInput): Promise<TemplateTransacao | null> {
    const idx = this.templates.findIndex(
      (t) => t.id === input.id && t.familiaId === input.familiaId,
    );
    if (idx === -1) return null;

    const current = this.templates[idx];
    const updated: TemplateTransacao = {
      ...current,
      nome: input.nome ?? current.nome,
      categoriaId: input.categoriaId !== undefined ? input.categoriaId : current.categoriaId,
      metodoPagamentoId:
        input.metodoPagamentoId !== undefined ? input.metodoPagamentoId : current.metodoPagamentoId,
      cofrinhoId: input.cofrinhoId !== undefined ? input.cofrinhoId : current.cofrinhoId,
      ordem: input.ordem ?? current.ordem,
      valorPadrao: input.valorPadrao !== undefined ? input.valorPadrao : current.valorPadrao,
      atualizadoEm: new Date(),
    };
    this.templates[idx] = updated;
    return updated;
  }

  async deactivate(input: { id: string; familiaId: string }): Promise<TemplateTransacao | null> {
    const idx = this.templates.findIndex(
      (t) => t.id === input.id && t.familiaId === input.familiaId,
    );
    if (idx === -1) return null;

    this.templates[idx] = {
      ...this.templates[idx],
      ativo: false,
      atualizadoEm: new Date(),
    };
    return this.templates[idx];
  }

  async reordenar(input: { familiaId: string; itens: ReordenarItem[] }): Promise<void> {
    for (const item of input.itens) {
      const idx = this.templates.findIndex(
        (t) => t.id === item.id && t.familiaId === input.familiaId,
      );
      if (idx !== -1) {
        this.templates[idx] = {
          ...this.templates[idx],
          ordem: item.ordem,
          atualizadoEm: new Date(),
        };
      }
    }
  }
}
```

- [ ] **Step 3: Escrever teste do InMemory repository**

```typescript
// apps/api/src/modules/template-transacao/template-transacao.repository.test.ts
import { describe, it, expect, beforeEach } from 'vitest';

import { InMemoryTemplateTransacaoRepository } from './template-transacao.repository.js';
import type { TemplateTransacaoRepository } from './template-transacao.types.js';

describe('InMemoryTemplateTransacaoRepository', () => {
  let repo: TemplateTransacaoRepository;

  beforeEach(() => {
    repo = new InMemoryTemplateTransacaoRepository();
  });

  it('cria e lista templates por familiaId', async () => {
    await repo.create({
      familiaId: 'f1',
      nome: 'Luz',
      tipo: 'despesa',
      categoriaId: 'cat1',
      criadoPor: 'u1',
    });
    await repo.create({
      familiaId: 'f2',
      nome: 'Salário',
      tipo: 'receita',
      categoriaId: 'cat2',
      criadoPor: 'u2',
    });

    const f1 = await repo.listByFamiliaId({ familiaId: 'f1' });
    expect(f1).toHaveLength(1);
    expect(f1[0].nome).toBe('Luz');
  });

  it('filtra por tipo', async () => {
    await repo.create({
      familiaId: 'f1',
      nome: 'Luz',
      tipo: 'despesa',
      categoriaId: 'c1',
      criadoPor: 'u1',
    });
    await repo.create({
      familiaId: 'f1',
      nome: 'Salário',
      tipo: 'receita',
      categoriaId: 'c2',
      criadoPor: 'u1',
    });

    const receitas = await repo.listByFamiliaId({ familiaId: 'f1', tipo: 'receita' });
    expect(receitas).toHaveLength(1);
    expect(receitas[0].nome).toBe('Salário');
  });

  it('não lista templates inativos', async () => {
    const t = await repo.create({
      familiaId: 'f1',
      nome: 'Luz',
      tipo: 'despesa',
      categoriaId: 'c1',
      criadoPor: 'u1',
    });
    await repo.deactivate({ id: t.id, familiaId: 'f1' });

    const lista = await repo.listByFamiliaId({ familiaId: 'f1' });
    expect(lista).toHaveLength(0);
  });

  it('isolamento multi-tenant: família A não vê templates de família B', async () => {
    await repo.create({
      familiaId: 'fA',
      nome: 'Luz',
      tipo: 'despesa',
      categoriaId: 'c1',
      criadoPor: 'u1',
    });
    await repo.create({
      familiaId: 'fB',
      nome: 'Gás',
      tipo: 'despesa',
      categoriaId: 'c1',
      criadoPor: 'u2',
    });

    const fA = await repo.listByFamiliaId({ familiaId: 'fA' });
    expect(fA).toHaveLength(1);
    expect(fA[0].nome).toBe('Luz');

    const found = await repo.findById({ id: fA[0].id, familiaId: 'fB' });
    expect(found).toBeNull();
  });

  it('update parcial', async () => {
    const t = await repo.create({
      familiaId: 'f1',
      nome: 'Luz',
      tipo: 'despesa',
      categoriaId: 'c1',
      criadoPor: 'u1',
    });
    const updated = await repo.update({ id: t.id, familiaId: 'f1', nome: 'Energia' });

    expect(updated?.nome).toBe('Energia');
    expect(updated?.categoriaId).toBe('c1');
  });

  it('reordena templates', async () => {
    const t1 = await repo.create({
      familiaId: 'f1',
      nome: 'Luz',
      tipo: 'despesa',
      categoriaId: 'c1',
      criadoPor: 'u1',
      ordem: 0,
    });
    const t2 = await repo.create({
      familiaId: 'f1',
      nome: 'Gás',
      tipo: 'despesa',
      categoriaId: 'c1',
      criadoPor: 'u1',
      ordem: 1,
    });

    await repo.reordenar({
      familiaId: 'f1',
      itens: [
        { id: t1.id, ordem: 1 },
        { id: t2.id, ordem: 0 },
      ],
    });

    const lista = await repo.listByFamiliaId({ familiaId: 'f1' });
    expect(lista[0].nome).toBe('Gás');
    expect(lista[1].nome).toBe('Luz');
  });

  it('findByIds retorna apenas templates ativos da família', async () => {
    const t1 = await repo.create({
      familiaId: 'f1',
      nome: 'Luz',
      tipo: 'despesa',
      categoriaId: 'c1',
      criadoPor: 'u1',
    });
    const t2 = await repo.create({
      familiaId: 'f1',
      nome: 'Gás',
      tipo: 'despesa',
      categoriaId: 'c1',
      criadoPor: 'u1',
    });
    await repo.deactivate({ id: t2.id, familiaId: 'f1' });

    const found = await repo.findByIds({ ids: [t1.id, t2.id], familiaId: 'f1' });
    expect(found).toHaveLength(1);
    expect(found[0].id).toBe(t1.id);
  });
});
```

- [ ] **Step 4: Rodar testes**

Run: `pnpm --filter api exec vitest run src/modules/template-transacao/template-transacao.repository.test.ts`
Expected: Todos passando

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/template-transacao/template-transacao.types.ts apps/api/src/modules/template-transacao/template-transacao.repository.ts apps/api/src/modules/template-transacao/template-transacao.repository.test.ts
git commit -m "feat(api): types e InMemory repository para template-transacao"
```

---

## Task 4: Service (CRUD + Aplicar)

**Files:**

- Create: `apps/api/src/modules/template-transacao/template-transacao.service.ts`
- Create: `apps/api/src/modules/template-transacao/template-transacao.service.test.ts`

- [ ] **Step 1: Escrever testes do service (Red)**

```typescript
// apps/api/src/modules/template-transacao/template-transacao.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { InMemoryTemplateTransacaoRepository } from './template-transacao.repository.js';
import {
  TemplateTransacaoService,
  TemplateNotFoundError,
  TemplateTransacaoDuplicateError,
} from './template-transacao.service.js';
import type { TemplateTransacaoRepository } from './template-transacao.types.js';

describe('TemplateTransacaoService', () => {
  let repo: TemplateTransacaoRepository;
  let service: TemplateTransacaoService;
  const mockTransacaoCreator = { criar: vi.fn().mockResolvedValue({ id: 'tx-1' }) };
  const mockCofrinhoService = {
    aportar: vi.fn().mockResolvedValue({
      cofrinho: { id: 'cof-1' },
      movimentacao: { id: 'mov-1' },
    }),
  };

  beforeEach(() => {
    repo = new InMemoryTemplateTransacaoRepository();
    service = new TemplateTransacaoService(repo, mockTransacaoCreator, mockCofrinhoService);
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('cria template com sucesso', async () => {
      const t = await service.create({
        familiaId: 'f1',
        nome: 'Luz',
        tipo: 'despesa',
        categoriaId: 'c1',
        criadoPor: 'u1',
      });
      expect(t.nome).toBe('Luz');
      expect(t.ativo).toBe(true);
    });

    it('rejeita duplicata (mesmo nome + tipo + família)', async () => {
      await service.create({
        familiaId: 'f1',
        nome: 'Luz',
        tipo: 'despesa',
        categoriaId: 'c1',
        criadoPor: 'u1',
      });
      await expect(
        service.create({
          familiaId: 'f1',
          nome: 'Luz',
          tipo: 'despesa',
          categoriaId: 'c2',
          criadoPor: 'u1',
        }),
      ).rejects.toThrow(TemplateTransacaoDuplicateError);
    });
  });

  describe('update', () => {
    it('atualiza template existente', async () => {
      const t = await service.create({
        familiaId: 'f1',
        nome: 'Luz',
        tipo: 'despesa',
        categoriaId: 'c1',
        criadoPor: 'u1',
      });
      const updated = await service.update({ id: t.id, familiaId: 'f1', nome: 'Energia Elétrica' });
      expect(updated.nome).toBe('Energia Elétrica');
    });

    it('lança erro se template não encontrado', async () => {
      await expect(
        service.update({ id: 'inexistente', familiaId: 'f1', nome: 'X' }),
      ).rejects.toThrow(TemplateNotFoundError);
    });
  });

  describe('deactivate', () => {
    it('desativa template', async () => {
      const t = await service.create({
        familiaId: 'f1',
        nome: 'Luz',
        tipo: 'despesa',
        categoriaId: 'c1',
        criadoPor: 'u1',
      });
      const result = await service.deactivate({ id: t.id, familiaId: 'f1' });
      expect(result.ativo).toBe(false);
    });
  });

  describe('aplicar', () => {
    it('cria transações normais para templates sem cofrinho', async () => {
      const t = await service.create({
        familiaId: 'f1',
        nome: 'Luz',
        tipo: 'despesa',
        categoriaId: 'c1',
        criadoPor: 'u1',
      });

      const result = await service.aplicar({
        familiaId: 'f1',
        usuarioId: 'u1',
        mesReferencia: '2026-03',
        itens: [{ templateId: t.id, valor: '285.71' }],
      });

      expect(result.transacoesCriadas).toBe(1);
      expect(result.aportesCriados).toBe(0);
      expect(mockTransacaoCreator.criar).toHaveBeenCalledWith(
        expect.objectContaining({
          familiaId: 'f1',
          tipo: 'despesa',
          valor: '285.71',
          categoriaId: 'c1',
          descricao: 'Luz',
          data: '2026-03-01',
          mesReferencia: '2026-03',
          usuarioRegistrouId: 'u1',
        }),
      );
    });

    it('chama cofrinhoService.aportar para templates com cofrinhoId', async () => {
      const t = await service.create({
        familiaId: 'f1',
        nome: 'Fundo Emergência',
        tipo: 'despesa',
        cofrinhoId: 'cof-1',
        criadoPor: 'u1',
      });

      const result = await service.aplicar({
        familiaId: 'f1',
        usuarioId: 'u1',
        mesReferencia: '2026-03',
        itens: [{ templateId: t.id, valor: '200.00' }],
      });

      expect(result.aportesCriados).toBe(1);
      expect(result.transacoesCriadas).toBe(0);
      expect(mockCofrinhoService.aportar).toHaveBeenCalledWith(
        expect.objectContaining({
          cofrinhoId: 'cof-1',
          familiaId: 'f1',
          valor: '200.00',
          descricao: 'Fundo Emergência',
          registradoPor: 'u1',
          mesReferencia: '2026-03',
          data: '2026-03-01',
        }),
      );
    });

    it('filtra itens com valor zero', async () => {
      const t1 = await service.create({
        familiaId: 'f1',
        nome: 'Luz',
        tipo: 'despesa',
        categoriaId: 'c1',
        criadoPor: 'u1',
      });
      const t2 = await service.create({
        familiaId: 'f1',
        nome: 'Gás',
        tipo: 'despesa',
        categoriaId: 'c1',
        criadoPor: 'u1',
      });

      const result = await service.aplicar({
        familiaId: 'f1',
        usuarioId: 'u1',
        mesReferencia: '2026-03',
        itens: [
          { templateId: t1.id, valor: '285.71' },
          { templateId: t2.id, valor: '0' },
        ],
      });

      expect(result.total).toBe(1);
      expect(mockTransacaoCreator.criar).toHaveBeenCalledTimes(1);
    });

    it('lança erro se template não pertence à família', async () => {
      const t = await service.create({
        familiaId: 'f1',
        nome: 'Luz',
        tipo: 'despesa',
        categoriaId: 'c1',
        criadoPor: 'u1',
      });

      await expect(
        service.aplicar({
          familiaId: 'f2',
          usuarioId: 'u2',
          mesReferencia: '2026-03',
          itens: [{ templateId: t.id, valor: '100' }],
        }),
      ).rejects.toThrow(TemplateNotFoundError);
    });
  });
});
```

- [ ] **Step 2: Rodar testes para confirmar que falham (Red)**

Run: `pnpm --filter api exec vitest run src/modules/template-transacao/template-transacao.service.test.ts`
Expected: FAIL — `TemplateTransacaoService` não existe

- [ ] **Step 3: Implementar o service (Green)**

```typescript
// apps/api/src/modules/template-transacao/template-transacao.service.ts
import type {
  CreateTemplateTransacaoInput,
  TemplateTransacao,
  TemplateTransacaoRepository,
  TemplateTransacaoWithJoins,
  UpdateTemplateTransacaoInput,
  ReordenarItem,
} from './template-transacao.types.js';

export class TemplateNotFoundError extends Error {
  constructor() {
    super('Template não encontrado');
  }
}

export class TemplateTransacaoDuplicateError extends Error {
  constructor() {
    super('Já existe um template com este nome e tipo nesta família');
  }
}

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
    metodoPagamentoId?: string | null;
    cofrinhoId?: string | null;
  }): Promise<{ id: string }>;
}

interface CofrinhoAportarService {
  aportar(input: {
    cofrinhoId: string;
    familiaId: string;
    valor: string;
    descricao?: string | null;
    registradoPor: string;
    mesReferencia?: string;
    data?: string;
  }): Promise<unknown>;
}

export class TemplateTransacaoService {
  constructor(
    private readonly repository: TemplateTransacaoRepository,
    private readonly transacaoCreator: TransacaoCreator,
    private readonly cofrinhoService: CofrinhoAportarService,
  ) {}

  async listByFamiliaId(input: {
    familiaId: string;
    tipo?: 'receita' | 'despesa';
  }): Promise<TemplateTransacaoWithJoins[]> {
    return this.repository.listByFamiliaId(input);
  }

  async create(input: CreateTemplateTransacaoInput): Promise<TemplateTransacao> {
    const existing = await this.repository.listByFamiliaId({
      familiaId: input.familiaId,
    });
    const duplicate = existing.find((t) => t.nome === input.nome && t.tipo === input.tipo);
    if (duplicate) {
      throw new TemplateTransacaoDuplicateError();
    }

    return this.repository.create(input);
  }

  async update(input: UpdateTemplateTransacaoInput): Promise<TemplateTransacao> {
    const updated = await this.repository.update(input);
    if (!updated) {
      throw new TemplateNotFoundError();
    }
    return updated;
  }

  async deactivate(input: { id: string; familiaId: string }): Promise<TemplateTransacao> {
    const result = await this.repository.deactivate(input);
    if (!result) {
      throw new TemplateNotFoundError();
    }
    return result;
  }

  async reordenar(input: { familiaId: string; itens: ReordenarItem[] }): Promise<void> {
    await this.repository.reordenar(input);
  }

  async aplicar(input: {
    familiaId: string;
    usuarioId: string;
    mesReferencia: string;
    itens: Array<{ templateId: string; valor: string }>;
  }): Promise<{ transacoesCriadas: number; aportesCriados: number; total: number }> {
    const itensValidos = input.itens.filter((i) => parseFloat(i.valor) > 0);
    if (itensValidos.length === 0) {
      return { transacoesCriadas: 0, aportesCriados: 0, total: 0 };
    }

    const templateIds = itensValidos.map((i) => i.templateId);
    const templates = await this.repository.findByIds({
      ids: templateIds,
      familiaId: input.familiaId,
    });

    if (templates.length !== templateIds.length) {
      throw new TemplateNotFoundError();
    }

    const templateMap = new Map(templates.map((t) => [t.id, t]));
    const data = `${input.mesReferencia}-01`;

    let transacoesCriadas = 0;
    let aportesCriados = 0;

    // IMPORTANTE: Em produção (DrizzleRepository), o `aplicar` no routes.ts
    // deve envolver toda a operação em `db.transaction()` para atomicidade.
    // No service com InMemory (testes), o loop simples é suficiente.
    for (const item of itensValidos) {
      const template = templateMap.get(item.templateId)!;

      if (template.cofrinhoId) {
        await this.cofrinhoService.aportar({
          cofrinhoId: template.cofrinhoId,
          familiaId: input.familiaId,
          valor: item.valor,
          descricao: template.nome,
          registradoPor: input.usuarioId,
          mesReferencia: input.mesReferencia,
          data,
        });
        aportesCriados++;
      } else {
        await this.transacaoCreator.criar({
          familiaId: input.familiaId,
          tipo: template.tipo,
          valor: item.valor,
          categoriaId: template.categoriaId!,
          descricao: template.nome,
          data,
          mesReferencia: input.mesReferencia,
          usuarioRegistrouId: input.usuarioId,
          metodoPagamentoId: template.metodoPagamentoId,
        });
        transacoesCriadas++;
      }
    }

    return { transacoesCriadas, aportesCriados, total: transacoesCriadas + aportesCriados };
  }
}
```

- [ ] **Step 4: Rodar testes (Green)**

Run: `pnpm --filter api exec vitest run src/modules/template-transacao/template-transacao.service.test.ts`
Expected: Todos passando

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/template-transacao/template-transacao.service.ts apps/api/src/modules/template-transacao/template-transacao.service.test.ts
git commit -m "feat(api): service template-transacao com CRUD e aplicar"
```

---

## Task 5: Drizzle Repository

**Files:**

- Modify: `apps/api/src/modules/template-transacao/template-transacao.repository.ts`

- [ ] **Step 1: Adicionar DrizzleTemplateTransacaoRepository**

Adicionar abaixo do `InMemoryTemplateTransacaoRepository` no mesmo arquivo:

```typescript
import { and, eq, inArray } from 'drizzle-orm';

import { db } from '../../db/client.js';
import { categorias, cofrinhos, metodosPagamento, templatesTransacao } from '../../db/schema.js';

// ... (InMemory acima)

export class DrizzleTemplateTransacaoRepository implements TemplateTransacaoRepository {
  async listByFamiliaId(input: {
    familiaId: string;
    tipo?: 'receita' | 'despesa';
  }): Promise<TemplateTransacaoWithJoins[]> {
    const conditions = [
      eq(templatesTransacao.familiaId, input.familiaId),
      eq(templatesTransacao.ativo, true),
    ];
    if (input.tipo) {
      conditions.push(eq(templatesTransacao.tipo, input.tipo));
    }

    const rows = await db
      .select({
        id: templatesTransacao.id,
        familiaId: templatesTransacao.familiaId,
        nome: templatesTransacao.nome,
        tipo: templatesTransacao.tipo,
        categoriaId: templatesTransacao.categoriaId,
        metodoPagamentoId: templatesTransacao.metodoPagamentoId,
        cofrinhoId: templatesTransacao.cofrinhoId,
        ordem: templatesTransacao.ordem,
        valorPadrao: templatesTransacao.valorPadrao,
        ativo: templatesTransacao.ativo,
        criadoPor: templatesTransacao.criadoPor,
        criadoEm: templatesTransacao.criadoEm,
        atualizadoEm: templatesTransacao.atualizadoEm,
        categoriaNome: categorias.nome,
        metodoPagamentoNome: metodosPagamento.nome,
        cofrinhoNome: cofrinhos.nome,
        cofrinhoEmoji: cofrinhos.emoji,
      })
      .from(templatesTransacao)
      .leftJoin(categorias, eq(templatesTransacao.categoriaId, categorias.id))
      .leftJoin(metodosPagamento, eq(templatesTransacao.metodoPagamentoId, metodosPagamento.id))
      .leftJoin(cofrinhos, eq(templatesTransacao.cofrinhoId, cofrinhos.id))
      .where(and(...conditions))
      .orderBy(templatesTransacao.ordem);

    return rows.map((r) => ({
      ...r,
      tipo: r.tipo as 'receita' | 'despesa',
      categoriaNome: r.categoriaNome ?? null,
      metodoPagamentoNome: r.metodoPagamentoNome ?? null,
      cofrinhoNome: r.cofrinhoNome ?? null,
      cofrinhoEmoji: r.cofrinhoEmoji ?? null,
    }));
  }

  async findById(input: { id: string; familiaId: string }): Promise<TemplateTransacao | null> {
    const [row] = await db
      .select()
      .from(templatesTransacao)
      .where(
        and(eq(templatesTransacao.id, input.id), eq(templatesTransacao.familiaId, input.familiaId)),
      );
    return row ? { ...row, tipo: row.tipo as 'receita' | 'despesa' } : null;
  }

  async findByIds(input: { ids: string[]; familiaId: string }): Promise<TemplateTransacao[]> {
    const rows = await db
      .select()
      .from(templatesTransacao)
      .where(
        and(
          inArray(templatesTransacao.id, input.ids),
          eq(templatesTransacao.familiaId, input.familiaId),
          eq(templatesTransacao.ativo, true),
        ),
      );
    return rows.map((r) => ({ ...r, tipo: r.tipo as 'receita' | 'despesa' }));
  }

  async create(input: CreateTemplateTransacaoInput): Promise<TemplateTransacao> {
    const [row] = await db
      .insert(templatesTransacao)
      .values({
        familiaId: input.familiaId,
        nome: input.nome,
        tipo: input.tipo,
        categoriaId: input.categoriaId ?? null,
        metodoPagamentoId: input.metodoPagamentoId ?? null,
        cofrinhoId: input.cofrinhoId ?? null,
        ordem: input.ordem ?? 0,
        valorPadrao: input.valorPadrao ?? null,
        criadoPor: input.criadoPor,
      })
      .returning();
    return { ...row, tipo: row.tipo as 'receita' | 'despesa' };
  }

  async update(input: UpdateTemplateTransacaoInput): Promise<TemplateTransacao | null> {
    const values: Record<string, unknown> = { atualizadoEm: new Date() };
    if (input.nome !== undefined) values.nome = input.nome;
    if (input.categoriaId !== undefined) values.categoriaId = input.categoriaId;
    if (input.metodoPagamentoId !== undefined) values.metodoPagamentoId = input.metodoPagamentoId;
    if (input.cofrinhoId !== undefined) values.cofrinhoId = input.cofrinhoId;
    if (input.ordem !== undefined) values.ordem = input.ordem;
    if (input.valorPadrao !== undefined) values.valorPadrao = input.valorPadrao;

    const [row] = await db
      .update(templatesTransacao)
      .set(values)
      .where(
        and(eq(templatesTransacao.id, input.id), eq(templatesTransacao.familiaId, input.familiaId)),
      )
      .returning();
    return row ? { ...row, tipo: row.tipo as 'receita' | 'despesa' } : null;
  }

  async deactivate(input: { id: string; familiaId: string }): Promise<TemplateTransacao | null> {
    const [row] = await db
      .update(templatesTransacao)
      .set({ ativo: false, atualizadoEm: new Date() })
      .where(
        and(eq(templatesTransacao.id, input.id), eq(templatesTransacao.familiaId, input.familiaId)),
      )
      .returning();
    return row ? { ...row, tipo: row.tipo as 'receita' | 'despesa' } : null;
  }

  async reordenar(input: { familiaId: string; itens: ReordenarItem[] }): Promise<void> {
    for (const item of input.itens) {
      await db
        .update(templatesTransacao)
        .set({ ordem: item.ordem, atualizadoEm: new Date() })
        .where(
          and(
            eq(templatesTransacao.id, item.id),
            eq(templatesTransacao.familiaId, input.familiaId),
          ),
        );
    }
  }
}
```

- [ ] **Step 2: Verificar que testes existentes ainda passam**

Run: `pnpm --filter api exec vitest run src/modules/template-transacao/`
Expected: Todos passando

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/template-transacao/template-transacao.repository.ts
git commit -m "feat(api): Drizzle repository para template-transacao"
```

---

## Task 6: Fastify Schema + Routes + Registro

**Files:**

- Create: `apps/api/src/modules/template-transacao/template-transacao.schema.ts`
- Create: `apps/api/src/modules/template-transacao/template-transacao.routes.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Criar schemas Fastify**

```typescript
// apps/api/src/modules/template-transacao/template-transacao.schema.ts
import {
  templateTransacaoAplicarRequestSchema,
  templateTransacaoAplicarResponseSchema,
  templateTransacaoCreateRequestSchema,
  templateTransacaoCreateResponseSchema,
  templateTransacaoListResponseSchema,
  templateTransacaoReordenarRequestSchema,
  templateTransacaoSchema,
  templateTransacaoUpdateRequestSchema,
} from '@nossagrana/types';

export const templateTransacaoListSchema = {
  response: { 200: templateTransacaoListResponseSchema },
};

export const templateTransacaoCreateSchema = {
  body: templateTransacaoCreateRequestSchema,
  response: { 201: templateTransacaoCreateResponseSchema },
};

export const templateTransacaoUpdateSchema = {
  body: templateTransacaoUpdateRequestSchema,
  response: { 200: templateTransacaoCreateResponseSchema },
};

export const templateTransacaoDeleteSchema = {
  response: { 200: templateTransacaoCreateResponseSchema },
};

export const templateTransacaoAplicarSchema = {
  body: templateTransacaoAplicarRequestSchema,
  response: { 200: templateTransacaoAplicarResponseSchema },
};

export const templateTransacaoReordenarSchema = {
  body: templateTransacaoReordenarRequestSchema,
};
```

- [ ] **Step 2: Criar routes**

```typescript
// apps/api/src/modules/template-transacao/template-transacao.routes.ts
import {
  templateTransacaoAplicarRequestSchema,
  templateTransacaoCreateRequestSchema,
  templateTransacaoDeleteParamsSchema,
  templateTransacaoListQuerySchema,
  templateTransacaoReordenarRequestSchema,
  templateTransacaoUpdateParamsSchema,
  templateTransacaoUpdateRequestSchema,
} from '@nossagrana/types';
import type { FastifyPluginAsync } from 'fastify';

import { env } from '../../config/env.js';
import {
  DrizzleTemplateTransacaoRepository,
  InMemoryTemplateTransacaoRepository,
} from './template-transacao.repository.js';
import {
  templateTransacaoAplicarSchema,
  templateTransacaoCreateSchema,
  templateTransacaoDeleteSchema,
  templateTransacaoListSchema,
  templateTransacaoReordenarSchema,
  templateTransacaoUpdateSchema,
} from './template-transacao.schema.js';
import {
  TemplateNotFoundError,
  TemplateTransacaoDuplicateError,
  TemplateTransacaoService,
} from './template-transacao.service.js';

// TODO: Wire up real TransacaoCreator and CofrinhoService dependencies
// For now, these are placeholders that will be connected in Task 7

const defaultService = (): TemplateTransacaoService => {
  const repo =
    env.NODE_ENV === 'test'
      ? new InMemoryTemplateTransacaoRepository()
      : new DrizzleTemplateTransacaoRepository();

  // Placeholder creators — Task 7 will wire these to real services
  const transacaoCreator = { criar: async () => ({ id: '' }) };
  const cofrinhoService = {
    aportar: async () => ({ cofrinho: {}, movimentacao: {} }),
  };

  return new TemplateTransacaoService(repo, transacaoCreator as never, cofrinhoService as never);
};

export const templateTransacaoRoutes: FastifyPluginAsync = async (fastify) => {
  const service = defaultService();

  // GET /templates-transacao
  fastify.get(
    '/templates-transacao',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: templateTransacaoListSchema,
    },
    async (request, reply) => {
      const query = templateTransacaoListQuerySchema.parse(request.query);
      const templates = await service.listByFamiliaId({
        familiaId: request.familiaIdAtiva as string,
        tipo: query.tipo,
      });

      return reply.code(200).send({
        templates: templates.map((t) => ({
          ...t,
          criadoEm: t.criadoEm.toISOString(),
          atualizadoEm: t.atualizadoEm.toISOString(),
        })),
      });
    },
  );

  // POST /templates-transacao
  fastify.post(
    '/templates-transacao',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: templateTransacaoCreateSchema,
    },
    async (request, reply) => {
      try {
        const payload = templateTransacaoCreateRequestSchema.parse(request.body);
        const template = await service.create({
          familiaId: request.familiaIdAtiva as string,
          nome: payload.nome,
          tipo: payload.tipo,
          categoriaId: payload.categoriaId ?? null,
          metodoPagamentoId: payload.metodoPagamentoId ?? null,
          cofrinhoId: payload.cofrinhoId ?? null,
          valorPadrao: payload.valorPadrao ?? null,
          ordem: payload.ordem,
          criadoPor: request.user.sub,
        });

        return reply.code(201).send({
          template: {
            ...template,
            criadoEm: template.criadoEm.toISOString(),
            atualizadoEm: template.atualizadoEm.toISOString(),
          },
        });
      } catch (error) {
        if (error instanceof TemplateTransacaoDuplicateError) {
          return reply.code(409).send({ message: error.message });
        }
        throw error;
      }
    },
  );

  // PATCH /templates-transacao/:id
  fastify.patch(
    '/templates-transacao/:id',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: templateTransacaoUpdateSchema,
    },
    async (request, reply) => {
      try {
        const params = templateTransacaoUpdateParamsSchema.parse(request.params);
        const payload = templateTransacaoUpdateRequestSchema.parse(request.body);
        const template = await service.update({
          id: params.id,
          familiaId: request.familiaIdAtiva as string,
          ...payload,
        });

        return reply.code(200).send({
          template: {
            ...template,
            criadoEm: template.criadoEm.toISOString(),
            atualizadoEm: template.atualizadoEm.toISOString(),
          },
        });
      } catch (error) {
        if (error instanceof TemplateNotFoundError) {
          return reply.code(404).send({ message: error.message });
        }
        throw error;
      }
    },
  );

  // DELETE /templates-transacao/:id
  fastify.delete(
    '/templates-transacao/:id',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: templateTransacaoDeleteSchema,
    },
    async (request, reply) => {
      try {
        const params = templateTransacaoDeleteParamsSchema.parse(request.params);
        const template = await service.deactivate({
          id: params.id,
          familiaId: request.familiaIdAtiva as string,
        });

        return reply.code(200).send({
          template: {
            ...template,
            criadoEm: template.criadoEm.toISOString(),
            atualizadoEm: template.atualizadoEm.toISOString(),
          },
        });
      } catch (error) {
        if (error instanceof TemplateNotFoundError) {
          return reply.code(404).send({ message: error.message });
        }
        throw error;
      }
    },
  );

  // POST /templates-transacao/aplicar
  // IMPORTANTE: Envolver em db.transaction() para atomicidade
  fastify.post(
    '/templates-transacao/aplicar',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: templateTransacaoAplicarSchema,
    },
    async (request, reply) => {
      try {
        const payload = templateTransacaoAplicarRequestSchema.parse(request.body);
        // TODO: Em produção, envolver service.aplicar() em db.transaction()
        // para garantir atomicidade (rollback se qualquer item falhar).
        // Exemplo: const result = await db.transaction(async (tx) => { ... })
        const result = await service.aplicar({
          familiaId: request.familiaIdAtiva as string,
          usuarioId: request.user.sub,
          mesReferencia: payload.mesReferencia,
          itens: payload.itens,
        });

        return reply.code(200).send(result);
      } catch (error) {
        if (error instanceof TemplateNotFoundError) {
          return reply.code(404).send({ message: error.message });
        }
        throw error;
      }
    },
  );

  // PATCH /templates-transacao/reordenar
  fastify.patch(
    '/templates-transacao/reordenar',
    {
      preHandler: [fastify.authenticate, fastify.requireFamiliaScope],
      schema: templateTransacaoReordenarSchema,
    },
    async (request, reply) => {
      const payload = templateTransacaoReordenarRequestSchema.parse(request.body);
      await service.reordenar({
        familiaId: request.familiaIdAtiva as string,
        itens: payload.itens,
      });

      return reply.code(204).send();
    },
  );
};
```

- [ ] **Step 3: Registrar routes em app.ts**

Adicionar import em `apps/api/src/app.ts` após a linha 17:

```typescript
import { templateTransacaoRoutes } from './modules/template-transacao/template-transacao.routes.js';
```

Adicionar registro após a linha 70 (após `app.register(relatorioRoutes, ...)`):

```typescript
app.register(templateTransacaoRoutes, { prefix: '/api' });
```

- [ ] **Step 4: Verificar build compila**

Run: `pnpm --filter @nossagrana/types build && pnpm --filter api exec tsc --noEmit`
Expected: Sem erros de tipo

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/template-transacao/template-transacao.schema.ts apps/api/src/modules/template-transacao/template-transacao.routes.ts apps/api/src/app.ts
git commit -m "feat(api): routes e schemas Fastify para template-transacao"
```

---

## Task 7: Estender CofrinhoService.aportar() para aceitar mesReferencia/data

**Files:**

- Modify: `apps/api/src/modules/cofrinho/cofrinho.service.ts:108-117,132-133`
- Modify: `apps/api/src/modules/cofrinho/cofrinho.service.test.ts`

- [ ] **Step 1: Escrever teste para aportar com mesReferencia (Red)**

Adicionar ao arquivo de testes do cofrinho service:

```typescript
it('aportar com mesReferencia e data opcionais', async () => {
  // criar cofrinho e fazer aporte com mesReferencia explícito
  const cofrinho = await service.criar({ familiaId: 'f1', nome: 'Teste', criadoPor: 'u1' });

  const result = await service.aportar({
    cofrinhoId: cofrinho.id,
    familiaId: 'f1',
    valor: '100.00',
    registradoPor: 'u1',
    mesReferencia: '2026-01',
    data: '2026-01-01',
  });

  expect(result.movimentacao.mesReferencia).toBe('2026-01');
  // Verificar que transacaoCreator.criar foi chamado com data e mesReferencia corretos
});
```

- [ ] **Step 2: Modificar assinatura de aportar()**

Em `apps/api/src/modules/cofrinho/cofrinho.service.ts`, linhas 108-117, adicionar campos opcionais:

```typescript
  async aportar(input: {
    cofrinhoId: string;
    familiaId: string;
    valor: string;
    descricao?: string | null;
    registradoPor: string;
    recorrente?: boolean;
    frequencia?: 'mensal' | 'semanal' | 'quinzenal' | null;
    dataFimRecorrencia?: string | null;
    mesReferencia?: string;  // ← NOVO
    data?: string;           // ← NOVO
  }): Promise<{ cofrinho: Cofrinho; movimentacao: MovimentacaoCofrinho }> {
```

Nas linhas 132-133, usar os valores do input se fornecidos:

```typescript
const mesReferencia = input.mesReferencia ?? getMesReferencia();
const data = input.data ?? getDataHoje();
```

- [ ] **Step 3: Rodar testes (Green)**

Run: `pnpm --filter api exec vitest run src/modules/cofrinho/`
Expected: Todos passando (incluindo o novo)

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/cofrinho/cofrinho.service.ts apps/api/src/modules/cofrinho/cofrinho.service.test.ts
git commit -m "feat(api): CofrinhoService.aportar aceita mesReferencia/data opcionais"
```

---

## Task 8: Wire Up Real Dependencies nas Routes

**Files:**

- Modify: `apps/api/src/modules/template-transacao/template-transacao.routes.ts`

- [ ] **Step 1: Conectar TransacaoCreator e CofrinhoService reais**

Substituir o `defaultService()` placeholder nas routes por wiring real. Verificar como os outros módulos (cofrinho.routes.ts) instanciam dependências e seguir o mesmo padrão.

A `defaultService()` deve:

1. Instanciar `DrizzleTemplateTransacaoRepository` (ou InMemory em testes)
2. Criar um adapter `TransacaoCreator` que chama `TransacaoService.registrar()` (adaptando a interface)
3. Instanciar `CofrinhoService` com suas dependências reais

Referência: ver como `cofrinho.routes.ts` instancia `CofrinhoService` com `TransacaoCreator`.

- [ ] **Step 2: Verificar type-check**

Run: `pnpm --filter api exec tsc --noEmit`
Expected: Sem erros

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/template-transacao/template-transacao.routes.ts
git commit -m "feat(api): wire up dependências reais no template-transacao routes"
```

---

## Task 9: Frontend Service + Store

**Files:**

- Create: `apps/web/src/services/template-transacao.service.ts`
- Create: `apps/web/src/stores/template-transacao.store.ts`

- [ ] **Step 1: Criar service**

```typescript
// apps/web/src/services/template-transacao.service.ts
import type {
  TemplateTransacaoAplicarRequest,
  TemplateTransacaoAplicarResponse,
  TemplateTransacaoCreateRequest,
  TemplateTransacaoCreateResponse,
  TemplateTransacaoListResponse,
  TemplateTransacaoReordenarRequest,
  TemplateTransacaoUpdateRequest,
} from '@nossagrana/types';

import { lazyApiClient } from './core-financeiro.service.js';
import type { ApiClient } from './api-client.js';

export class TemplateTransacaoService {
  constructor(private readonly api: ApiClient) {}

  async listar(
    familiaId: string,
    tipo?: 'receita' | 'despesa',
  ): Promise<TemplateTransacaoListResponse> {
    const query = tipo ? `?tipo=${tipo}` : '';
    return this.api.request<TemplateTransacaoListResponse>(`/api/templates-transacao${query}`, {
      headers: { 'X-Familia-Id': familiaId },
    });
  }

  async criar(
    familiaId: string,
    payload: TemplateTransacaoCreateRequest,
  ): Promise<TemplateTransacaoCreateResponse> {
    return this.api.request<TemplateTransacaoCreateResponse>('/api/templates-transacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Familia-Id': familiaId },
      body: JSON.stringify(payload),
    });
  }

  async editar(
    familiaId: string,
    id: string,
    payload: TemplateTransacaoUpdateRequest,
  ): Promise<TemplateTransacaoCreateResponse> {
    return this.api.request<TemplateTransacaoCreateResponse>(`/api/templates-transacao/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Familia-Id': familiaId },
      body: JSON.stringify(payload),
    });
  }

  async excluir(familiaId: string, id: string): Promise<void> {
    await this.api.request(`/api/templates-transacao/${id}`, {
      method: 'DELETE',
      headers: { 'X-Familia-Id': familiaId },
    });
  }

  async aplicar(
    familiaId: string,
    payload: TemplateTransacaoAplicarRequest,
  ): Promise<TemplateTransacaoAplicarResponse> {
    return this.api.request<TemplateTransacaoAplicarResponse>('/api/templates-transacao/aplicar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Familia-Id': familiaId },
      body: JSON.stringify(payload),
    });
  }

  async reordenar(familiaId: string, payload: TemplateTransacaoReordenarRequest): Promise<void> {
    await this.api.request('/api/templates-transacao/reordenar', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Familia-Id': familiaId },
      body: JSON.stringify(payload),
    });
  }
}

export const templateTransacaoService = new TemplateTransacaoService(lazyApiClient);
```

- [ ] **Step 2: Criar store**

```typescript
// apps/web/src/stores/template-transacao.store.ts
import type {
  TemplateTransacaoAplicarResponse,
  TemplateTransacaoListItem,
} from '@nossagrana/types';
import { create } from 'zustand';

import { templateTransacaoService } from '@/services/template-transacao.service';

interface TemplateTransacaoStore {
  templates: TemplateTransacaoListItem[];
  valores: Record<string, string>;
  mesReferencia: string;
  carregando: boolean;
  salvando: boolean;
  erro: string | null;

  fetchTemplates: (familiaId: string) => Promise<void>;
  setValor: (templateId: string, valor: string) => void;
  setMesReferencia: (mes: string) => void;
  limparValores: () => void;
  aplicar: (familiaId: string) => Promise<TemplateTransacaoAplicarResponse>;
}

const getMesAtual = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const useTemplateTransacaoStore = create<TemplateTransacaoStore>((set, get) => ({
  templates: [],
  valores: {},
  mesReferencia: getMesAtual(),
  carregando: false,
  salvando: false,
  erro: null,

  async fetchTemplates(familiaId: string) {
    set({ carregando: true, erro: null });
    try {
      const data = await templateTransacaoService.listar(familiaId);
      const valores: Record<string, string> = {};
      for (const t of data.templates) {
        if (t.valorPadrao) {
          valores[t.id] = t.valorPadrao;
        }
      }
      set({ templates: data.templates, valores, carregando: false });
    } catch {
      set({ erro: 'Erro ao carregar templates', carregando: false });
    }
  },

  setValor(templateId: string, valor: string) {
    set((state) => ({
      valores: { ...state.valores, [templateId]: valor },
    }));
  },

  setMesReferencia(mes: string) {
    set({ mesReferencia: mes });
  },

  limparValores() {
    const { templates } = get();
    const valores: Record<string, string> = {};
    for (const t of templates) {
      if (t.valorPadrao) {
        valores[t.id] = t.valorPadrao;
      }
    }
    set({ valores });
  },

  async aplicar(familiaId: string) {
    const { mesReferencia, valores } = get();
    const itens = Object.entries(valores)
      .filter(([, valor]) => parseFloat(valor) > 0)
      .map(([templateId, valor]) => ({ templateId, valor }));

    if (itens.length === 0) {
      throw new Error('Preencha ao menos um valor');
    }

    set({ salvando: true, erro: null });
    try {
      const result = await templateTransacaoService.aplicar(familiaId, {
        mesReferencia,
        itens,
      });
      set({ salvando: false });
      return result;
    } catch {
      set({ erro: 'Erro ao salvar lançamentos', salvando: false });
      throw new Error('Erro ao salvar lançamentos');
    }
  },
}));
```

- [ ] **Step 3: Verificar type-check**

Run: `pnpm --filter @nossagrana/types build && pnpm --filter web exec tsc --noEmit`
Expected: Sem erros

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/services/template-transacao.service.ts apps/web/src/stores/template-transacao.store.ts
git commit -m "feat(web): service e Zustand store para template-transacao"
```

---

## Task 10: Frontend — Componentes auxiliares

**Files:**

- Create: `apps/web/src/components/template-valor-input.tsx`
- Create: `apps/web/src/components/template-grupo.tsx`
- Create: `apps/web/src/components/lancamentos-resumo.tsx`

- [ ] **Step 1: Criar TemplateValorInput**

Componente de linha: nome do template à esquerda, input de valor à direita. Se tem cofrinho, mostra emoji. Se tem `valorPadrao`, pré-preenche.

Props: `{ nome: string, valor: string, onChange: (valor: string) => void, cofrinhoEmoji?: string | null }`

Usar tokens semânticos: `bg-surface`, `text-text`, `text-text-muted`, `border-border`.

- [ ] **Step 2: Criar TemplateGrupo**

Componente que renderiza um header de categoria + lista de `TemplateValorInput`.

Props: `{ titulo: string, templates: TemplateTransacaoListItem[], valores: Record<string, string>, onSetValor: (id: string, valor: string) => void }`

- [ ] **Step 3: Criar LancamentosResumo**

Card com totais: receitas, despesas, saldo. Calcula em tempo real a partir dos valores preenchidos.

Props: `{ templates: TemplateTransacaoListItem[], valores: Record<string, string> }`

Usar cores semânticas: `text-success` para receitas, `text-danger` para despesas.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/template-valor-input.tsx apps/web/src/components/template-grupo.tsx apps/web/src/components/lancamentos-resumo.tsx
git commit -m "feat(web): componentes auxiliares para tela de lançamentos"
```

---

## Task 11: Frontend — Página Lançamentos + Navegação

**Files:**

- Create: `apps/web/src/pages/lancamentos-page.tsx`
- Create: `apps/web/src/pages/lancamentos-page.test.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/sidebar.tsx`

- [ ] **Step 1: Escrever testes da página (Red)**

Testar:

- Exibe loading enquanto carrega templates
- Exibe lista de templates agrupados por tipo/categoria
- Permite preencher valores
- Totais atualizam em tempo real
- Botão salvar chama `aplicar`
- Exibe feedback de sucesso após salvar

Usar padrão: mock do service + setState no store.

- [ ] **Step 2: Implementar LancamentosPage (Green)**

Componente com:

- Seletor de mês (◀ ▶)
- Templates agrupados: Receitas → Despesas por categoria → Cofrinhos
- Card de resumo com totais
- Botão "Salvar Lançamentos"
- Toast de sucesso

Props: `{ familiaId: string, onNavigate: (screen: string) => void }`

Layout responsivo com tokens semânticos.

- [ ] **Step 3: Adicionar Screen e rota em App.tsx**

Em `apps/web/src/App.tsx`:

- Adicionar `'lancamentos'` ao tipo `Screen` (após `'cofrinho-detalhe'`)
- Importar `LancamentosPage`
- Adicionar case no renderScreen

- [ ] **Step 4: Adicionar item no Sidebar**

Em `apps/web/src/components/sidebar.tsx`:

- Importar ícone `ClipboardList` de `lucide-react`
- Adicionar `{ id: 'lancamentos', icon: ClipboardList, label: 'Lançamentos' }` no primeiro grupo de navegação (após `'historico'`)

- [ ] **Step 5: Rodar testes**

Run: `pnpm --filter web exec vitest run src/pages/lancamentos-page.test.tsx`
Expected: Todos passando

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/lancamentos-page.tsx apps/web/src/pages/lancamentos-page.test.tsx apps/web/src/App.tsx apps/web/src/components/sidebar.tsx
git commit -m "feat(web): página Lançamentos do Mês com navegação"
```

---

## Task 12: Frontend — Modal de Gerenciamento de Templates

**Files:**

- Create: `apps/web/src/components/templates-gerenciar-modal.tsx`
- Create: `apps/web/src/components/templates-gerenciar-modal.test.tsx`

- [ ] **Step 1: Escrever testes (Red)**

Testar:

- Exibe lista de templates existentes
- Permite criar novo template (nome, tipo, categoria)
- Permite editar nome/categoria de template existente
- Permite desativar template
- Chama service correto em cada ação

- [ ] **Step 2: Implementar modal (Green)**

Modal/dialog com:

- Lista de templates agrupados por tipo (receita/despesa)
- Botão "Adicionar Template" que abre form inline
- Form: nome (text), tipo (select), categoria (select), valorPadrao (opcional), cofrinhoId (opcional)
- Cada template na lista tem ações: editar (ícone lápis), desativar (ícone X)
- Busca categorias via `useCategoriaStore` e cofrinhos via `useCofrinhoStore`

Props: `{ open: boolean, onClose: () => void, familiaId: string }`

Integrar com o botão "Gerenciar Templates" (engrenagem) na `lancamentos-page.tsx`.

- [ ] **Step 3: Rodar testes**

Run: `pnpm --filter web exec vitest run src/components/templates-gerenciar-modal.test.tsx`
Expected: Todos passando

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/templates-gerenciar-modal.tsx apps/web/src/components/templates-gerenciar-modal.test.tsx apps/web/src/pages/lancamentos-page.tsx
git commit -m "feat(web): modal de gerenciamento de templates"
```

---

## Task 13: Seed Script dos Templates da Planilha

**Files:**

- Create: `apps/api/src/scripts/seed-templates.ts`

- [ ] **Step 1: Criar script**

Script que:

1. Recebe `familiaId` como argumento ou variável de ambiente
2. Conecta ao banco via Drizzle
3. Busca categorias da família
4. Cria cofrinhos para os itens de investimento (se não existirem)
5. Insere os 51 templates com mapeamento de categorias e cofrinhos conforme a spec (`docs/superpowers/specs/2026-03-27-templates-transacao-design.md`, seção "Seed dos Templates")
6. Log de resumo

Seguir o padrão do `seed-from-xlsx.ts` existente.

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/scripts/seed-templates.ts
git commit -m "feat(api): seed script dos 51 templates da planilha 2025"
```

---

## Task 14: CI Simulation + Final Cleanup

- [ ] **Step 1: Build types**

Run: `pnpm --filter @nossagrana/types build`

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Fix any issues.

- [ ] **Step 3: Type check**

Run: `pnpm type-check`
Fix any issues.

- [ ] **Step 4: Build**

Run: `pnpm build`

- [ ] **Step 5: Knip (dead code)**

Run: `pnpm knip`
Fix any issues.

- [ ] **Step 6: Tests + Coverage**

Run: `pnpm test:coverage`
Ensure ≥80% coverage on new files.

- [ ] **Step 7: Commit final (se houve fixes)**

```bash
git add -A
git commit -m "fix: CI fixes para template-transacao"
```
