import { describe, expect, it } from 'vitest';

import { InMemoryReferenciaOwnershipRepository } from '../../shared/referencia-ownership/referencia-ownership.repository.js';
import { ReferenciasSempreValidasFake } from '../../shared/referencia-ownership/referencia-ownership.fakes.js';
import {
  ReferenciaInvalidaError,
  ReferenciaOwnershipValidator,
} from '../../shared/referencia-ownership/referencia-ownership.validator.js';
import { InMemoryUnitOfWork } from '../../shared/unit-of-work/in-memory-unit-of-work.js';
import {
  CofrinhoHandlerQueFalhaNaChamada,
  CofrinhoHandlerQueGravaNoTx,
  InMemoryTransacaoRepositoryFalhaNoEnesimoInsert,
} from './transacao.fakes.js';
import { InMemoryTransacaoRepository } from './transacao.repository.js';
import { TransacaoService } from './transacao.service.js';
import type { CofrinhoHandler } from './transacao.types.js';
import { InMemoryIdempotenciaRepository } from '../../shared/idempotencia/idempotencia.repository.js';

/**
 * Atomicidade do registro (issues #78/#85): pai, filhas e efeitos de cofrinho
 * rodam numa única Unit of Work — falha em qualquer ponto não deixa nada.
 */
function setup(opcoes: { falharNoInsert?: number; cofrinhoHandler?: CofrinhoHandler } = {}) {
  const repository = opcoes.falharNoInsert
    ? new InMemoryTransacaoRepositoryFalhaNoEnesimoInsert(opcoes.falharNoInsert)
    : new InMemoryTransacaoRepository();
  const unitOfWork = new InMemoryUnitOfWork({
    transacoes: repository,
    idempotencia: new InMemoryIdempotenciaRepository(),
  });
  const service = new TransacaoService(
    repository,
    new ReferenciasSempreValidasFake(),
    unitOfWork,
    undefined,
    opcoes.cofrinhoHandler,
  );
  return { repository, unitOfWork, service };
}

const base = {
  familiaId: 'f1',
  tipo: 'despesa' as const,
  valor: '400.00',
  categoriaId: 'cat1',
  descricao: 'TV',
  data: '2026-01-10',
  metodoPagamentoId: null,
  metodoPagamentoTipo: null,
  dataFechamento: null,
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

async function totalGravado(repository: InMemoryTransacaoRepository) {
  return (await repository.list({ familiaId: 'f1' })).length;
}

describe('TransacaoService.registrar — atomicidade (#85)', () => {
  it('parcelada: grava pai + N-1 filhas numa única unidade confirmada', async () => {
    const { repository, unitOfWork, service } = setup();

    const pai = await service.registrar(parcelada);

    const filhas = await repository.listByPaiId({ transacaoPaiId: pai.id, familiaId: 'f1' });
    expect(filhas).toHaveLength(3);
    expect(filhas.every((f) => f.familiaId === pai.familiaId)).toBe(true);
    expect(filhas.map((f) => f.parcelaAtual)).toEqual([2, 3, 4]);
    expect(unitOfWork.estatisticas()).toEqual({ iniciadas: 1, confirmadas: 1, desfeitas: 0 });
  });

  it.each([
    ['no pai (1º insert)', 1],
    ['na 2ª parcela', 2],
    ['na última parcela', 4],
  ])('parcelada: falha %s não deixa pai nem parcelas', async (_caso, falharNoInsert) => {
    const { repository, unitOfWork, service } = setup({ falharNoInsert });

    await expect(service.registrar(parcelada)).rejects.toThrow(`insert nº ${falharNoInsert}`);

    expect(await totalGravado(repository)).toBe(0);
    expect(unitOfWork.estatisticas()).toEqual({ iniciadas: 1, confirmadas: 0, desfeitas: 1 });
  });

  it('recorrente com data fim: falha na última filha não deixa lote incompleto', async () => {
    // pai (jan) + fev, mar, abr → 4 inserts; falha no 4º
    const { repository, service } = setup({ falharNoInsert: 4 });

    await expect(service.registrar(recorrenteComFim)).rejects.toThrow('insert nº 4');

    expect(await totalGravado(repository)).toBe(0);
  });

  it('recorrente sem data fim: falha na 24ª filha (25º insert) não deixa nada', async () => {
    const { repository, service } = setup({ falharNoInsert: 25 });

    await expect(service.registrar(recorrenteSemFim)).rejects.toThrow('insert nº 25');

    expect(await totalGravado(repository)).toBe(0);
  });

  it('recorrente sem data fim: sucesso grava pai + 24 filhas apontando para o pai', async () => {
    const { repository, service } = setup();

    const pai = await service.registrar(recorrenteSemFim);

    const filhas = await repository.listByPaiId({ transacaoPaiId: pai.id, familiaId: 'f1' });
    expect(filhas).toHaveLength(24);
    expect(await totalGravado(repository)).toBe(25);
  });

  it('falha do cofrinhoHandler na 2ª filha desfaz pai e todas as filhas', async () => {
    const cofrinhoHandler = new CofrinhoHandlerQueFalhaNaChamada(2);
    const { repository, unitOfWork, service } = setup({ cofrinhoHandler });

    await expect(
      service.registrar({ ...recorrenteComFim, cofrinhoId: 'cofrinho-1' }),
    ).rejects.toThrow('chamada nº 2');

    expect(cofrinhoHandler.processadas).toHaveLength(1);
    expect(await totalGravado(repository)).toBe(0);
    expect(unitOfWork.estatisticas().desfeitas).toBe(1);
  });

  it('cofrinhoHandler recebe cada filha recorrente dentro da unidade (antes do commit)', async () => {
    const repository = new InMemoryTransacaoRepository();
    const cofrinhoHandler = new CofrinhoHandlerQueFalhaNaChamada(Infinity, repository);
    const service = new TransacaoService(
      repository,
      new ReferenciasSempreValidasFake(),
      new InMemoryUnitOfWork({
        transacoes: repository,
        idempotencia: new InMemoryIdempotenciaRepository(),
      }),
      undefined,
      cofrinhoHandler,
    );

    await service.registrar({ ...recorrenteComFim, cofrinhoId: 'cofrinho-1' });

    expect(cofrinhoHandler.processadas.map((t) => t.mesReferencia)).toEqual([
      '2026-02',
      '2026-03',
      '2026-04',
    ]);
    // Fora da unidade nada é visível enquanto o handler roda: ainda não houve commit.
    expect(cofrinhoHandler.gravadasVisiveisNaChamada).toEqual([0, 0, 0]);
    expect(await totalGravado(repository)).toBe(4);
  });

  it('cofrinhoHandler grava pelos repos do tx: efeitos confirmados junto com a série (#59)', async () => {
    const cofrinhoHandler = new CofrinhoHandlerQueGravaNoTx(Infinity);
    const { repository, service } = setup({ cofrinhoHandler });

    await service.registrar({ ...recorrenteComFim, cofrinhoId: 'cofrinho-1' });

    // pai + 3 filhas + 1 efeito por filha, todos no mesmo commit
    expect(await totalGravado(repository)).toBe(7);
  });

  it('falha do cofrinhoHandler desfaz também o que ele já gravou pelos repos do tx', async () => {
    const cofrinhoHandler = new CofrinhoHandlerQueGravaNoTx(3);
    const { repository, service } = setup({ cofrinhoHandler });

    await expect(
      service.registrar({ ...recorrenteComFim, cofrinhoId: 'cofrinho-1' }),
    ).rejects.toThrow('chamada nº 3');

    expect(cofrinhoHandler.efeitosGravados).toBe(2);
    expect(await totalGravado(repository)).toBe(0);
  });

  it('transação simples também passa pela unidade (1 commit)', async () => {
    const { unitOfWork, service } = setup();

    await service.registrar(base);

    expect(unitOfWork.estatisticas()).toEqual({ iniciadas: 1, confirmadas: 1, desfeitas: 0 });
  });

  it('ownership inválido é rejeitado antes de abrir a unidade de trabalho', async () => {
    const referencias = new InMemoryReferenciaOwnershipRepository();
    referencias.addCategoria({ id: 'cat-b', familiaId: 'f2', tipo: 'despesa', ativo: true });
    const repository = new InMemoryTransacaoRepository();
    const unitOfWork = new InMemoryUnitOfWork({
      transacoes: repository,
      idempotencia: new InMemoryIdempotenciaRepository(),
    });
    const service = new TransacaoService(
      repository,
      new ReferenciaOwnershipValidator(referencias),
      unitOfWork,
    );

    await expect(service.registrar({ ...parcelada, categoriaId: 'cat-b' })).rejects.toThrow(
      ReferenciaInvalidaError,
    );

    expect(unitOfWork.estatisticas().iniciadas).toBe(0);
    expect(await totalGravado(repository)).toBe(0);
  });
});
