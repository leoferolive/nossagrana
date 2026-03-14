import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '@/stores/auth.store';

import { PrivateRoute } from './PrivateRoute';

describe('PrivateRoute', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
    localStorage.clear();
  });

  const renderRoute = (initialEntry = '/') =>
    render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<div>Página de Login</div>} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <div>Conteúdo Protegido</div>
              </PrivateRoute>
            }
          />
        </Routes>
      </MemoryRouter>,
    );

  it('redireciona para /login quando não autenticado', () => {
    renderRoute('/');
    expect(screen.getByText('Página de Login')).toBeInTheDocument();
    expect(screen.queryByText('Conteúdo Protegido')).not.toBeInTheDocument();
  });

  it('renderiza o conteúdo protegido quando autenticado', () => {
    useAuthStore.getState().setAuth({ id: '1', nome: 'Leo', email: 'leo@test.com' }, 'token', 'refresh');
    renderRoute('/');
    expect(screen.getByText('Conteúdo Protegido')).toBeInTheDocument();
    expect(screen.queryByText('Página de Login')).not.toBeInTheDocument();
  });
});
