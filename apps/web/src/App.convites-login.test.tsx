import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fillSignUpForm, resetAppMocks } from '@/test/app-mocks';

import { App } from './App';
import { useAuth } from './contexts/use-auth';

afterEach(resetAppMocks);

describe('App > fluxo não autenticado > convites e login', () => {
  beforeEach(() => {
    let currentFamiliaId: string | null = null;
    vi.mocked(useAuth).mockImplementation(() => ({
      isAuthenticated: false as const,
      accessToken: null,
      refreshToken: null,
      familiaIdAtiva: currentFamiliaId,
      login: vi.fn(),
      logout: vi.fn(),
      setAccessToken: vi.fn(),
      setRefreshToken: vi.fn(),
      updateFamiliaIdAtiva: vi.fn((id: string) => {
        currentFamiliaId = id;
      }),
    }));
  });

  it('manages pending requests in family settings', { timeout: 15000 }, async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /cadastre-se/i }));
    fillSignUpForm();
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /entrar numa família/i })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: /criar família/i }));
    fireEvent.change(screen.getByLabelText(/nome da fam/i), {
      target: { value: 'Familia Test' },
    });
    fireEvent.submit(screen.getByRole('form', { name: /criar fam/i }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /família/i })).toBeInTheDocument(),
    );

    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: /^aprovar$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /^rejeitar$/i })).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    fireEvent.click(screen.getByRole('button', { name: /^aprovar$/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^aprovar$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^rejeitar$/i })).not.toBeInTheDocument();
    });
  });

  it('generates and copies invite code in family settings', { timeout: 15000 }, async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /cadastre-se/i }));
    fillSignUpForm();
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /entrar numa família/i })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: /criar família/i }));
    fireEvent.change(screen.getByLabelText(/nome da fam/i), {
      target: { value: 'Familia Test' },
    });
    fireEvent.submit(screen.getByRole('form', { name: /criar fam/i }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /família/i })).toBeInTheDocument(),
    );

    await waitFor(
      () =>
        expect(
          screen.getByRole('button', { name: /gerar c.digo de convite/i }),
        ).toBeInTheDocument(),
      { timeout: 3000 },
    );
    fireEvent.click(screen.getByRole('button', { name: /gerar c.digo de convite/i }));

    await waitFor(
      () => {
        expect(screen.getByText(/FAM-LEO-2026/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /copiar/i })).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    fireEvent.click(screen.getByRole('button', { name: /copiar/i }));

    expect(writeText).toHaveBeenCalledWith('FAM-LEO-2026');
    expect(await screen.findByText(/c.digo copiado/i)).toBeInTheDocument();
  });

  it('exibe seletor de família quando login retorna múltiplas famílias', async () => {
    const { familiaService } = await import('./services/auth.service');
    vi.mocked(familiaService.listarMinhas).mockResolvedValueOnce({
      familias: [
        { id: 'fam-1', nome: 'Família 1', dataEntrada: '2026-01-01', role: 'admin' },
        { id: 'fam-2', nome: 'Família 2', dataEntrada: '2026-01-02', role: 'membro' },
      ],
    });

    let authenticated = false;
    vi.mocked(useAuth).mockImplementation(() => ({
      isAuthenticated: authenticated,
      accessToken: authenticated ? 'token' : null,
      refreshToken: null,
      familiaIdAtiva: null,
      login: vi.fn(() => {
        authenticated = true;
      }),
      logout: vi.fn(),
      setAccessToken: vi.fn(),
      setRefreshToken: vi.fn(),
      updateFamiliaIdAtiva: vi.fn(),
    }));

    render(<App />);
    fireEvent.submit(screen.getByRole('form', { name: /login/i }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /escolha uma família/i })).toBeInTheDocument(),
    );
  });

  it('login com uma única família chama updateFamiliaIdAtiva e navega para dashboard', async () => {
    const updateFamilia = vi.fn();
    vi.mocked(useAuth).mockImplementation(() => ({
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      familiaIdAtiva: null,
      login: vi.fn(),
      logout: vi.fn(),
      setAccessToken: vi.fn(),
      setRefreshToken: vi.fn(),
      updateFamiliaIdAtiva: updateFamilia,
    }));

    const { familiaService } = await import('./services/auth.service');
    vi.mocked(familiaService.listarMinhas).mockResolvedValueOnce({
      familias: [
        { id: 'fam-only', nome: 'Unica Familia', dataEntrada: '2026-01-01', role: 'admin' },
      ],
    });

    render(<App />);
    fireEvent.submit(screen.getByRole('form', { name: /login/i }));

    await waitFor(() => {
      expect(updateFamilia).toHaveBeenCalledWith('fam-only');
    });
  });

  it('navega para onboarding quando familiaId não existe após login', async () => {
    render(<App />);

    // Trigger onLoginSuccess → sem familiaId → setScreen('onboarding')
    fireEvent.submit(screen.getByRole('form', { name: /login/i }));

    // Deve ir para onboarding quando não há familiaId
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /entrar numa família/i })).toBeInTheDocument(),
    );
  });
});
