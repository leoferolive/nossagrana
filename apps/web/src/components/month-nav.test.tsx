import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MonthNav } from './month-nav';

afterEach(() => {
  cleanup();
});

describe('MonthNav', () => {
  it('mostra o mês só com a primeira letra maiúscula', () => {
    render(
      <MonthNav
        mesReferencia="2026-11"
        onMesAnterior={vi.fn()}
        onMesProximo={vi.fn()}
        isCurrentMonth={false}
      />,
    );

    const rotulo = screen.getByText('Novembro de 2026');
    expect(rotulo).not.toHaveClass('capitalize');
  });

  it('é uma pílula: fundo panel, anel de 1px e dois botões de 44x44', () => {
    render(
      <MonthNav
        mesReferencia="2026-11"
        onMesAnterior={vi.fn()}
        onMesProximo={vi.fn()}
        isCurrentMonth={false}
      />,
    );

    const pilula = screen.getByText('Novembro de 2026').parentElement;
    expect(pilula).toHaveClass('rounded-full', 'bg-panel', 'shadow-soft');
    for (const nome of ['Mês anterior', 'Próximo mês']) {
      expect(screen.getByRole('button', { name: nome })).toHaveClass('min-h-11', 'min-w-11');
    }
    expect(screen.getByText('Novembro de 2026')).toHaveClass('font-bold');
  });
});
