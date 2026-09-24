import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  CofrinhoEncerradoError,
  CofrinhoNotFoundError,
  SaldoInsuficienteError,
} from '../../modules/cofrinho/cofrinho.errors.js';
import {
  BarreiraDeTeste,
  FalhaInjetadaError,
  type PontoDeFalha,
} from '../../modules/cofrinho/cofrinho.fakes.js';
import { aportarNoEscopo } from '../../modules/cofrinho/cofrinho.operacoes.js';
import { ConflitoDeConcorrenciaError } from '../../shared/unit-of-work/conflito-concorrencia.js';
import {
  clienteCofrinho,
  diagnosticoReconciliacao,
  esperandoLock,
  estadoCofrinho,
  semearCategoriaCofrinho,
  transacoesPendentes,
  type ClienteCofrinho,
} from './pg-cofrinho.js';
import { semearFamilia, type FamiliaSemeada } from './pg-fixtures.js';
import {
  aplicarMigrations,
  conectar,
  criarBancoDescartavel,
  type BancoDescartavel,
} from './pg-harness.js';

/**
 * Atomicidade e concorrência de cofrinhos no PostgreSQL real (#59–#63), com o
 * wiring de produção. Corridas são determinísticas: a 1ª operação pausa numa
 * barreira DEPOIS de travar a linha e a 2ª só é liberada quando o banco
 * mostra que ela está esperando o lock. Casos de corrida rodam várias vezes
 * (`RODADAS`) para expor flakiness; cada rodada usa um cofrinho novo.
 */
const RODADAS = [1, 2, 3, 4, 5];

type Resultado = PromiseSettledResult<unknown>;

const rejeitadas = (resultados: Resultado[]) =>
  resultados.filter((r): r is PromiseRejectedResult => r.status === 'rejected');

describe('Cofrinho atômico no PostgreSQL', () => {
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
    await semearCategoriaCofrinho(banco.sql, bruno);
    observador = conectar(banco.url);
    conexaoA = conectar(banco.url);
    conexaoB = conectar(banco.url);
  });

  afterAll(async () => {
    await Promise.all([observador?.end(), conexaoA?.end(), conexaoB?.end()]);
    await banco?.descartar();
  });

  const clientes = () => ({ a: clienteCofrinho(conexaoA), b: clienteCofrinho(conexaoB) });

  /** Cofrinho novo da família com saldo vindo de um aporte real (ledger consistente). */
  async function novoCofrinho(saldo: string | null, familia = ana): Promise<string> {
    const { service } = clienteCofrinho(banco.sql);
    const { id } = await service.criar({
      familiaId: familia.familiaId,
      nome: 'Reserva',
      criadoPor: familia.usuarioId,
    });
    if (saldo) await aportar({ service } as ClienteCofrinho, id, saldo, familia);
    return id;
  }

  function aportar(cliente: ClienteCofrinho, cofrinhoId: string, valor: string, familia = ana) {
    return cliente.service.aportar({
      cofrinhoId,
      familiaId: familia.familiaId,
      valor,
      registradoPor: familia.usuarioId,
    });
  }

  function retirar(cliente: ClienteCofrinho, cofrinhoId: string, valor: string, familia = ana) {
    return cliente.service.retirar({
      cofrinhoId,
      familiaId: familia.familiaId,
      valor,
      voltarAoSaldo: true,
      registradoPor: familia.usuarioId,
    });
  }

  function encerrar(cliente: ClienteCofrinho, id: string, familia = ana) {
    return cliente.service.encerrar({
      id,
      familiaId: familia.familiaId,
      voltarAoSaldo: true,
      registradoPor: familia.usuarioId,
    });
  }

  /**
   * `primeira` pausa após `ponto` segurando o lock; `segunda` é disparada e só
   * então a barreira abre — a 2ª operação sempre encontra a linha travada.
   */
  async function corrida(
    primeira: ClienteCofrinho,
    ponto: PontoDeFalha,
    operacaoPrimeira: () => Promise<unknown>,
    operacaoSegunda: () => Promise<unknown>,
  ): Promise<[Resultado, Resultado]> {
    const barreira = new BarreiraDeTeste();
    primeira.instrumentada.pausarApos(ponto, barreira);
    const resultadoPrimeira = Promise.allSettled([operacaoPrimeira()]);
    await barreira.alcancada;
    const resultadoSegunda = Promise.allSettled([operacaoSegunda()]);
    await expect.poll(() => esperandoLock(observador), { timeout: 5_000 }).toBe(1);
    barreira.liberar();
    const [[r1], [r2]] = await Promise.all([resultadoPrimeira, resultadoSegunda]);
    return [r1, r2];
  }

  async function semEstadoPendente(cofrinhoId: string) {
    const estado = await estadoCofrinho(observador, cofrinhoId);
    expect(estado.saldo).toBe(estado.saldoLedger);
    expect(Number(estado.saldo)).toBeGreaterThanOrEqual(0);
    expect(await transacoesPendentes(observador)).toBe(0);
    return estado;
  }

  describe('retiradas concorrentes sobre saldo único', () => {
    it.each(RODADAS)(
      'rodada %i (barreira): exatamente uma passa, a outra recebe saldo insuficiente',
      async () => {
        const cofrinhoId = await novoCofrinho('100.00');
        const { a, b } = clientes();

        const resultados = await corrida(
          a,
          'cofrinhos.decrementarSaldo',
          () => retirar(a, cofrinhoId, '100.00'),
          () => retirar(b, cofrinhoId, '100.00'),
        );

        expect(resultados.map((r) => r.status)).toEqual(['fulfilled', 'rejected']);
        expect(rejeitadas(resultados)[0]?.reason).toBeInstanceOf(SaldoInsuficienteError);
        expect(await semEstadoPendente(cofrinhoId)).toMatchObject({
          saldo: '0.00',
          aportes: 1,
          retiradas: 1,
          transacoes: 2, // despesa do aporte + UMA receita de retorno
        });
      },
    );

    it.each(RODADAS)(
      'rodada %i (disparo simultâneo): nunca duas retiradas do mesmo saldo',
      async () => {
        const cofrinhoId = await novoCofrinho('60.00');
        const { a, b } = clientes();

        const resultados = await Promise.allSettled([
          retirar(a, cofrinhoId, '50.00'),
          retirar(b, cofrinhoId, '50.00'),
        ]);

        expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
        expect(rejeitadas(resultados)[0]?.reason).toBeInstanceOf(SaldoInsuficienteError);
        expect(await semEstadoPendente(cofrinhoId)).toMatchObject({ saldo: '10.00', retiradas: 1 });
      },
    );
  });

  describe('aportes concorrentes', () => {
    it.each(RODADAS)('rodada %i (barreira): os dois aportes somam', async () => {
      const cofrinhoId = await novoCofrinho(null);
      const { a, b } = clientes();

      const resultados = await corrida(
        a,
        'cofrinhos.incrementarSaldo',
        () => aportar(a, cofrinhoId, '10.25'),
        () => aportar(b, cofrinhoId, '20.50'),
      );

      expect(resultados.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
      expect(await semEstadoPendente(cofrinhoId)).toMatchObject({
        saldo: '30.75',
        aportes: 2,
        transacoes: 2,
      });
    });

    it('rajada: 2 conexões × 10 aportes simultâneos somam todos, sem lost update', async () => {
      const cofrinhoId = await novoCofrinho(null);
      const { a, b } = clientes();
      const lote = (cliente: ClienteCofrinho) =>
        Array.from({ length: 10 }, () => aportar(cliente, cofrinhoId, '1.10'));

      await Promise.all([...lote(a), ...lote(b)]);

      expect(await semEstadoPendente(cofrinhoId)).toMatchObject({ saldo: '22.00', aportes: 20 });
    });
  });

  it.each(RODADAS)(
    'rodada %i: retirada concorrente a um encerramento vê o cofrinho encerrado',
    async () => {
      const cofrinhoId = await novoCofrinho('80.00');
      const { a, b } = clientes();

      const [encerramento, retirada] = await corrida(
        a,
        'cofrinhos.bloquearParaAtualizacao',
        () => encerrar(a, cofrinhoId),
        () => retirar(b, cofrinhoId, '10.00'),
      );

      expect(encerramento.status).toBe('fulfilled');
      expect(rejeitadas([retirada])[0]?.reason).toBeInstanceOf(CofrinhoEncerradoError);
      expect(await semEstadoPendente(cofrinhoId)).toMatchObject({
        saldo: '0.00',
        status: 'encerrado',
        retiradas: 1,
      });
    },
  );

  describe('falha injetada após cada escrita reverte tudo (rollback real)', () => {
    const cenarios: Array<
      [string, PontoDeFalha[], (c: ClienteCofrinho, id: string) => Promise<unknown>]
    > = [
      [
        'aporte',
        ['cofrinhos.incrementarSaldo', 'transacoes.create', 'movimentacoes.create'],
        (c, id) => aportar(c, id, '5.00'),
      ],
      [
        'retirada com retorno',
        ['cofrinhos.decrementarSaldo', 'transacoes.create', 'movimentacoes.create'],
        (c, id) => retirar(c, id, '5.00'),
      ],
      [
        'encerramento com retorno',
        [
          'cofrinhos.decrementarSaldo',
          'transacoes.create',
          'movimentacoes.create',
          'cofrinhos.encerrar',
        ],
        (c, id) => encerrar(c, id),
      ],
    ];

    describe.each(cenarios)('%s', (_nome, pontos, operacao) => {
      it.each(pontos)('falha após %s: saldo, ledger e transações iguais a antes', async (ponto) => {
        const cofrinhoId = await novoCofrinho('50.00');
        const antes = await estadoCofrinho(observador, cofrinhoId);
        const { a } = clientes();
        a.instrumentada.falharApos(ponto);

        await expect(operacao(a, cofrinhoId)).rejects.toBeInstanceOf(FalhaInjetadaError);

        expect(await semEstadoPendente(cofrinhoId)).toEqual(antes);
      });
    });
  });

  describe('saldo e família', () => {
    it('retirada do saldo exato zera; um centavo a mais é recusado sem efeitos', async () => {
      const cofrinhoId = await novoCofrinho('33.33');
      const { a } = clientes();

      await expect(retirar(a, cofrinhoId, '33.34')).rejects.toBeInstanceOf(SaldoInsuficienteError);
      await retirar(a, cofrinhoId, '33.33');

      expect(await semEstadoPendente(cofrinhoId)).toMatchObject({
        saldo: '0.00',
        retiradas: 1,
        transacoes: 2,
      });
    });

    it.each([
      ['aporte', (c: ClienteCofrinho, id: string, f: FamiliaSemeada) => aportar(c, id, '1.00', f)],
      [
        'retirada',
        (c: ClienteCofrinho, id: string, f: FamiliaSemeada) => retirar(c, id, '1.00', f),
      ],
      ['encerramento', (c: ClienteCofrinho, id: string, f: FamiliaSemeada) => encerrar(c, id, f)],
    ])(
      '%s com a família B no cofrinho da família A: não encontrado e nada muda',
      async (_n, operacao) => {
        const cofrinhoDeAna = await novoCofrinho('20.00');
        const antes = await estadoCofrinho(observador, cofrinhoDeAna);
        const [{ total: transacoesDeBrunoAntes }] = await observador`
        SELECT count(*)::int AS total FROM transacoes WHERE familia_id = ${bruno.familiaId}`;

        await expect(operacao(clientes().b, cofrinhoDeAna, bruno)).rejects.toBeInstanceOf(
          CofrinhoNotFoundError,
        );

        expect(await semEstadoPendente(cofrinhoDeAna)).toEqual(antes);
        const [{ total }] = await observador`
        SELECT count(*)::int AS total FROM transacoes WHERE familia_id = ${bruno.familiaId}`;
        expect(total).toBe(transacoesDeBrunoAntes);
      },
    );

    it('CHECK no banco rejeita saldo negativo mesmo por UPDATE direto', async () => {
      const cofrinhoId = await novoCofrinho('1.00');

      await expect(
        observador`UPDATE cofrinhos SET saldo_atual = saldo_atual - 1.01 WHERE id = ${cofrinhoId}`,
      ).rejects.toMatchObject({
        code: '23514',
        constraint_name: 'cofrinhos_saldo_atual_nao_negativo',
      });
      expect((await estadoCofrinho(observador, cofrinhoId)).saldo).toBe('1.00');
    });
  });

  describe('conflitos viram erro de domínio tratável', () => {
    it('lock_timeout: linha travada por outra transação → ConflitoDeConcorrenciaError, nada gravado', async () => {
      const cofrinhoId = await novoCofrinho('10.00');
      const antes = await estadoCofrinho(observador, cofrinhoId);
      const segurador = conectar(banco.url);
      const travou = new BarreiraDeTeste();
      const soltar = new BarreiraDeTeste();
      const segurando = segurador.begin(async (tx) => {
        await tx.unsafe('SELECT 1 FROM cofrinhos WHERE id = $1 FOR UPDATE', [cofrinhoId]);
        void travou.alcancar(); // só sinaliza que o lock está seguro
        await soltar.alcancar();
      });
      await travou.alcancada;

      const inicio = Date.now();
      const erro = await retirar(clienteCofrinho(conexaoA, 300), cofrinhoId, '1.00').catch(
        (e: unknown) => e,
      );
      const duracaoMs = Date.now() - inicio;
      soltar.liberar();
      await segurando;
      await segurador.end();

      expect(erro).toBeInstanceOf(ConflitoDeConcorrenciaError);
      expect((erro as ConflitoDeConcorrenciaError).sqlstate).toBe('55P03');
      expect((erro as Error).message).not.toMatch(/cofrinhos|UPDATE|SELECT/i);
      expect(duracaoMs).toBeLessThan(5_000);
      expect(await semEstadoPendente(cofrinhoId)).toEqual(antes);
    });

    it('deadlock entre aportes em ordem cruzada: um confirma, o outro vira conflito sem escrita parcial', async () => {
      const x = await novoCofrinho(null);
      const y = await novoCofrinho(null);
      const { a, b } = clientes();
      const barreiraA = new BarreiraDeTeste();
      const barreiraB = new BarreiraDeTeste();
      a.instrumentada.pausarApos('cofrinhos.incrementarSaldo', barreiraA);
      b.instrumentada.pausarApos('cofrinhos.incrementarSaldo', barreiraB);
      const aporteNaOrdem = (cliente: ClienteCofrinho, ordem: string[]) =>
        cliente.instrumentada.executar(async ({ repos }) => {
          for (const cofrinhoId of ordem) {
            await aportarNoEscopo(repos, {
              cofrinhoId,
              familiaId: ana.familiaId,
              valor: '7.00',
              descricao: null,
              registradoPor: ana.usuarioId,
              mesReferencia: '2026-09',
              data: '2026-09-01',
              categoriaId: ana.categoriaId,
            });
          }
        });

      const resultados = Promise.allSettled([aporteNaOrdem(a, [x, y]), aporteNaOrdem(b, [y, x])]);
      await Promise.all([barreiraA.alcancada, barreiraB.alcancada]);
      barreiraA.liberar();
      barreiraB.liberar();
      const [ra, rb] = await resultados;

      expect([ra.status, rb.status].sort()).toEqual(['fulfilled', 'rejected']);
      const conflito = rejeitadas([ra, rb])[0]?.reason as ConflitoDeConcorrenciaError;
      expect(conflito).toBeInstanceOf(ConflitoDeConcorrenciaError);
      expect(conflito.sqlstate).toBe('40P01');
      expect(await semEstadoPendente(x)).toMatchObject({ saldo: '7.00', aportes: 1 });
      expect(await semEstadoPendente(y)).toMatchObject({ saldo: '7.00', aportes: 1 });
    });
  });

  describe('diagnóstico SQL de reconciliação (arquivo real)', () => {
    // Deltas sobre uma leitura de base: independe do que outros testes deixaram no banco.
    it('aporte, retirada e encerramento reais não criam divergência nem saldo negativo', async () => {
      const base = await diagnosticoReconciliacao(observador);
      const cofrinhoId = await novoCofrinho('40.00');
      const { a } = clientes();

      await retirar(a, cofrinhoId, '15.00');
      await encerrar(a, cofrinhoId);

      expect(await diagnosticoReconciliacao(observador)).toEqual({
        total_cofrinhos: base.total_cofrinhos + 1,
        divergentes: base.divergentes,
        saldo_negativo: base.saldo_negativo,
      });
    });

    it('detecta saldo materializado sem movimentação correspondente', async () => {
      const cofrinhoId = await novoCofrinho(null);
      const base = await diagnosticoReconciliacao(observador);

      await observador`UPDATE cofrinhos SET saldo_atual = 3.00 WHERE id = ${cofrinhoId}`;
      const comDivergencia = await diagnosticoReconciliacao(observador);
      await observador`UPDATE cofrinhos SET saldo_atual = 0 WHERE id = ${cofrinhoId}`;

      expect(comDivergencia.divergentes).toBe(base.divergentes + 1);
      expect((await diagnosticoReconciliacao(observador)).divergentes).toBe(base.divergentes);
    });
  });
});
