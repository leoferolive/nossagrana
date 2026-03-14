import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-chartjs-2', () => ({
  Doughnut: () => <canvas data-testid="doughnut" />,
  Line: () => <canvas data-testid="line" />,
}));

const mockService = vi.hoisted(() => ({
  getRelatorioDistribuicao: vi.fn(),
  getRelatorioPorUsuario: vi.fn(),
  getRelatorioTendencias: vi.fn(),
}));

vi.mock('../services/core-financeiro.service', () => ({
  coreFinanceiroService: mockService,
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

  it('calls onBack when back button clicked', async () => {
    const onBack = vi.fn();
    render(<RelatoriosPage familiaId={familiaId} onBack={onBack} />);
    await waitFor(() => screen.getByRole('button', { name: /voltar/i }));
    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it('shows distribuicao tab by default with donut chart when there is data', async () => {
    mockService.getRelatorioDistribuicao.mockResolvedValue({
      mesReferencia: '2026-03',
      distribuicao: [
        { categoriaId: 'c1', categoriaNome: 'Alimentação', total: '300.00', percentual: 60 },
        { categoriaId: 'c2', categoriaNome: 'Lazer', total: '200.00', percentual: 40 },
      ],
    });
    render(<RelatoriosPage familiaId={familiaId} onBack={vi.fn()} />);
    await waitFor(() => screen.getByText('Alimentação'));
    expect(screen.getByTestId('doughnut')).toBeInTheDocument();
  });

  it('switches to por-membro tab', async () => {
    mockService.getRelatorioPorUsuario.mockResolvedValue({
      mesReferencia: '2026-03',
      porUsuario: [
        { usuarioId: 'u1', usuarioNome: 'Leo', total: '400.00', percentual: 80 },
      ],
    });
    render(<RelatoriosPage familiaId={familiaId} onBack={vi.fn()} />);
    await waitFor(() => screen.getByRole('tab', { name: /por membro/i }));
    fireEvent.click(screen.getByRole('tab', { name: /por membro/i }));
    await waitFor(() => screen.getByText('Leo'));
    expect(screen.getByText(/400/)).toBeInTheDocument();
  });

  it('switches to tendencias tab and shows line chart', async () => {
    mockService.getRelatorioTendencias.mockResolvedValue({
      meses: [
        { mesReferencia: '2026-01', totalReceitas: '5000.00', totalDespesas: '3000.00', saldo: '2000.00' },
        { mesReferencia: '2026-02', totalReceitas: '4500.00', totalDespesas: '3200.00', saldo: '1300.00' },
        { mesReferencia: '2026-03', totalReceitas: '5200.00', totalDespesas: '2800.00', saldo: '2400.00' },
      ],
    });
    render(<RelatoriosPage familiaId={familiaId} onBack={vi.fn()} />);
    await waitFor(() => screen.getByRole('tab', { name: /tendências/i }));
    fireEvent.click(screen.getByRole('tab', { name: /tendências/i }));
    await waitFor(() => screen.getByTestId('line'));
  });
});
