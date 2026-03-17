import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/auth.service', () => ({
  familiaService: {
    criar: vi.fn(),
    alternar: vi.fn(),
    entrarPorConvite: vi.fn(),
    buscar: vi.fn(),
    solicitarEntrada: vi.fn(),
  },
}));

vi.mock('@/contexts/use-auth', () => ({
  useAuth: vi.fn(),
}));

import { familiaService } from '@/services/auth.service';
import { useAuth } from '@/contexts/use-auth';
import { OnboardingPage } from './onboarding-page';

const mockUpdateFamiliaIdAtiva = vi.fn();

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({
    isAuthenticated: true,
    accessToken: 'token',
    refreshToken: 'refresh',
    familiaIdAtiva: null,
    login: vi.fn(),
    logout: vi.fn(),
    setAccessToken: vi.fn(),
    updateFamiliaIdAtiva: mockUpdateFamiliaIdAtiva,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderPage = (
  props: { onOpenLogin?: () => void; onOpenFamilySettings?: () => void } = {},
) => {
  return render(
    <OnboardingPage
      onOpenLogin={props.onOpenLogin ?? vi.fn()}
      onOpenFamilySettings={props.onOpenFamilySettings ?? vi.fn()}
    />,
  );
};

describe('OnboardingPage', () => {
  it('renderiza os 3 cards de opção', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /criar família/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tenho um código de convite/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /buscar família/i })).toBeInTheDocument();
  });

  describe('Modo create', () => {
    it('submit chama familiaService.criar, alternar, updateFamiliaIdAtiva e onOpenFamilySettings', async () => {
      const onOpenFamilySettings = vi.fn();
      vi.mocked(familiaService.criar).mockResolvedValueOnce({
        familia: { id: 'fam-123', nome: 'Oliveira', dataCriacao: '2026-01-01' },
      });
      vi.mocked(familiaService.alternar).mockResolvedValueOnce({
        familiaIdAtiva: 'fam-123',
      });

      renderPage({ onOpenFamilySettings });

      fireEvent.click(screen.getByRole('button', { name: /criar família/i }));

      fireEvent.change(screen.getByLabelText(/nome da fam/i), {
        target: { value: 'Oliveira' },
      });

      fireEvent.submit(screen.getByRole('form', { name: /criar famil/i }));

      await waitFor(() => {
        expect(familiaService.criar).toHaveBeenCalledWith({ nome: 'Oliveira' });
      });

      await waitFor(() => {
        expect(familiaService.alternar).toHaveBeenCalledWith('fam-123');
      });

      await waitFor(() => {
        expect(mockUpdateFamiliaIdAtiva).toHaveBeenCalledWith('fam-123');
      });

      await waitFor(() => {
        expect(onOpenFamilySettings).toHaveBeenCalled();
      });
    });

    it('exibe mensagem de erro quando criar falha', async () => {
      vi.mocked(familiaService.criar).mockRejectedValueOnce(new Error('Erro interno'));

      renderPage();

      fireEvent.click(screen.getByRole('button', { name: /criar família/i }));

      fireEvent.change(screen.getByLabelText(/nome da fam/i), {
        target: { value: 'Oliveira' },
      });

      fireEvent.submit(screen.getByRole('form', { name: /criar famil/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/erro ao criar família/i);
      });
    });
  });

  describe('Modo invite', () => {
    it('submit chama entrarPorConvite, alternar e onOpenFamilySettings', async () => {
      const onOpenFamilySettings = vi.fn();
      vi.mocked(familiaService.entrarPorConvite).mockResolvedValueOnce({
        familia: { id: 'fam-456', nome: 'Souza', dataCriacao: '2026-01-01' },
      });
      vi.mocked(familiaService.alternar).mockResolvedValueOnce({
        familiaIdAtiva: 'fam-456',
      });

      renderPage({ onOpenFamilySettings });

      fireEvent.click(screen.getByRole('button', { name: /tenho um código de convite/i }));

      fireEvent.change(screen.getByLabelText(/c.digo de convite/i), {
        target: { value: 'CODIGO123' },
      });

      fireEvent.submit(screen.getByRole('form', { name: /entrar com convite/i }));

      await waitFor(() => {
        expect(familiaService.entrarPorConvite).toHaveBeenCalledWith('CODIGO123');
      });

      await waitFor(() => {
        expect(familiaService.alternar).toHaveBeenCalledWith('fam-456');
      });

      await waitFor(() => {
        expect(mockUpdateFamiliaIdAtiva).toHaveBeenCalledWith('fam-456');
      });

      await waitFor(() => {
        expect(onOpenFamilySettings).toHaveBeenCalled();
      });
    });

    it('exibe mensagem de erro quando convite é inválido', async () => {
      vi.mocked(familiaService.entrarPorConvite).mockRejectedValueOnce(
        new Error('Convite inválido'),
      );

      renderPage();

      fireEvent.click(screen.getByRole('button', { name: /tenho um código de convite/i }));

      fireEvent.change(screen.getByLabelText(/c.digo de convite/i), {
        target: { value: 'INVALIDO' },
      });

      fireEvent.submit(screen.getByRole('form', { name: /entrar com convite/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/código inválido ou expirado/i);
      });
    });
  });

  describe('Modo request', () => {
    it('busca chama familiaService.buscar e exibe resultados', async () => {
      vi.mocked(familiaService.buscar).mockResolvedValueOnce({
        familias: [
          { id: 'fam-789', nome: 'Silva' },
          { id: 'fam-999', nome: 'Silvestrini' },
        ],
      });

      renderPage();

      fireEvent.click(screen.getByRole('button', { name: /buscar família/i }));

      fireEvent.change(screen.getByLabelText(/nome da fam/i), {
        target: { value: 'Silv' },
      });

      fireEvent.submit(screen.getByRole('form', { name: /buscar familia/i }));

      await waitFor(() => {
        expect(familiaService.buscar).toHaveBeenCalledWith('Silv');
      });

      await waitFor(() => {
        expect(screen.getByText('Silva')).toBeInTheDocument();
        expect(screen.getByText('Silvestrini')).toBeInTheDocument();
      });
    });

    it('solicitar entrada chama familiaService.solicitarEntrada e exibe confirmação', async () => {
      vi.mocked(familiaService.buscar).mockResolvedValueOnce({
        familias: [{ id: 'fam-789', nome: 'Silva' }],
      });
      vi.mocked(familiaService.solicitarEntrada).mockResolvedValueOnce({
        solicitacao: {
          id: 'sol-1',
          familiaId: 'fam-789',
          usuarioId: 'usr-1',
          status: 'pendente',
          solicitadoEm: '2026-01-01',
        },
      });

      renderPage();

      fireEvent.click(screen.getByRole('button', { name: /buscar família/i }));

      fireEvent.change(screen.getByLabelText(/nome da fam/i), {
        target: { value: 'Silva' },
      });

      fireEvent.submit(screen.getByRole('form', { name: /buscar familia/i }));

      await waitFor(() => {
        expect(screen.getByText('Silva')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /solicitar entrada/i }));

      await waitFor(() => {
        expect(familiaService.solicitarEntrada).toHaveBeenCalledWith('fam-789');
      });

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });

    it('exibe mensagem de erro quando busca falha', async () => {
      vi.mocked(familiaService.buscar).mockRejectedValueOnce(new Error('Erro de busca'));

      renderPage();

      fireEvent.click(screen.getByRole('button', { name: /buscar família/i }));

      fireEvent.change(screen.getByLabelText(/nome da fam/i), {
        target: { value: 'Test' },
      });

      fireEvent.submit(screen.getByRole('form', { name: /buscar familia/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });
  });
});
