import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ResultadoRefresh } from '../services/api-client';
import { useAuthSessionStore } from '../stores/auth-session.store';

import { AuthProvider } from './auth-context';
import { useAuth } from './use-auth';

class FakeApiClient {
  resolver: (resultado: ResultadoRefresh) => void = () => undefined;
  restaurarSessao = vi.fn(
    () =>
      new Promise<ResultadoRefresh>((resolve) => {
        this.resolver = resolve;
      }),
  );
}

const fakeApi = vi.hoisted(() => ({ atual: null as unknown }));

vi.mock('../services/core-financeiro.service', () => ({
  get lazyApiClient() {
    return fakeApi.atual;
  },
}));

vi.mock('../services/auth.service', () => ({
  familiaService: { listarMinhas: async () => ({ familias: [] }) },
}));

vi.mock('../stores/websocket.store', () => ({
  useWebSocketStore: (seletor: (s: { connect: () => void; disconnect: () => void }) => unknown) =>
    seletor({ connect: vi.fn(), disconnect: vi.fn() }),
}));

let api: FakeApiClient;

beforeEach(() => {
  api = new FakeApiClient();
  fakeApi.atual = api;
  useAuthSessionStore.setState({ status: 'carregando', accessToken: null, familiaIdAtiva: null });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const AuthConsumer = () => {
  const { isAuthenticated, accessToken, login, logout } = useAuth();
  return (
    <div>
      <p>authenticated: {isAuthenticated ? 'yes' : 'no'}</p>
      <p>accessToken: {accessToken ?? 'none'}</p>
      <button
        type="button"
        onClick={() => login({ accessToken: 'access-1', familiaIdAtiva: 'f1' })}
      >
        login
      </button>
      <button type="button" onClick={logout}>
        logout
      </button>
    </div>
  );
};

const renderizar = () =>
  render(
    <AuthProvider>
      <AuthConsumer />
    </AuthProvider>,
  );

const tokenNoStorage = (token: string) =>
  [localStorage, sessionStorage].some((s) =>
    Object.keys(s).some((k) => (s.getItem(k) ?? '').includes(token)),
  );

describe('AuthProvider (#117)', () => {
  it('mostra "carregando sessão" e não renderiza o app (nem a tela de login) durante o bootstrap', () => {
    renderizar();

    expect(screen.getByRole('status', { name: /carregando sessão/i })).toBeInTheDocument();
    expect(screen.queryByText(/authenticated:/)).not.toBeInTheDocument();
  });

  it('bootstrap ok: sessão restaurada a partir do refresh (token em memória)', async () => {
    renderizar();
    act(() => {
      useAuthSessionStore.getState().atualizarAccessToken('access-do-refresh');
    });
    await act(async () => api.resolver('ok'));

    await waitFor(() => expect(screen.getByText('authenticated: yes')).toBeInTheDocument());
    expect(screen.getByText('accessToken: access-do-refresh')).toBeInTheDocument();
    expect(tokenNoStorage('access-do-refresh')).toBe(false);
  });

  it('bootstrap 401/403: libera o app deslogado (login)', async () => {
    renderizar();
    await act(async () => api.resolver('sem-sessao'));

    await waitFor(() => expect(screen.getByText('authenticated: no')).toBeInTheDocument());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('servidor indisponível: role=alert com "Tentar novamente", sem cair no login', async () => {
    renderizar();
    await act(async () => api.resolver('indisponivel'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível conectar ao servidor',
    );
    expect(screen.queryByText(/authenticated:/)).not.toBeInTheDocument();
  });

  it('"Tentar novamente" refaz o bootstrap e restaura a sessão', async () => {
    renderizar();
    await act(async () => api.resolver('indisponivel'));

    fireEvent.click(await screen.findByRole('button', { name: /tentar novamente/i }));
    expect(await screen.findByRole('status', { name: /carregando sessão/i })).toBeInTheDocument();
    expect(api.restaurarSessao).toHaveBeenCalledTimes(2);

    act(() => useAuthSessionStore.getState().atualizarAccessToken('a-retry'));
    await act(async () => api.resolver('ok'));

    await waitFor(() => expect(screen.getByText('accessToken: a-retry')).toBeInTheDocument());
  });

  it('login mantém o token só em memória; logout limpa a memória', async () => {
    renderizar();
    await act(async () => api.resolver('sem-sessao'));

    fireEvent.click(await screen.findByRole('button', { name: 'login' }));
    expect(screen.getByText('accessToken: access-1')).toBeInTheDocument();
    expect(tokenNoStorage('access-1')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'logout' }));
    expect(screen.getByText('accessToken: none')).toBeInTheDocument();
    expect(useAuthSessionStore.getState().accessToken).toBeNull();
  });
});
