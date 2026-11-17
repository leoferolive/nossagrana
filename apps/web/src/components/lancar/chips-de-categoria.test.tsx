import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChipsDeCategoria } from './chips-de-categoria';

afterEach(cleanup);

const lista = (...nomes: string[]) => nomes.map((nome) => ({ id: `id-${nome}`, nome }));

const montar = (props: Partial<Parameters<typeof ChipsDeCategoria>[0]> = {}) => {
  const onEscolher = vi.fn();
  const mais = lista('Mercado', 'Lazer');
  render(
    <ChipsDeCategoria
      tipo="despesa"
      maisUsadas={mais}
      todas={[...mais, ...lista('Saúde', 'Transporte')]}
      selecionadaId=""
      onEscolher={onEscolher}
      {...props}
    />,
  );
  return onEscolher;
};

describe('ChipsDeCategoria', () => {
  it('mostra um chip por categoria mais usada e o "Todas"', () => {
    montar();
    const grupo = screen.getByRole('group', { name: 'Categoria' });
    expect(
      within(grupo)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Mercado', 'Lazer', 'Todas']);
  });

  it('marca o chip da categoria escolhida com aria-pressed', () => {
    montar({ selecionadaId: 'id-Lazer' });
    expect(screen.getByRole('button', { name: 'Lazer' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Mercado' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('escolher um chip avisa o id', () => {
    const onEscolher = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Mercado' }));
    expect(onEscolher).toHaveBeenCalledWith('id-Mercado');
  });

  it('a categoria escolhida fora das mais usadas entra como chip a mais, já selecionada', () => {
    montar({ selecionadaId: 'id-Saúde' });
    const grupo = screen.getByRole('group', { name: 'Categoria' });
    expect(
      within(grupo)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Mercado', 'Lazer', 'Saúde', 'Todas']);
    expect(screen.getByRole('button', { name: 'Saúde' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('"Todas" abre a lista completa e escolher fecha a lista', () => {
    const onEscolher = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Todas' }));

    const lista = screen.getByRole('dialog', { name: 'Todas as categorias' });
    expect(within(lista).getAllByRole('button', { name: /^(?!Fechar)/ }).length).toBeGreaterThan(3);
    fireEvent.click(within(lista).getByRole('button', { name: 'Transporte' }));

    expect(onEscolher).toHaveBeenCalledWith('id-Transporte');
    expect(screen.queryByRole('dialog', { name: 'Todas as categorias' })).not.toBeInTheDocument();
  });

  it('a lista completa marca a categoria atual e fecha sem escolher', () => {
    const onEscolher = montar({ selecionadaId: 'id-Lazer' });
    fireEvent.click(screen.getByRole('button', { name: 'Todas' }));

    const lista = screen.getByRole('dialog', { name: 'Todas as categorias' });
    expect(within(lista).getByRole('button', { name: 'Lazer' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(within(lista).getByRole('button', { name: 'Fechar lista de categorias' }));
    expect(screen.queryByRole('dialog', { name: 'Todas as categorias' })).not.toBeInTheDocument();
    expect(onEscolher).not.toHaveBeenCalled();
  });

  it('sem nenhuma categoria do tipo explica o que fazer', () => {
    montar({ maisUsadas: [], todas: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Todas' }));
    expect(screen.getByText('Nenhuma categoria de despesa cadastrada')).toBeInTheDocument();
  });
});
