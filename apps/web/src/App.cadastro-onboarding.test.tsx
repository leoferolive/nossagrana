import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fillSignUpForm, resetAppMocks } from '@/test/app-mocks';

import { App } from './App';
import { useAuth } from './contexts/use-auth';

afterEach(resetAppMocks);

describe('App > fluxo não autenticado > cadastro e onboarding', () => {
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

  it('renders login screen', () => {
    render(<App />);

    expect(screen.getByText('NossaGrana')).toBeInTheDocument();
    expect(screen.getByText(/finanças da família/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/senha/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
    expect(screen.getByText(/não tem conta\?/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cadastre-se/i })).toBeInTheDocument();
  });

  it('navigates to sign up screen', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /cadastre-se/i }));

    expect(screen.getByRole('heading', { name: /criar conta/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /voltar/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/nome/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^e-mail$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^senha$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continuar/i })).toBeInTheDocument();
  });

  it('opens onboarding flow after sign up submit', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /cadastre-se/i }));
    fillSignUpForm();
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /entrar numa família/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /criar família/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tenho um código de convite/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /buscar família/i })).toBeInTheDocument();
  });

  it('opens family settings screen from onboarding via criar familia', async () => {
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
  });

  it(
    'lists members and allows removing a member in family settings',
    { timeout: 15000 },
    async () => {
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
          expect(screen.getAllByText(/leo/i).length).toBeGreaterThan(0);
          expect(screen.getByRole('button', { name: /remover maria/i })).toBeInTheDocument();
        },
        { timeout: 3000 },
      );

      fireEvent.click(screen.getByRole('button', { name: /remover maria/i }));

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /remover maria/i })).not.toBeInTheDocument();
      });
    },
  );
});
