import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/stores/auth.store';

import { LoginPage } from './LoginPage';

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

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().logout();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderLogin = () =>
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

  it('renderiza campos de email e senha e botão de login', () => {
    renderLogin();
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
  });

  it('exibe link para a tela de cadastro', () => {
    renderLogin();
    expect(screen.getByRole('link', { name: /criar conta/i })).toBeInTheDocument();
  });

  it('faz login com sucesso e redireciona para /', async () => {
    const { api } = await import('@/services/api');
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        accessToken: 'tok-access',
        refreshToken: 'tok-refresh',
        user: { id: '1', nome: 'Leo', email: 'leo@test.com' },
      },
    });

    renderLogin();
    await userEvent.type(screen.getByLabelText(/e-mail/i), 'leo@test.com');
    await userEvent.type(screen.getByLabelText(/senha/i), 'senha123');
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    const { isAuthenticated, user } = useAuthStore.getState();
    expect(isAuthenticated).toBe(true);
    expect(user?.email).toBe('leo@test.com');
  });

  it('exibe mensagem de erro quando o login falha', async () => {
    const { api } = await import('@/services/api');
    vi.mocked(api.post).mockRejectedValueOnce({
      response: { data: { message: 'Credenciais inválidas' } },
    });

    renderLogin();
    await userEvent.type(screen.getByLabelText(/e-mail/i), 'leo@test.com');
    await userEvent.type(screen.getByLabelText(/senha/i), 'errada');
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(screen.getByText(/credenciais inválidas/i)).toBeInTheDocument();
    });
  });

  it('desabilita o botão enquanto o login está sendo processado', async () => {
    const { api } = await import('@/services/api');
    let resolve: (value: unknown) => void;
    vi.mocked(api.post).mockReturnValueOnce(new Promise((r) => (resolve = r)));

    renderLogin();
    await userEvent.type(screen.getByLabelText(/e-mail/i), 'leo@test.com');
    await userEvent.type(screen.getByLabelText(/senha/i), 'senha123');
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }));

    expect(screen.getByRole('button', { name: /entrando/i })).toBeDisabled();
    resolve!({ data: { accessToken: 'tok', refreshToken: 'ref', user: { id: '1', nome: 'L', email: 'l@t.com' } } });
  });
});
