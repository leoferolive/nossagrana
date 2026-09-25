import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CofrinhoHandlerQueFalhaNaChamada } from '../../modules/transacao/transacao.fakes.js';
import { DrizzleTransacaoRepository } from '../../modules/transacao/transacao.repository.js';
import { criarRepositoriosTransacaoDrizzle } from '../../modules/transacao/transacao.unit-of-work.js';
import { TransacaoService } from '../../modules/transacao/transacao.service.js';
import type {
  CofrinhoHandler,
  CreateTransacaoInput,
  RegistrarTransacaoInput,
  Transacao,
  TransacaoRepositorios,
} from '../../modules/transacao/transacao.types.js';
import { ReferenciasSempreValidasFake } from '../../shared/referencia-ownership/referencia-ownership.fakes.js';
import { traduzirViolacaoReferencia } from '../../shared/referencia-ownership/referencia-ownership.db-error.js';
import { ReferenciaInvalidaError } from '../../shared/referencia-ownership/referencia-ownership.validator.js';
import {
  UnidadeDeTrabalhoAninhadaError,
  UnidadeDeTrabalhoEncerradaError,
} from '../../shared/unit-of-work/escopo-transacional.js';
import { DrizzleUnitOfWork } from '../../shared/unit-of-work/drizzle-unit-of-work.js';
import type { ExecutorDrizzle } from '../executor.types.js';
import { semearFamilia, type FamiliaSemeada } from './pg-fixtures.js';
import {
  aplicarMigrations,
  conectar,
  criarBancoDescartavel,
  type BancoDescartavel,
} from './pg-harness.js';

/**
 * Unit of Work Drizzle no PostgreSQL real (issues #78/#85): o registro de
 * parcelas/recorrências grava pai + filhas num único `db.transaction`, e uma
 * falha real no meio do lote não deixa linha nenhuma.
 */

/**
 * Fake nomeada: repositório Drizzle real que troca a categoria da N-ésima
 * filha por uma categoria de OUTRA família — a FK composta
 * `transacoes_categoria_familia_fk` rejeita esse insert de verdade.
 */
class DrizzleTransacaoRepositoryComFilhaEstrangeira extends DrizzleTransacaoRepository {
  constructor(
    executor: ExecutorDrizzle,
    private readonly enesimaFilha: number,
    private readonly categoriaEstrangeiraId: string,
  ) {
    super(executor);
  }

  override createMany(inputs: CreateTransacaoInput[]): Promise<Transacao[]> {
    const sabotadas = inputs.map((input, indice) =>
      indice + 1 === this.enesimaFilha
        ? { ...input, categoriaId: this.categoriaEstrangeiraId }
        : input,
    );
    return super.createMany(sabotadas);
  }
}

type CriarRepos = (tx: ExecutorDrizzle) => TransacaoRepositorios;

/** Pool de 1 conexão: uma conexão presa travaria o teste; aqui falha com mensagem clara. */
async function dentroDoPrazo<T>(operacao: Promise<T>, mensagem: string, ms = 3_000): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const prazo = new Promise<never>((_, rejeitar) => {
    timer = setTimeout(() => rejeitar(new Error(mensagem)), ms);
  });
  try {
    return await Promise.race([operacao, prazo]);
  } finally {
    clearTimeout(timer);
  }
}

describe('DrizzleUnitOfWork + TransacaoService.registrar no PostgreSQL', () => {
  let banco: BancoDescartavel;
  let db: PostgresJsDatabase;
  let observador: postgres.Sql;
  let a: FamiliaSemeada;
  let b: FamiliaSemeada;

  beforeAll(async () => {
    banco = await criarBancoDescartavel();
    await aplicarMigrations(banco.url);
    a = await semearFamilia(banco.sql, 'Ana');
    b = await semearFamilia(banco.sql, 'Bruno');
    // `banco.sql` tem max: 1 — se a UoW não devolver a conexão, o próximo teste trava.
    db = drizzle(banco.sql);
    observador = conectar(banco.url);
  });

  afterAll(async () => {
    await observador?.end();
    await banco?.descartar();
  });

  const reposReais: CriarRepos = criarRepositoriosTransacaoDrizzle;

  function servico(criarRepos: CriarRepos = reposReais, cofrinhoHandler?: CofrinhoHandler) {
    return new TransacaoService(
      // Leituras fora da unidade; com o mesmo repositório as escritas também seriam sabotadas.
      criarRepos(db).transacoes,
      new ReferenciasSempreValidasFake(),
      new DrizzleUnitOfWork(db, criarRepos),
      undefined,
      cofrinhoHandler,
    );
  }

  function entrada(extra: Partial<RegistrarTransacaoInput>): RegistrarTransacaoInput {
    return {
      familiaId: a.familiaId,
      tipo: 'despesa',
      valor: '600.00',
      categoriaId: a.categoriaId,
      data: '2026-01-10',
      usuarioRegistrouId: a.usuarioId,
      ...extra,
    };
  }

  /** Contagem por outra conexão: só enxerga o que foi de fato commitado. */
  async function linhasDeA(): Promise<number> {
    const [linha] = await observador`SELECT count(*)::int AS total FROM transacoes
      WHERE familia_id = ${a.familiaId}`;
    return linha?.total as number;
  }

  async function transacoesPendentes(): Promise<number> {
    const [linha] = await observador`SELECT count(*)::int AS total FROM pg_stat_activity
      WHERE datname = current_database() AND state LIKE 'idle in transaction%'`;
    return linha?.total as number;
  }

  it('sucesso: grava pai + 5 parcelas no mesmo commit, todas apontando para o pai da família', async () => {
    const antes = await linhasDeA();

    const pai = await servico().registrar(entrada({ parcelado: true, numeroParcelas: 6 }));

    const filhas = await observador`SELECT familia_id, parcela_atual, mes_referencia
      FROM transacoes WHERE transacao_pai_id = ${pai.id} ORDER BY parcela_atual`;
    expect(await linhasDeA()).toBe(antes + 6);
    expect(filhas.map((f) => f.parcela_atual)).toEqual([2, 3, 4, 5, 6]);
    expect(filhas.every((f) => f.familia_id === a.familiaId)).toBe(true);
    expect(filhas.map((f) => f.mes_referencia)).toEqual([
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
    ]);
  });

  it('violação real de FK na 4ª parcela desfaz pai e todas as parcelas', async () => {
    const antes = await linhasDeA();
    const sabotado: CriarRepos = (tx) => ({
      ...criarRepositoriosTransacaoDrizzle(tx),
      transacoes: new DrizzleTransacaoRepositoryComFilhaEstrangeira(tx, 4, b.categoriaId),
    });

    const erro = await servico(sabotado)
      .registrar(entrada({ parcelado: true, numeroParcelas: 6, descricao: 'rollback-parcelas' }))
      .catch((e: unknown) => e);

    // O erro do driver atravessa a UoW intacto e segue traduzível para 422.
    expect(traduzirViolacaoReferencia(erro)).toBeInstanceOf(ReferenciaInvalidaError);
    expect(await linhasDeA()).toBe(antes);
    const orfas = await observador`SELECT id FROM transacoes WHERE descricao = 'rollback-parcelas'`;
    expect(orfas).toHaveLength(0);
    expect(await transacoesPendentes()).toBe(0);
  });

  it('falha do cofrinhoHandler na 3ª recorrência desfaz a série inteira', async () => {
    const antes = await linhasDeA();
    const handler = new CofrinhoHandlerQueFalhaNaChamada(3);

    await expect(
      servico(reposReais, handler).registrar(
        entrada({
          recorrente: true,
          frequencia: 'mensal',
          dataFimRecorrencia: '2026-06-10',
          cofrinhoId: a.cofrinhoId,
        }),
      ),
    ).rejects.toThrow('chamada nº 3');

    expect(handler.processadas).toHaveLength(2);
    expect(await linhasDeA()).toBe(antes);
  });

  it('dentro da unidade outra conexão não vê nada; o efeito pós-commit já vê tudo', async () => {
    const uow = new DrizzleUnitOfWork(db, reposReais);
    const antes = await linhasDeA();
    const vistos: Record<string, number> = {};

    await uow.executar(async ({ repos, aoConfirmar }) => {
      await repos.transacoes.create({ ...entrada({}), mesReferencia: '2026-01' });
      vistos.duranteTransacao = await linhasDeA();
      aoConfirmar(async () => {
        vistos.posCommit = await linhasDeA();
      });
    });

    expect(vistos).toEqual({ duranteTransacao: antes, posCommit: antes + 1 });
  });

  it('libera a conexão em sucesso e erro, e bloqueia o repositório após o fim', async () => {
    const uow = new DrizzleUnitOfWork(db, reposReais);
    let capturado: TransacaoRepositorios['transacoes'] | undefined;

    await expect(
      uow.executar(async ({ repos }) => {
        capturado = repos.transacoes;
        throw new Error('abortar');
      }),
    ).rejects.toThrow('abortar');

    expect(await transacoesPendentes()).toBe(0);
    // Pool de 1 conexão: esta query só roda se a transação abortada devolveu a conexão.
    await expect(
      dentroDoPrazo(db.execute('SELECT 1'), 'conexão não liberada pela UoW'),
    ).resolves.toBeDefined();
    await expect(capturado?.list({ familiaId: a.familiaId })).rejects.toThrow(
      UnidadeDeTrabalhoEncerradaError,
    );
  });

  it('executar aninhado é recusado sem abrir 2ª transação (evita deadlock no pool) e desfaz a externa', async () => {
    const uow = new DrizzleUnitOfWork(db, reposReais);
    const antes = await linhasDeA();

    const aninhada = uow.executar(async ({ repos }) => {
      await repos.transacoes.create({ ...entrada({}), mesReferencia: '2026-01' });
      await uow.executar(async ({ repos: internos }) =>
        internos.transacoes.create({ ...entrada({}), mesReferencia: '2026-01' }),
      );
    });

    await expect(
      dentroDoPrazo(aninhada, 'unidade aninhada travou esperando conexão do pool'),
    ).rejects.toThrow(UnidadeDeTrabalhoAninhadaError);
    expect(await linhasDeA()).toBe(antes);
    expect(await transacoesPendentes()).toBe(0);
  });
});
