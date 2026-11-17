import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { CabecalhoDoDia } from './cabecalho-do-dia';

afterEach(cleanup);

describe('CabecalhoDoDia', () => {
  it('mostra o rótulo como título de nível 2 e tem 34px de altura', () => {
    render(<CabecalhoDoDia rotulo="Hoje · seg, 16 nov" totalCentavos={0} />);
    const titulo = screen.getByRole('heading', { level: 2, name: 'Hoje · seg, 16 nov' });
    expect(titulo.parentElement).toHaveClass('h-[34px]');
  });

  it('total positivo em verde com "+"', () => {
    render(<CabecalhoDoDia rotulo="Sex, 13 nov" totalCentavos={12000} />);
    const total = screen.getByText(/\+R\$\s*120,00/);
    expect(total).toHaveClass('text-success');
  });

  it('total negativo em texto neutro com "−"', () => {
    render(<CabecalhoDoDia rotulo="Sex, 13 nov" totalCentavos={-4550} />);
    const total = screen.getByText(/−R\$\s*45,50/);
    expect(total).toHaveClass('text-text-dim');
    expect(total).not.toHaveClass('text-danger');
  });

  it('o total do dia tem nome acessível próprio', () => {
    render(<CabecalhoDoDia rotulo="Sex, 13 nov" totalCentavos={-4550} />);
    expect(screen.getByLabelText(/total do dia/i)).toBeInTheDocument();
  });
});
