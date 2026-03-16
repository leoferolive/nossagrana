import { createContext } from 'react';

interface AuthSession {
  accessToken: string;
  refreshToken: string;
  familiaIdAtiva: string;
}

export interface AuthContextValue {
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  familiaIdAtiva: string | null;
  login: (session: AuthSession) => void;
  logout: () => void;
  setAccessToken: (accessToken: string) => void;
  updateFamiliaIdAtiva: (familiaIdAtiva: string) => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
