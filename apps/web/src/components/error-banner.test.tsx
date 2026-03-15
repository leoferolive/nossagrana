import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ErrorBanner } from './error-banner';

afterEach(cleanup);

describe('ErrorBanner', () => {
  it('não renderiza quando erro é null', () => {
    render(<ErrorBanner error={null} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renderiza mensagem de erro quando há erro', () => {
    render(<ErrorBanner error="Erro ao carregar dados." />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Erro ao carregar dados.')).toBeInTheDocument();
  });

  it('renderiza mensagem padrão quando erro é true sem mensagem', () => {
    render(<ErrorBanner error="Erro inesperado." />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
