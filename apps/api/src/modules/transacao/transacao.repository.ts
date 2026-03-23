import { randomUUID } from 'node:crypto';

import { and, eq, gte, sql } from 'drizzle-orm';

import { db } from '../../db/client.js';
import { transacoes } from '../../db/schema.js';
import type {
  CreateTransacaoInput,
  Transacao,
  TransacaoFiltros,
  TransacaoRepository,
  UpdateTransacaoInput,
} from './transacao.types.js';

const mapRow = (row: {
  id: string;
  familiaId: string;
  tipo: string;
  valor: string;
  categoriaId: string;
  descricao: string | null;
  data: string;
  mesReferencia: string;
  metodoPagamentoId: string | null;
  usuarioRegistrouId: string;
  recorrente: boolean;
  frequencia: string | null;
  dataFimRecorrencia: string | null;
  parcelado: boolean;
  numeroParcelas: number | null;
  parcelaAtual: number | null;
  valorTotal: string | null;
  valorParcela: string | null;
  transacaoPaiId: string | null;
  cofrinhoId: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
}): Transacao => ({
  ...row,
  tipo: row.tipo as Transacao['tipo'],
  frequencia: row.frequencia as Transacao['frequencia'],
});

const RETURNING_FIELDS = {
  id: transacoes.id,
  familiaId: transacoes.familiaId,
  tipo: transacoes.tipo,
  valor: transacoes.valor,
  categoriaId: transacoes.categoriaId,
  descricao: transacoes.descricao,
  data: transacoes.data,
  mesReferencia: transacoes.mesReferencia,
  metodoPagamentoId: transacoes.metodoPagamentoId,
  usuarioRegistrouId: transacoes.usuarioRegistrouId,
  recorrente: transacoes.recorrente,
  frequencia: transacoes.frequencia,
  dataFimRecorrencia: transacoes.dataFimRecorrencia,
  parcelado: transacoes.parcelado,
  numeroParcelas: transacoes.numeroParcelas,
  parcelaAtual: transacoes.parcelaAtual,
  valorTotal: transacoes.valorTotal,
  valorParcela: transacoes.valorParcela,
  transacaoPaiId: transacoes.transacaoPaiId,
  cofrinhoId: transacoes.cofrinhoId,
  criadoEm: transacoes.criadoEm,
  atualizadoEm: transacoes.atualizadoEm,
};

export class DrizzleTransacaoRepository implements TransacaoRepository {
  async create(input: CreateTransacaoInput): Promise<Transacao> {
    const [created] = await db
      .insert(transacoes)
      .values({
        familiaId: input.familiaId,
        tipo: input.tipo,
        valor: input.valor,
        categoriaId: input.categoriaId,
        descricao: input.descricao ?? null,
        data: input.data,
        mesReferencia: input.mesReferencia,
        metodoPagamentoId: input.metodoPagamentoId ?? null,
        usuarioRegistrouId: input.usuarioRegistrouId,
        recorrente: input.recorrente ?? false,
        frequencia: input.frequencia ?? null,
        dataFimRecorrencia: input.dataFimRecorrencia ?? null,
        parcelado: input.parcelado ?? false,
        numeroParcelas: input.numeroParcelas ?? null,
        parcelaAtual: input.parcelaAtual ?? null,
        valorTotal: input.valorTotal ?? null,
        valorParcela: input.valorParcela ?? null,
        transacaoPaiId: input.transacaoPaiId ?? null,
        cofrinhoId: input.cofrinhoId ?? null,
      })
      .returning(RETURNING_FIELDS);

    return mapRow(created);
  }

  async createMany(inputs: CreateTransacaoInput[]): Promise<Transacao[]> {
    if (inputs.length === 0) return [];
    const rows = await db
      .insert(transacoes)
      .values(
        inputs.map((input) => ({
          familiaId: input.familiaId,
          tipo: input.tipo,
          valor: input.valor,
          categoriaId: input.categoriaId,
          descricao: input.descricao ?? null,
          data: input.data,
          mesReferencia: input.mesReferencia,
          metodoPagamentoId: input.metodoPagamentoId ?? null,
          usuarioRegistrouId: input.usuarioRegistrouId,
          recorrente: input.recorrente ?? false,
          frequencia: input.frequencia ?? null,
          dataFimRecorrencia: input.dataFimRecorrencia ?? null,
          parcelado: input.parcelado ?? false,
          numeroParcelas: input.numeroParcelas ?? null,
          parcelaAtual: input.parcelaAtual ?? null,
          valorTotal: input.valorTotal ?? null,
          valorParcela: input.valorParcela ?? null,
          transacaoPaiId: input.transacaoPaiId ?? null,
          cofrinhoId: input.cofrinhoId ?? null,
        })),
      )
      .returning(RETURNING_FIELDS);

    return rows.map(mapRow);
  }

  async findById(input: { id: string; familiaId: string }): Promise<Transacao | null> {
    const [row] = await db
      .select(RETURNING_FIELDS)
      .from(transacoes)
      .where(and(eq(transacoes.id, input.id), eq(transacoes.familiaId, input.familiaId)));

    return row ? mapRow(row) : null;
  }

  async list(filtros: TransacaoFiltros): Promise<Transacao[]> {
    const conditions = [eq(transacoes.familiaId, filtros.familiaId)];

    if (filtros.mesReferencia) {
      conditions.push(eq(transacoes.mesReferencia, filtros.mesReferencia));
    }
    if (filtros.tipo) {
      conditions.push(eq(transacoes.tipo, filtros.tipo));
    }
    if (filtros.categoriaId) {
      conditions.push(eq(transacoes.categoriaId, filtros.categoriaId));
    }
    if (filtros.usuarioRegistrouId) {
      conditions.push(eq(transacoes.usuarioRegistrouId, filtros.usuarioRegistrouId));
    }
    if (filtros.metodoPagamentoId) {
      conditions.push(eq(transacoes.metodoPagamentoId, filtros.metodoPagamentoId));
    }

    const rows = await db
      .select(RETURNING_FIELDS)
      .from(transacoes)
      .where(and(...conditions));

    return rows.map(mapRow);
  }

  async update(input: UpdateTransacaoInput): Promise<Transacao | null> {
    const [updated] = await db
      .update(transacoes)
      .set({
        tipo: input.tipo,
        valor: input.valor,
        categoriaId: input.categoriaId,
        descricao: input.descricao ?? null,
        data: input.data,
        mesReferencia: input.mesReferencia,
        metodoPagamentoId: input.metodoPagamentoId ?? null,
        atualizadoEm: sql`now()`,
      })
      .where(and(eq(transacoes.id, input.id), eq(transacoes.familiaId, input.familiaId)))
      .returning(RETURNING_FIELDS);

    return updated ? mapRow(updated) : null;
  }

  async delete(input: { id: string; familiaId: string }): Promise<boolean> {
    const deleted = await db
      .delete(transacoes)
      .where(and(eq(transacoes.id, input.id), eq(transacoes.familiaId, input.familiaId)))
      .returning({ id: transacoes.id });

    return deleted.length > 0;
  }

  async deleteManyByPaiId(input: {
    transacaoPaiId: string;
    familiaId: string;
    dataMinima?: string;
  }): Promise<number> {
    const conditions = [
      eq(transacoes.transacaoPaiId, input.transacaoPaiId),
      eq(transacoes.familiaId, input.familiaId),
    ];
    if (input.dataMinima) {
      conditions.push(gte(transacoes.data, input.dataMinima));
    }

    const deleted = await db
      .delete(transacoes)
      .where(and(...conditions))
      .returning({ id: transacoes.id });
    return deleted.length;
  }

  async listByPaiId(input: { transacaoPaiId: string; familiaId: string }): Promise<Transacao[]> {
    const rows = await db
      .select(RETURNING_FIELDS)
      .from(transacoes)
      .where(
        and(
          eq(transacoes.transacaoPaiId, input.transacaoPaiId),
          eq(transacoes.familiaId, input.familiaId),
        ),
      );

    return rows.map(mapRow);
  }

  async updateManyByPaiId(input: {
    transacaoPaiId: string;
    familiaId: string;
    dataMinima?: string;
    fields: Partial<
      Pick<Transacao, 'mesReferencia' | 'valor' | 'categoriaId' | 'descricao' | 'metodoPagamentoId'>
    >;
  }): Promise<number> {
    const conditions = [
      eq(transacoes.transacaoPaiId, input.transacaoPaiId),
      eq(transacoes.familiaId, input.familiaId),
    ];
    if (input.dataMinima) {
      conditions.push(gte(transacoes.data, input.dataMinima));
    }

    const updated = await db
      .update(transacoes)
      .set({ ...input.fields, atualizadoEm: sql`now()` })
      .where(and(...conditions))
      .returning({ id: transacoes.id });

    return updated.length;
  }
}

export class InMemoryTransacaoRepository implements TransacaoRepository {
  private transacoes: Transacao[] = [];

  async create(input: CreateTransacaoInput): Promise<Transacao> {
    const now = new Date();
    const t: Transacao = {
      id: randomUUID(),
      familiaId: input.familiaId,
      tipo: input.tipo,
      valor: input.valor,
      categoriaId: input.categoriaId,
      descricao: input.descricao ?? null,
      data: input.data,
      mesReferencia: input.mesReferencia,
      metodoPagamentoId: input.metodoPagamentoId ?? null,
      usuarioRegistrouId: input.usuarioRegistrouId,
      recorrente: input.recorrente ?? false,
      frequencia: input.frequencia ?? null,
      dataFimRecorrencia: input.dataFimRecorrencia ?? null,
      parcelado: input.parcelado ?? false,
      numeroParcelas: input.numeroParcelas ?? null,
      parcelaAtual: input.parcelaAtual ?? null,
      valorTotal: input.valorTotal ?? null,
      valorParcela: input.valorParcela ?? null,
      transacaoPaiId: input.transacaoPaiId ?? null,
      cofrinhoId: input.cofrinhoId ?? null,
      criadoEm: now,
      atualizadoEm: now,
    };
    this.transacoes.push(t);
    return t;
  }

  async createMany(inputs: CreateTransacaoInput[]): Promise<Transacao[]> {
    return Promise.all(inputs.map((input) => this.create(input)));
  }

  async findById(input: { id: string; familiaId: string }): Promise<Transacao | null> {
    return (
      this.transacoes.find((t) => t.id === input.id && t.familiaId === input.familiaId) ?? null
    );
  }

  async list(filtros: TransacaoFiltros): Promise<Transacao[]> {
    return this.transacoes.filter((t) => {
      if (t.familiaId !== filtros.familiaId) return false;
      if (filtros.mesReferencia && t.mesReferencia !== filtros.mesReferencia) return false;
      if (filtros.tipo && t.tipo !== filtros.tipo) return false;
      if (filtros.categoriaId && t.categoriaId !== filtros.categoriaId) return false;
      if (filtros.usuarioRegistrouId && t.usuarioRegistrouId !== filtros.usuarioRegistrouId)
        return false;
      if (filtros.metodoPagamentoId && t.metodoPagamentoId !== filtros.metodoPagamentoId)
        return false;
      return true;
    });
  }

  async update(input: UpdateTransacaoInput): Promise<Transacao | null> {
    const index = this.transacoes.findIndex(
      (t) => t.id === input.id && t.familiaId === input.familiaId,
    );
    if (index === -1) return null;

    const updated: Transacao = {
      ...this.transacoes[index],
      tipo: input.tipo,
      valor: input.valor,
      categoriaId: input.categoriaId,
      descricao: input.descricao ?? null,
      data: input.data,
      mesReferencia: input.mesReferencia,
      metodoPagamentoId: input.metodoPagamentoId ?? null,
      atualizadoEm: new Date(),
    };
    this.transacoes[index] = updated;
    return updated;
  }

  async delete(input: { id: string; familiaId: string }): Promise<boolean> {
    const index = this.transacoes.findIndex(
      (t) => t.id === input.id && t.familiaId === input.familiaId,
    );
    if (index === -1) return false;
    this.transacoes.splice(index, 1);
    return true;
  }

  async deleteManyByPaiId(input: {
    transacaoPaiId: string;
    familiaId: string;
    dataMinima?: string;
  }): Promise<number> {
    const before = this.transacoes.length;
    this.transacoes = this.transacoes.filter((t) => {
      if (t.transacaoPaiId !== input.transacaoPaiId || t.familiaId !== input.familiaId) return true;
      if (input.dataMinima && t.data < input.dataMinima) return true;
      return false;
    });
    return before - this.transacoes.length;
  }

  async listByPaiId(input: { transacaoPaiId: string; familiaId: string }): Promise<Transacao[]> {
    return this.transacoes.filter(
      (t) => t.transacaoPaiId === input.transacaoPaiId && t.familiaId === input.familiaId,
    );
  }

  async updateManyByPaiId(input: {
    transacaoPaiId: string;
    familiaId: string;
    dataMinima?: string;
    fields: Partial<
      Pick<Transacao, 'mesReferencia' | 'valor' | 'categoriaId' | 'descricao' | 'metodoPagamentoId'>
    >;
  }): Promise<number> {
    let count = 0;
    this.transacoes = this.transacoes.map((t) => {
      if (t.transacaoPaiId !== input.transacaoPaiId || t.familiaId !== input.familiaId) return t;
      if (input.dataMinima && t.data < input.dataMinima) return t;
      count++;
      return { ...t, ...input.fields, atualizadoEm: new Date() };
    });
    return count;
  }
}
