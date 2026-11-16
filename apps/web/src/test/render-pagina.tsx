import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, type InitialEntry } from 'react-router';

import { SondaDeRota } from './sonda-de-rota';

/**
 * Monta uma página dentro de um roteador em memória, sem a casca do app. As páginas falam com o
 * roteador direto (`useNavegacao`, `CabecalhoDetalhe`), então precisam de um. Aceita um endereço
 * ou a lista de entradas já visitadas (a última é a atual); a sonda de rota expõe o endereço
 * atual e um "voltar" do histórico para os testes afirmarem a navegação.
 */
export const renderPagina = (
  pagina: ReactElement,
  entradas: InitialEntry | InitialEntry[] = '/',
) => {
  const lista = Array.isArray(entradas) ? entradas : [entradas];
  const arvore = (elemento: ReactElement) => (
    <MemoryRouter initialEntries={lista} initialIndex={lista.length - 1}>
      {elemento}
      <SondaDeRota />
    </MemoryRouter>
  );
  const resultado = render(arvore(pagina));
  return {
    ...resultado,
    rerenderPagina: (proxima: ReactElement) => resultado.rerender(arvore(proxima)),
  };
};
