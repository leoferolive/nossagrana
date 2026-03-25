import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCategoriaStore } from '@/stores/categoria.store';
import { CategoriasPage } from './categorias-page';

vi.mock('@/contexts/use-auth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    accessToken: 'tok',
    refreshToken: 'ref',
    login: vi.fn(),
    logout: vi.fn(),
    setAccessToken: vi.fn(),
  }),
}));

const mockListar = vi.fn();
const mockCriar = vi.fn();
const mockEditar = vi.fn();
const mockDesativar = vi.fn();

vi.mock('@/services/core-financeiro.service', () => ({
  categoriaService: {
    listar: (...args: unknown[]) => mockListar(...args),
    criar: (...args: unknown[]) => mockCriar(...args),
    editar: (...args: unknown[]) => mockEditar(...args),
    desativar: (...args: unknown[]) => mockDesativar(...args),
  },
}));

afterEach(() => {
  cleanup();
  useCategoriaStore.setState({ categorias: [], carregando: false, erro: null });
  vi.clearAllMocks();
});

const CATEGORIAS = [
  {
    id: 'c1',
    nome: 'Mercado',
    tipo: 'despesa' as const,
    ativo: true,
    familiaId: 'f1',
    criadoPor: 'u1',
    criadoEm: '2026-01-01',
  },
  {
    id: 'c2',
    nome: 'Salario',
    tipo: 'receita' as const,
    ativo: true,
    familiaId: 'f1',
    criadoPor: 'u1',
    criadoEm: '2026-01-01',
  },
];

describe('CategoriasPage', () => {
  beforeEach(() => {
    useCategoriaStore.setState({ categorias: CATEGORIAS, carregando: false, erro: null });
  });

  it('exibe lista de categorias', () => {
    mockListar.mockResolvedValue({ categorias: CATEGORIAS });
    render(<CategoriasPage familiaId="f1" onBack={vi.fn()} />);
    expect(screen.getAllByText('Mercado').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Salario').length).toBeGreaterThan(0);
  });

  it('exibe seções DESPESAS e RECEITAS', () => {
    mockListar.mockResolvedValue({ categorias: CATEGORIAS });
    render(<CategoriasPage familiaId="f1" onBack={vi.fn()} />);
    expect(screen.getAllByText(/despesas/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/receitas/i).length).toBeGreaterThan(0);
  });

  it('abre formulário de nova categoria ao clicar em adicionar', () => {
    mockListar.mockResolvedValue({ categorias: CATEGORIAS });
    render(<CategoriasPage familiaId="f1" onBack={vi.fn()} />);
    const addButtons = screen.getAllByRole('button', { name: /nova categoria/i });
    fireEvent.click(addButtons[0]);
    expect(screen.getByLabelText(/nome/i)).toBeInTheDocument();
  });

  it('exibe botão de desativar por categoria', () => {
    mockListar.mockResolvedValue({ categorias: CATEGORIAS });
    render(<CategoriasPage familiaId="f1" onBack={vi.fn()} />);
    const deleteButtons = screen.getAllByRole('button', { name: /desativar/i });
    // Desktop (2) + Mobile (2) = 4
    expect(deleteButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('chama onBack ao clicar em voltar', () => {
    mockListar.mockResolvedValue({ categorias: CATEGORIAS });
    const onBack = vi.fn();
    render(<CategoriasPage familiaId="f1" onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));
    expect(onBack).toHaveBeenCalled();
  });

  // ── Novos testes TDD ────────────────────────────────────────────────────────

  it('chama categoriaService.listar ao montar com familiaId', async () => {
    mockListar.mockResolvedValue({ categorias: CATEGORIAS });
    render(<CategoriasPage familiaId="f1" onBack={vi.fn()} />);
    await waitFor(() => {
      expect(mockListar).toHaveBeenCalledWith('f1');
    });
  });

  it('exibe categorias retornadas pelo serviço após montagem', async () => {
    useCategoriaStore.setState({ categorias: [], carregando: false, erro: null });
    mockListar.mockResolvedValue({ categorias: CATEGORIAS });
    render(<CategoriasPage familiaId="f1" onBack={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getAllByText('Mercado').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Salario').length).toBeGreaterThan(0);
    });
  });

  it('salvar no modo create chama categoriaService.criar e fecha formulário', async () => {
    mockListar.mockResolvedValue({ categorias: CATEGORIAS });
    const novaCategoria = {
      id: 'c3',
      nome: 'Transporte',
      tipo: 'despesa' as const,
      ativo: true,
      familiaId: 'f1',
      criadoPor: 'u1',
      criadoEm: '2026-01-01',
    };
    mockCriar.mockResolvedValue({ categoria: novaCategoria });

    render(<CategoriasPage familiaId="f1" onBack={vi.fn()} />);

    const addButtons = screen.getAllByRole('button', { name: /nova categoria/i });
    fireEvent.click(addButtons[0]);

    const input = screen.getByLabelText(/nome/i);
    fireEvent.change(input, { target: { value: 'Transporte' } });

    fireEvent.click(screen.getByRole('button', { name: /^salvar$/i }));

    await waitFor(() => {
      expect(mockCriar).toHaveBeenCalledWith({ nome: 'Transporte', tipo: 'despesa' }, 'f1');
    });

    // Formulário deve fechar após salvar
    await waitFor(() => {
      expect(screen.queryByLabelText(/nome/i)).not.toBeInTheDocument();
    });
  });

  it('salvar no modo edit chama categoriaService.editar', async () => {
    mockListar.mockResolvedValue({ categorias: CATEGORIAS });
    const categoriaAtualizada = {
      ...CATEGORIAS[0],
      nome: 'Mercado Novo',
    };
    mockEditar.mockResolvedValue({ categoria: categoriaAtualizada });

    render(<CategoriasPage familiaId="f1" onBack={vi.fn()} />);

    const editButtons = screen.getAllByRole('button', { name: /editar mercado/i });
    fireEvent.click(editButtons[0]);

    const input = screen.getByLabelText(/nome/i);
    fireEvent.change(input, { target: { value: 'Mercado Novo' } });

    fireEvent.click(screen.getByRole('button', { name: /^salvar$/i }));

    await waitFor(() => {
      expect(mockEditar).toHaveBeenCalledWith(
        'c1',
        { nome: 'Mercado Novo', tipo: 'despesa' },
        'f1',
      );
    });
  });

  it('exibe erro ao falhar carregamento de categorias', async () => {
    useCategoriaStore.setState({ categorias: [], carregando: false, erro: null });
    mockListar.mockRejectedValue(new Error('Falha'));
    render(<CategoriasPage familiaId="f1" onBack={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/erro ao carregar categorias/i);
    });
  });

  it('exibe erro ao falhar ao salvar categoria', async () => {
    mockListar.mockResolvedValue({ categorias: CATEGORIAS });
    mockCriar.mockRejectedValue(new Error('Falha'));
    render(<CategoriasPage familiaId="f1" onBack={vi.fn()} />);

    const addButtons = screen.getAllByRole('button', { name: /nova categoria/i });
    fireEvent.click(addButtons[0]);

    const input = screen.getByLabelText(/nome/i);
    fireEvent.change(input, { target: { value: 'Transporte' } });
    fireEvent.click(screen.getByRole('button', { name: /^salvar$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/erro ao salvar categoria/i);
    });
  });

  it('exibe erro ao falhar desativacao de categoria', async () => {
    mockListar.mockResolvedValue({ categorias: CATEGORIAS });
    mockDesativar.mockRejectedValue(new Error('Falha'));
    render(<CategoriasPage familiaId="f1" onBack={vi.fn()} />);

    const desativarButtons = screen.getAllByRole('button', { name: /desativar/i });
    fireEvent.click(desativarButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/erro ao desativar categoria/i);
    });
  });

  it('desativar chama categoriaService.desativar e remove do store', async () => {
    mockListar.mockResolvedValue({ categorias: CATEGORIAS });
    mockDesativar.mockResolvedValue({ success: true });

    render(<CategoriasPage familiaId="f1" onBack={vi.fn()} />);

    const desativarButtons = screen.getAllByRole('button', { name: /desativar/i });
    fireEvent.click(desativarButtons[0]);

    await waitFor(() => {
      expect(mockDesativar).toHaveBeenCalledWith('c1', 'f1');
    });

    await waitFor(() => {
      expect(screen.queryByText('Mercado')).not.toBeInTheDocument();
    });
  });
});
