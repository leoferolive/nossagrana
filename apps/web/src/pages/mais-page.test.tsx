import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderPagina } from '../test/render-pagina';

import { MaisPage } from './mais-page';

afterEach(cleanup);

const GRUPOS: Array<[string, Array<[string, string]>]> = [
  [
    'Análises',
    [
      ['Relatórios', '/mais/relatorios'],
      ['Histórico', '/mais/historico'],
    ],
  ],
  [
    'Família',
    [
      ['Família', '/mais/familia'],
      ['Alternar família', '/familias'],
    ],
  ],
  [
    'Cadastros',
    [
      ['Categorias', '/mais/categorias'],
      ['Métodos de pagamento', '/mais/metodos-pagamento'],
    ],
  ],
  [
    'Conta',
    [
      ['Perfil', '/mais/perfil'],
      ['Ajuda', '/mais/ajuda'],
    ],
  ],
];

const grupo = (titulo: string) => within(screen.getByRole('region', { name: titulo }));

describe('MaisPage', () => {
  it('mostra o título Mais como cabeçalho de aba, sem Voltar', () => {
    renderPagina(<MaisPage onLogout={vi.fn()} />, '/mais');
    expect(screen.getByRole('heading', { level: 1, name: 'Mais' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Voltar' })).not.toBeInTheDocument();
  });

  it('tem os quatro grupos, nesta ordem', () => {
    renderPagina(<MaisPage onLogout={vi.fn()} />, '/mais');
    const titulos = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titulos).toEqual(['Análises', 'Família', 'Cadastros', 'Conta']);
  });

  it.each(GRUPOS)('o grupo %s tem os itens e os destinos certos', (titulo, itens) => {
    renderPagina(<MaisPage onLogout={vi.fn()} />, '/mais');
    for (const [rotulo, destino] of itens) {
      expect(grupo(titulo).getByRole('link', { name: rotulo })).toHaveAttribute('href', destino);
    }
  });

  it('o grupo Conta termina em Sair', () => {
    renderPagina(<MaisPage onLogout={vi.fn()} />, '/mais');
    const nomes = within(screen.getByRole('region', { name: 'Conta' }))
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    expect(nomes).toEqual(['Perfil', 'Ajuda', 'Sair']);
  });

  it('"Sair" encerra a sessão e não navega', () => {
    const onLogout = vi.fn();
    renderPagina(<MaisPage onLogout={onLogout} />, '/mais');
    fireEvent.click(grupo('Conta').getByRole('button', { name: 'Sair' }));
    expect(onLogout).toHaveBeenCalledOnce();
    expect(screen.getByTestId('sonda-local')).toHaveTextContent(/^\/mais$/);
  });

  it('"Sair" usa a cor de perigo', () => {
    renderPagina(<MaisPage onLogout={vi.fn()} />, '/mais');
    expect(grupo('Conta').getByRole('button', { name: 'Sair' })).toHaveClass('text-danger');
  });

  it('cada linha tem pelo menos 44px de altura', () => {
    renderPagina(<MaisPage onLogout={vi.fn()} />, '/mais');
    const linhas = [
      ...screen.getAllByRole('link').filter((l) => l.getAttribute('href')?.startsWith('/')),
      screen.getByRole('button', { name: 'Sair' }),
    ];
    expect(linhas).toHaveLength(9);
    for (const linha of linhas) expect(linha).toHaveClass('min-h-11');
  });

  it('os cartões dos grupos usam fundo panel, anel border e raio 18', () => {
    renderPagina(<MaisPage onLogout={vi.fn()} />, '/mais');
    const cartao = grupo('Análises').getByRole('list');
    expect(cartao).toHaveClass('bg-panel', 'shadow-soft', 'rounded-[18px]');
  });
});
