import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cofrinhoService } from '../services/cofrinho.service';

import { useCofrinhoStore } from './cofrinho.store';

vi.mock('../services/cofrinho.service', () => ({
  cofrinhoService: { listar: vi.fn(), detalhe: vi.fn() },
}));

const detalheDeOutroCofrinho = {
  cofrinho: {
    id: 'c-antigo',
    familiaId: 'fam-1',
    nome: 'Antigo',
    emoji: null,
    descricao: null,
    metaValor: null,
    saldoAtual: '10.00',
    status: 'ativo' as const,
    criadoPor: 'u1',
    criadoEm: '2026-01-01T00:00:00Z',
    encerradoEm: null,
  },
  movimentacoes: [],
  aporteRecorrenteAtivo: null,
};

describe('cofrinho.store > fetchDetalhe', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useCofrinhoStore.getState().reset();
  });

  it('guarda o detalhe carregado', async () => {
    vi.mocked(cofrinhoService.detalhe).mockResolvedValue(detalheDeOutroCofrinho);

    await useCofrinhoStore.getState().fetchDetalhe('fam-1', 'c-antigo');

    expect(useCofrinhoStore.getState().cofrinhoSelecionado).toEqual(detalheDeOutroCofrinho);
    expect(useCofrinhoStore.getState().carregando).toBe(false);
  });

  it('na falha, descarta o detalhe anterior e registra o erro', async () => {
    useCofrinhoStore.setState({ cofrinhoSelecionado: detalheDeOutroCofrinho });
    vi.mocked(cofrinhoService.detalhe).mockRejectedValue(new Error('404'));

    await useCofrinhoStore.getState().fetchDetalhe('fam-1', 'c-inexistente');

    const { cofrinhoSelecionado, erro, carregando } = useCofrinhoStore.getState();
    expect(cofrinhoSelecionado).toBeNull();
    expect(erro).toBe('Erro ao carregar detalhe do cofrinho');
    expect(carregando).toBe(false);
  });
});
