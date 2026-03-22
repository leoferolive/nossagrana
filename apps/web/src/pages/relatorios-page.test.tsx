import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockService = vi.hoisted(() => ({
  getRelatorioDistribuicao: vi.fn(),
  getRelatorioPorUsuario: vi.fn(),
  getRelatorioTendencias: vi.fn(),
}));

vi.mock('../services/core-financeiro.service', () => ({
  coreFinanceiroService: mockService,
}));

vi.mock('../components/first-time-tour', () => ({
  FirstTimeTour: ({ tourKey }: { tourKey: string }) => <div data-testid={`tour-${tourKey}`} />,
}));

import { RelatoriosPage } from './relatorios-page';

const familiaId = 'fam-1';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  mockService.getRelatorioDistribuicao.mockResolvedValue({
    mesReferencia: '2026-03',
    distribuicao: [],
  });
  mockService.getRelatorioPorUsuario.mockResolvedValue({
    mesReferencia: '2026-03',
    porUsuario: [],
  });
  mockService.getRelatorioTendencias.mockResolvedValue({ meses: [] });
});

describe('RelatoriosPage', () => {
  it('renders heading', async () => {
    render(<RelatoriosPage familiaId={familiaId} onBack={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /relatórios/i })).toBeInTheDocument(),
    );
  });

  it('shows distribuicao tab by default with category data', async () => {
    mockService.getRelatorioDistribuicao.mockResolvedValue({
      mesReferencia: '2026-03',
      distribuicao: [
        { categoriaId: 'c1', categoriaNome: 'Alimentação', total: '300.00', percentual: 60 },
        { categoriaId: 'c2', categoriaNome: 'Lazer', total: '200.00', percentual: 40 },
      ],
    });
    render(<RelatoriosPage familiaId={familiaId} onBack={vi.fn()} />);
    await waitFor(() => screen.getAllByText('Alimentação'));
    expect(screen.getAllByText('Alimentação').length).toBeGreaterThan(0);
  });

  it('switches to por-membro tab', async () => {
    mockService.getRelatorioPorUsuario.mockResolvedValue({
      mesReferencia: '2026-03',
      porUsuario: [{ usuarioId: 'u1', usuarioNome: 'Leo', total: '400.00', percentual: 80 }],
    });
    render(<RelatoriosPage familiaId={familiaId} onBack={vi.fn()} />);
    await waitFor(() => screen.getByRole('tab', { name: /por membro/i }));
    fireEvent.click(screen.getByRole('tab', { name: /por membro/i }));
    await waitFor(() => screen.getByText('Leo'));
    expect(screen.getByText(/400/)).toBeInTheDocument();
  });

  it('exibe banner de erro quando a requisição falha', async () => {
    mockService.getRelatorioDistribuicao.mockRejectedValue(new Error('network'));
    render(<RelatoriosPage familiaId={familiaId} onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('exibe seletor de mês e re-fetch ao mudar', async () => {
    render(<RelatoriosPage familiaId={familiaId} onBack={vi.fn()} />);
    await waitFor(() => screen.getByLabelText(/mês anterior/i));
    expect(screen.getByLabelText(/mês anterior/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/próximo mês/i)).toBeInTheDocument();

    // Mudar para mês anterior deve re-fetch distribuição e porUsuario
    fireEvent.click(screen.getByLabelText(/mês anterior/i));
    await waitFor(() => expect(mockService.getRelatorioDistribuicao).toHaveBeenCalledTimes(2));
    expect(mockService.getRelatorioPorUsuario).toHaveBeenCalledTimes(2);
    // Tendências não devem ser re-fetched
    expect(mockService.getRelatorioTendencias).toHaveBeenCalledTimes(1);
  });

  it('passes mesReferencia to distribuição and porUsuario APIs', async () => {
    render(<RelatoriosPage familiaId={familiaId} onBack={vi.fn()} />);
    await waitFor(() => expect(mockService.getRelatorioDistribuicao).toHaveBeenCalled());
    // Chamada inicial usa mês atual
    expect(mockService.getRelatorioDistribuicao).toHaveBeenCalledWith(
      familiaId,
      expect.stringMatching(/^\d{4}-\d{2}$/),
    );
    expect(mockService.getRelatorioPorUsuario).toHaveBeenCalledWith(
      familiaId,
      expect.stringMatching(/^\d{4}-\d{2}$/),
    );
  });

  it('switches to tendencias tab and shows charts', async () => {
    mockService.getRelatorioTendencias.mockResolvedValue({
      meses: [
        {
          mesReferencia: '2026-01',
          totalReceitas: '5000.00',
          totalDespesas: '3000.00',
          saldo: '2000.00',
        },
        {
          mesReferencia: '2026-02',
          totalReceitas: '4500.00',
          totalDespesas: '3200.00',
          saldo: '1300.00',
        },
        {
          mesReferencia: '2026-03',
          totalReceitas: '5200.00',
          totalDespesas: '2800.00',
          saldo: '2400.00',
        },
      ],
    });
    render(<RelatoriosPage familiaId={familiaId} onBack={vi.fn()} />);
    await waitFor(() => screen.getByRole('tab', { name: /tendências/i }));
    fireEvent.click(screen.getByRole('tab', { name: /tendências/i }));
    await waitFor(() => screen.getByText(/receitas/i));
    expect(screen.getByText(/receitas/i)).toBeInTheDocument();
  });
});
