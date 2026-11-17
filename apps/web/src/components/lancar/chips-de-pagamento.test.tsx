import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChipsDePagamento } from './chips-de-pagamento';

afterEach(cleanup);

const metodos = [
  { id: 'm1', nome: 'Pix' },
  { id: 'm2', nome: 'Nubank' },
];

describe('ChipsDePagamento', () => {
  it('mostra um chip por forma de pagamento, nenhum selecionado por padrão', () => {
    render(<ChipsDePagamento metodos={metodos} selecionadoId="" onEscolher={vi.fn()} />);

    expect(screen.getByRole('group', { name: 'Pago com' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pix' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Nubank' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('marca a forma escolhida e avisa o id ao tocar', () => {
    const onEscolher = vi.fn();
    render(<ChipsDePagamento metodos={metodos} selecionadoId="m2" onEscolher={onEscolher} />);

    expect(screen.getByRole('button', { name: 'Nubank' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Pix' }));
    expect(onEscolher).toHaveBeenCalledWith('m1');
  });

  it('tocar na forma já escolhida desmarca (nenhuma é válido)', () => {
    const onEscolher = vi.fn();
    render(<ChipsDePagamento metodos={metodos} selecionadoId="m2" onEscolher={onEscolher} />);

    fireEvent.click(screen.getByRole('button', { name: 'Nubank' }));
    expect(onEscolher).toHaveBeenCalledWith('');
  });

  it('sem formas de pagamento cadastradas não mostra o bloco', () => {
    render(<ChipsDePagamento metodos={[]} selecionadoId="" onEscolher={vi.fn()} />);
    expect(screen.queryByRole('group', { name: 'Pago com' })).not.toBeInTheDocument();
  });
});
