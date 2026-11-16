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
});
