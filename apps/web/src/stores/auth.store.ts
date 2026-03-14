import { create } from 'zustand';

interface AuthUser {
  id: string;
  nome: string;
  email: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  setAccessToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  accessToken: typeof window !== 'undefined' ? localStorage.getItem('ng_access_token') : null,
  isAuthenticated: false,

  setAuth: (user, accessToken, refreshToken) => {
    localStorage.setItem('ng_access_token', accessToken);
    localStorage.setItem('ng_refresh_token', refreshToken);
    set({ user, accessToken, isAuthenticated: true });
  },

  setAccessToken: (token) => {
    localStorage.setItem('ng_access_token', token);
    set({ accessToken: token });
  },

  logout: () => {
    localStorage.removeItem('ng_access_token');
    localStorage.removeItem('ng_refresh_token');
    set({ user: null, accessToken: null, isAuthenticated: false });
  },
}));
