import { render } from '@testing-library/react';
import { StrictMode } from 'react';
import {
  BrowserRouter,
  MemoryRouter,
  useLocation,
  useNavigate,
  type InitialEntry,
} from 'react-router';

import { App } from '../App';

/**
 * Sonda de teste: expõe o endereço atual e um "voltar" do histórico, para os testes
 * afirmarem a navegação sem depender de `window.history` do jsdom. O nome do botão
 * evita a palavra "voltar", que os botões das páginas já usam.
 */
const SondaDeRota = () => {
  const local = useLocation();
  const navigate = useNavigate();
  return (
    <div>
      <output data-testid="sonda-local">{`${local.pathname}${local.search}`}</output>
      <button type="button" onClick={() => void navigate(-1)}>
        Sonda: histórico para trás
      </button>
    </div>
  );
};

/**
 * Monta o `<App />` dentro de um roteador em memória. Aceita um endereço (padrão `/`),
 * uma entrada com `state` (ex.: endereço pedido antes do login) ou uma lista de entradas
 * já visitadas, sendo a última a atual.
 */
export const renderApp = (
  entradas: InitialEntry | InitialEntry[] = '/',
  { strict = false, navegador = false }: { strict?: boolean; navegador?: boolean } = {},
) => {
  const lista = Array.isArray(entradas) ? entradas : [entradas];
  if (navegador) return renderNoNavegador(typeof entradas === 'string' ? entradas : '/');
  // Função, e não elemento: um elemento idêntico faria o React pular o novo render.
  const roteador = () => (
    <MemoryRouter initialEntries={lista} initialIndex={lista.length - 1}>
      <App />
      <SondaDeRota />
    </MemoryRouter>
  );
  // O StrictMode do main.tsx roda cada efeito duas vezes em desenvolvimento.
  const arvore = () => (strict ? <StrictMode>{roteador()}</StrictMode> : roteador());
  const resultado = render(arvore());
  // Renderiza de novo a mesma árvore, sem perder estado, para o App reler a sessão mockada.
  return { ...resultado, reavaliarSessao: () => resultado.rerender(arvore()) };
};

/**
 * Usa o `BrowserRouter` sobre o `window.history` do jsdom, o único que grava o `idx` em
 * `history.state`. Serve aos testes que dependem de substituir a entrada inicial do histórico.
 */
const renderNoNavegador = (caminho: string) => {
  window.history.replaceState(null, '', caminho);
  const arvore = () => (
    <BrowserRouter>
      <App />
      <SondaDeRota />
    </BrowserRouter>
  );
  const resultado = render(arvore());
  return { ...resultado, reavaliarSessao: () => resultado.rerender(arvore()) };
};
