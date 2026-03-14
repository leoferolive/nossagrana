import { createContext } from 'react';

interface AuthSession {
  accessToken: string;
  refreshToken: string;
}

export interface AuthContextValue {
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  login: (session: AuthSession) => void;
  logout: () => void;
  setAccessToken: (accessToken: string) => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
