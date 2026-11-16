import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Sidebar } from './sidebar';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderSidebar = (caminho = '/', onLogout = vi.fn()) =>
  render(
    <MemoryRouter initialEntries={[caminho]}>
      <Sidebar onLogout={onLogout} />
    </MemoryRouter>,
  );

const GRUPOS: Array<[string, Array<[string, string]>]> = [
  [
    'Planejar',
    [
      ['Contas do mês', '/planejar/contas'],
      ['Limites por categoria', '/planejar/limites'],
      ['Cofrinhos', '/planejar/cofrinhos'],
    ],
  ],
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

describe('Sidebar', () => {
  it('renderiza o título NossaGrana', () => {
    renderSidebar();
    expect(screen.getByText('NossaGrana')).toBeInTheDocument();
  });

  it('mostra o nome da família quando informado', () => {
    render(
      <MemoryRouter>
        <Sidebar onLogout={vi.fn()} familiaNome="Silva" />
      </MemoryRouter>,
    );
    expect(screen.getByText('Silva')).toBeInTheDocument();
  });

  it('abre com Início e Extrato, sem título de grupo', () => {
    renderSidebar();
    expect(screen.getByRole('link', { name: 'Início' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Extrato' })).toHaveAttribute('href', '/extrato');
  });

  it('tem os grupos da tela Mais e o de Planejar, com os mesmos endereços', () => {
    renderSidebar();
    const titulos = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titulos).toEqual(GRUPOS.map(([titulo]) => titulo));
    for (const [titulo, itens] of GRUPOS) {
      const grupo = within(screen.getByRole('region', { name: titulo }));
      for (const [rotulo, destino] of itens) {
        expect(grupo.getByRole('link', { name: rotulo })).toHaveAttribute('href', destino);
      }
    }
  });

  it('marca o item do endereço atual', () => {
    renderSidebar('/mais/categorias');
    expect(screen.getByRole('link', { name: 'Categorias' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Início' })).not.toHaveAttribute('aria-current');
  });

  it('renderiza botão "Sair"', () => {
    renderSidebar();
    expect(screen.getByRole('button', { name: /sair/i })).toBeInTheDocument();
  });

  it('chama onLogout ao clicar em "Sair"', () => {
    const onLogout = vi.fn();
    renderSidebar('/', onLogout);
    fireEvent.click(screen.getByRole('button', { name: /sair/i }));
    expect(onLogout).toHaveBeenCalled();
  });
});
