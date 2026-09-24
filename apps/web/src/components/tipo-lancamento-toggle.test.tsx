import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TipoLancamentoToggle } from './tipo-lancamento-toggle';

afterEach(cleanup);

describe('TipoLancamentoToggle', () => {
  it('destaca o tipo ativo', () => {
    render(<TipoLancamentoToggle tipo="receita" onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Receita' }).className).toContain('bg-success');
    expect(screen.getByRole('button', { name: 'Despesa' }).className).not.toContain('bg-danger');
  });

  it('avisa o tipo escolhido', () => {
    const onChange = vi.fn();
    render(<TipoLancamentoToggle tipo="receita" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Despesa' }));
    expect(onChange).toHaveBeenCalledWith('despesa');
  });
});
