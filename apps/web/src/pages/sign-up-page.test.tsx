import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/services/api-client';

vi.mock('@/services/auth.service', () => ({
  authService: {
    register: vi.fn(),
    login: vi.fn(),
  },
}));

vi.mock('@/contexts/use-auth', () => ({
  useAuth: vi.fn(),
}));

import { authService } from '@/services/auth.service';
import { useAuth } from '@/contexts/use-auth';
import { SignUpPage } from './sign-up-page';

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

const renderPage = (props: { onOpenLogin?: () => void; onCompleteSignUp?: () => void } = {}) => {
  return render(
    <SignUpPage
      onOpenLogin={props.onOpenLogin ?? vi.fn()}
      onCompleteSignUp={props.onCompleteSignUp ?? vi.fn()}
    />,
  );
};

describe('SignUpPage', () => {
  it('renderiza campos nome, email, senha e confirmSenha', () => {
    renderPage();
    expect(screen.getByLabelText(/nome completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^e-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^senha$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirmar senha/i)).toBeInTheDocument();
  });

  it('exibe erro quando senhas não coincidem', async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText(/nome completo/i), {
      target: { value: 'João Silva' },
    });
    fireEvent.change(screen.getByLabelText(/^e-mail/i), {
      target: { value: 'joao@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^senha$/i), {
      target: { value: 'senha12345' },
    });
    fireEvent.change(screen.getByLabelText(/confirmar senha/i), {
      target: { value: 'senha99999' },
    });

    fireEvent.submit(screen.getByRole('form', { name: /cadastro/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/as senhas não coincidem/i);
    });
    expect(authService.register).not.toHaveBeenCalled();
  });

  it('exibe erro quando senha tem menos de 8 caracteres', async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText(/nome completo/i), {
      target: { value: 'João Silva' },
    });
    fireEvent.change(screen.getByLabelText(/^e-mail/i), {
      target: { value: 'joao@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^senha$/i), {
      target: { value: 'abc' },
    });
    fireEvent.change(screen.getByLabelText(/confirmar senha/i), {
      target: { value: 'abc' },
    });

    fireEvent.submit(screen.getByRole('form', { name: /cadastro/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        /a senha deve ter no mínimo 8 caracteres/i,
      );
    });
    expect(authService.register).not.toHaveBeenCalled();
  });

  it('sucesso: chama register, login e onCompleteSignUp', async () => {
    const onCompleteSignUp = vi.fn();

    vi.mocked(authService.register).mockResolvedValueOnce({
      user: {
        id: 'u1',
        nome: 'João Silva',
        email: 'joao@example.com',
        dataCriacao: '2026-01-01',
      },
    });
    vi.mocked(authService.login).mockResolvedValueOnce({
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-456',
    });

    renderPage({ onCompleteSignUp });

    fireEvent.change(screen.getByLabelText(/nome completo/i), {
      target: { value: 'João Silva' },
    });
    fireEvent.change(screen.getByLabelText(/^e-mail/i), {
      target: { value: 'joao@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^senha$/i), {
      target: { value: 'senha12345' },
    });
    fireEvent.change(screen.getByLabelText(/confirmar senha/i), {
      target: { value: 'senha12345' },
    });

    fireEvent.submit(screen.getByRole('form', { name: /cadastro/i }));

    await waitFor(() => {
      expect(authService.register).toHaveBeenCalledWith({
        nome: 'João Silva',
        email: 'joao@example.com',
        senha: 'senha12345',
      });
    });

    await waitFor(() => {
      expect(authService.login).toHaveBeenCalledWith({
        email: 'joao@example.com',
        senha: 'senha12345',
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
      expect(onCompleteSignUp).toHaveBeenCalled();
    });
  });

  it('exibe mensagem de e-mail já cadastrado quando API retorna erro 409', async () => {
    const error = new ApiError('Conflict', 409);
    vi.mocked(authService.register).mockRejectedValueOnce(error);

    renderPage();

    fireEvent.change(screen.getByLabelText(/nome completo/i), {
      target: { value: 'João Silva' },
    });
    fireEvent.change(screen.getByLabelText(/^e-mail/i), {
      target: { value: 'joao@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^senha$/i), {
      target: { value: 'senha12345' },
    });
    fireEvent.change(screen.getByLabelText(/confirmar senha/i), {
      target: { value: 'senha12345' },
    });

    fireEvent.submit(screen.getByRole('form', { name: /cadastro/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/já está cadastrado/i);
    });
  });

  it('botão fica desabilitado e mostra "Criando conta..." durante loading', async () => {
    let resolveRegister!: (value: {
      user: { id: string; nome: string; email: string; dataCriacao: string };
    }) => void;
    vi.mocked(authService.register).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRegister = resolve;
      }),
    );
    vi.mocked(authService.login).mockResolvedValueOnce({
      accessToken: 'at',
      refreshToken: 'rt',
    });

    renderPage();

    fireEvent.change(screen.getByLabelText(/nome completo/i), {
      target: { value: 'João Silva' },
    });
    fireEvent.change(screen.getByLabelText(/^e-mail/i), {
      target: { value: 'joao@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^senha$/i), {
      target: { value: 'senha12345' },
    });
    fireEvent.change(screen.getByLabelText(/confirmar senha/i), {
      target: { value: 'senha12345' },
    });

    fireEvent.submit(screen.getByRole('form', { name: /cadastro/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /criando conta/i })).toBeDisabled();
    });

    resolveRegister({
      user: { id: 'u1', nome: 'João Silva', email: 'joao@example.com', dataCriacao: '2026-01-01' },
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /criar conta/i })).not.toBeDisabled();
    });
  });
});
