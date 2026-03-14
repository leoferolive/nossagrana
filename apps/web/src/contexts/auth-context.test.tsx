import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { AuthProvider } from './auth-context';
import { useAuth } from './use-auth';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const AuthConsumer = () => {
  const { isAuthenticated, accessToken, refreshToken, login, logout, setAccessToken } = useAuth();

  return (
    <div>
      <p>authenticated: {isAuthenticated ? 'yes' : 'no'}</p>
      <p>accessToken: {accessToken ?? 'none'}</p>
      <p>refreshToken: {refreshToken ?? 'none'}</p>
      <button
        type="button"
        onClick={() => login({ accessToken: 'access-token-1', refreshToken: 'refresh-token-1' })}
      >
        login
      </button>
      <button type="button" onClick={() => setAccessToken('access-token-2')}>
        rotate-access-token
      </button>
      <button type="button" onClick={logout}>
        logout
      </button>
    </div>
  );
};

describe('AuthContext', () => {
  it('hydrates session from localStorage on startup', () => {
    localStorage.setItem(
      'nossagrana.auth.session',
      JSON.stringify({
        accessToken: 'saved-access-token',
        refreshToken: 'saved-refresh-token',
      }),
    );

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    expect(screen.getByText('authenticated: yes')).toBeInTheDocument();
    expect(screen.getByText('accessToken: saved-access-token')).toBeInTheDocument();
    expect(screen.getByText('refreshToken: saved-refresh-token')).toBeInTheDocument();
  });

  it('starts logged out and allows login/logout flow', () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    expect(screen.getByText('authenticated: no')).toBeInTheDocument();
    expect(screen.getByText('accessToken: none')).toBeInTheDocument();
    expect(screen.getByText('refreshToken: none')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'login' }));

    expect(screen.getByText('authenticated: yes')).toBeInTheDocument();
    expect(screen.getByText('accessToken: access-token-1')).toBeInTheDocument();
    expect(screen.getByText('refreshToken: refresh-token-1')).toBeInTheDocument();
    expect(localStorage.getItem('nossagrana.auth.session')).toContain('access-token-1');
    expect(localStorage.getItem('nossagrana.auth.session')).toContain('refresh-token-1');

    fireEvent.click(screen.getByRole('button', { name: 'logout' }));

    expect(screen.getByText('authenticated: no')).toBeInTheDocument();
    expect(screen.getByText('accessToken: none')).toBeInTheDocument();
    expect(screen.getByText('refreshToken: none')).toBeInTheDocument();
    expect(localStorage.getItem('nossagrana.auth.session')).toBeNull();
  });

  it('updates only access token when refresh happens', () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'login' }));
    fireEvent.click(screen.getByRole('button', { name: 'rotate-access-token' }));

    expect(screen.getByText('accessToken: access-token-2')).toBeInTheDocument();
    expect(screen.getByText('refreshToken: refresh-token-1')).toBeInTheDocument();
    expect(localStorage.getItem('nossagrana.auth.session')).toContain('access-token-2');
    expect(localStorage.getItem('nossagrana.auth.session')).toContain('refresh-token-1');
  });
});
