import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CofrinhoDetalheResponse } from '@nossagrana/types';

const mockFetchDetalhe = vi.fn();
const mockStore = vi.hoisted(() => ({
  useCofrinhoStore: vi.fn(),
}));

vi.mock('../stores/cofrinho.store', () => mockStore);

const mockService = vi.hoisted(() => ({
  cofrinhoService: {
    aportar: vi.fn(),
    retirar: vi.fn(),
    encerrar: vi.fn(),
    editar: vi.fn(),
    cancelarAporteRecorrente: vi.fn(),
  },
}));

vi.mock('../services/cofrinho.service', () => mockService);

vi.mock('../components/charts/budget-bar', () => ({
  BudgetBar: ({ category, spent, limit }: { category: string; spent: number; limit: number }) => (
    <div data-testid="budget-bar">{`${category} ${spent}/${limit}`}</div>
  ),
}));

import { CofrinhoDetalhePage } from './cofrinho-detalhe-page';

const familiaId = 'fam-1';
const cofrinhoId = 'cof-1';

const baseCofrinhoDetalhe: CofrinhoDetalheResponse = {
  cofrinho: {
    id: cofrinhoId,
    familiaId,
    nome: 'Viagem Europa',
    emoji: '\u2708\uFE0F',
    descricao: 'Ferias de julho',
    metaValor: '5000.00',
    saldoAtual: '2500.00',
    status: 'ativo',
    criadoPor: 'user-1',
    criadoEm: '2026-01-15T10:00:00.000Z',
    encerradoEm: null,
  },
  movimentacoes: [
    {
      id: 'mov-1',
      cofrinhoId,
      tipo: 'aporte',
      valor: '1500.00',
      descricao: 'Primeiro aporte',
      transacaoId: 'tx-1',
      registradoPor: 'user-1',
      registradoEm: '2026-02-01T10:00:00.000Z',
      mesReferencia: '2026-02',
    },
    {
      id: 'mov-2',
      cofrinhoId,
      tipo: 'retirada',
      valor: '500.00',
      descricao: 'Compra passagem',
      transacaoId: 'tx-2',
      registradoPor: 'user-1',
      registradoEm: '2026-02-10T10:00:00.000Z',
      mesReferencia: '2026-02',
    },
    {
      id: 'mov-3',
      cofrinhoId,
      tipo: 'aporte',
      valor: '1500.00',
      descricao: 'Segundo aporte',
      transacaoId: 'tx-3',
      registradoPor: 'user-1',
      registradoEm: '2026-03-01T10:00:00.000Z',
      mesReferencia: '2026-03',
    },
  ],
  aporteRecorrenteAtivo: null,
};

const setupStore = (overrides: Partial<{
  cofrinhoSelecionado: CofrinhoDetalheResponse | null;
  carregando: boolean;
  erro: string | null;
}> = {}) => {
  mockStore.useCofrinhoStore.mockReturnValue({
    cofrinhoSelecionado: overrides.cofrinhoSelecionado ?? baseCofrinhoDetalhe,
    carregando: overrides.carregando ?? false,
    erro: overrides.erro ?? null,
    fetchDetalhe: mockFetchDetalhe,
  });
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  mockFetchDetalhe.mockResolvedValue(undefined);
  mockService.cofrinhoService.aportar.mockResolvedValue({ movimentacao: {}, cofrinho: {} });
  mockService.cofrinhoService.retirar.mockResolvedValue({ movimentacao: {}, cofrinho: {} });
  mockService.cofrinhoService.encerrar.mockResolvedValue({ cofrinho: {} });
  mockService.cofrinhoService.editar.mockResolvedValue({ cofrinho: {} });
  mockService.cofrinhoService.cancelarAporteRecorrente.mockResolvedValue(undefined);
});

describe('CofrinhoDetalhePage', () => {
  it('exibe nome, emoji, saldo e meta do cofrinho', () => {
    setupStore();
    render(
      <CofrinhoDetalhePage
        familiaId={familiaId}
        cofrinhoId={cofrinhoId}
        onBack={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByText('\u2708\uFE0F')).toBeInTheDocument();
    expect(screen.getByText('Viagem Europa')).toBeInTheDocument();
    expect(screen.getByText(/2\.500,00/)).toBeInTheDocument();
    expect(screen.getByText(/5\.000,00/)).toBeInTheDocument();
  });

  it('exibe barra de progresso quando ha meta', () => {
    setupStore();
    render(
      <CofrinhoDetalhePage
        familiaId={familiaId}
        cofrinhoId={cofrinhoId}
        onBack={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByTestId('budget-bar')).toBeInTheDocument();
  });

  it('nao exibe barra de progresso quando nao ha meta', () => {
    setupStore({
      cofrinhoSelecionado: {
        ...baseCofrinhoDetalhe,
        cofrinho: { ...baseCofrinhoDetalhe.cofrinho, metaValor: null },
      },
    });
    render(
      <CofrinhoDetalhePage
        familiaId={familiaId}
        cofrinhoId={cofrinhoId}
        onBack={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('budget-bar')).not.toBeInTheDocument();
  });

  it('exibe lista de movimentacoes', () => {
    setupStore();
    render(
      <CofrinhoDetalhePage
        familiaId={familiaId}
        cofrinhoId={cofrinhoId}
        onBack={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByText('Primeiro aporte')).toBeInTheDocument();
    expect(screen.getByText('Compra passagem')).toBeInTheDocument();
    expect(screen.getByText('Segundo aporte')).toBeInTheDocument();
  });

  it('botoes Aportar e Retirar existem', () => {
    setupStore();
    render(
      <CofrinhoDetalhePage
        familiaId={familiaId}
        cofrinhoId={cofrinhoId}
        onBack={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /aportar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retirar/i })).toBeInTheDocument();
  });

  it('botao Encerrar existe', () => {
    setupStore();
    render(
      <CofrinhoDetalhePage
        familiaId={familiaId}
        cofrinhoId={cofrinhoId}
        onBack={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /encerrar/i })).toBeInTheDocument();
  });

  it('abre modal de aporte ao clicar Aportar', async () => {
    setupStore();
    render(
      <CofrinhoDetalhePage
        familiaId={familiaId}
        cofrinhoId={cofrinhoId}
        onBack={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /aportar/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    // The aporte modal shows the cofrinho name in its header
    expect(screen.getByText(/Aporte/)).toBeInTheDocument();
  });

  it('exibe loading quando carregando', () => {
    setupStore({ carregando: true, cofrinhoSelecionado: null });
    render(
      <CofrinhoDetalhePage
        familiaId={familiaId}
        cofrinhoId={cofrinhoId}
        onBack={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
  });

  it('chama fetchDetalhe ao montar', () => {
    setupStore();
    render(
      <CofrinhoDetalhePage
        familiaId={familiaId}
        cofrinhoId={cofrinhoId}
        onBack={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    expect(mockFetchDetalhe).toHaveBeenCalledWith(familiaId, cofrinhoId);
  });

  it('chama onBack ao clicar no botao Voltar', () => {
    setupStore();
    const onBack = vi.fn();
    render(
      <CofrinhoDetalhePage
        familiaId={familiaId}
        cofrinhoId={cofrinhoId}
        onBack={onBack}
        onNavigate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it('desabilita botoes de acao quando status encerrado', () => {
    setupStore({
      cofrinhoSelecionado: {
        ...baseCofrinhoDetalhe,
        cofrinho: {
          ...baseCofrinhoDetalhe.cofrinho,
          status: 'encerrado',
          encerradoEm: '2026-03-20T10:00:00.000Z',
        },
      },
    });
    render(
      <CofrinhoDetalhePage
        familiaId={familiaId}
        cofrinhoId={cofrinhoId}
        onBack={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /aportar/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /retirar/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /editar/i })).toBeDisabled();
  });

  it('abre modal de retirada ao clicar Retirar', async () => {
    setupStore();
    render(
      <CofrinhoDetalhePage
        familiaId={familiaId}
        cofrinhoId={cofrinhoId}
        onBack={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /retirar/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    expect(screen.getByText(/Retirada/)).toBeInTheDocument();
  });

  it('abre modal de encerrar ao clicar Encerrar', async () => {
    setupStore();
    render(
      <CofrinhoDetalhePage
        familiaId={familiaId}
        cofrinhoId={cofrinhoId}
        onBack={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /encerrar/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    expect(screen.getByText(/Encerrar Cofrinho/)).toBeInTheDocument();
  });

  it('abre modal de editar ao clicar Editar', async () => {
    setupStore();
    render(
      <CofrinhoDetalhePage
        familiaId={familiaId}
        cofrinhoId={cofrinhoId}
        onBack={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /editar/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    expect(screen.getByText(/Editar Cofrinho/)).toBeInTheDocument();
  });

  it('exibe secao de aporte recorrente quando ativo', () => {
    setupStore({
      cofrinhoSelecionado: {
        ...baseCofrinhoDetalhe,
        aporteRecorrenteAtivo: {
          transacaoPaiId: 'tx-rec-1',
          valor: '200.00',
          frequencia: 'mensal',
          dataFimRecorrencia: null,
        },
      },
    });
    render(
      <CofrinhoDetalhePage
        familiaId={familiaId}
        cofrinhoId={cofrinhoId}
        onBack={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByText(/Aporte recorrente/i)).toBeInTheDocument();
    expect(screen.getByText(/200,00/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancelar recorr/i })).toBeInTheDocument();
  });

  it('movimentacoes mostram indicadores de tipo', () => {
    setupStore();
    render(
      <CofrinhoDetalhePage
        familiaId={familiaId}
        cofrinhoId={cofrinhoId}
        onBack={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    // Aportes have up arrow, retiradas have down arrow
    const upArrows = screen.getAllByText('\u2191');
    const downArrows = screen.getAllByText('\u2193');
    expect(upArrows.length).toBe(2); // 2 aportes
    expect(downArrows.length).toBe(1); // 1 retirada
  });

  it('exibe mensagem quando nao ha movimentacoes', () => {
    setupStore({
      cofrinhoSelecionado: {
        ...baseCofrinhoDetalhe,
        movimentacoes: [],
      },
    });
    render(
      <CofrinhoDetalhePage
        familiaId={familiaId}
        cofrinhoId={cofrinhoId}
        onBack={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByText(/nenhuma movimentacao/i)).toBeInTheDocument();
  });

  it('exibe dataFimRecorrencia quando presente', () => {
    setupStore({
      cofrinhoSelecionado: {
        ...baseCofrinhoDetalhe,
        aporteRecorrenteAtivo: {
          transacaoPaiId: 'tx-rec-1',
          valor: '200.00',
          frequencia: 'mensal',
          dataFimRecorrencia: '2026-12-31T12:00:00.000Z',
        },
      },
    });
    render(
      <CofrinhoDetalhePage
        familiaId={familiaId}
        cofrinhoId={cofrinhoId}
        onBack={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByText(/31\/12\/2026/)).toBeInTheDocument();
  });

  it('cancela aporte recorrente ao clicar no botao', async () => {
    setupStore({
      cofrinhoSelecionado: {
        ...baseCofrinhoDetalhe,
        aporteRecorrenteAtivo: {
          transacaoPaiId: 'tx-rec-1',
          valor: '200.00',
          frequencia: 'mensal',
          dataFimRecorrencia: null,
        },
      },
    });
    render(
      <CofrinhoDetalhePage
        familiaId={familiaId}
        cofrinhoId={cofrinhoId}
        onBack={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /cancelar recorr/i }));

    await waitFor(() => {
      expect(mockService.cofrinhoService.cancelarAporteRecorrente).toHaveBeenCalledWith(
        familiaId,
        cofrinhoId,
      );
    });
  });
});
