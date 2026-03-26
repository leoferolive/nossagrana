import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../components/first-time-tour', () => ({
  FirstTimeTour: ({ tourKey }: { tourKey: string }) => <div data-testid={`tour-${tourKey}`} />,
}));

vi.mock('@/contexts/use-auth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    accessToken: 'tok',
    refreshToken: 'ref',
    login: vi.fn(),
    logout: vi.fn(),
    setAccessToken: vi.fn(),
    setRefreshToken: vi.fn(),
  }),
}));

const mockService = vi.hoisted(() => ({
  getPerfil: vi.fn(),
  updatePerfil: vi.fn(),
  updateSenha: vi.fn(),
}));

vi.mock('../services/core-financeiro.service', () => ({
  coreFinanceiroService: mockService,
}));

import { PerfilPage } from './perfil-page';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  mockService.getPerfil.mockResolvedValue({ nome: 'Maria', email: 'maria@example.com' });
});

describe('PerfilPage', () => {
  it('renderiza o título Perfil', async () => {
    render(<PerfilPage onBack={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /perfil/i })).toBeInTheDocument(),
    );
  });

  it('exibe nome e email carregados', async () => {
    render(<PerfilPage onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByDisplayValue('Maria')).toBeInTheDocument());
    expect(screen.getByDisplayValue('maria@example.com')).toBeInTheDocument();
  });

  it('chama updatePerfil ao salvar nome', async () => {
    mockService.updatePerfil.mockResolvedValue({ nome: 'Maria Silva', email: 'maria@example.com' });
    render(<PerfilPage onBack={vi.fn()} />);
    await waitFor(() => screen.getByDisplayValue('Maria'));
    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: 'Maria Silva' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar perfil/i }));
    await waitFor(() =>
      expect(mockService.updatePerfil).toHaveBeenCalledWith({ nome: 'Maria Silva' }),
    );
  });

  it('exibe formulário de troca de senha', async () => {
    render(<PerfilPage onBack={vi.fn()} />);
    await waitFor(() => screen.getByLabelText(/senha atual/i));
    expect(screen.getByLabelText(/nova senha/i)).toBeInTheDocument();
  });

  it('chama updateSenha ao submeter troca de senha', async () => {
    mockService.updateSenha.mockResolvedValue({});
    render(<PerfilPage onBack={vi.fn()} />);
    await waitFor(() => screen.getByLabelText(/senha atual/i));
    fireEvent.change(screen.getByLabelText(/senha atual/i), { target: { value: 'old123' } });
    fireEvent.change(screen.getByLabelText(/nova senha/i), { target: { value: 'new456' } });
    fireEvent.click(screen.getByRole('button', { name: /alterar senha/i }));
    await waitFor(() =>
      expect(mockService.updateSenha).toHaveBeenCalledWith({
        senhaAtual: 'old123',
        novaSenha: 'new456',
      }),
    );
  });

  it('chama onBack ao clicar em Voltar', async () => {
    const onBack = vi.fn();
    render(<PerfilPage onBack={onBack} />);
    await waitFor(() => screen.getByRole('button', { name: /voltar/i }));
    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it('exibe mensagem de sucesso ao salvar perfil', async () => {
    mockService.updatePerfil.mockResolvedValue({ nome: 'Maria', email: 'maria@example.com' });
    render(<PerfilPage onBack={vi.fn()} />);
    await waitFor(() => screen.getByDisplayValue('Maria'));
    fireEvent.click(screen.getByRole('button', { name: /salvar perfil/i }));
    await waitFor(() => expect(screen.getByText(/salvo/i)).toBeInTheDocument());
  });
});
