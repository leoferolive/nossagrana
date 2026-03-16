import type { FC, ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AuthContext } from './auth-context-store';
import { useAuth } from './use-auth';

describe('useAuth', () => {
  it('returns auth context when provider is present', () => {
    const wrapper: FC<{ children: ReactNode }> = ({ children }) => (
      <AuthContext.Provider
        value={{
          accessToken: 'token',
          refreshToken: 'refresh',
          isAuthenticated: true,
          familiaIdAtiva: null,
          login: () => undefined,
          logout: () => undefined,
          setAccessToken: () => undefined,
          updateFamiliaIdAtiva: () => undefined,
        }}
      >
        {children}
      </AuthContext.Provider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.accessToken).toBe('token');
  });

  it('throws when hook is used outside provider', () => {
    expect(() => renderHook(() => useAuth())).toThrowError(
      'useAuth must be used within AuthProvider',
    );
  });
});
