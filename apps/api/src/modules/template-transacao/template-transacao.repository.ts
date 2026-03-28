import { randomUUID } from 'node:crypto';

import { and, eq, inArray } from 'drizzle-orm';

import { db } from '../../db/client.js';
import { categorias, cofrinhos, metodosPagamento, templatesTransacao } from '../../db/schema.js';
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
    this.templates[idx] = { ...this.templates[idx], ativo: false, atualizadoEm: new Date() };
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

/* v8 ignore start -- Drizzle repository requires real DB; tested via integration/E2E */
export class DrizzleTemplateTransacaoRepository implements TemplateTransacaoRepository {
  async listByFamiliaId(input: {
    familiaId: string;
    tipo?: 'receita' | 'despesa';
  }): Promise<TemplateTransacaoWithJoins[]> {
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
      .where(
        and(
          eq(templatesTransacao.familiaId, input.familiaId),
          eq(templatesTransacao.ativo, true),
          input.tipo ? eq(templatesTransacao.tipo, input.tipo) : undefined,
        ),
      )
      .orderBy(templatesTransacao.ordem);

    return rows.map((row) => ({
      ...row,
      tipo: row.tipo as 'receita' | 'despesa',
    }));
  }

  async findById(input: { id: string; familiaId: string }): Promise<TemplateTransacao | null> {
    const [row] = await db
      .select()
      .from(templatesTransacao)
      .where(
        and(eq(templatesTransacao.id, input.id), eq(templatesTransacao.familiaId, input.familiaId)),
      );

    if (!row) return null;
    return { ...row, tipo: row.tipo as 'receita' | 'despesa' };
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

    return rows.map((row) => ({ ...row, tipo: row.tipo as 'receita' | 'despesa' }));
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
    const setFields: Partial<typeof templatesTransacao.$inferInsert> & { atualizadoEm: Date } = {
      atualizadoEm: new Date(),
    };

    if (input.nome !== undefined) setFields.nome = input.nome;
    if (input.categoriaId !== undefined) setFields.categoriaId = input.categoriaId;
    if (input.metodoPagamentoId !== undefined)
      setFields.metodoPagamentoId = input.metodoPagamentoId;
    if (input.cofrinhoId !== undefined) setFields.cofrinhoId = input.cofrinhoId;
    if (input.ordem !== undefined) setFields.ordem = input.ordem;
    if (input.valorPadrao !== undefined) setFields.valorPadrao = input.valorPadrao;

    const [row] = await db
      .update(templatesTransacao)
      .set(setFields)
      .where(
        and(eq(templatesTransacao.id, input.id), eq(templatesTransacao.familiaId, input.familiaId)),
      )
      .returning();

    if (!row) return null;
    return { ...row, tipo: row.tipo as 'receita' | 'despesa' };
  }

  async deactivate(input: { id: string; familiaId: string }): Promise<TemplateTransacao | null> {
    const [row] = await db
      .update(templatesTransacao)
      .set({ ativo: false, atualizadoEm: new Date() })
      .where(
        and(eq(templatesTransacao.id, input.id), eq(templatesTransacao.familiaId, input.familiaId)),
      )
      .returning();

    if (!row) return null;
    return { ...row, tipo: row.tipo as 'receita' | 'despesa' };
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
