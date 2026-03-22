import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockService = vi.hoisted(() => ({
  getHistorico: vi.fn(),
  getHistoricoDetalhe: vi.fn(),
  gerarSnapshot: vi.fn(),
}));

vi.mock('../services/core-financeiro.service', () => ({
  coreFinanceiroService: mockService,
}));

vi.mock('../components/first-time-tour', () => ({
  FirstTimeTour: ({ tourKey }: { tourKey: string }) => <div data-testid={`tour-${tourKey}`} />,
}));

import { HistoricoPage } from './historico-page';

const familiaId = 'fam-1';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  mockService.getHistorico.mockResolvedValue({ meses: [] });
});

describe('HistoricoPage', () => {
  it('renderiza o título', async () => {
    render(<HistoricoPage familiaId={familiaId} onBack={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /histórico/i })).toBeInTheDocument(),
    );
  });

  it('mostra estado de carregamento', () => {
    mockService.getHistorico.mockReturnValue(new Promise(() => {}));
    render(<HistoricoPage familiaId={familiaId} onBack={vi.fn()} />);
    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
  });

  it('mostra mensagem de empty state quando não há meses', async () => {
    render(<HistoricoPage familiaId={familiaId} onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/nenhum histórico/i)).toBeInTheDocument());
  });

  it('lista meses com snapshot e sem snapshot', async () => {
    mockService.getHistorico.mockResolvedValue({
      meses: [
        {
          mesReferencia: '2026-02',
          totalReceitas: '2000.00',
          totalDespesas: '1200.00',
          saldo: '800.00',
          temSnapshot: true,
          divergente: false,
          geradoEm: '2026-02-28T23:55:00.000Z',
        },
        {
          mesReferencia: '2026-01',
          totalReceitas: '1800.00',
          totalDespesas: '900.00',
          saldo: '900.00',
          temSnapshot: false,
          divergente: false,
          geradoEm: null,
        },
      ],
    });
    render(<HistoricoPage familiaId={familiaId} onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByText(/fev.*2026/i).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/jan.*2026/i).length).toBeGreaterThan(0);
  });

  it('indica divergente com indicador visual', async () => {
    mockService.getHistorico.mockResolvedValue({
      meses: [
        {
          mesReferencia: '2025-12',
          totalReceitas: '1500.00',
          totalDespesas: '800.00',
          saldo: '700.00',
          temSnapshot: true,
          divergente: true,
          geradoEm: '2025-12-31T23:55:00.000Z',
        },
      ],
    });
    render(<HistoricoPage familiaId={familiaId} onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByText(/divergente/i).length).toBeGreaterThan(0));
  });

  it('chama onBack ao clicar em voltar', async () => {
    const onBack = vi.fn();
    render(<HistoricoPage familiaId={familiaId} onBack={onBack} />);
    await waitFor(() => screen.getByRole('button', { name: /voltar/i }));
    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it('abre detalhe do mês ao clicar', async () => {
    mockService.getHistorico.mockResolvedValue({
      meses: [
        {
          mesReferencia: '2026-02',
          totalReceitas: '2000.00',
          totalDespesas: '1200.00',
          saldo: '800.00',
          temSnapshot: true,
          divergente: false,
          geradoEm: '2026-02-28T23:55:00.000Z',
        },
      ],
    });
    mockService.getHistoricoDetalhe.mockResolvedValue({
      mesReferencia: '2026-02',
      atual: { totalReceitas: '2100.00', totalDespesas: '1250.00', saldo: '850.00' },
      snapshot: {
        totalReceitas: '2000.00',
        totalDespesas: '1200.00',
        saldo: '800.00',
        geradoEm: '2026-02-28T23:55:00.000Z',
        divergente: false,
        dadosCategorias: [{ categoriaId: 'c1', categoriaNome: 'Alimentação', total: '500.00' }],
        dadosUsuarios: [{ usuarioId: 'u1', usuarioNome: 'Maria', total: '500.00' }],
      },
    });

    render(<HistoricoPage familiaId={familiaId} onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByText(/fev.*2026/i).length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText(/fev.*2026/i)[0]);

    await waitFor(() => expect(screen.getByText(/alimentação/i)).toBeInTheDocument());
    expect(mockService.getHistoricoDetalhe).toHaveBeenCalledWith(familiaId, '2026-02');
  });

  it('exibe banner de erro quando a requisição falha', async () => {
    mockService.getHistorico.mockRejectedValue(new Error('network'));
    render(<HistoricoPage familiaId={familiaId} onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('exibe o tour de histórico', async () => {
    render(<HistoricoPage familiaId={familiaId} onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('tour-historico')).toBeInTheDocument());
  });

  it('exibe botão "Gerar Snapshot" para meses abertos (sem snapshot)', async () => {
    mockService.getHistorico.mockResolvedValue({
      meses: [
        {
          mesReferencia: '2026-01',
          totalReceitas: '1800.00',
          totalDespesas: '900.00',
          saldo: '900.00',
          temSnapshot: false,
          divergente: false,
          geradoEm: null,
        },
      ],
    });
    render(<HistoricoPage familiaId={familiaId} onBack={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /gerar snapshot/i }).length).toBeGreaterThan(0),
    );
  });

  it('não exibe botão "Gerar Snapshot" para meses já fechados', async () => {
    mockService.getHistorico.mockResolvedValue({
      meses: [
        {
          mesReferencia: '2026-02',
          totalReceitas: '2000.00',
          totalDespesas: '1200.00',
          saldo: '800.00',
          temSnapshot: true,
          divergente: false,
          geradoEm: '2026-02-28T23:55:00.000Z',
        },
      ],
    });
    render(<HistoricoPage familiaId={familiaId} onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByText(/fev.*2026/i).length).toBeGreaterThan(0));
    expect(screen.queryByRole('button', { name: /gerar snapshot/i })).not.toBeInTheDocument();
  });

  it('chama gerarSnapshot e re-fetch ao clicar no botão', async () => {
    mockService.getHistorico
      .mockResolvedValueOnce({
        meses: [
          {
            mesReferencia: '2026-01',
            totalReceitas: '1800.00',
            totalDespesas: '900.00',
            saldo: '900.00',
            temSnapshot: false,
            divergente: false,
            geradoEm: null,
          },
        ],
      })
      .mockResolvedValue({
        meses: [
          {
            mesReferencia: '2026-01',
            totalReceitas: '1800.00',
            totalDespesas: '900.00',
            saldo: '900.00',
            temSnapshot: true,
            divergente: false,
            geradoEm: '2026-03-19T00:00:00.000Z',
          },
        ],
      });
    mockService.gerarSnapshot.mockResolvedValue({
      mesReferencia: '2026-01',
      totalReceitas: '1800.00',
      totalDespesas: '900.00',
      saldo: '900.00',
      geradoEm: '2026-03-19T00:00:00.000Z',
    });
    render(<HistoricoPage familiaId={familiaId} onBack={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /gerar snapshot/i }).length).toBeGreaterThan(0),
    );
    fireEvent.click(screen.getAllByRole('button', { name: /gerar snapshot/i })[0]);
    await waitFor(() =>
      expect(mockService.gerarSnapshot).toHaveBeenCalledWith(familiaId, '2026-01'),
    );
    await waitFor(() => expect(mockService.getHistorico).toHaveBeenCalledTimes(2));
  });

  describe('gráfico de tendência', () => {
    const mesesComDados = [
      {
        mesReferencia: '2026-03',
        totalReceitas: '2200.00',
        totalDespesas: '1400.00',
        saldo: '800.00',
        temSnapshot: false,
        divergente: false,
        geradoEm: null,
      },
      {
        mesReferencia: '2026-02',
        totalReceitas: '2000.00',
        totalDespesas: '1200.00',
        saldo: '800.00',
        temSnapshot: true,
        divergente: false,
        geradoEm: '2026-02-28T23:55:00.000Z',
      },
      {
        mesReferencia: '2026-01',
        totalReceitas: '1800.00',
        totalDespesas: '900.00',
        saldo: '900.00',
        temSnapshot: true,
        divergente: false,
        geradoEm: '2026-01-31T23:55:00.000Z',
      },
    ];

    it('renderiza o gráfico de tendência quando há 2 ou mais meses', async () => {
      mockService.getHistorico.mockResolvedValue({ meses: mesesComDados });
      render(<HistoricoPage familiaId={familiaId} onBack={vi.fn()} />);
      await waitFor(() => expect(screen.getAllByText(/tendência/i).length).toBeGreaterThan(0));
    });

    it('não renderiza o gráfico quando há menos de 2 meses', async () => {
      mockService.getHistorico.mockResolvedValue({ meses: [mesesComDados[0]] });
      render(<HistoricoPage familiaId={familiaId} onBack={vi.fn()} />);
      await waitFor(() => screen.getAllByText(/mar.*2026/i));
      expect(screen.queryByText(/tendência/i)).not.toBeInTheDocument();
    });

    it('o gráfico inclui as séries de receitas, despesas e saldo', async () => {
      mockService.getHistorico.mockResolvedValue({ meses: mesesComDados });
      render(<HistoricoPage familiaId={familiaId} onBack={vi.fn()} />);
      await waitFor(() => screen.getAllByText(/tendência/i));
      expect(screen.getAllByText(/receitas/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/despesas/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/saldo/i).length).toBeGreaterThan(0);
    });

    it('os labels do gráfico estão em ordem cronológica crescente', async () => {
      mockService.getHistorico.mockResolvedValue({ meses: mesesComDados });
      render(<HistoricoPage familiaId={familiaId} onBack={vi.fn()} />);
      // Os meses são ordenados cronologicamente (mesesOrdenados = [...meses].reverse())
      // meses vêm do mais recente para o mais antigo, então reversed = jan, fev, mar
      await waitFor(() => screen.getAllByText(/tendência/i));
      const allText = document.body.textContent ?? '';
      const janPos = allText.indexOf('jan');
      const fevPos = allText.indexOf('fev');
      const marPos = allText.indexOf('mar');
      expect(janPos).toBeLessThan(fevPos);
      expect(fevPos).toBeLessThan(marPos);
    });
  });
});
