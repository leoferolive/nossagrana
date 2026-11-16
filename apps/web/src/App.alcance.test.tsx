import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { resetAppMocks } from '@/test/app-mocks';
import { barraInferior } from '@/test/barra-inferior';
import { renderApp } from '@/test/render-app';

afterEach(resetAppMocks);

/**
 * Toda tela do mapa que não leva id no endereço, a partir da barra do celular: um toque na
 * aba e um no item. (Cofrinho aberto e fatura levam o id do registro e partem de Planejar.)
 */
const DESTINOS_DE_MAIS: Array<[string, RegExp]> = [
  ['Relatórios', /^\/mais\/relatorios$/],
  ['Histórico', /^\/mais\/historico$/],
  ['Família', /^\/mais\/familia$/],
  ['Alternar família', /^\/familias$/],
  ['Categorias', /^\/mais\/categorias$/],
  ['Métodos de pagamento', /^\/mais\/metodos-pagamento$/],
  ['Perfil', /^\/mais\/perfil$/],
  ['Ajuda', /^\/mais\/ajuda$/],
];

describe('App > alcance pela barra do celular', () => {
  it.each(DESTINOS_DE_MAIS)('Mais › %s em dois toques', async (item, endereco) => {
    renderApp('/');
    fireEvent.click(await screen.findByRole('link', { name: 'Mais' }));
    const main = await waitFor(() => screen.getByRole('main'));
    fireEvent.click(await within(main).findByRole('link', { name: item }));
    await waitFor(() => expect(screen.getByTestId('sonda-local')).toHaveTextContent(endereco));
  });

  const DESTINOS_DE_PLANEJAR: Array<[string, RegExp]> = [
    ['Contas do mês', /^\/planejar\/contas$/],
    ['Limites por categoria', /^\/planejar\/limites$/],
    ['Cofrinhos', /^\/planejar\/cofrinhos$/],
  ];

  it.each(DESTINOS_DE_PLANEJAR)('Planejar › %s em dois toques', async (item, endereco) => {
    renderApp('/');
    fireEvent.click(await barraInferior().findByRole('link', { name: 'Planejar' }));
    const main = await waitFor(() => screen.getByRole('main'));
    fireEvent.click(await within(main).findByRole('link', { name: new RegExp(item, 'i') }));
    await waitFor(() => expect(screen.getByTestId('sonda-local')).toHaveTextContent(endereco));
  });

  it.each([
    ['Início', /^\/$/],
    ['Extrato', /^\/extrato$/],
    ['Planejar', /^\/planejar$/],
    ['Mais', /^\/mais$/],
  ])('a aba %s abre em um toque', async (aba, endereco) => {
    renderApp('/mais/perfil');
    fireEvent.click(await barraInferior().findByRole('link', { name: aba }));
    await waitFor(() => expect(screen.getByTestId('sonda-local')).toHaveTextContent(endereco));
  });
});
