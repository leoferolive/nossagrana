import { useCallback, useEffect, useMemo, useState } from 'react';

import { useWebSocketStore } from '../stores/websocket.store';

import { AuthContext, type AuthContextValue } from './auth-context-store';

interface AuthSession {
  accessToken: string;
  familiaIdAtiva: string;
}

const AUTH_SESSION_STORAGE_KEY = 'nossagrana.auth.session';

/**
 * O refresh token vive em cookie HttpOnly (#116). Sessões gravadas antes da migração ainda
 * têm `refreshToken` no JSON: ele é descartado na leitura e o storage é regravado limpo
 * pelo efeito de persistência abaixo.
 */
const loadStoredSession = (): AuthSession | null => {
  const rawValue = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as Partial<AuthSession>;
    if (typeof parsedValue.accessToken !== 'string' || parsedValue.accessToken.length === 0) {
      return null;
    }

    return {
      accessToken: parsedValue.accessToken,
      familiaIdAtiva:
        typeof parsedValue.familiaIdAtiva === 'string' ? parsedValue.familiaIdAtiva : '',
    };
  } catch {
    return null;
  }
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [session, setSession] = useState<AuthSession | null>(() => loadStoredSession());
  const login = useCallback((nextSession: AuthSession) => {
    localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    setSession(null);
  }, []);

  const setAccessToken = useCallback((accessToken: string) => {
    setSession((currentSession) => {
      if (!currentSession) {
        return null;
      }

      return {
        ...currentSession,
        accessToken,
      };
    });
  }, []);

  const updateFamiliaIdAtiva = useCallback((familiaIdAtiva: string) => {
    const currentRaw = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (currentRaw) {
      const current = JSON.parse(currentRaw) as Partial<AuthSession>;
      localStorage.setItem(
        AUTH_SESSION_STORAGE_KEY,
        JSON.stringify({ ...current, familiaIdAtiva }),
      );
    }
    setSession((s) => (s ? { ...s, familiaIdAtiva } : null));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: session !== null,
      accessToken: session?.accessToken ?? null,
      familiaIdAtiva: session?.familiaIdAtiva ?? null,
      login,
      logout,
      setAccessToken,
      updateFamiliaIdAtiva,
    }),
    [login, logout, session, setAccessToken, updateFamiliaIdAtiva],
  );

  useEffect(() => {
    if (!session) {
      localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      return;
    }

    localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
  }, [session]);

  const wsConnect = useWebSocketStore((s) => s.connect);
  const wsDisconnect = useWebSocketStore((s) => s.disconnect);

  useEffect(() => {
    if (session && session.familiaIdAtiva) {
      wsConnect({
        familiaId: session.familiaIdAtiva,
        clearSession: logout,
      });
    } else {
      wsDisconnect();
    }
  }, [session, wsConnect, wsDisconnect, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
