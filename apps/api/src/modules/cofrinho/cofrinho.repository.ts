import { and, eq, sql, type SQL } from 'drizzle-orm';

import type { ExecutorDrizzle } from '../../db/executor.types.js';
import { cofrinhos, transacoes } from '../../db/schema.js';
import type {
  AporteRecorrenteAtivo,
  BuscaAporteRecorrente,
  Cofrinho,
  CofrinhoDaFamilia,
  CofrinhoRepository,
  CreateCofrinhoInput,
  UpdateCofrinhoInput,
  VariacaoSaldo,
} from './cofrinho.types.js';

const colunasCofrinho = {
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
};

/** Mesmo limite da migration 0009: falha rápido em vez de ficar na fila de locks. */
const ESPERA_MAXIMA_POR_LOCK_MS = 5_000;

const daFamilia = (input: CofrinhoDaFamilia) =>
  and(eq(cofrinhos.id, input.id), eq(cofrinhos.familiaId, input.familiaId));

const ativoDaFamilia = (input: CofrinhoDaFamilia, ...extras: SQL[]) =>
  and(daFamilia(input), eq(cofrinhos.status, 'ativo'), ...extras);

/**
 * Cofrinhos sobre o `db` ou o `tx` da Unit of Work (#60). Saldo só muda por
 * UPDATE atômico com RETURNING (#61/#62); a espera por lock de linha é
 * limitada (`SET LOCAL lock_timeout`) e o estouro vira
 * `ConflitoDeConcorrenciaError` no decorator da Unit of Work.
 */
export class DrizzleCofrinhoRepository implements CofrinhoRepository {
  constructor(
    private readonly executor: ExecutorDrizzle,
    private readonly esperaMaximaPorLockMs: number = ESPERA_MAXIMA_POR_LOCK_MS,
  ) {
    if (!Number.isInteger(esperaMaximaPorLockMs) || esperaMaximaPorLockMs <= 0) {
      throw new Error(
        `esperaMaximaPorLockMs inválido: recebido ${esperaMaximaPorLockMs}, esperado inteiro > 0`,
      );
    }
  }

  async list(input: { familiaId: string; status: 'ativo' | 'encerrado' }): Promise<Cofrinho[]> {
    return this.executor
      .select(colunasCofrinho)
      .from(cofrinhos)
      .where(and(eq(cofrinhos.familiaId, input.familiaId), eq(cofrinhos.status, input.status)));
  }

  async findById(input: CofrinhoDaFamilia): Promise<Cofrinho | null> {
    const [found] = await this.executor
      .select(colunasCofrinho)
      .from(cofrinhos)
      .where(daFamilia(input));
    return found ?? null;
  }

  async bloquearParaAtualizacao(input: CofrinhoDaFamilia): Promise<Cofrinho | null> {
    await this.limitarEsperaPorLock();
    const [found] = await this.executor
      .select(colunasCofrinho)
      .from(cofrinhos)
      .where(daFamilia(input))
      .for('update');
    return found ?? null;
  }

  async create(input: CreateCofrinhoInput): Promise<Cofrinho> {
    const [created] = await this.executor
      .insert(cofrinhos)
      .values({
        familiaId: input.familiaId,
        nome: input.nome,
        emoji: input.emoji ?? null,
        descricao: input.descricao ?? null,
        metaValor: input.metaValor ?? null,
        criadoPor: input.criadoPor,
      })
      .returning(colunasCofrinho);
    return created;
  }

  async update(input: UpdateCofrinhoInput): Promise<Cofrinho | null> {
    const { id, familiaId, ...campos } = input;
    // PATCH sem campos: o Drizzle lançaria "No values to set" (500); nada a mudar.
    if (Object.values(campos).every((valor) => valor === undefined)) {
      const atual = await this.findById({ id, familiaId });
      return atual?.status === 'ativo' ? atual : null;
    }
    const [updated] = await this.executor
      .update(cofrinhos)
      .set(campos)
      .where(ativoDaFamilia({ id, familiaId }))
      .returning(colunasCofrinho);
    return updated ?? null;
  }

  async incrementarSaldo(input: VariacaoSaldo): Promise<Cofrinho | null> {
    return this.variarSaldo(input, sql`${cofrinhos.saldoAtual} + ${input.valor}::numeric`);
  }

  /** Condição `saldo >= valor` no próprio UPDATE: sob concorrência só um passa (#62). */
  async decrementarSaldo(input: VariacaoSaldo): Promise<Cofrinho | null> {
    const coberto = sql`${cofrinhos.saldoAtual} >= ${input.valor}::numeric`;
    return this.variarSaldo(input, sql`${cofrinhos.saldoAtual} - ${input.valor}::numeric`, coberto);
  }

  async encerrar(input: CofrinhoDaFamilia): Promise<Cofrinho | null> {
    const [updated] = await this.executor
      .update(cofrinhos)
      .set({ status: 'encerrado', encerradoEm: new Date() })
      .where(ativoDaFamilia(input))
      .returning(colunasCofrinho);
    return updated ?? null;
  }

  async findAporteRecorrenteAtivo(
    input: BuscaAporteRecorrente,
  ): Promise<AporteRecorrenteAtivo | null> {
    const [found] = await this.executor
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
    if (!found?.frequencia) return null;
    return { ...found, frequencia: found.frequencia };
  }

  private async variarSaldo(input: VariacaoSaldo, novoSaldo: SQL, ...condicoes: SQL[]) {
    await this.limitarEsperaPorLock();
    const [updated] = await this.executor
      .update(cofrinhos)
      .set({ saldoAtual: novoSaldo })
      .where(ativoDaFamilia(input, ...condicoes))
      .returning(colunasCofrinho);
    return updated ?? null;
  }

  /** Só tem efeito dentro de transação (Unit of Work); o valor é inteiro validado no construtor. */
  private async limitarEsperaPorLock(): Promise<void> {
    await this.executor.execute(sql.raw(`SET LOCAL lock_timeout = ${this.esperaMaximaPorLockMs}`));
  }
}
