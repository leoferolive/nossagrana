import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { IconeCategoria, familiaDaCategoria } from './icone-categoria';

afterEach(cleanup);

describe('familiaDaCategoria', () => {
  it.each([
    ['Alimentação', 'alimentacao'],
    ['Alimentacao', 'alimentacao'],
    ['Mercado', 'alimentacao'],
    ['Supermercado', 'alimentacao'],
    ['Saúde', 'saude'],
    ['saude', 'saude'],
    ['Farmácia', 'saude'],
    ['Lazer', 'lazer'],
    ['Compras', 'compras'],
    ['compra online', 'compras'],
  ])('"%s" cai em %s', (nome, familia) => {
    expect(familiaDaCategoria(nome)).toBe(familia);
  });

  it.each(['Moradia', 'Transporte', 'Educação', 'Salário', 'Categoria inventada', ''])(
    '"%s" cai em outros',
    (nome) => {
      expect(familiaDaCategoria(nome)).toBe('outros');
    },
  );
});

describe('IconeCategoria', () => {
  it('é um quadrado de 38×38 com raio 12, fundo e tinta da família', () => {
    const { container } = render(<IconeCategoria nome="Lazer" />);
    const caixa = container.firstElementChild as HTMLElement;
    expect(caixa).toHaveAttribute('data-familia', 'lazer');
    expect(caixa).toHaveClass('h-[38px]', 'w-[38px]', 'rounded-xl', 'bg-cat-lazer-bg');
    expect(caixa).toHaveClass('text-cat-lazer-ink');
  });

  it('usa a família "outros" para categoria desconhecida', () => {
    const { container } = render(<IconeCategoria nome="Qualquer coisa" />);
    expect(container.firstElementChild).toHaveAttribute('data-familia', 'outros');
    expect(container.firstElementChild).toHaveClass('bg-cat-outros-bg', 'text-cat-outros-ink');
  });

  it('esconde o ícone de leitores de tela', () => {
    const { container } = render(<IconeCategoria nome="Saúde" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('categorias padrão fora das cinco famílias ganham ícone próprio, na família "outros"', () => {
    const icone = (nome: string) =>
      render(<IconeCategoria nome={nome} />)
        .container.querySelector('svg')
        ?.getAttribute('class');
    const classes = ['Moradia', 'Transporte', 'Educação', 'Assinaturas', 'Salário', 'Cofrinho'].map(
      icone,
    );
    expect(new Set(classes).size).toBe(classes.length);
  });
});
