import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockService = vi.hoisted(() => ({
  getOrcamentos: vi.fn(),
  setOrcamento: vi.fn(),
}));

vi.mock('../services/core-financeiro.service', () => ({
  coreFinanceiroService: mockService,
}));

vi.mock('../components/first-time-tour', () => ({
  FirstTimeTour: ({ tourKey }: { tourKey: string }) => <div data-testid={`tour-${tourKey}`} />,
}));

import { OrcamentoPage } from './orcamento-page';

const familiaId = 'fam-1';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  mockService.getOrcamentos.mockResolvedValue({ orcamentos: [] });
});

describe('OrcamentoPage', () => {
  it('renders heading', async () => {
    render(<OrcamentoPage familiaId={familiaId} onBack={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /orçamento/i })).toBeInTheDocument(),
    );
  });

  it('shows loading state', () => {
    mockService.getOrcamentos.mockReturnValue(new Promise(() => {}));
    render(<OrcamentoPage familiaId={familiaId} onBack={vi.fn()} />);
    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
  });

  it('renders orcamento rows after load', async () => {
    mockService.getOrcamentos.mockResolvedValue({
      orcamentos: [
        {
          id: 'o1',
          categoriaId: 'c1',
          categoriaNome: 'Alimentação',
          valorLimite: '500.00',
          vigenciaInicio: '2026-03',
          vigenciaFim: null,
          totalGasto: '250.00',
          percentual: 50,
          status: 'ok',
        },
      ],
    });
    render(<OrcamentoPage familiaId={familiaId} onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Alimentação')).toBeInTheDocument());
    expect(screen.getByText(/500/)).toBeInTheDocument();
    expect(screen.getByText(/50%/)).toBeInTheDocument();
  });

  it('calls onBack when back button clicked', async () => {
    const onBack = vi.fn();
    render(<OrcamentoPage familiaId={familiaId} onBack={onBack} />);
    await waitFor(() => screen.getByRole('button', { name: /voltar/i }));
    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it('opens edit form and submits new limit', async () => {
    mockService.getOrcamentos
      .mockResolvedValueOnce({
        orcamentos: [
          {
            id: 'o1',
            categoriaId: 'c1',
            categoriaNome: 'Alimentação',
            valorLimite: '500.00',
            vigenciaInicio: '2026-03',
            vigenciaFim: null,
            totalGasto: '250.00',
            percentual: 50,
            status: 'ok',
          },
        ],
      })
      .mockResolvedValue({ orcamentos: [] });
    mockService.setOrcamento.mockResolvedValue({ orcamento: {} });

    render(<OrcamentoPage familiaId={familiaId} onBack={vi.fn()} />);
    await waitFor(() => screen.getByText('Alimentação'));
    fireEvent.click(screen.getByRole('button', { name: /editar limite/i }));

    const input = screen.getByLabelText(/novo limite/i);
    fireEvent.change(input, { target: { value: '800' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() =>
      expect(mockService.setOrcamento).toHaveBeenCalledWith(
        familiaId,
        'c1',
        expect.objectContaining({ valorLimite: '800' }),
      ),
    );
  });

  it('exibe o tour de orçamento', async () => {
    render(<OrcamentoPage familiaId={familiaId} onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('tour-orcamento')).toBeInTheDocument());
  });
});
