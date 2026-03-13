import { createContext, useContext, useMemo, useState } from 'react';

interface AuthSession {
  accessToken: string;
  refreshToken: string;
}

interface AuthContextValue {
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  login: (session: AuthSession) => void;
  logout: () => void;
  setAccessToken: (accessToken: string) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [session, setSession] = useState<AuthSession | null>(null);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: session !== null,
      accessToken: session?.accessToken ?? null,
      refreshToken: session?.refreshToken ?? null,
      login: (nextSession) => setSession(nextSession),
      logout: () => setSession(null),
      setAccessToken: (accessToken) =>
        setSession((currentSession) => {
          if (!currentSession) {
            return null;
          }

          return {
            ...currentSession,
            accessToken,
          };
        }),
    }),
    [session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};
