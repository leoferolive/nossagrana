import { beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from './auth.store';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

describe('useAuthStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.getState().logout();
  });

  it('começa sem usuário autenticado', () => {
    const { user, accessToken, isAuthenticated } = useAuthStore.getState();
    expect(user).toBeNull();
    expect(accessToken).toBeNull();
    expect(isAuthenticated).toBe(false);
  });

  it('autentica o usuário com setAuth', () => {
    const userData = { id: '1', nome: 'Leo', email: 'leo@test.com' };
    useAuthStore.getState().setAuth(userData, 'access-token-123', 'refresh-token-456');

    const { user, accessToken, isAuthenticated } = useAuthStore.getState();
    expect(user).toEqual(userData);
    expect(accessToken).toBe('access-token-123');
    expect(isAuthenticated).toBe(true);
  });

  it('persiste o accessToken no localStorage ao autenticar', () => {
    const userData = { id: '1', nome: 'Leo', email: 'leo@test.com' };
    useAuthStore.getState().setAuth(userData, 'access-token-abc', 'refresh-token-xyz');

    expect(localStorage.getItem('ng_access_token')).toBe('access-token-abc');
    expect(localStorage.getItem('ng_refresh_token')).toBe('refresh-token-xyz');
  });

  it('atualiza apenas o accessToken com setAccessToken', () => {
    const userData = { id: '1', nome: 'Leo', email: 'leo@test.com' };
    useAuthStore.getState().setAuth(userData, 'token-old', 'refresh-token');
    useAuthStore.getState().setAccessToken('token-new');

    expect(useAuthStore.getState().accessToken).toBe('token-new');
    expect(localStorage.getItem('ng_access_token')).toBe('token-new');
    expect(useAuthStore.getState().user).toEqual(userData);
  });

  it('limpa o estado e o localStorage ao fazer logout', () => {
    const userData = { id: '1', nome: 'Leo', email: 'leo@test.com' };
    useAuthStore.getState().setAuth(userData, 'token', 'refresh');
    useAuthStore.getState().logout();

    const { user, accessToken, isAuthenticated } = useAuthStore.getState();
    expect(user).toBeNull();
    expect(accessToken).toBeNull();
    expect(isAuthenticated).toBe(false);
    expect(localStorage.getItem('ng_access_token')).toBeNull();
    expect(localStorage.getItem('ng_refresh_token')).toBeNull();
  });
});
