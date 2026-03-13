import { useCallback, useEffect, useMemo, useState } from 'react';

import { AuthContext, type AuthContextValue } from './auth-context-store';

interface AuthSession {
  accessToken: string;
  refreshToken: string;
}

const AUTH_SESSION_STORAGE_KEY = 'nossagrana.auth.session';

const loadStoredSession = (): AuthSession | null => {
  const rawValue = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as Partial<AuthSession>;
    if (
      typeof parsedValue.accessToken !== 'string' ||
      parsedValue.accessToken.length === 0 ||
      typeof parsedValue.refreshToken !== 'string' ||
      parsedValue.refreshToken.length === 0
    ) {
      return null;
    }

    return {
      accessToken: parsedValue.accessToken,
      refreshToken: parsedValue.refreshToken,
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
    setSession(nextSession);
  }, []);

  const logout = useCallback(() => {
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

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: session !== null,
      accessToken: session?.accessToken ?? null,
      refreshToken: session?.refreshToken ?? null,
      login,
      logout,
      setAccessToken,
    }),
    [login, logout, session, setAccessToken],
  );

  useEffect(() => {
    if (!session) {
      localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      return;
    }

    localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
  }, [session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
