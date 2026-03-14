import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

afterEach(() => {
  cleanup();
  useCategoriaStore.setState({ categorias: [], carregando: false, erro: null });
});

const CATEGORIAS = [
  { id: 'c1', nome: 'Mercado', tipo: 'despesa' as const, ativo: true, familiaId: 'f1', criadoPor: 'u1', criadoEm: '2026-01-01' },
  { id: 'c2', nome: 'Salario', tipo: 'receita' as const, ativo: true, familiaId: 'f1', criadoPor: 'u1', criadoEm: '2026-01-01' },
];

describe('CategoriasPage', () => {
  beforeEach(() => {
    useCategoriaStore.setState({ categorias: CATEGORIAS, carregando: false, erro: null });
  });

  it('exibe lista de categorias', () => {
    render(<CategoriasPage familiaId="f1" onBack={vi.fn()} />);
    expect(screen.getByText('Mercado')).toBeInTheDocument();
    expect(screen.getByText('Salario')).toBeInTheDocument();
  });

  it('exibe badge de tipo', () => {
    render(<CategoriasPage familiaId="f1" onBack={vi.fn()} />);
    expect(screen.getByText('despesa')).toBeInTheDocument();
    expect(screen.getByText('receita')).toBeInTheDocument();
  });

  it('abre formulário de nova categoria ao clicar em adicionar', () => {
    render(<CategoriasPage familiaId="f1" onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /nova categoria/i }));
    expect(screen.getByLabelText(/nome/i)).toBeInTheDocument();
  });

  it('exibe botão de desativar por categoria', () => {
    render(<CategoriasPage familiaId="f1" onBack={vi.fn()} />);
    const deleteButtons = screen.getAllByRole('button', { name: /desativar/i });
    expect(deleteButtons).toHaveLength(2);
  });

  it('chama onBack ao clicar em voltar', () => {
    const onBack = vi.fn();
    render(<CategoriasPage familiaId="f1" onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));
    expect(onBack).toHaveBeenCalled();
  });
});
