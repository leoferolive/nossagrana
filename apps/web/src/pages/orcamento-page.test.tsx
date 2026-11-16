import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
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
import { renderPagina } from '../test/render-pagina';

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
    renderPagina(<OrcamentoPage familiaId={familiaId} />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /orçamento mensal/i })).toBeInTheDocument(),
    );
  });

  it('shows loading state', () => {
    mockService.getOrcamentos.mockReturnValue(new Promise(() => {}));
    renderPagina(<OrcamentoPage familiaId={familiaId} />);
    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
  });

  // Regressão: a vigência "2026-03" era lida como UTC e aparecia como fevereiro.
  it('mostra "vigente desde" com o mês da vigência, não o anterior', async () => {
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
    renderPagina(<OrcamentoPage familiaId={familiaId} />);

    expect(await screen.findByText('Vigente desde mar. de 2026')).toBeInTheDocument();
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
    renderPagina(<OrcamentoPage familiaId={familiaId} />);
    await waitFor(() => expect(screen.getAllByText('Alimentação').length).toBeGreaterThan(0));
    expect(screen.getAllByText(/500/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/50%/).length).toBeGreaterThan(0);
  });

  it('mostra o título como heading de nível 1 e o Voltar leva a Planejar (link direto)', async () => {
    renderPagina(<OrcamentoPage familiaId={familiaId} />, '/planejar/limites');
    await waitFor(() => screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.getByRole('heading', { level: 1, name: /orçamento/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.getByTestId('sonda-local')).toHaveTextContent(/^\/planejar$/);
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

    renderPagina(<OrcamentoPage familiaId={familiaId} />);
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
    renderPagina(<OrcamentoPage familiaId={familiaId} />);
    await waitFor(() => expect(screen.getByTestId('tour-orcamento')).toBeInTheDocument());
  });

  it('exibe empty state melhorado com CTA quando não há orçamentos', async () => {
    renderPagina(<OrcamentoPage familiaId={familiaId} />);
    await waitFor(() =>
      expect(screen.getByText(/nenhum orçamento configurado/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/defina limites mensais/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /configurar orçamento/i })).toBeInTheDocument();
  });

  it('exibe formulário de adicionar categoria ao clicar no botão', async () => {
    renderPagina(<OrcamentoPage familiaId={familiaId} />);
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
    renderPagina(<OrcamentoPage familiaId={familiaId} />);
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

  it('exibe erro ao falhar carregamento de categorias disponiveis', async () => {
    mockService.getOrcamentos.mockResolvedValue({ orcamentos: [] });
    mockCategoriaService.listar.mockRejectedValue(new Error('Falha'));
    renderPagina(<OrcamentoPage familiaId={familiaId} />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/erro ao carregar categorias/i);
    });
  });

  it('salva novo orçamento de categoria', async () => {
    mockService.setOrcamento.mockResolvedValue({ orcamento: {} });
    renderPagina(<OrcamentoPage familiaId={familiaId} />);
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
