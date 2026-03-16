import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/auth.service', () => ({
  authService: {
    login: vi.fn(),
  },
}));

vi.mock('@/contexts/use-auth', () => ({
  useAuth: vi.fn(),
}));

import { authService } from '@/services/auth.service';
import { useAuth } from '@/contexts/use-auth';
import { LoginPage } from './login-page';

const mockLogin = vi.fn();

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({
    isAuthenticated: false,
    accessToken: null,
    refreshToken: null,
    familiaIdAtiva: null,
    login: mockLogin,
    logout: vi.fn(),
    setAccessToken: vi.fn(),
    updateFamiliaIdAtiva: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderPage = (props: { onOpenSignUp?: () => void; onLoginSuccess?: () => void } = {}) => {
  return render(
    <LoginPage
      onOpenSignUp={props.onOpenSignUp ?? vi.fn()}
      onLoginSuccess={props.onLoginSuccess}
    />,
  );
};

describe('LoginPage', () => {
  it('renderiza os campos de email e senha', () => {
    renderPage();
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
  });

  it('submit sem preencher campos não chama onLoginSuccess', async () => {
    const onLoginSuccess = vi.fn();
    vi.mocked(authService.login).mockRejectedValueOnce(new Error('Credenciais inválidas'));

    renderPage({ onLoginSuccess });

    fireEvent.submit(screen.getByRole('form', { name: /login/i }));

    await waitFor(() => {
      expect(onLoginSuccess).not.toHaveBeenCalled();
    });
  });

  it('com dados válidos chama authService.login e depois onLoginSuccess', async () => {
    const onLoginSuccess = vi.fn();
    vi.mocked(authService.login).mockResolvedValueOnce({
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-456',
    });

    renderPage({ onLoginSuccess });

    fireEvent.change(screen.getByLabelText(/e-mail/i), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/senha/i), {
      target: { value: 'senha123' },
    });

    fireEvent.submit(screen.getByRole('form', { name: /login/i }));

    await waitFor(() => {
      expect(authService.login).toHaveBeenCalledWith({
        email: 'user@example.com',
        senha: 'senha123',
      });
    });

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
        familiaIdAtiva: '',
      });
    });

    await waitFor(() => {
      expect(onLoginSuccess).toHaveBeenCalled();
    });
  });

  it('exibe mensagem de erro quando a API retorna erro', async () => {
    vi.mocked(authService.login).mockRejectedValueOnce(new Error('Credenciais inválidas'));

    renderPage();

    fireEvent.change(screen.getByLabelText(/e-mail/i), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/senha/i), {
      target: { value: 'senhaerrada' },
    });

    fireEvent.submit(screen.getByRole('form', { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('botão fica desabilitado e mostra "Entrando..." durante loading', async () => {
    let resolveLogin!: (value: { accessToken: string; refreshToken: string }) => void;
    vi.mocked(authService.login).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLogin = resolve;
      }),
    );

    renderPage();

    fireEvent.change(screen.getByLabelText(/e-mail/i), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/senha/i), {
      target: { value: 'senha123' },
    });

    fireEvent.submit(screen.getByRole('form', { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /entrando/i })).toBeDisabled();
    });

    resolveLogin({ accessToken: 'at', refreshToken: 'rt' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /entrar/i })).not.toBeDisabled();
    });
  });
});
