import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/stores/auth.store';

vi.mock('@/services/api', () => ({
  api: {
    post: vi.fn(),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().logout();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderRegister = () =>
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );

  // Importação dinâmica para garantir mock antes da importação
  let RegisterPage: typeof import('./RegisterPage').RegisterPage;
  beforeEach(async () => {
    const mod = await import('./RegisterPage');
    RegisterPage = mod.RegisterPage;
  });

  it('renderiza campos de nome, email, senha e confirmar senha', () => {
    renderRegister();
    expect(screen.getByLabelText(/nome/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^e-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^senha/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirmar senha/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /criar conta/i })).toBeInTheDocument();
  });

  it('exibe link para login', () => {
    renderRegister();
    expect(screen.getByRole('link', { name: /entrar/i })).toBeInTheDocument();
  });

  it('exibe erro quando senhas não coincidem', async () => {
    renderRegister();
    await userEvent.type(screen.getByLabelText(/nome/i), 'Leo');
    await userEvent.type(screen.getByLabelText(/^e-mail/i), 'leo@test.com');
    await userEvent.type(screen.getByLabelText(/^senha/i), 'senha123');
    await userEvent.type(screen.getByLabelText(/confirmar senha/i), 'diferente');
    await userEvent.click(screen.getByRole('button', { name: /criar conta/i }));

    expect(screen.getByText(/senhas não coincidem/i)).toBeInTheDocument();
  });

  it('cadastra com sucesso e redireciona para /', async () => {
    const { api } = await import('@/services/api');
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        accessToken: 'tok-access',
        refreshToken: 'tok-refresh',
        user: { id: '1', nome: 'Leo', email: 'leo@test.com' },
      },
    });

    renderRegister();
    await userEvent.type(screen.getByLabelText(/nome/i), 'Leo');
    await userEvent.type(screen.getByLabelText(/^e-mail/i), 'leo@test.com');
    await userEvent.type(screen.getByLabelText(/^senha/i), 'senha123');
    await userEvent.type(screen.getByLabelText(/confirmar senha/i), 'senha123');
    await userEvent.click(screen.getByRole('button', { name: /criar conta/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('exibe mensagem de erro da API quando cadastro falha', async () => {
    const { api } = await import('@/services/api');
    vi.mocked(api.post).mockRejectedValueOnce({
      response: { data: { message: 'E-mail já cadastrado' } },
    });

    renderRegister();
    await userEvent.type(screen.getByLabelText(/nome/i), 'Leo');
    await userEvent.type(screen.getByLabelText(/^e-mail/i), 'leo@test.com');
    await userEvent.type(screen.getByLabelText(/^senha/i), 'senha123');
    await userEvent.type(screen.getByLabelText(/confirmar senha/i), 'senha123');
    await userEvent.click(screen.getByRole('button', { name: /criar conta/i }));

    await waitFor(() => {
      expect(screen.getByText(/e-mail já cadastrado/i)).toBeInTheDocument();
    });
  });
});
