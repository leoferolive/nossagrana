import { randomUUID } from 'node:crypto';

import { and, eq } from 'drizzle-orm';

import { db } from '../../db/client.js';
import { categorias, metodosPagamento, transacoes, users } from '../../db/schema.js';
import type {
  FaturaTransacaoRow,
  MetodoPagamento,
  MetodoPagamentoRepository,
} from './metodo-pagamento.types.js';

const RETURNING_FIELDS = {
  id: metodosPagamento.id,
  familiaId: metodosPagamento.familiaId,
  nome: metodosPagamento.nome,
  tipo: metodosPagamento.tipo,
  dataFechamento: metodosPagamento.dataFechamento,
  dataVencimento: metodosPagamento.dataVencimento,
  usuarioDonoId: metodosPagamento.usuarioDonoId,
  ativo: metodosPagamento.ativo,
  criadoEm: metodosPagamento.criadoEm,
};

const mapRow = (row: {
  id: string;
  familiaId: string;
  nome: string;
  tipo: string;
  dataFechamento: number | null;
  dataVencimento: number | null;
  usuarioDonoId: string;
  ativo: boolean;
  criadoEm: Date;
}): MetodoPagamento => ({
  ...row,
  tipo: row.tipo as MetodoPagamento['tipo'],
});

export class DrizzleMetodoPagamentoRepository implements MetodoPagamentoRepository {
  async listByFamiliaId(input: { familiaId: string }): Promise<MetodoPagamento[]> {
    const rows = await db
      .select(RETURNING_FIELDS)
      .from(metodosPagamento)
      .where(
        and(eq(metodosPagamento.familiaId, input.familiaId), eq(metodosPagamento.ativo, true)),
      );

    return rows.map(mapRow);
  }

  async findById(input: { id: string; familiaId: string }): Promise<MetodoPagamento | null> {
    const [row] = await db
      .select(RETURNING_FIELDS)
      .from(metodosPagamento)
      .where(
        and(
          eq(metodosPagamento.id, input.id),
          eq(metodosPagamento.familiaId, input.familiaId),
          eq(metodosPagamento.ativo, true),
        ),
      );
    return row ? mapRow(row) : null;
  }

  async create(input: {
    familiaId: string;
    nome: string;
    tipo: 'credito' | 'debito' | 'pix' | 'dinheiro';
    dataFechamento: number | null;
    dataVencimento: number | null;
    usuarioDonoId: string;
  }): Promise<MetodoPagamento> {
    const [created] = await db
      .insert(metodosPagamento)
      .values({
        familiaId: input.familiaId,
        nome: input.nome,
        tipo: input.tipo,
        dataFechamento: input.dataFechamento,
        dataVencimento: input.dataVencimento,
        usuarioDonoId: input.usuarioDonoId,
        ativo: true,
      })
      .returning(RETURNING_FIELDS);

    return mapRow(created);
  }

  async update(input: {
    id: string;
    familiaId: string;
    nome: string;
    tipo: 'credito' | 'debito' | 'pix' | 'dinheiro';
    dataFechamento: number | null;
    dataVencimento: number | null;
  }): Promise<MetodoPagamento | null> {
    const [updated] = await db
      .update(metodosPagamento)
      .set({
        nome: input.nome,
        tipo: input.tipo,
        dataFechamento: input.dataFechamento,
        dataVencimento: input.dataVencimento,
      })
      .where(
        and(
          eq(metodosPagamento.id, input.id),
          eq(metodosPagamento.familiaId, input.familiaId),
          eq(metodosPagamento.ativo, true),
        ),
      )
      .returning(RETURNING_FIELDS);

    return updated ? mapRow(updated) : null;
  }

  async deactivate(input: { id: string; familiaId: string }): Promise<MetodoPagamento | null> {
    const [updated] = await db
      .update(metodosPagamento)
      .set({ ativo: false })
      .where(
        and(
          eq(metodosPagamento.id, input.id),
          eq(metodosPagamento.familiaId, input.familiaId),
          eq(metodosPagamento.ativo, true),
        ),
      )
      .returning(RETURNING_FIELDS);

    return updated ? mapRow(updated) : null;
  }

  async getFatura(
    familiaId: string,
    metodoPagamentoId: string,
    mesReferencia: string,
  ): Promise<FaturaTransacaoRow[]> {
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
}

export class InMemoryMetodoPagamentoRepository implements MetodoPagamentoRepository {
  private metodos: MetodoPagamento[] = [];
  private _fatura: Array<
    FaturaTransacaoRow & { familiaId: string; metodoPagamentoId: string; mesReferencia: string }
  > = [];

  async listByFamiliaId(input: { familiaId: string }): Promise<MetodoPagamento[]> {
    return this.metodos.filter((m) => m.familiaId === input.familiaId && m.ativo);
  }

  async findById(input: { id: string; familiaId: string }): Promise<MetodoPagamento | null> {
    return (
      this.metodos.find(
        (m) => m.id === input.id && m.familiaId === input.familiaId && m.ativo,
      ) ?? null
    );
  }

  seedFatura(
    t: FaturaTransacaoRow & {
      familiaId: string;
      metodoPagamentoId: string;
      mesReferencia: string;
    },
  ): void {
    this._fatura.push(t);
  }

  async getFatura(
    familiaId: string,
    metodoPagamentoId: string,
    mesReferencia: string,
  ): Promise<FaturaTransacaoRow[]> {
    return this._fatura.filter(
      (t) =>
        t.familiaId === familiaId &&
        t.metodoPagamentoId === metodoPagamentoId &&
        t.mesReferencia === mesReferencia,
    );
  }

  async create(input: {
    familiaId: string;
    nome: string;
    tipo: 'credito' | 'debito' | 'pix' | 'dinheiro';
    dataFechamento: number | null;
    dataVencimento: number | null;
    usuarioDonoId: string;
  }): Promise<MetodoPagamento> {
    const created: MetodoPagamento = {
      id: randomUUID(),
      familiaId: input.familiaId,
      nome: input.nome,
      tipo: input.tipo,
      dataFechamento: input.dataFechamento,
      dataVencimento: input.dataVencimento,
      usuarioDonoId: input.usuarioDonoId,
      ativo: true,
      criadoEm: new Date(),
    };
    this.metodos.push(created);
    return created;
  }

  async update(input: {
    id: string;
    familiaId: string;
    nome: string;
    tipo: 'credito' | 'debito' | 'pix' | 'dinheiro';
    dataFechamento: number | null;
    dataVencimento: number | null;
  }): Promise<MetodoPagamento | null> {
    const index = this.metodos.findIndex(
      (m) => m.id === input.id && m.familiaId === input.familiaId && m.ativo,
    );
    if (index === -1) return null;

    const updated: MetodoPagamento = {
      ...this.metodos[index],
      nome: input.nome,
      tipo: input.tipo,
      dataFechamento: input.dataFechamento,
      dataVencimento: input.dataVencimento,
    };
    this.metodos[index] = updated;
    return updated;
  }

  async deactivate(input: { id: string; familiaId: string }): Promise<MetodoPagamento | null> {
    const index = this.metodos.findIndex(
      (m) => m.id === input.id && m.familiaId === input.familiaId && m.ativo,
    );
    if (index === -1) return null;

    const deactivated: MetodoPagamento = { ...this.metodos[index], ativo: false };
    this.metodos[index] = deactivated;
    return deactivated;
  }
}
