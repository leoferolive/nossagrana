import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { useAuthStore } from '@/stores/auth.store';

import { App } from './App';

const renderApp = (initialEntry = '/') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <App />
    </MemoryRouter>,
  );

describe('App', () => {
  it('redireciona para /login quando não autenticado', () => {
    useAuthStore.getState().logout();
    renderApp('/');
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
  });

  it('renderiza HomePage quando autenticado', () => {
    useAuthStore.getState().setAuth({ id: '1', nome: 'Leo', email: 'leo@test.com' }, 'tok', 'ref');
    renderApp('/');
    expect(screen.getByText('Bem-vindo!')).toBeInTheDocument();
    useAuthStore.getState().logout();
  });
});
