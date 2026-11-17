import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ValorDoLancamento } from './valor-do-lancamento';

afterEach(cleanup);

describe('ValorDoLancamento', () => {
  it('mostra o prefixo R$ e o campo com teclado decimal', () => {
    render(<ValorDoLancamento valor="" onChange={vi.fn()} focarAoAbrir={false} />);

    expect(screen.getByText('R$')).toBeInTheDocument();
    const campo = screen.getByLabelText('Valor');
    expect(campo).toHaveAttribute('inputmode', 'decimal');
    expect(campo).toHaveAttribute('placeholder', '0,00');
  });

  it('recebe o foco ao abrir uma transação nova', () => {
    render(<ValorDoLancamento valor="" onChange={vi.fn()} focarAoAbrir />);
    expect(screen.getByLabelText('Valor')).toHaveFocus();
  });

  it('não rouba o foco quando não é para focar', () => {
    render(<ValorDoLancamento valor="10" onChange={vi.fn()} focarAoAbrir={false} />);
    expect(screen.getByLabelText('Valor')).not.toHaveFocus();
  });

  it('avisa o valor digitado', () => {
    const onChange = vi.fn();
    render(<ValorDoLancamento valor="" onChange={onChange} focarAoAbrir={false} />);

    fireEvent.change(screen.getByLabelText('Valor'), { target: { value: '12.50' } });
    expect(onChange).toHaveBeenCalledWith('12.50');
  });

  it('mostra o microfone ao lado do valor e chama a voz', () => {
    const onVoz = vi.fn();
    render(<ValorDoLancamento valor="" onChange={vi.fn()} onVoz={onVoz} focarAoAbrir={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Preencher por voz' }));
    expect(onVoz).toHaveBeenCalledOnce();
  });

  it('sem voz disponível não mostra o microfone', () => {
    render(<ValorDoLancamento valor="" onChange={vi.fn()} focarAoAbrir={false} />);
    expect(screen.queryByRole('button', { name: 'Preencher por voz' })).not.toBeInTheDocument();
  });
});
