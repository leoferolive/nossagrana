import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ResumoDoPeriodo } from './resumo-do-periodo';

afterEach(cleanup);

const montar = (entradas: number, saidas: number) =>
  render(
    <ResumoDoPeriodo
      resumo={{
        entradasCentavos: entradas,
        saidasCentavos: saidas,
        saldoCentavos: entradas - saidas,
      }}
    />,
  );

const valorDe = (rotulo: string) =>
  within(screen.getByRole('group', { name: 'Resumo do período' })).getByText(rotulo)
    .nextElementSibling as HTMLElement;

describe('ResumoDoPeriodo', () => {
  it('mostra Entradas, Saídas e Saldo formatados', () => {
    montar(500000, 15050);
    expect(valorDe('Entradas')).toHaveTextContent(/R\$\s*5\.000,00/);
    expect(valorDe('Saídas')).toHaveTextContent(/R\$\s*150,50/);
    expect(valorDe('Saldo')).toHaveTextContent(/R\$\s*4\.849,50/);
  });

  it('entradas em verde, saídas e saldo positivo em texto neutro', () => {
    montar(1000, 400);
    expect(valorDe('Entradas')).toHaveClass('text-success');
    expect(valorDe('Saídas')).toHaveClass('text-text');
    expect(valorDe('Saldo')).toHaveClass('text-text');
  });

  it('saldo negativo em vermelho, e só ele', () => {
    montar(1000, 4000);
    expect(valorDe('Saldo')).toHaveClass('text-danger');
    expect(valorDe('Saldo')).toHaveTextContent(/-R\$\s*30,00/);
    expect(valorDe('Saídas')).not.toHaveClass('text-danger');
  });

  it('valores com números tabulares e 18/800', () => {
    montar(0, 0);
    expect(valorDe('Saldo')).toHaveClass('tabular-nums', 'text-lg', 'font-extrabold');
  });
});
