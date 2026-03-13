import { useCallback, useMemo, useState } from 'react';

import { AuthContext, type AuthContextValue } from './auth-context-store';

interface AuthSession {
  accessToken: string;
  refreshToken: string;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [session, setSession] = useState<AuthSession | null>(null);
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
