import { render } from '@testing-library/react';
import { StrictMode, type ReactElement } from 'react';
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
  { strict = false }: { strict?: boolean } = {},
) => {
  const lista = Array.isArray(entradas) ? entradas : [entradas];
  const roteador = (elemento: ReactElement) => (
    <MemoryRouter initialEntries={lista} initialIndex={lista.length - 1}>
      {elemento}
      <SondaDeRota />
    </MemoryRouter>
  );
  // `strict` põe o StrictMode na raiz, fora do roteador, como o main.tsx: só assim cada efeito
  // roda duas vezes (um StrictMode dentro do roteador não duplica o efeito da página).
  const arvore = (elemento: ReactElement) =>
    strict ? <StrictMode>{roteador(elemento)}</StrictMode> : roteador(elemento);
  const resultado = render(arvore(pagina));
  return {
    ...resultado,
    rerenderPagina: (proxima: ReactElement) => resultado.rerender(arvore(proxima)),
  };
};
