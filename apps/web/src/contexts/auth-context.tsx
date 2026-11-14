import { useCallback, useEffect, useMemo } from 'react';

import { familiaService } from '../services/auth.service';
import { lazyApiClient } from '../services/core-financeiro.service';
import { bootstrapSessao } from '../services/sessao-bootstrap';
import { useAuthSessionStore } from '../stores/auth-session.store';
import { useWebSocketStore } from '../stores/websocket.store';

import { AuthContext, type AuthContextValue } from './auth-context-store';

interface AuthProviderProps {
  children: React.ReactNode;
}

/** Evita o flash da tela de login enquanto o refresh do bootstrap decide se há sessão. */
const SessaoCarregando = () => (
  <div
    role="status"
    aria-label="Carregando sessão"
    className="flex min-h-screen items-center justify-center bg-bg text-text-muted"
  >
    Carregando...
  </div>
);

const listarFamiliaIds = async (): Promise<string[]> =>
  (await familiaService.listarMinhas()).familias.map((familia) => familia.id);

const iniciarBootstrap = (): void => {
  void bootstrapSessao(lazyApiClient, listarFamiliaIds);
};

/** Servidor inalcançável no bootstrap: o cookie pode estar válido, então não mostramos o login. */
const SessaoIndisponivel = () => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg p-4 text-text">
    <p role="alert" className="text-center">
      Não foi possível conectar ao servidor
    </p>
    <button
      type="button"
      className="rounded-lg border border-border bg-panel px-4 py-2 text-text hover:bg-surface"
      onClick={() => {
        useAuthSessionStore.getState().tentarNovamente();
        iniciarBootstrap();
      }}
    >
      Tentar novamente
    </button>
  </div>
);

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const status = useAuthSessionStore((s) => s.status);
  const accessToken = useAuthSessionStore((s) => s.accessToken);
  const familiaIdAtiva = useAuthSessionStore((s) => s.familiaIdAtiva);

  useEffect(iniciarBootstrap, []);

  const login = useCallback((s: { accessToken: string; familiaIdAtiva: string }) => {
    useAuthSessionStore.getState().iniciarSessao(s.accessToken, s.familiaIdAtiva);
  }, []);
  const logout = useCallback(() => useAuthSessionStore.getState().encerrarSessao(), []);
  const setAccessToken = useCallback(
    (token: string) => useAuthSessionStore.getState().atualizarAccessToken(token),
    [],
  );
  const updateFamiliaIdAtiva = useCallback(
    (id: string) => useAuthSessionStore.getState().definirFamiliaAtiva(id),
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: status === 'autenticado',
      accessToken,
      familiaIdAtiva,
      login,
      logout,
      setAccessToken,
      updateFamiliaIdAtiva,
    }),
    [status, accessToken, familiaIdAtiva, login, logout, setAccessToken, updateFamiliaIdAtiva],
  );

  const wsConnect = useWebSocketStore((s) => s.connect);
  const wsDisconnect = useWebSocketStore((s) => s.disconnect);

  useEffect(() => {
    if (status === 'autenticado' && familiaIdAtiva) {
      wsConnect({ familiaId: familiaIdAtiva, clearSession: logout });
    } else {
      wsDisconnect();
    }
  }, [status, familiaIdAtiva, wsConnect, wsDisconnect, logout]);

  if (status === 'carregando') return <SessaoCarregando />;
  if (status === 'indisponivel') return <SessaoIndisponivel />;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
