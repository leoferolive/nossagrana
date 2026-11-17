import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RodapeSalvar } from './rodape-salvar';

afterEach(cleanup);

describe('RodapeSalvar', () => {
  it('habilitado chama salvar', () => {
    const onSalvar = vi.fn();
    render(
      <RodapeSalvar rotulo="Salvar despesa" motivo={null} gravando={false} onSalvar={onSalvar} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Salvar despesa' }));
    expect(onSalvar).toHaveBeenCalledOnce();
  });

  it('com motivo fica desabilitado e escreve o motivo, ligado ao botão', () => {
    const onSalvar = vi.fn();
    render(
      <RodapeSalvar
        rotulo="Salvar despesa"
        motivo="Digite o valor"
        gravando={false}
        onSalvar={onSalvar}
      />,
    );

    const botao = screen.getByRole('button', { name: 'Salvar despesa' });
    expect(botao).toBeDisabled();
    expect(botao).toHaveAccessibleDescription('Digite o valor');
    fireEvent.click(botao);
    expect(onSalvar).not.toHaveBeenCalled();
  });

  it('enquanto grava fica desabilitado e diz que está salvando', () => {
    render(<RodapeSalvar rotulo="Salvar despesa" motivo={null} gravando onSalvar={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Salvando...' })).toBeDisabled();
  });

  it('mostra o erro de gravação como alerta', () => {
    render(
      <RodapeSalvar
        rotulo="Salvar despesa"
        motivo={null}
        gravando={false}
        erro="Não foi possível salvar. Tente de novo."
        onSalvar={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível salvar. Tente de novo.');
  });
});
