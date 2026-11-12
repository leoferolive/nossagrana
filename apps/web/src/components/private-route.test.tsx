import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEffect } from 'react';

import { AuthProvider } from '@/contexts/auth-context';
import { useAuth } from '@/contexts/use-auth';

import { PrivateRoute } from './private-route';

// Bootstrap sem sessão (refresh recusado): evita rede real no AuthProvider.
vi.mock('@/services/core-financeiro.service', () => ({
  lazyApiClient: { restaurarSessao: async () => false },
}));

afterEach(() => {
  cleanup();
});

describe('PrivateRoute', () => {
  const LoginSeed = () => {
    const { login } = useAuth();

    useEffect(() => {
      login({
        accessToken: 'access-token',
        familiaIdAtiva: 'f1',
      });
    }, [login]);

    return null;
  };

  it('renders fallback when user is not authenticated', async () => {
    render(
      <AuthProvider>
        <PrivateRoute fallback={<p>login required</p>}>
          <p>dashboard content</p>
        </PrivateRoute>
      </AuthProvider>,
    );

    expect(await screen.findByText('login required')).toBeInTheDocument();
    expect(screen.queryByText('dashboard content')).not.toBeInTheDocument();
  });

  it('renders protected content when user is authenticated', async () => {
    render(
      <AuthProvider>
        <LoginSeed />
        <PrivateRoute fallback={<p>login required</p>}>
          <p>dashboard content</p>
        </PrivateRoute>
      </AuthProvider>,
    );

    expect(await screen.findByText('dashboard content')).toBeInTheDocument();
    expect(screen.queryByText('login required')).not.toBeInTheDocument();
  });
});
