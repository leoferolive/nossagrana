import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConfirmarExclusao } from './confirmar-exclusao';

afterEach(cleanup);

const montar = (props: Partial<Parameters<typeof ConfirmarExclusao>[0]> = {}) => {
  const onCancelar = vi.fn();
  const onConfirmar = vi.fn();
  render(
    <ConfirmarExclusao
      nome="Mercado do mês"
      valor="129.9"
      excluindo={false}
      onCancelar={onCancelar}
      onConfirmar={onConfirmar}
      {...props}
    />,
  );
  return { onCancelar, onConfirmar };
};

describe('ConfirmarExclusao', () => {
  it('pergunta e mostra o nome e o valor do lançamento', () => {
    montar();
    const painel = screen.getByRole('dialog', { name: 'Excluir lançamento?' });
    expect(painel).toHaveTextContent('Mercado do mês');
    expect(painel).toHaveTextContent('R$ 129,90');
  });

  it('Cancelar não exclui', () => {
    const { onCancelar, onConfirmar } = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancelar).toHaveBeenCalledOnce();
    expect(onConfirmar).not.toHaveBeenCalled();
  });

  it('Excluir confirma, em vermelho de perigo', () => {
    const { onConfirmar } = montar();
    const botao = screen.getByRole('button', { name: 'Excluir' });
    expect(botao.className).toContain('bg-danger');
    fireEvent.click(botao);
    expect(onConfirmar).toHaveBeenCalledOnce();
  });

  it('enquanto exclui, desabilita os dois botões', () => {
    montar({ excluindo: true });
    expect(screen.getByRole('button', { name: 'Excluindo...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  });

  it('mostra o erro de exclusão como alerta', () => {
    montar({ erro: 'Não foi possível excluir. Tente de novo.' });
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível excluir');
  });

  describe('teclado', () => {
    const ativo = () => document.activeElement;
    const teclar = (key: string, shiftKey = false) =>
      fireEvent.keyDown(document.activeElement ?? document.body, { key, shiftKey });

    it('abre com o foco em "Cancelar", a ação segura', () => {
      montar();
      expect(ativo()).toBe(screen.getByRole('button', { name: 'Cancelar' }));
    });

    it('Tab e Shift+Tab ficam presos entre Cancelar e Excluir', () => {
      montar();
      screen.getByRole('button', { name: 'Excluir' }).focus();
      teclar('Tab');
      expect(ativo()).toBe(screen.getByRole('button', { name: 'Cancelar' }));
      teclar('Tab', true);
      expect(ativo()).toBe(screen.getByRole('button', { name: 'Excluir' }));
    });

    it('Escape cancela', () => {
      const { onCancelar } = montar();
      teclar('Escape');
      expect(onCancelar).toHaveBeenCalledOnce();
    });

    it('Escape não cancela enquanto exclui', () => {
      const { onCancelar } = montar({ excluindo: true });
      teclar('Escape');
      expect(onCancelar).not.toHaveBeenCalled();
    });
  });
});
