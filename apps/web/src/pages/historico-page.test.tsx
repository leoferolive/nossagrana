import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockService = vi.hoisted(() => ({
  getHistorico: vi.fn(),
  getHistoricoDetalhe: vi.fn(),
}));

vi.mock('../services/core-financeiro.service', () => ({
  coreFinanceiroService: mockService,
}));

vi.mock('react-chartjs-2', () => ({
  Line: ({ data }: { data: { labels: string[]; datasets: { label: string }[] } }) => (
    <div data-testid="chart-tendencia">
      {data.labels.map((l: string) => <span key={l}>{l}</span>)}
      {data.datasets.map((d: { label: string }) => <span key={d.label}>{d.label}</span>)}
    </div>
  ),
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
    await waitFor(() =>
      expect(screen.getByText(/nenhum histórico/i)).toBeInTheDocument(),
    );
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
    await waitFor(() =>
      expect(screen.getAllByText(/fev.*2026/i).length).toBeGreaterThan(0),
    );
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
    await waitFor(() => expect(screen.getByText(/divergente/i)).toBeInTheDocument());
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
    await waitFor(() => expect(screen.getByText(/fev.*2026/i)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/fev.*2026/i));

    await waitFor(() =>
      expect(screen.getByText(/alimentação/i)).toBeInTheDocument(),
    );
    expect(mockService.getHistoricoDetalhe).toHaveBeenCalledWith(familiaId, '2026-02');
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
      await waitFor(() =>
        expect(screen.getByTestId('chart-tendencia')).toBeInTheDocument(),
      );
    });

    it('não renderiza o gráfico quando há menos de 2 meses', async () => {
      mockService.getHistorico.mockResolvedValue({ meses: [mesesComDados[0]] });
      render(<HistoricoPage familiaId={familiaId} onBack={vi.fn()} />);
      await waitFor(() => screen.getByText(/mar.*2026/i));
      expect(screen.queryByTestId('chart-tendencia')).not.toBeInTheDocument();
    });

    it('o gráfico inclui as séries de receitas, despesas e saldo', async () => {
      mockService.getHistorico.mockResolvedValue({ meses: mesesComDados });
      render(<HistoricoPage familiaId={familiaId} onBack={vi.fn()} />);
      await waitFor(() => screen.getByTestId('chart-tendencia'));
      expect(screen.getByText(/receitas/i)).toBeInTheDocument();
      expect(screen.getByText(/despesas/i)).toBeInTheDocument();
      expect(screen.getByText(/saldo/i)).toBeInTheDocument();
    });

    it('os labels do gráfico estão em ordem cronológica crescente', async () => {
      mockService.getHistorico.mockResolvedValue({ meses: mesesComDados });
      render(<HistoricoPage familiaId={familiaId} onBack={vi.fn()} />);
      await waitFor(() => screen.getByTestId('chart-tendencia'));
      const labels = screen.getAllByText(/jan|fev|mar/i);
      const texts = labels.map((el) => el.textContent ?? '');
      const janIdx = texts.findIndex((t) => /jan/i.test(t));
      const fevIdx = texts.findIndex((t) => /fev/i.test(t));
      const marIdx = texts.findIndex((t) => /mar/i.test(t));
      expect(janIdx).toBeLessThan(fevIdx);
      expect(fevIdx).toBeLessThan(marIdx);
    });
  });
});
