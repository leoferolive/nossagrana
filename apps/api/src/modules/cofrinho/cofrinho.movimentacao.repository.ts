import { randomUUID } from 'node:crypto';

import { and, desc, eq } from 'drizzle-orm';

import type { ExecutorDrizzle } from '../../db/executor.types.js';
import { movimentacoesCofrinhos } from '../../db/schema.js';
import type { ParticipanteInMemory } from '../../shared/unit-of-work/unit-of-work.types.js';
import type {
  BuscaAporteRecorrente,
  CreateMovimentacaoInput,
  MovimentacaoCofrinho,
  MovimentacaoCofrinhoRepository,
} from './cofrinho.types.js';

const colunasMovimentacao = {
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
};

/** Ledger do cofrinho sobre o `db` ou o `tx` da Unit of Work (#60). */
export class DrizzleMovimentacaoCofrinhoRepository implements MovimentacaoCofrinhoRepository {
  constructor(private readonly executor: ExecutorDrizzle) {}

  async create(input: CreateMovimentacaoInput): Promise<MovimentacaoCofrinho> {
    const [created] = await this.executor
      .insert(movimentacoesCofrinhos)
      .values({
        ...input,
        descricao: input.descricao ?? null,
        transacaoId: input.transacaoId ?? null,
      })
      .returning(colunasMovimentacao);
    return created;
  }

  async listByCofrinho(input: BuscaAporteRecorrente): Promise<MovimentacaoCofrinho[]> {
    return this.executor
      .select(colunasMovimentacao)
      .from(movimentacoesCofrinhos)
      .where(
        and(
          eq(movimentacoesCofrinhos.cofrinhoId, input.cofrinhoId),
          eq(movimentacoesCofrinhos.familiaId, input.familiaId),
        ),
      )
      .orderBy(desc(movimentacoesCofrinhos.registradoEm));
  }
}

export class InMemoryMovimentacaoCofrinhoRepository
  implements
    MovimentacaoCofrinhoRepository,
    ParticipanteInMemory<InMemoryMovimentacaoCofrinhoRepository>
{
  private movimentacoes: MovimentacaoCofrinho[] = [];

  abrirStaging(): InMemoryMovimentacaoCofrinhoRepository {
    const staging = new InMemoryMovimentacaoCofrinhoRepository();
    staging.movimentacoes = [...this.movimentacoes];
    return staging;
  }

  publicar(staging: InMemoryMovimentacaoCofrinhoRepository): void {
    this.movimentacoes = [...staging.movimentacoes];
  }

  async create(input: CreateMovimentacaoInput): Promise<MovimentacaoCofrinho> {
    const created: MovimentacaoCofrinho = {
      ...input,
      id: randomUUID(),
      descricao: input.descricao ?? null,
      transacaoId: input.transacaoId ?? null,
      registradoEm: new Date(),
    };
    this.movimentacoes = [...this.movimentacoes, created];
    return created;
  }

  async listByCofrinho(input: BuscaAporteRecorrente): Promise<MovimentacaoCofrinho[]> {
    return this.movimentacoes
      .filter((m) => m.cofrinhoId === input.cofrinhoId && m.familiaId === input.familiaId)
      .sort((a, b) => b.registradoEm.getTime() - a.registradoEm.getTime());
  }
}
