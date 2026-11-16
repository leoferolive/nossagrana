import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';

const PARAMETRO = 'lancar';
const NOVA = 'nova';
// Marca a entrada de histórico criada ao abrir o painel. Ela sobrevive à recarga (fica no
// history.state), e a entrada anterior também, então voltar continua sendo o jeito de fechar.
const MARCA_DE_ABERTURA = { painelLancar: true } as const;

const abertoPorNavegacao = (state: unknown): boolean =>
  typeof state === 'object' && state !== null && 'painelLancar' in state;

/**
 * O painel de lançar vive no endereço (`?lancar=nova` ou `?lancar=<id da transação>`), então o
 * voltar do navegador fecha só o painel e a tela de baixo não muda.
 */
export const usePainelLancar = () => {
  const navigate = useNavigate();
  const { pathname, search, state } = useLocation();
  const valor = new URLSearchParams(search).get(PARAMETRO);
  const aberto = valor !== null && valor !== '';
  const transacaoId = aberto && valor !== NOVA ? valor : null;

  const abrir = (destino: string) => {
    const parametros = new URLSearchParams(search);
    parametros.set(PARAMETRO, destino);
    // Com o painel aberto troca a entrada: abrir de novo (ex.: voz) não empilha outro passo.
    void navigate(
      { pathname, search: `?${parametros.toString()}` },
      { replace: aberto, state: aberto ? state : MARCA_DE_ABERTURA },
    );
  };

  const fecharAgora = () => {
    if (!aberto) return;
    if (abertoPorNavegacao(state)) {
      void navigate(-1);
      return;
    }
    // Link direto ou recarga em outro navegador: não há entrada anterior sem o painel.
    const parametros = new URLSearchParams(search);
    parametros.delete(PARAMETRO);
    const restante = parametros.toString();
    void navigate({ pathname, search: restante ? `?${restante}` : '' }, { replace: true });
  };

  // `fechar` fica estável e sempre usa o último render: um envio que termina depois de a
  // pessoa já ter fechado o painel pelo voltar não pode voltar mais uma entrada.
  const ultimoFechar = useRef(fecharAgora);
  useEffect(() => {
    ultimoFechar.current = fecharAgora;
  });
  const fechar = useCallback(() => ultimoFechar.current(), []);

  return {
    aberto,
    transacaoId,
    abrirNova: () => abrir(NOVA),
    abrirEdicao: (id: string) => abrir(id),
    fechar,
  };
};
