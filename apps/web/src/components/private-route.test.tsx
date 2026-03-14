import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useEffect } from 'react';

import { AuthProvider } from '@/contexts/auth-context';
import { useAuth } from '@/contexts/use-auth';

import { PrivateRoute } from './private-route';

afterEach(() => {
  cleanup();
});

describe('PrivateRoute', () => {
  const LoginSeed = () => {
    const { login } = useAuth();

    useEffect(() => {
      login({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        familiaIdAtiva: 'f1',
      });
    }, [login]);

    return null;
  };

  it('renders fallback when user is not authenticated', () => {
    render(
      <AuthProvider>
        <PrivateRoute fallback={<p>login required</p>}>
          <p>dashboard content</p>
        </PrivateRoute>
      </AuthProvider>,
    );

    expect(screen.getByText('login required')).toBeInTheDocument();
    expect(screen.queryByText('dashboard content')).not.toBeInTheDocument();
  });

  it('renders protected content when user is authenticated', () => {
    render(
      <AuthProvider>
        <LoginSeed />
        <PrivateRoute fallback={<p>login required</p>}>
          <p>dashboard content</p>
        </PrivateRoute>
      </AuthProvider>,
    );

    expect(screen.getByText('dashboard content')).toBeInTheDocument();
    expect(screen.queryByText('login required')).not.toBeInTheDocument();
  });
});
