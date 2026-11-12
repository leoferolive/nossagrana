import { useCallback, useEffect, useMemo } from 'react';

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

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const status = useAuthSessionStore((s) => s.status);
  const accessToken = useAuthSessionStore((s) => s.accessToken);
  const familiaIdAtiva = useAuthSessionStore((s) => s.familiaIdAtiva);

  useEffect(() => {
    void bootstrapSessao(lazyApiClient);
  }, []);

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
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
