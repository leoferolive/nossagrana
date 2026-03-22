import { randomUUID } from 'node:crypto';

import { and, desc, eq } from 'drizzle-orm';

import { db } from '../../db/client.js';
import { cofrinhos, movimentacoesCofrinhos, transacoes } from '../../db/schema.js';
import type {
  Cofrinho,
  CofrinhoRepository,
  MovimentacaoCofrinho,
} from './cofrinho.types.js';

export class DrizzleCofrinhoRepository implements CofrinhoRepository {
  async list(input: {
    familiaId: string;
    status: 'ativo' | 'encerrado';
  }): Promise<Cofrinho[]> {
    const found = await db
      .select({
        id: cofrinhos.id,
        familiaId: cofrinhos.familiaId,
        nome: cofrinhos.nome,
        emoji: cofrinhos.emoji,
        descricao: cofrinhos.descricao,
        metaValor: cofrinhos.metaValor,
        saldoAtual: cofrinhos.saldoAtual,
        status: cofrinhos.status,
        criadoPor: cofrinhos.criadoPor,
        criadoEm: cofrinhos.criadoEm,
        encerradoEm: cofrinhos.encerradoEm,
      })
      .from(cofrinhos)
      .where(
        and(
          eq(cofrinhos.familiaId, input.familiaId),
          eq(cofrinhos.status, input.status),
        ),
      );

    return found.map((c) => ({
      ...c,
      status: c.status as 'ativo' | 'encerrado',
    }));
  }

  async findById(input: {
    id: string;
    familiaId: string;
  }): Promise<Cofrinho | null> {
    const [found] = await db
      .select({
        id: cofrinhos.id,
        familiaId: cofrinhos.familiaId,
        nome: cofrinhos.nome,
        emoji: cofrinhos.emoji,
        descricao: cofrinhos.descricao,
        metaValor: cofrinhos.metaValor,
        saldoAtual: cofrinhos.saldoAtual,
        status: cofrinhos.status,
        criadoPor: cofrinhos.criadoPor,
        criadoEm: cofrinhos.criadoEm,
        encerradoEm: cofrinhos.encerradoEm,
      })
      .from(cofrinhos)
      .where(
        and(
          eq(cofrinhos.id, input.id),
          eq(cofrinhos.familiaId, input.familiaId),
        ),
      );

    if (!found) {
      return null;
    }

    return {
      ...found,
      status: found.status as 'ativo' | 'encerrado',
    };
  }

  async create(input: {
    familiaId: string;
    nome: string;
    emoji?: string | null;
    descricao?: string | null;
    metaValor?: string | null;
    criadoPor: string;
  }): Promise<Cofrinho> {
    const [created] = await db
      .insert(cofrinhos)
      .values({
        familiaId: input.familiaId,
        nome: input.nome,
        emoji: input.emoji ?? null,
        descricao: input.descricao ?? null,
        metaValor: input.metaValor ?? null,
        criadoPor: input.criadoPor,
      })
      .returning({
        id: cofrinhos.id,
        familiaId: cofrinhos.familiaId,
        nome: cofrinhos.nome,
        emoji: cofrinhos.emoji,
        descricao: cofrinhos.descricao,
        metaValor: cofrinhos.metaValor,
        saldoAtual: cofrinhos.saldoAtual,
        status: cofrinhos.status,
        criadoPor: cofrinhos.criadoPor,
        criadoEm: cofrinhos.criadoEm,
        encerradoEm: cofrinhos.encerradoEm,
      });

    return {
      ...created,
      status: created.status as 'ativo' | 'encerrado',
    };
  }

  async update(input: {
    id: string;
    familiaId: string;
    nome?: string;
    emoji?: string | null;
    descricao?: string | null;
    metaValor?: string | null;
  }): Promise<Cofrinho | null> {
    const setFields: Record<string, unknown> = {};
    if (input.nome !== undefined) setFields['nome'] = input.nome;
    if (input.emoji !== undefined) setFields['emoji'] = input.emoji;
    if (input.descricao !== undefined) setFields['descricao'] = input.descricao;
    if (input.metaValor !== undefined) setFields['metaValor'] = input.metaValor;

    const [updated] = await db
      .update(cofrinhos)
      .set(setFields)
      .where(
        and(
          eq(cofrinhos.id, input.id),
          eq(cofrinhos.familiaId, input.familiaId),
          eq(cofrinhos.status, 'ativo'),
        ),
      )
      .returning({
        id: cofrinhos.id,
        familiaId: cofrinhos.familiaId,
        nome: cofrinhos.nome,
        emoji: cofrinhos.emoji,
        descricao: cofrinhos.descricao,
        metaValor: cofrinhos.metaValor,
        saldoAtual: cofrinhos.saldoAtual,
        status: cofrinhos.status,
        criadoPor: cofrinhos.criadoPor,
        criadoEm: cofrinhos.criadoEm,
        encerradoEm: cofrinhos.encerradoEm,
      });

    if (!updated) {
      return null;
    }

    return {
      ...updated,
      status: updated.status as 'ativo' | 'encerrado',
    };
  }

  async updateSaldo(input: {
    id: string;
    familiaId: string;
    novoSaldo: string;
  }): Promise<Cofrinho | null> {
    const [updated] = await db
      .update(cofrinhos)
      .set({ saldoAtual: input.novoSaldo })
      .where(
        and(
          eq(cofrinhos.id, input.id),
          eq(cofrinhos.familiaId, input.familiaId),
          eq(cofrinhos.status, 'ativo'),
        ),
      )
      .returning({
        id: cofrinhos.id,
        familiaId: cofrinhos.familiaId,
        nome: cofrinhos.nome,
        emoji: cofrinhos.emoji,
        descricao: cofrinhos.descricao,
        metaValor: cofrinhos.metaValor,
        saldoAtual: cofrinhos.saldoAtual,
        status: cofrinhos.status,
        criadoPor: cofrinhos.criadoPor,
        criadoEm: cofrinhos.criadoEm,
        encerradoEm: cofrinhos.encerradoEm,
      });

    if (!updated) {
      return null;
    }

    return {
      ...updated,
      status: updated.status as 'ativo' | 'encerrado',
    };
  }

  async encerrar(input: {
    id: string;
    familiaId: string;
  }): Promise<Cofrinho | null> {
    const [updated] = await db
      .update(cofrinhos)
      .set({ status: 'encerrado', encerradoEm: new Date() })
      .where(
        and(
          eq(cofrinhos.id, input.id),
          eq(cofrinhos.familiaId, input.familiaId),
          eq(cofrinhos.status, 'ativo'),
        ),
      )
      .returning({
        id: cofrinhos.id,
        familiaId: cofrinhos.familiaId,
        nome: cofrinhos.nome,
        emoji: cofrinhos.emoji,
        descricao: cofrinhos.descricao,
        metaValor: cofrinhos.metaValor,
        saldoAtual: cofrinhos.saldoAtual,
        status: cofrinhos.status,
        criadoPor: cofrinhos.criadoPor,
        criadoEm: cofrinhos.criadoEm,
        encerradoEm: cofrinhos.encerradoEm,
      });

    if (!updated) {
      return null;
    }

    return {
      ...updated,
      status: updated.status as 'ativo' | 'encerrado',
    };
  }

  async createMovimentacao(input: {
    cofrinhoId: string;
    familiaId: string;
    tipo: 'aporte' | 'retirada';
    valor: string;
    descricao?: string | null;
    transacaoId?: string | null;
    registradoPor: string;
    mesReferencia: string;
  }): Promise<MovimentacaoCofrinho> {
    const [created] = await db
      .insert(movimentacoesCofrinhos)
      .values({
        cofrinhoId: input.cofrinhoId,
        familiaId: input.familiaId,
        tipo: input.tipo,
        valor: input.valor,
        descricao: input.descricao ?? null,
        transacaoId: input.transacaoId ?? null,
        registradoPor: input.registradoPor,
        mesReferencia: input.mesReferencia,
      })
      .returning({
        id: movimentacoesCofrinhos.id,
        cofrinhoId: movimentacoesCofrinhos.cofrinhoId,
        familiaId: movimentacoesCofrinhos.familiaId,
        tipo: movimentacoesCofrinhos.tipo,
        valor: movimentacoesCofrinhos.valor,
        descricao: movimentacoesCofrinhos.descricao,
        transacaoId: movimentacoesCofrinhos.transacaoId,
        registradoPor: movimentacoesCofrinhos.registradoPor,
        registradoEm: movimentacoesCofrinhos.registradoEm,
        mesReferencia: movimentacoesCofrinhos.mesReferencia,
      });

    return {
      ...created,
      tipo: created.tipo as 'aporte' | 'retirada',
    };
  }

  async listMovimentacoes(input: {
    cofrinhoId: string;
    familiaId: string;
  }): Promise<MovimentacaoCofrinho[]> {
    const found = await db
      .select({
        id: movimentacoesCofrinhos.id,
        cofrinhoId: movimentacoesCofrinhos.cofrinhoId,
        familiaId: movimentacoesCofrinhos.familiaId,
        tipo: movimentacoesCofrinhos.tipo,
        valor: movimentacoesCofrinhos.valor,
        descricao: movimentacoesCofrinhos.descricao,
        transacaoId: movimentacoesCofrinhos.transacaoId,
        registradoPor: movimentacoesCofrinhos.registradoPor,
        registradoEm: movimentacoesCofrinhos.registradoEm,
        mesReferencia: movimentacoesCofrinhos.mesReferencia,
      })
      .from(movimentacoesCofrinhos)
      .where(
        and(
          eq(movimentacoesCofrinhos.cofrinhoId, input.cofrinhoId),
          eq(movimentacoesCofrinhos.familiaId, input.familiaId),
        ),
      )
      .orderBy(desc(movimentacoesCofrinhos.registradoEm));

    return found.map((m) => ({
      ...m,
      tipo: m.tipo as 'aporte' | 'retirada',
    }));
  }

  async findAporteRecorrenteAtivo(input: {
    cofrinhoId: string;
    familiaId: string;
  }): Promise<{
    transacaoPaiId: string;
    valor: string;
    frequencia: 'mensal' | 'semanal' | 'quinzenal';
    dataFimRecorrencia: string | null;
  } | null> {
    const [found] = await db
      .select({
        transacaoPaiId: transacoes.id,
        valor: transacoes.valor,
        frequencia: transacoes.frequencia,
        dataFimRecorrencia: transacoes.dataFimRecorrencia,
      })
      .from(transacoes)
      .where(
        and(
          eq(transacoes.cofrinhoId, input.cofrinhoId),
          eq(transacoes.familiaId, input.familiaId),
          eq(transacoes.recorrente, true),
        ),
      );

    if (!found || !found.frequencia) {
      return null;
    }

    return {
      transacaoPaiId: found.transacaoPaiId,
      valor: found.valor,
      frequencia: found.frequencia as 'mensal' | 'semanal' | 'quinzenal',
      dataFimRecorrencia: found.dataFimRecorrencia,
    };
  }
}

export class InMemoryCofrinhoRepository implements CofrinhoRepository {
  private cofrinhos: Cofrinho[] = [];
  private movimentacoes: MovimentacaoCofrinho[] = [];

  async list(input: {
    familiaId: string;
    status: 'ativo' | 'encerrado';
  }): Promise<Cofrinho[]> {
    return this.cofrinhos.filter(
      (c) => c.familiaId === input.familiaId && c.status === input.status,
    );
  }

  async findById(input: {
    id: string;
    familiaId: string;
  }): Promise<Cofrinho | null> {
    return (
      this.cofrinhos.find(
        (c) => c.id === input.id && c.familiaId === input.familiaId,
      ) ?? null
    );
  }

  async create(input: {
    familiaId: string;
    nome: string;
    emoji?: string | null;
    descricao?: string | null;
    metaValor?: string | null;
    criadoPor: string;
  }): Promise<Cofrinho> {
    const created: Cofrinho = {
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

    this.cofrinhos.push(created);

    return created;
  }

  async update(input: {
    id: string;
    familiaId: string;
    nome?: string;
    emoji?: string | null;
    descricao?: string | null;
    metaValor?: string | null;
  }): Promise<Cofrinho | null> {
    const index = this.cofrinhos.findIndex(
      (c) =>
        c.id === input.id &&
        c.familiaId === input.familiaId &&
        c.status === 'ativo',
    );

    if (index === -1) {
      return null;
    }

    const updated: Cofrinho = {
      ...this.cofrinhos[index],
      ...(input.nome !== undefined && { nome: input.nome }),
      ...(input.emoji !== undefined && { emoji: input.emoji ?? null }),
      ...(input.descricao !== undefined && {
        descricao: input.descricao ?? null,
      }),
      ...(input.metaValor !== undefined && {
        metaValor: input.metaValor ?? null,
      }),
    };
    this.cofrinhos[index] = updated;

    return updated;
  }

  async updateSaldo(input: {
    id: string;
    familiaId: string;
    novoSaldo: string;
  }): Promise<Cofrinho | null> {
    const index = this.cofrinhos.findIndex(
      (c) =>
        c.id === input.id &&
        c.familiaId === input.familiaId &&
        c.status === 'ativo',
    );

    if (index === -1) {
      return null;
    }

    const updated: Cofrinho = {
      ...this.cofrinhos[index],
      saldoAtual: input.novoSaldo,
    };
    this.cofrinhos[index] = updated;

    return updated;
  }

  async encerrar(input: {
    id: string;
    familiaId: string;
  }): Promise<Cofrinho | null> {
    const index = this.cofrinhos.findIndex(
      (c) =>
        c.id === input.id &&
        c.familiaId === input.familiaId &&
        c.status === 'ativo',
    );

    if (index === -1) {
      return null;
    }

    const updated: Cofrinho = {
      ...this.cofrinhos[index],
      status: 'encerrado',
      encerradoEm: new Date(),
    };
    this.cofrinhos[index] = updated;

    return updated;
  }

  async createMovimentacao(input: {
    cofrinhoId: string;
    familiaId: string;
    tipo: 'aporte' | 'retirada';
    valor: string;
    descricao?: string | null;
    transacaoId?: string | null;
    registradoPor: string;
    mesReferencia: string;
  }): Promise<MovimentacaoCofrinho> {
    const created: MovimentacaoCofrinho = {
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

    this.movimentacoes.push(created);

    return created;
  }

  async listMovimentacoes(input: {
    cofrinhoId: string;
    familiaId: string;
  }): Promise<MovimentacaoCofrinho[]> {
    return this.movimentacoes
      .filter(
        (m) =>
          m.cofrinhoId === input.cofrinhoId &&
          m.familiaId === input.familiaId,
      )
      .sort(
        (a, b) => b.registradoEm.getTime() - a.registradoEm.getTime(),
      );
  }

  async findAporteRecorrenteAtivo(_input: {
    cofrinhoId: string;
    familiaId: string;
  }): Promise<{
    transacaoPaiId: string;
    valor: string;
    frequencia: 'mensal' | 'semanal' | 'quinzenal';
    dataFimRecorrencia: string | null;
  } | null> {
    return null;
  }
}
