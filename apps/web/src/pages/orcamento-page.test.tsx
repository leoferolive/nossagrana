import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockService = vi.hoisted(() => ({
  getOrcamentos: vi.fn(),
  setOrcamento: vi.fn(),
}));

const mockCategoriaService = vi.hoisted(() => ({
  listar: vi.fn(),
}));

vi.mock('../services/core-financeiro.service', () => ({
  coreFinanceiroService: mockService,
  categoriaService: mockCategoriaService,
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
  mockCategoriaService.listar.mockResolvedValue({
    categorias: [
      { id: 'c1', nome: 'Alimentação', tipo: 'despesa', ativo: true },
      { id: 'c2', nome: 'Lazer', tipo: 'despesa', ativo: true },
      { id: 'c3', nome: 'Salário', tipo: 'receita', ativo: true },
    ],
  });
});

describe('OrcamentoPage', () => {
  it('renders heading', async () => {
    render(<OrcamentoPage familiaId={familiaId} onBack={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /orçamento mensal/i })).toBeInTheDocument(),
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
    await waitFor(() => expect(screen.getAllByText('Alimentação').length).toBeGreaterThan(0));
    expect(screen.getAllByText(/500/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/50%/).length).toBeGreaterThan(0);
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
    await waitFor(() => expect(screen.getAllByText('Alimentação').length).toBeGreaterThan(0));
    const editButtons = screen.getAllByRole('button', { name: /editar limite/i });
    fireEvent.click(editButtons[0]);

    const input = screen.getAllByLabelText(/novo limite/i)[0];
    fireEvent.change(input, { target: { value: '800' } });
    const saveButtons = screen.getAllByRole('button', { name: /salvar/i });
    fireEvent.click(saveButtons[0]);

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

  it('exibe empty state melhorado com CTA quando não há orçamentos', async () => {
    render(<OrcamentoPage familiaId={familiaId} onBack={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByText(/nenhum orçamento configurado/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/defina limites mensais/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /configurar orçamento/i })).toBeInTheDocument();
  });

  it('exibe formulário de adicionar categoria ao clicar no botão', async () => {
    render(<OrcamentoPage familiaId={familiaId} onBack={vi.fn()} />);
    await waitFor(() => screen.getByRole('button', { name: /configurar orçamento/i }));
    fireEvent.click(screen.getByRole('button', { name: /configurar orçamento/i }));
    await waitFor(() => expect(screen.getByLabelText(/categoria/i)).toBeInTheDocument());
    expect(screen.getByLabelText(/valor limite/i)).toBeInTheDocument();
  });

  it('filtra categorias de receita e categorias já com orçamento do select', async () => {
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
    await waitFor(() => expect(screen.getAllByText('Alimentação').length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: /adicionar categoria/i }));
    await waitFor(() => screen.getByLabelText(/categoria/i));
    const select = screen.getByLabelText(/categoria/i);
    // Alimentação (c1) já tem orçamento, Salário (c3) é receita → só deve ter Lazer (c2)
    expect(select).toBeInTheDocument();
    const options = select.querySelectorAll('option:not([value=""])');
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toBe('Lazer');
  });

  it('salva novo orçamento de categoria', async () => {
    mockService.setOrcamento.mockResolvedValue({ orcamento: {} });
    render(<OrcamentoPage familiaId={familiaId} onBack={vi.fn()} />);
    await waitFor(() => screen.getByRole('button', { name: /configurar orçamento/i }));
    fireEvent.click(screen.getByRole('button', { name: /configurar orçamento/i }));
    await waitFor(() => screen.getByLabelText(/categoria/i));

    fireEvent.change(screen.getByLabelText(/categoria/i), { target: { value: 'c1' } });
    fireEvent.change(screen.getByLabelText(/valor limite/i), { target: { value: '600' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() =>
      expect(mockService.setOrcamento).toHaveBeenCalledWith(
        familiaId,
        'c1',
        expect.objectContaining({ valorLimite: '600' }),
      ),
    );
  });
});
