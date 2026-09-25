import { drizzle } from 'drizzle-orm/postgres-js';
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  BarreiraDeTeste,
  FalhaInjetadaError,
  type PontoDeFalha,
} from '../../modules/cofrinho/cofrinho.fakes.js';
import type { ResultadoMovimentacao } from '../../modules/cofrinho/cofrinho.types.js';
import { TransacaoService } from '../../modules/transacao/transacao.service.js';
import type { Transacao } from '../../modules/transacao/transacao.types.js';
import { criarRepositoriosTransacaoDrizzle } from '../../modules/transacao/transacao.unit-of-work.js';
import { DrizzleIdempotenciaRepository } from '../../shared/idempotencia/idempotencia.repository.js';
import type {
  OpcoesIdempotencia,
  PedidoIdempotente,
  ResultadoReserva,
} from '../../shared/idempotencia/idempotencia.types.js';
import { ReferenciasSempreValidasFake } from '../../shared/referencia-ownership/referencia-ownership.fakes.js';
import { DrizzleUnitOfWork } from '../../shared/unit-of-work/drizzle-unit-of-work.js';
import type { ExecutorDrizzle } from '../executor.types.js';
import {
  clienteCofrinho,
  esperandoLock,
  estadoCofrinho,
  semearCategoriaCofrinho,
  transacoesPendentes,
  type ClienteCofrinho,
} from './pg-cofrinho.js';
import { semearFamilia, type FamiliaSemeada } from './pg-fixtures.js';
import {
  aplicarMigrations,
  aplicarMigrationsAntesDe,
  conectar,
  criarBancoDescartavel,
  migrationsAPartirDe,
  type BancoDescartavel,
} from './pg-harness.js';

/**
 * Idempotência no PostgreSQL real (#90): a 2ª requisição com a mesma chave
 * espera no índice único (familia_id, chave) até a 1ª confirmar (→ replay) ou
 * desfazer (→ executa ela). Corridas determinísticas: a 1ª pausa numa barreira
 * logo após reservar a chave, e só é liberada quando o banco mostra a 2ª
 * esperando lock. Várias rodadas para expor flakiness.
 */
const RODADAS = [1, 2, 3];
const MIGRATION_0011 = '0011_chaves_idempotencia';

let sequencial = 0;
const novaChave = () => `chave-pg-${Date.now()}-${++sequencial}`;

/** Fake nomeada: repositório real que pausa numa barreira logo APÓS reservar (dentro do tx). */
class IdempotenciaQuePausaAposReservar extends DrizzleIdempotenciaRepository {
  constructor(
    executor: ExecutorDrizzle,
    private readonly barreira: BarreiraDeTeste | null,
  ) {
    super(executor);
  }

  override async reservar(pedido: PedidoIdempotente): Promise<ResultadoReserva> {
    const reserva = await super.reservar(pedido);
    if (this.barreira) await this.barreira.alcancar();
    return reserva;
  }
}

function servicoTransacao(conexao: postgres.Sql, barreira: BarreiraDeTeste | null = null) {
  const db = drizzle(conexao);
  const uow = new DrizzleUnitOfWork(db, (tx: ExecutorDrizzle) => ({
    ...criarRepositoriosTransacaoDrizzle(tx),
    idempotencia: new IdempotenciaQuePausaAposReservar(tx, barreira),
  }));
  return new TransacaoService(
    criarRepositoriosTransacaoDrizzle(db).transacoes,
    new ReferenciasSempreValidasFake(),
    uow,
  );
}

function opcoes<T>(pedido: PedidoIdempotente, statusCode = 201): OpcoesIdempotencia<T> {
  return { pedido, responder: (valor) => ({ statusCode, corpo: { valor } }) };
}

describe('Idempotência no PostgreSQL', () => {
  let banco: BancoDescartavel;
  let observador: postgres.Sql;
  let conexaoA: postgres.Sql;
  let conexaoB: postgres.Sql;
  let ana: FamiliaSemeada;
  let bruno: FamiliaSemeada;

  beforeAll(async () => {
    banco = await criarBancoDescartavel();
    await aplicarMigrations(banco.url);
    ana = await semearFamilia(banco.sql, 'Ana');
    bruno = await semearFamilia(banco.sql, 'Bruno');
    await semearCategoriaCofrinho(banco.sql, ana);
    observador = conectar(banco.url);
    conexaoA = conectar(banco.url);
    conexaoB = conectar(banco.url);
  });

  afterAll(async () => {
    await Promise.all([observador?.end(), conexaoA?.end(), conexaoB?.end()]);
    await banco?.descartar();
  });

  const pedidoDe = (f: FamiliaSemeada, chave: string, hashPayload = 'hash-1') => ({
    familiaId: f.familiaId,
    chave,
    operacao: 'POST /api/transacoes',
    hashPayload,
  });

  const parceladaDe = (f: FamiliaSemeada) => ({
    familiaId: f.familiaId,
    tipo: 'despesa' as const,
    valor: '300.00',
    categoriaId: f.categoriaId,
    data: '2026-03-10',
    usuarioRegistrouId: f.usuarioId,
    parcelado: true,
    numeroParcelas: 3,
  });

  async function transacoesDa(f: FamiliaSemeada): Promise<number> {
    const [linha] = await observador`SELECT count(*)::int AS n FROM transacoes
      WHERE familia_id = ${f.familiaId}`;
    return linha?.n as number;
  }

  async function chaveGravada(f: FamiliaSemeada, chave: string) {
    const [linha] = await observador`SELECT status_code, jsonb_typeof(resposta) AS tipo_resposta
      FROM chaves_idempotencia WHERE familia_id = ${f.familiaId} AND chave = ${chave}`;
    return linha ?? null;
  }

  describe('POST /transacoes concorrente com a mesma chave', () => {
    it.each(RODADAS)(
      'rodada %i: exatamente uma execução; a outra espera o commit e recebe replay',
      async () => {
        const chave = novaChave();
        const barreira = new BarreiraDeTeste();
        const antes = await transacoesDa(ana);

        const primeira = servicoTransacao(conexaoA, barreira).registrarIdempotente(
          parceladaDe(ana),
          opcoes<Transacao>(pedidoDe(ana, chave)),
        );
        await barreira.alcancada;
        const segunda = servicoTransacao(conexaoB).registrarIdempotente(
          parceladaDe(ana),
          opcoes<Transacao>(pedidoDe(ana, chave)),
        );
        await expect.poll(() => esperandoLock(observador), { timeout: 5_000 }).toBe(1);
        barreira.liberar();
        const [r1, r2] = await Promise.all([primeira, segunda]);

        expect(r1.tipo).toBe('executada');
        expect(r2.tipo).toBe('repetida');
        const pai = r1.tipo === 'executada' ? r1.valor : null;
        expect(r2).toMatchObject({
          resposta: { statusCode: 201, corpo: { valor: { id: pai?.id } } },
        });
        expect(await transacoesDa(ana)).toBe(antes + 3);
        expect(await chaveGravada(ana, chave)).toEqual({
          status_code: 201,
          tipo_resposta: 'object',
        });
        expect(await transacoesPendentes(observador)).toBe(0);
      },
    );

    it('mesma chave concorrente com payload diferente: a 2ª recebe conflito, nada a mais gravado', async () => {
      const chave = novaChave();
      const barreira = new BarreiraDeTeste();
      const antes = await transacoesDa(ana);

      const primeira = servicoTransacao(conexaoA, barreira).registrarIdempotente(
        parceladaDe(ana),
        opcoes<Transacao>(pedidoDe(ana, chave)),
      );
      await barreira.alcancada;
      const segunda = servicoTransacao(conexaoB)
        .registrarIdempotente(
          { ...parceladaDe(ana), valor: '999.00' },
          opcoes<Transacao>(pedidoDe(ana, chave, 'hash-2')),
        )
        .catch((e: unknown) => e);
      await expect.poll(() => esperandoLock(observador), { timeout: 5_000 }).toBe(1);
      barreira.liberar();

      await primeira;
      expect(await segunda).toMatchObject({ code: 'IDEMPOTENCIA_CONFLITO' });
      expect(await transacoesDa(ana)).toBe(antes + 3);
    });

    it.each(RODADAS)(
      'rodada %i: chave EXPIRADA reaproveitada concorrentemente (DO UPDATE) — só uma execução assume',
      async () => {
        const chave = novaChave();
        await banco.sql`INSERT INTO chaves_idempotencia
          (familia_id, chave, operacao, hash_payload, status_code, resposta, criado_em)
          VALUES (${ana.familiaId}, ${chave}, 'POST /api/antiga', 'hash-antigo', 201,
            '{"antiga": true}'::jsonb, now() - interval '25 hours')`;
        const barreira = new BarreiraDeTeste();
        const antes = await transacoesDa(ana);

        const primeira = servicoTransacao(conexaoA, barreira).registrarIdempotente(
          parceladaDe(ana),
          opcoes<Transacao>(pedidoDe(ana, chave)),
        );
        await barreira.alcancada;
        const segunda = servicoTransacao(conexaoB).registrarIdempotente(
          parceladaDe(ana),
          opcoes<Transacao>(pedidoDe(ana, chave)),
        );
        await expect.poll(() => esperandoLock(observador), { timeout: 5_000 }).toBe(1);
        barreira.liberar();
        const [r1, r2] = await Promise.all([primeira, segunda]);

        expect([r1.tipo, r2.tipo]).toEqual(['executada', 'repetida']);
        const pai = r1.tipo === 'executada' ? r1.valor : null;
        expect(r2).toMatchObject({ resposta: { corpo: { valor: { id: pai?.id } } } });
        expect(await transacoesDa(ana)).toBe(antes + 3);
        const [linha] =
          await observador`SELECT operacao, hash_payload, resposta ? 'antiga' AS antiga,
            criado_em > now() - interval '1 minute' AS renovada
          FROM chaves_idempotencia WHERE familia_id = ${ana.familiaId} AND chave = ${chave}`;
        expect(linha).toEqual({
          operacao: 'POST /api/transacoes',
          hash_payload: 'hash-1',
          antiga: false,
          renovada: true,
        });
      },
    );

    it('mesma chave em famílias diferentes não se bloqueiam nem se repetem', async () => {
      const chave = novaChave();

      const [a, b] = await Promise.all([
        servicoTransacao(conexaoA).registrarIdempotente(
          parceladaDe(ana),
          opcoes<Transacao>(pedidoDe(ana, chave)),
        ),
        servicoTransacao(conexaoB).registrarIdempotente(
          parceladaDe(bruno),
          opcoes<Transacao>(pedidoDe(bruno, chave)),
        ),
      ]);

      expect([a.tipo, b.tipo]).toEqual(['executada', 'executada']);
      expect(await chaveGravada(ana, chave)).not.toBeNull();
      expect(await chaveGravada(bruno, chave)).not.toBeNull();
    });
  });

  describe('aporte (wiring de produção do cofrinho)', () => {
    async function cofrinhoNovo(): Promise<string> {
      const [linha] = await banco.sql`INSERT INTO cofrinhos (familia_id, nome, criado_por)
        VALUES (${ana.familiaId}, 'Idem', ${ana.usuarioId}) RETURNING id`;
      return linha?.id as string;
    }

    const aportar = (cliente: ClienteCofrinho, cofrinhoId: string, pedido: PedidoIdempotente) =>
      cliente.service.aportarIdempotente(
        { cofrinhoId, familiaId: ana.familiaId, valor: '50.00', registradoPor: ana.usuarioId },
        opcoes<ResultadoMovimentacao>(pedido),
      );

    const pedidoAporte = (chave: string) => ({
      ...pedidoDe(ana, chave),
      operacao: 'POST /api/cofrinhos/:id/aportes',
    });

    it.each<PontoDeFalha>([
      'idempotencia.reservar',
      'movimentacoes.create',
      'idempotencia.gravarResposta',
    ])(
      'falha após %s: rollback remove saldo, ledger E a chave; retry com a mesma chave executa',
      async (ponto) => {
        const cofrinhoId = await cofrinhoNovo();
        const chave = novaChave();
        const cliente = clienteCofrinho(conexaoA);
        cliente.instrumentada.falharApos(ponto);

        await expect(aportar(cliente, cofrinhoId, pedidoAporte(chave))).rejects.toBeInstanceOf(
          FalhaInjetadaError,
        );
        expect(await chaveGravada(ana, chave)).toBeNull();
        expect(await estadoCofrinho(observador, cofrinhoId)).toMatchObject({
          saldo: '0.00',
          aportes: 0,
        });

        const retry = await aportar(clienteCofrinho(conexaoA), cofrinhoId, pedidoAporte(chave));
        expect(retry.tipo).toBe('executada');
        expect(await estadoCofrinho(observador, cofrinhoId)).toMatchObject({
          saldo: '50.00',
          aportes: 1,
        });
      },
    );

    it.each(RODADAS)(
      'rodada %i: a 1ª falha depois de reservar; a 2ª (esperando no índice) executa ela mesma',
      async () => {
        const cofrinhoId = await cofrinhoNovo();
        const chave = novaChave();
        const primeira = clienteCofrinho(conexaoA);
        const barreira = new BarreiraDeTeste();
        primeira.instrumentada.pausarApos('idempotencia.reservar', barreira);
        primeira.instrumentada.falharApos('idempotencia.reservar');

        const r1 = aportar(primeira, cofrinhoId, pedidoAporte(chave)).catch((e: unknown) => e);
        await barreira.alcancada;
        const r2 = aportar(clienteCofrinho(conexaoB), cofrinhoId, pedidoAporte(chave));
        await expect.poll(() => esperandoLock(observador), { timeout: 5_000 }).toBe(1);
        barreira.liberar();

        expect(await r1).toBeInstanceOf(FalhaInjetadaError);
        expect((await r2).tipo).toBe('executada');
        expect(await estadoCofrinho(observador, cofrinhoId)).toMatchObject({
          saldo: '50.00',
          aportes: 1,
        });
        expect(await chaveGravada(ana, chave)).toEqual({
          status_code: 201,
          tipo_resposta: 'object',
        });
      },
    );
  });

  describe('restrições e limpeza', () => {
    it('CHECK recusa resposta não-2xx e status sem corpo', async () => {
      await expect(
        banco.sql`INSERT INTO chaves_idempotencia (familia_id, chave, operacao, hash_payload, status_code, resposta)
          VALUES (${ana.familiaId}, ${novaChave()}, 'POST /x', 'h', 400, '{}'::jsonb)`,
      ).rejects.toThrow(/chaves_idempotencia_resposta_2xx/);
      await expect(
        banco.sql`INSERT INTO chaves_idempotencia (familia_id, chave, operacao, hash_payload, status_code)
          VALUES (${ana.familiaId}, ${novaChave()}, 'POST /x', 'h', 201)`,
      ).rejects.toThrow(/chaves_idempotencia_resposta_2xx/);
    });

    it('chave expirada: removerExpiradas apaga só fora da janela; reservar a reaproveita', async () => {
      const [antiga, recente, reaproveitada] = [novaChave(), novaChave(), novaChave()];
      await banco.sql`INSERT INTO chaves_idempotencia
        (familia_id, chave, operacao, hash_payload, status_code, resposta, criado_em) VALUES
        (${ana.familiaId}, ${antiga}, 'POST /x', 'h', 201, '{}'::jsonb, now() - interval '25 hours'),
        (${ana.familiaId}, ${recente}, 'POST /x', 'h', 201, '{}'::jsonb, now() - interval '23 hours'),
        (${ana.familiaId}, ${reaproveitada}, 'POST /x', 'h', 201, '{}'::jsonb, now() - interval '25 hours')`;
      const repo = new DrizzleIdempotenciaRepository(drizzle(conexaoA));

      expect(
        await repo.reservar({ ...pedidoDe(ana, reaproveitada), hashPayload: 'outro' }),
      ).toEqual({
        reservada: true,
      });
      expect(await repo.removerExpiradas()).toBeGreaterThanOrEqual(1);
      expect(await chaveGravada(ana, antiga)).toBeNull();
      expect(await chaveGravada(ana, recente)).not.toBeNull();
    });
  });
});

describe('Migration 0011 sobre dados existentes', () => {
  let banco: BancoDescartavel;

  beforeAll(async () => {
    banco = await criarBancoDescartavel();
  });

  afterAll(async () => {
    await banco?.descartar();
  });

  it('aplica sobre um banco com famílias e transações sem alterar dados legados', async () => {
    await aplicarMigrationsAntesDe(banco.url, MIGRATION_0011);
    const legado = await semearFamilia(banco.sql, 'Legado');
    const [antes] = await banco.sql`SELECT count(*)::int AS n FROM transacoes`;
    expect(migrationsAPartirDe(MIGRATION_0011)).toBe(1);

    await aplicarMigrations(banco.url);

    const [depois] = await banco.sql`SELECT count(*)::int AS n FROM transacoes`;
    expect(depois?.n).toBe(antes?.n);
    await banco.sql`INSERT INTO chaves_idempotencia (familia_id, chave, operacao, hash_payload)
      VALUES (${legado.familiaId}, 'chave-legado', 'POST /x', 'h')`;
    await expect(
      banco.sql`INSERT INTO chaves_idempotencia (familia_id, chave, operacao, hash_payload)
        VALUES (${legado.familiaId}, 'chave-legado', 'POST /x', 'h')`,
    ).rejects.toThrow(/chaves_idempotencia_pk/);
    await expect(
      banco.sql`INSERT INTO chaves_idempotencia (familia_id, chave, operacao, hash_payload)
        VALUES ('00000000-0000-0000-0000-000000000000', 'orfa-0001', 'POST /x', 'h')`,
    ).rejects.toThrow(/chaves_idempotencia_familia_id_familias_id_fk/);
  });
});
