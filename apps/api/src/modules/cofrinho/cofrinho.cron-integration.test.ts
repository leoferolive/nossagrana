import { describe, it, expect, vi } from 'vitest';

import { InMemoryTransacaoRepository } from '../transacao/transacao.repository.js';
import { TransacaoService } from '../transacao/transacao.service.js';
import type { CofrinhoHandler } from '../transacao/transacao.types.js';

function makeMockCofrinhoHandler(): CofrinhoHandler & {
  processarTransacaoComCofrinho: ReturnType<typeof vi.fn>;
} {
  return {
    processarTransacaoComCofrinho: vi.fn().mockResolvedValue(undefined),
  };
}

describe('Integração: transação recorrente com cofrinhoId', () => {
  it('ao gerar filhas recorrentes com cofrinhoId, chama handler para cada filha', async () => {
    const repository = new InMemoryTransacaoRepository();
    const cofrinhoHandler = makeMockCofrinhoHandler();
    const service = new TransacaoService(repository, undefined, cofrinhoHandler);

    const cofrinhoId = 'cofrinho-123';

    const pai = await service.registrar({
      familiaId: 'f1',
      tipo: 'despesa',
      valor: '200.00',
      categoriaId: 'cat-cofrinho',
      descricao: 'Aporte mensal',
      data: '2026-01-10',
      metodoPagamentoId: null,
      metodoPagamentoTipo: null,
      dataFechamento: null,
      usuarioRegistrouId: 'u1',
      recorrente: true,
      frequencia: 'mensal',
      dataFimRecorrencia: '2026-03-10',
      cofrinhoId,
    });

    // Pai + 2 filhas (fev, mar)
    const filhas = await repository.listByPaiId({
      transacaoPaiId: pai.id,
      familiaId: 'f1',
    });
    expect(filhas).toHaveLength(2);

    // Handler deve ter sido chamado uma vez para cada filha
    expect(cofrinhoHandler.processarTransacaoComCofrinho).toHaveBeenCalledTimes(2);

    // Verificar chamada da primeira filha
    const primeiraChamada = cofrinhoHandler.processarTransacaoComCofrinho.mock.calls[0][0];
    expect(primeiraChamada.cofrinhoId).toBe(cofrinhoId);
    expect(primeiraChamada.familiaId).toBe('f1');
    expect(primeiraChamada.valor).toBe('200.00');
    expect(primeiraChamada.usuarioRegistrouId).toBe('u1');
    expect(primeiraChamada.id).toBe(filhas[0].id);
    expect(primeiraChamada.mesReferencia).toBe('2026-02');
    expect(primeiraChamada.descricao).toBe('Aporte mensal');

    // Verificar chamada da segunda filha
    const segundaChamada = cofrinhoHandler.processarTransacaoComCofrinho.mock.calls[1][0];
    expect(segundaChamada.cofrinhoId).toBe(cofrinhoId);
    expect(segundaChamada.id).toBe(filhas[1].id);
    expect(segundaChamada.mesReferencia).toBe('2026-03');
  });

  it('filhas recorrentes com cofrinhoId têm cofrinhoId propagado', async () => {
    const repository = new InMemoryTransacaoRepository();
    const cofrinhoHandler = makeMockCofrinhoHandler();
    const service = new TransacaoService(repository, undefined, cofrinhoHandler);

    const cofrinhoId = 'cofrinho-456';

    const pai = await service.registrar({
      familiaId: 'f1',
      tipo: 'despesa',
      valor: '100.00',
      categoriaId: 'cat-cofrinho',
      data: '2026-01-01',
      metodoPagamentoId: null,
      metodoPagamentoTipo: null,
      dataFechamento: null,
      usuarioRegistrouId: 'u1',
      recorrente: true,
      frequencia: 'mensal',
      dataFimRecorrencia: '2026-02-01',
      cofrinhoId,
    });

    // O pai deve ter cofrinhoId
    expect(pai.cofrinhoId).toBe(cofrinhoId);

    // As filhas devem ter cofrinhoId
    const filhas = await repository.listByPaiId({
      transacaoPaiId: pai.id,
      familiaId: 'f1',
    });
    expect(filhas).toHaveLength(1);
    expect(filhas[0].cofrinhoId).toBe(cofrinhoId);
  });

  it('ao gerar filhas recorrentes sem cofrinhoId, não chama handler', async () => {
    const repository = new InMemoryTransacaoRepository();
    const cofrinhoHandler = makeMockCofrinhoHandler();
    const service = new TransacaoService(repository, undefined, cofrinhoHandler);

    await service.registrar({
      familiaId: 'f1',
      tipo: 'despesa',
      valor: '50.00',
      categoriaId: 'cat1',
      data: '2026-01-10',
      metodoPagamentoId: null,
      metodoPagamentoTipo: null,
      dataFechamento: null,
      usuarioRegistrouId: 'u1',
      recorrente: true,
      frequencia: 'mensal',
      dataFimRecorrencia: '2026-03-10',
    });

    // Handler NÃO deve ter sido chamado
    expect(cofrinhoHandler.processarTransacaoComCofrinho).not.toHaveBeenCalled();
  });

  it('sem cofrinhoHandler injetado, não causa erro mesmo com cofrinhoId', async () => {
    const repository = new InMemoryTransacaoRepository();
    const service = new TransacaoService(repository); // sem cofrinhoHandler

    // Não deve lançar erro
    const pai = await service.registrar({
      familiaId: 'f1',
      tipo: 'despesa',
      valor: '100.00',
      categoriaId: 'cat1',
      data: '2026-01-10',
      metodoPagamentoId: null,
      metodoPagamentoTipo: null,
      dataFechamento: null,
      usuarioRegistrouId: 'u1',
      recorrente: true,
      frequencia: 'mensal',
      dataFimRecorrencia: '2026-02-10',
      cofrinhoId: 'cofrinho-789',
    });

    expect(pai.cofrinhoId).toBe('cofrinho-789');
  });

  it('transação simples com cofrinhoId armazena cofrinhoId mas não chama handler', async () => {
    const repository = new InMemoryTransacaoRepository();
    const cofrinhoHandler = makeMockCofrinhoHandler();
    const service = new TransacaoService(repository, undefined, cofrinhoHandler);

    const t = await service.registrar({
      familiaId: 'f1',
      tipo: 'despesa',
      valor: '100.00',
      categoriaId: 'cat1',
      data: '2026-03-10',
      metodoPagamentoId: null,
      metodoPagamentoTipo: null,
      dataFechamento: null,
      usuarioRegistrouId: 'u1',
      cofrinhoId: 'cofrinho-simple',
    });

    expect(t.cofrinhoId).toBe('cofrinho-simple');
    // Handler is not called for simple transactions (those are handled by CofrinhoService directly)
    expect(cofrinhoHandler.processarTransacaoComCofrinho).not.toHaveBeenCalled();
  });

  it('transação simples sem cofrinhoId tem cofrinhoId null', async () => {
    const repository = new InMemoryTransacaoRepository();
    const service = new TransacaoService(repository);

    const t = await service.registrar({
      familiaId: 'f1',
      tipo: 'despesa',
      valor: '100.00',
      categoriaId: 'cat1',
      data: '2026-03-10',
      metodoPagamentoId: null,
      metodoPagamentoTipo: null,
      dataFechamento: null,
      usuarioRegistrouId: 'u1',
    });

    expect(t.cofrinhoId).toBeNull();
  });
});
