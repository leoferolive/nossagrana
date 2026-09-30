import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../components/first-time-tour', () => ({
  FirstTimeTour: ({ tourKey }: { tourKey: string }) => <div data-testid={`tour-${tourKey}`} />,
}));

const mockLogout = vi.hoisted(() => vi.fn());

vi.mock('@/contexts/use-auth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    accessToken: 'tok',
    refreshToken: 'ref',
    login: vi.fn(),
    logout: mockLogout,
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

import { ApiError } from '../services/api-client';
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

  async function submeterTrocaDeSenha() {
    render(<PerfilPage onBack={vi.fn()} />);
    await waitFor(() => screen.getByLabelText(/senha atual/i));
    fireEvent.change(screen.getByLabelText(/senha atual/i), { target: { value: 'old123' } });
    fireEvent.change(screen.getByLabelText(/nova senha/i), { target: { value: 'new456' } });
    fireEvent.click(screen.getByRole('button', { name: /alterar senha/i }));
  }

  it('avisa que é preciso entrar novamente e desloga após trocar a senha (#119)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mockService.updateSenha.mockResolvedValue(undefined);
      await submeterTrocaDeSenha();
      await waitFor(() =>
        expect(screen.getByText(/senha alterada\. entre novamente/i)).toBeInTheDocument(),
      );
      expect(mockLogout).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(2500);
      expect(mockLogout).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('mostra "senha atual incorreta" apenas para 401', async () => {
    mockService.updateSenha.mockRejectedValue(new ApiError(401, 'Não autorizado'));
    await submeterTrocaDeSenha();
    await waitFor(() => expect(screen.getByText('Senha atual incorreta.')).toBeInTheDocument());
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('mostra erro genérico em falha 5xx, sem acusar senha incorreta', async () => {
    mockService.updateSenha.mockRejectedValue(new ApiError(500, 'Erro ao processar requisição'));
    await submeterTrocaDeSenha();
    await waitFor(() =>
      expect(screen.getByText(/não foi possível alterar a senha/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText('Senha atual incorreta.')).not.toBeInTheDocument();
  });
});
