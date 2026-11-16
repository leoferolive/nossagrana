import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';

const PARAMETRO = 'lancar';
const NOVA = 'nova';
// Marca a entrada de histórico criada ao abrir o painel. Ela sobrevive à recarga (fica no
// history.state), e a entrada anterior também, então voltar continua sendo o jeito de fechar.
const MARCA_DE_ABERTURA = { painelLancar: true } as const;

const abertoPorNavegacao = (state: unknown): boolean =>
  typeof state === 'object' && state !== null && 'painelLancar' in state;

const lerPainel = (search: string) => {
  const valor = new URLSearchParams(search).get(PARAMETRO);
  const aberto = valor !== null && valor !== '';
  return { aberto, transacaoId: aberto && valor !== NOVA ? valor : null };
};

/** Query string com o parâmetro do painel definido (ou removido, com `null`) e os demais intactos. */
const buscaCom = (search: string, destino: string | null): string => {
  const parametros = new URLSearchParams(search);
  if (destino === null) parametros.delete(PARAMETRO);
  else parametros.set(PARAMETRO, destino);
  const resultado = parametros.toString();
  return resultado ? `?${resultado}` : '';
};

/**
 * O painel de lançar vive no endereço (`?lancar=nova` ou `?lancar=<id da transação>`), então o
 * voltar do navegador fecha só o painel e a tela de baixo não muda.
 */
export const usePainelLancar = () => {
  const navigate = useNavigate();
  const { pathname, search, state, key } = useLocation();
  const { aberto, transacaoId } = lerPainel(search);
  const entradaEncerrada = useRef<string | null>(null);

  const abrir = (destino: string) => {
    // Com o painel aberto troca a entrada: abrir de novo (ex.: voz) não empilha outro passo.
    void navigate(
      { pathname, search: buscaCom(search, destino) },
      { replace: aberto, state: aberto ? state : MARCA_DE_ABERTURA },
    );
  };

  const fecharAgora = () => {
    if (!aberto) return;
    if (!abertoPorNavegacao(state)) {
      // Link direto ou recarga: não há entrada anterior sem o painel, só tira o parâmetro.
      void navigate({ pathname, search: buscaCom(search, null) }, { replace: true });
      return;
    }
    // Idempotente por entrada: voltar só uma vez por abertura. Fechar e depois reagir ao
    // fechamento (envio que termina, toque duplo, efeito do StrictMode) chega aqui de novo
    // enquanto o endereço ainda é o do painel, e não pode voltar uma segunda entrada.
    if (entradaEncerrada.current === key) return;
    entradaEncerrada.current = key;
    void navigate(-1);
  };

  // `fechar` fica estável e sempre usa o último render: um envio que termina depois de a
  // pessoa já ter fechado o painel pelo voltar não pode voltar mais uma entrada.
  // Painel fechado de verdade: o mesmo registro de histórico pode reabrir (avançar do navegador).
  useEffect(() => {
    if (!aberto) entradaEncerrada.current = null;
  }, [aberto]);

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
