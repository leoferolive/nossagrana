import { describe, expect, it } from 'vitest';

import { InMemoryIdempotenciaRepository } from '../../shared/idempotencia/idempotencia.repository.js';
import { IdempotenciaConflitoError } from '../../shared/idempotencia/idempotencia.errors.js';
import type {
  OpcoesIdempotencia,
  PedidoIdempotente,
} from '../../shared/idempotencia/idempotencia.types.js';
import { ReferenciasSempreValidasFake } from '../../shared/referencia-ownership/referencia-ownership.fakes.js';
import { InMemoryUnitOfWork } from '../../shared/unit-of-work/in-memory-unit-of-work.js';
import {
  CofrinhoHandlerQueGravaNoTx,
  InMemoryTransacaoRepositoryFalhaNoEnesimoInsert,
} from './transacao.fakes.js';
import { InMemoryTransacaoRepository } from './transacao.repository.js';
import { TransacaoService } from './transacao.service.js';
import type { CofrinhoHandler, RegistrarTransacaoInput, Transacao } from './transacao.types.js';

/**
 * Idempotência do registro (#90): a chave é reservada na MESMA Unit of Work
 * do pai/filhas — replay não grava nada, falha em qualquer insert não deixa
 * transação nem chave, e o retry com a mesma chave executa de novo.
 */
function setup(opcoes: { falharNoInsert?: number; cofrinhoHandler?: CofrinhoHandler } = {}) {
  const transacoes = opcoes.falharNoInsert
    ? new InMemoryTransacaoRepositoryFalhaNoEnesimoInsert(opcoes.falharNoInsert)
    : new InMemoryTransacaoRepository();
  const idempotencia = new InMemoryIdempotenciaRepository();
  const unitOfWork = new InMemoryUnitOfWork({ transacoes, idempotencia });
  const service = new TransacaoService(
    transacoes,
    new ReferenciasSempreValidasFake(),
    unitOfWork,
    undefined,
    opcoes.cofrinhoHandler,
  );
  return { transacoes, idempotencia, unitOfWork, service };
}

const base: RegistrarTransacaoInput = {
  familiaId: 'f1',
  tipo: 'despesa',
  valor: '400.00',
  categoriaId: 'cat1',
  descricao: 'TV',
  data: '2026-01-10',
  usuarioRegistrouId: 'u1',
};
const parcelada = { ...base, parcelado: true, numeroParcelas: 4 };
const recorrenteComFim = {
  ...base,
  recorrente: true,
  frequencia: 'mensal' as const,
  dataFimRecorrencia: '2026-04-10',
};
const recorrenteSemFim = { ...base, recorrente: true, frequencia: 'semanal' as const };

const pedido = (familiaId = 'f1', hashPayload = 'hash-1'): PedidoIdempotente => ({
  familiaId,
  chave: 'chave-0001',
  operacao: 'POST /api/transacoes',
  hashPayload,
});

const comChave = (p: PedidoIdempotente = pedido()): OpcoesIdempotencia<Transacao> => ({
  pedido: p,
  responder: (t) => ({ statusCode: 201, corpo: { transacao: { id: t.id } } }),
});

const total = async (repo: InMemoryTransacaoRepository, familiaId = 'f1') =>
  (await repo.list({ familiaId })).length;

describe('TransacaoService.registrarIdempotente (#90)', () => {
  it('replay com a mesma chave devolve a mesma resposta sem gravar a série de novo', async () => {
    const { transacoes, unitOfWork, service } = setup();

    const primeira = await service.registrarIdempotente(parcelada, comChave());
    const replay = await service.registrarIdempotente(parcelada, comChave());

    expect(primeira.tipo).toBe('executada');
    const pai = primeira.tipo === 'executada' ? primeira.valor : null;
    expect(replay).toEqual({
      tipo: 'repetida',
      resposta: { statusCode: 201, corpo: { transacao: { id: pai?.id } } },
    });
    expect(await total(transacoes)).toBe(4);
    expect(unitOfWork.estatisticas()).toEqual({ iniciadas: 2, confirmadas: 2, desfeitas: 0 });
  });

  it('mesma chave com payload diferente → IdempotenciaConflitoError, nada gravado', async () => {
    const { transacoes, service } = setup();
    await service.registrarIdempotente(parcelada, comChave());

    await expect(
      service.registrarIdempotente(
        { ...parcelada, valor: '999.00' },
        comChave(pedido('f1', 'hash-2')),
      ),
    ).rejects.toThrow(IdempotenciaConflitoError);

    expect(await total(transacoes)).toBe(4);
  });

  it('sem chave (comportamento documentado): reenviar o mesmo payload DUPLICA a série', async () => {
    const { transacoes, idempotencia, service } = setup();

    await service.registrarIdempotente(parcelada, null);
    await service.registrarIdempotente(parcelada, null);

    expect(await total(transacoes)).toBe(8);
    expect(idempotencia.chavesDa('f1')).toEqual([]);
  });

  it('mesma chave em famílias diferentes: execuções independentes', async () => {
    const { transacoes, idempotencia, service } = setup();

    await service.registrarIdempotente(parcelada, comChave(pedido('f1')));
    const outra = await service.registrarIdempotente(
      { ...parcelada, familiaId: 'f2' },
      comChave(pedido('f2')),
    );

    expect(outra.tipo).toBe('executada');
    expect(await total(transacoes, 'f2')).toBe(4);
    expect(idempotencia.chavesDa('f1')).toEqual(['chave-0001']);
    expect(idempotencia.chavesDa('f2')).toEqual(['chave-0001']);
  });
});

/** [cenário, input, total de inserts da série] — cada N de 1..total é uma posição de falha. */
const series: Array<[string, RegistrarTransacaoInput, number]> = [
  ['parcelada 4x', parcelada, 4],
  ['recorrente com fim (jan→abr)', recorrenteComFim, 4],
  ['recorrente sem fim (pai + 24)', recorrenteSemFim, 25],
];

const posicoes = series.flatMap(([nome, input, inserts]) =>
  Array.from({ length: inserts }, (_, i) => [nome, i + 1, input, inserts] as const),
);

describe('TransacaoService.registrarIdempotente — matriz de falha no N-ésimo insert', () => {
  it.each(posicoes)(
    '%s: falha no insert %i não deixa transação nem chave; retry com a chave executa',
    async (_nome, n, input, inserts) => {
      const falha = setup({ falharNoInsert: n });

      await expect(falha.service.registrarIdempotente(input, comChave())).rejects.toThrow(
        `insert nº ${n}`,
      );
      expect(await total(falha.transacoes)).toBe(0);
      expect(falha.idempotencia.chavesDa('f1')).toEqual([]);

      // Mesma chave, agora sem a falha injetada (a fake conta por staging): executa de novo.
      const { transacoes, idempotencia, service } = setup();
      const retry = await service.registrarIdempotente(input, comChave());
      expect(retry.tipo).toBe('executada');
      expect(await total(transacoes)).toBe(inserts);
      expect(idempotencia.chavesDa('f1')).toEqual(['chave-0001']);
    },
  );

  it.each([1, 2, 3])(
    'recorrente com cofrinho: falha do handler na chamada %i desfaz série, efeitos e chave',
    async (chamada) => {
      const cofrinhoHandler = new CofrinhoHandlerQueGravaNoTx(chamada);
      const { transacoes, idempotencia, service } = setup({ cofrinhoHandler });

      await expect(
        service.registrarIdempotente({ ...recorrenteComFim, cofrinhoId: 'cx' }, comChave()),
      ).rejects.toThrow(`chamada nº ${chamada}`);

      expect(await total(transacoes)).toBe(0);
      expect(idempotencia.chavesDa('f1')).toEqual([]);
    },
  );
});
