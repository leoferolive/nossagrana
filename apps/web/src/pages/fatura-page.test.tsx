import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockService = vi.hoisted(() => ({
  getFatura: vi.fn(),
}));

vi.mock('../services/core-financeiro.service', () => ({
  coreFinanceiroService: mockService,
}));

import { FaturaPage } from './fatura-page';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('FaturaPage', () => {
  const props = {
    familiaId: 'fam-1',
    metodoPagamentoId: 'mp-1',
    metodoPagamentoNome: 'Visa',
    mesReferencia: '2026-03',
    onBack: vi.fn(),
  };

  beforeEach(() => {
    mockService.getFatura.mockResolvedValue({
      metodoPagamentoId: 'mp-1',
      mesReferencia: '2026-03',
      total: '0.00',
      transacoes: [],
    });
  });

  it('renders heading with card name', async () => {
    render(<FaturaPage {...props} />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /fatura.*visa/i })).toBeInTheDocument(),
    );
    expect(screen.getByText(/2026-03/)).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockService.getFatura.mockReturnValue(new Promise(() => {}));
    render(<FaturaPage {...props} />);
    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
  });

  it('shows empty state', async () => {
    render(<FaturaPage {...props} />);
    await waitFor(() => screen.getByRole('heading', { name: /fatura.*visa/i }));
    expect(screen.getByText(/nenhuma transação/i)).toBeInTheDocument();
  });

  it('renders transactions with parcela info', async () => {
    mockService.getFatura.mockResolvedValue({
      metodoPagamentoId: 'mp-1',
      mesReferencia: '2026-03',
      total: '350.00',
      transacoes: [
        {
          id: 't1',
          descricao: 'Mercado',
          valor: '200.00',
          data: '2026-03-10',
          categoriaId: 'c1',
          categoriaNome: 'Alimentação',
          usuarioNome: 'Leo',
          parcelaAtual: null,
          numeroParcelas: null,
        },
        {
          id: 't2',
          descricao: 'Cinema',
          valor: '150.00',
          data: '2026-03-15',
          categoriaId: 'c2',
          categoriaNome: 'Lazer',
          usuarioNome: 'Ana',
          parcelaAtual: 1,
          numeroParcelas: 3,
        },
      ],
    });
    render(<FaturaPage {...props} />);
    await waitFor(() => screen.getByText('Mercado'));
    expect(screen.getByText('Cinema')).toBeInTheDocument();
    expect(screen.getByText(/parcela 1\/3/i)).toBeInTheDocument();
    expect(screen.getByText(/total/i)).toBeInTheDocument();
    expect(screen.getByText(/350/)).toBeInTheDocument();
  });

  it('calls onBack when back button clicked', async () => {
    const onBack = vi.fn();
    render(<FaturaPage {...{ ...props, onBack }} />);
    await waitFor(() => screen.getByRole('button', { name: /voltar/i }));
    screen.getByRole('button', { name: /voltar/i }).click();
    expect(onBack).toHaveBeenCalled();
  });
});
