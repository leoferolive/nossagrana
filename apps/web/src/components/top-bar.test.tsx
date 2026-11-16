import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TopBar } from './top-bar';

afterEach(cleanup);

describe('TopBar', () => {
  it.each([
    ['dashboard', 'Início'],
    ['extrato', 'Extrato'],
    ['planejar', 'Planejar'],
    ['mais', 'Mais'],
  ])('na aba %s mostra o título %s (o cabeçalho de aba some no desktop)', (tela, titulo) => {
    render(<TopBar currentScreen={tela} onNovaTransacao={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 2, name: titulo })).toBeInTheDocument();
  });

  it.each(['categorias', 'lancamentos', 'cofrinho-detalhe', 'fatura', 'relatorios'])(
    'na tela de detalhe %s não repete o título (o cabeçalho de detalhe já mostra)',
    (tela) => {
      render(<TopBar currentScreen={tela} onNovaTransacao={vi.fn()} />);
      expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    },
  );

  it('mantém o botão Nova Transação em qualquer tela', () => {
    render(<TopBar currentScreen="categorias" onNovaTransacao={vi.fn()} />);
    expect(screen.getByRole('button', { name: /nova transação/i })).toBeInTheDocument();
  });
});
