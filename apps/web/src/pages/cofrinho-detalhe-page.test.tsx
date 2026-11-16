import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
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
import { renderPagina } from '../test/render-pagina';

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

const setupStore = (
  overrides: Partial<{
    cofrinhoSelecionado: CofrinhoDetalheResponse | null;
    carregando: boolean;
    erro: string | null;
  }> = {},
) => {
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
    renderPagina(<CofrinhoDetalhePage familiaId={familiaId} cofrinhoId={cofrinhoId} />);

    expect(screen.getByText('\u2708\uFE0F')).toBeInTheDocument();
    expect(screen.getByText('Viagem Europa')).toBeInTheDocument();
    expect(screen.getByText(/2\.500,00/)).toBeInTheDocument();
    expect(screen.getByText(/5\.000,00/)).toBeInTheDocument();
  });

  it('exibe barra de progresso quando ha meta', () => {
    setupStore();
    renderPagina(<CofrinhoDetalhePage familiaId={familiaId} cofrinhoId={cofrinhoId} />);

    expect(screen.getByTestId('budget-bar')).toBeInTheDocument();
  });

  it('nao exibe barra de progresso quando nao ha meta', () => {
    setupStore({
      cofrinhoSelecionado: {
        ...baseCofrinhoDetalhe,
        cofrinho: { ...baseCofrinhoDetalhe.cofrinho, metaValor: null },
      },
    });
    renderPagina(<CofrinhoDetalhePage familiaId={familiaId} cofrinhoId={cofrinhoId} />);

    expect(screen.queryByTestId('budget-bar')).not.toBeInTheDocument();
  });

  it('exibe lista de movimentacoes', () => {
    setupStore();
    renderPagina(<CofrinhoDetalhePage familiaId={familiaId} cofrinhoId={cofrinhoId} />);

    expect(screen.getByText('Primeiro aporte')).toBeInTheDocument();
    expect(screen.getByText('Compra passagem')).toBeInTheDocument();
    expect(screen.getByText('Segundo aporte')).toBeInTheDocument();
  });

  it('botoes Aportar e Retirar existem', () => {
    setupStore();
    renderPagina(<CofrinhoDetalhePage familiaId={familiaId} cofrinhoId={cofrinhoId} />);

    expect(screen.getByRole('button', { name: /aportar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retirar/i })).toBeInTheDocument();
  });

  it('botao Encerrar existe', () => {
    setupStore();
    renderPagina(<CofrinhoDetalhePage familiaId={familiaId} cofrinhoId={cofrinhoId} />);

    expect(screen.getByRole('button', { name: /encerrar/i })).toBeInTheDocument();
  });

  it('abre modal de aporte ao clicar Aportar', async () => {
    setupStore();
    renderPagina(<CofrinhoDetalhePage familiaId={familiaId} cofrinhoId={cofrinhoId} />);

    fireEvent.click(screen.getByRole('button', { name: /aportar/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    // The aporte modal shows the cofrinho name in its header
    expect(screen.getByText(/Aporte/)).toBeInTheDocument();
  });

  it('exibe loading quando carregando', () => {
    setupStore({ carregando: true, cofrinhoSelecionado: null });
    renderPagina(<CofrinhoDetalhePage familiaId={familiaId} cofrinhoId={cofrinhoId} />);

    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
  });

  it('chama fetchDetalhe ao montar', () => {
    setupStore();
    renderPagina(<CofrinhoDetalhePage familiaId={familiaId} cofrinhoId={cofrinhoId} />);

    expect(mockFetchDetalhe).toHaveBeenCalledWith(familiaId, cofrinhoId);
  });

  it('mostra o título como heading de nível 1 e o Voltar leva a Cofrinhos (link direto)', async () => {
    setupStore();
    renderPagina(
      <CofrinhoDetalhePage familiaId={familiaId} cofrinhoId={cofrinhoId} />,
      '/planejar/cofrinhos/c1',
    );
    expect(screen.getByRole('heading', { level: 1, name: /.+/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.getByTestId('sonda-local')).toHaveTextContent(/^\/planejar\/cofrinhos$/);
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
    renderPagina(<CofrinhoDetalhePage familiaId={familiaId} cofrinhoId={cofrinhoId} />);

    expect(screen.getByRole('button', { name: /aportar/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /retirar/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /editar/i })).toBeDisabled();
  });

  it('abre modal de retirada ao clicar Retirar', async () => {
    setupStore();
    renderPagina(<CofrinhoDetalhePage familiaId={familiaId} cofrinhoId={cofrinhoId} />);

    fireEvent.click(screen.getByRole('button', { name: /retirar/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    expect(screen.getByText(/Retirada/)).toBeInTheDocument();
  });

  it('abre modal de encerrar ao clicar Encerrar', async () => {
    setupStore();
    renderPagina(<CofrinhoDetalhePage familiaId={familiaId} cofrinhoId={cofrinhoId} />);

    fireEvent.click(screen.getByRole('button', { name: /encerrar/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    expect(screen.getByText(/Encerrar Cofrinho/)).toBeInTheDocument();
  });

  it('abre modal de editar ao clicar Editar', async () => {
    setupStore();
    renderPagina(<CofrinhoDetalhePage familiaId={familiaId} cofrinhoId={cofrinhoId} />);

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
    renderPagina(<CofrinhoDetalhePage familiaId={familiaId} cofrinhoId={cofrinhoId} />);

    expect(screen.getByText(/Aporte recorrente/i)).toBeInTheDocument();
    expect(screen.getByText(/200,00/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancelar recorr/i })).toBeInTheDocument();
  });

  it('movimentacoes mostram indicadores de tipo', () => {
    setupStore();
    const { container } = renderPagina(
      <CofrinhoDetalhePage familiaId={familiaId} cofrinhoId={cofrinhoId} />,
    );

    // Aportes têm seta para cima, retiradas seta para baixo (ícones lucide, sem texto)
    expect(container.querySelectorAll('svg.lucide-arrow-up')).toHaveLength(2); // 2 aportes
    expect(container.querySelectorAll('svg.lucide-arrow-down')).toHaveLength(1); // 1 retirada
  });

  it('exibe mensagem quando nao ha movimentacoes', () => {
    setupStore({
      cofrinhoSelecionado: {
        ...baseCofrinhoDetalhe,
        movimentacoes: [],
      },
    });
    renderPagina(<CofrinhoDetalhePage familiaId={familiaId} cofrinhoId={cofrinhoId} />);

    expect(screen.getByText(/nenhuma movimentação/i)).toBeInTheDocument();
  });

  it('exibe dataFimRecorrencia quando presente', () => {
    setupStore({
      cofrinhoSelecionado: {
        ...baseCofrinhoDetalhe,
        aporteRecorrenteAtivo: {
          transacaoPaiId: 'tx-rec-1',
          valor: '200.00',
          frequencia: 'mensal',
          dataFimRecorrencia: '2026-12-31', // formato real da API: coluna `date`, sem hora
        },
      },
    });
    renderPagina(<CofrinhoDetalhePage familiaId={familiaId} cofrinhoId={cofrinhoId} />);

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
    renderPagina(<CofrinhoDetalhePage familiaId={familiaId} cofrinhoId={cofrinhoId} />);

    fireEvent.click(screen.getByRole('button', { name: /cancelar recorr/i }));

    await waitFor(() => {
      expect(mockService.cofrinhoService.cancelarAporteRecorrente).toHaveBeenCalledWith(
        familiaId,
        cofrinhoId,
      );
    });
  });

  describe('Idempotency-Key por envio (#90)', () => {
    const enviarPeloModal = async (abrir: RegExp, confirmar: RegExp) => {
      fireEvent.click(screen.getByRole('button', { name: abrir }));
      const dialog = await screen.findByRole('dialog');
      fireEvent.change(within(dialog).getByLabelText('Valor'), { target: { value: '10' } });
      fireEvent.click(within(dialog).getByRole('button', { name: confirmar }));
    };

    it.each([
      ['aporte', /^aportar$/i, mockService.cofrinhoService.aportar],
      ['retirada', /^retirar$/i, mockService.cofrinhoService.retirar],
    ])('%s: cada envio do usuário manda uma chave nova', async (_op, botao, chamada) => {
      setupStore();
      renderPagina(<CofrinhoDetalhePage familiaId={familiaId} cofrinhoId={cofrinhoId} />);

      await enviarPeloModal(botao, botao);
      await waitFor(() => expect(chamada).toHaveBeenCalledTimes(1));
      await enviarPeloModal(botao, botao);
      await waitFor(() => expect(chamada).toHaveBeenCalledTimes(2));

      const chaves = chamada.mock.calls.map((args: unknown[]) => args[3]);
      expect(chaves[0]).toMatch(/^[0-9a-f-]{36}$/);
      expect(chaves[1]).toMatch(/^[0-9a-f-]{36}$/);
      expect(chaves[0]).not.toBe(chaves[1]);
    });
  });

  // Nova UI, Entrega 1: textos da tela e dos modais de cofrinho estavam sem acento.
  describe('textos com acento', () => {
    const renderizarPagina = () =>
      renderPagina(<CofrinhoDetalhePage familiaId={familiaId} cofrinhoId={cofrinhoId} />);

    const abrirModal = (botao: RegExp) => {
      fireEvent.click(screen.getByRole('button', { name: botao }));
      return screen.findByRole('dialog');
    };

    it('título e estado vazio das movimentações', () => {
      setupStore({ cofrinhoSelecionado: { ...baseCofrinhoDetalhe, movimentacoes: [] } });
      renderizarPagina();

      expect(screen.getByRole('heading', { name: 'Movimentações' })).toBeInTheDocument();
      expect(screen.getByText('Nenhuma movimentação registrada.')).toBeInTheDocument();
    });

    it('aporte recorrente mostra "Até" e "Cancelar recorrência"', () => {
      setupStore({
        cofrinhoSelecionado: {
          ...baseCofrinhoDetalhe,
          aporteRecorrenteAtivo: {
            transacaoPaiId: 'tx-rec-1',
            valor: '200.00',
            frequencia: 'mensal',
            dataFimRecorrencia: '2026-12-31',
          },
        },
      });
      renderizarPagina();

      expect(screen.getByText(/Até:/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancelar recorrência' })).toBeInTheDocument();
    });

    it('modal de aporte', async () => {
      setupStore();
      renderizarPagina();
      const dialog = await abrirModal(/^aportar$/i);

      expect(
        within(dialog).getByText('Será registrado como saída no mês atual.'),
      ).toBeInTheDocument();
    });

    it('modal de retirada', async () => {
      setupStore();
      renderizarPagina();
      const dialog = await abrirModal(/^retirar$/i);

      expect(within(dialog).getByText('Descrição (opcional)')).toBeInTheDocument();
      expect(
        within(dialog).getByText('O valor retorna como receita no mês atual.'),
      ).toBeInTheDocument();
      fireEvent.change(within(dialog).getByLabelText('Valor'), { target: { value: '99999999' } });
      expect(within(dialog).getByText('Valor excede o saldo disponível.')).toBeInTheDocument();
    });

    it('modal de encerrar', async () => {
      setupStore();
      renderizarPagina();
      const dialog = await abrirModal(/encerrar/i);

      expect(
        within(dialog).getByText('O valor retorna como receita no mês atual.'),
      ).toBeInTheDocument();
    });
  });
});
