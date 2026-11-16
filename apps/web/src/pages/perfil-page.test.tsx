import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockLogout = vi.hoisted(() => vi.fn());

vi.mock('@/contexts/use-auth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    accessToken: 'tok',
    login: vi.fn(),
    logout: mockLogout,
    setAccessToken: vi.fn(),
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
import { renderPagina } from '../test/render-pagina';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  mockService.getPerfil.mockResolvedValue({ nome: 'Maria', email: 'maria@example.com' });
});

describe('PerfilPage', () => {
  it('renderiza o título Perfil', async () => {
    renderPagina(<PerfilPage />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /perfil/i })).toBeInTheDocument(),
    );
  });

  it('exibe nome e email carregados', async () => {
    renderPagina(<PerfilPage />);
    await waitFor(() => expect(screen.getByDisplayValue('Maria')).toBeInTheDocument());
    expect(screen.getByDisplayValue('maria@example.com')).toBeInTheDocument();
  });

  it('chama updatePerfil ao salvar nome', async () => {
    mockService.updatePerfil.mockResolvedValue({ nome: 'Maria Silva', email: 'maria@example.com' });
    renderPagina(<PerfilPage />);
    await waitFor(() => screen.getByDisplayValue('Maria'));
    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: 'Maria Silva' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar perfil/i }));
    await waitFor(() =>
      expect(mockService.updatePerfil).toHaveBeenCalledWith({ nome: 'Maria Silva' }),
    );
  });

  it('exibe formulário de troca de senha', async () => {
    renderPagina(<PerfilPage />);
    await waitFor(() => screen.getByLabelText(/senha atual/i));
    expect(screen.getByLabelText(/nova senha/i)).toBeInTheDocument();
  });

  it('chama updateSenha ao submeter troca de senha', async () => {
    mockService.updateSenha.mockResolvedValue({});
    renderPagina(<PerfilPage />);
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

  it('mostra o título como heading de nível 1 e o Voltar leva a Mais (link direto)', async () => {
    renderPagina(<PerfilPage />, '/mais/perfil');
    await waitFor(() => screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Perfil' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.getByTestId('sonda-local')).toHaveTextContent(/^\/mais$/);
  });

  it('exibe mensagem de sucesso ao salvar perfil', async () => {
    mockService.updatePerfil.mockResolvedValue({ nome: 'Maria', email: 'maria@example.com' });
    renderPagina(<PerfilPage />);
    await waitFor(() => screen.getByDisplayValue('Maria'));
    fireEvent.click(screen.getByRole('button', { name: /salvar perfil/i }));
    await waitFor(() => expect(screen.getByText(/salvo/i)).toBeInTheDocument());
  });

  async function submeterTrocaDeSenha() {
    renderPagina(<PerfilPage />);
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
