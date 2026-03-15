import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AjudaPage } from './ajuda-page';

afterEach(() => cleanup());

describe('AjudaPage', () => {
  it('renderiza título de ajuda', () => {
    render(<AjudaPage onBack={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /ajuda/i })).toBeInTheDocument();
  });

  it('mostra seções de FAQ', () => {
    render(<AjudaPage onBack={vi.fn()} />);
    expect(screen.getAllByText(/mês de referência/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/parcelado/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/recorrente/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/snapshot/i).length).toBeGreaterThan(0);
  });

  it('expande resposta ao clicar na pergunta', () => {
    render(<AjudaPage onBack={vi.fn()} />);
    const question = screen.getByText(/o que é mês de referência/i);
    expect(screen.queryByText(/data de fechamento/i)).not.toBeInTheDocument();
    fireEvent.click(question);
    expect(screen.getByText(/data de fechamento/i)).toBeInTheDocument();
  });

  it('chama onBack ao clicar em voltar', () => {
    const onBack = vi.fn();
    render(<AjudaPage onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));
    expect(onBack).toHaveBeenCalled();
  });
});
