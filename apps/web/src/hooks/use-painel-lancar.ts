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
  const { pathname, search, state, key } = useLocation();
  const entradaDescartada = useRef<string | null>(null);
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

  // Idempotente: só substitui a entrada atual, sem andar no histórico. É o que o StrictMode
  // (efeito rodando duas vezes) e uma recarga sem o que editar exigem, ao contrário de voltar.
  const descartarAgora = () => {
    if (!aberto) return;
    // Entrada aberta pelo app (marca no history.state, que sobrevive à recarga): a anterior é a
    // mesma tela sem o parâmetro, então voltar evita deixar duas entradas iguais em sequência.
    // Uma vez por entrada: o StrictMode roda o efeito duas vezes.
    if (abertoPorNavegacao(state)) {
      if (entradaDescartada.current === key) return;
      entradaDescartada.current = key;
      void navigate(-1);
      return;
    }
    const parametros = new URLSearchParams(search);
    parametros.delete(PARAMETRO);
    const restante = parametros.toString();
    void navigate({ pathname, search: restante ? `?${restante}` : '' }, { replace: true });
  };

  const fecharAgora = () => {
    if (aberto && abertoPorNavegacao(state)) void navigate(-1);
    else descartarAgora();
  };

  // `fechar` fica estável e sempre usa o último render: um envio que termina depois de a
  // pessoa já ter fechado o painel pelo voltar não pode voltar mais uma entrada.
  const ultimos = useRef({ fecharAgora, descartarAgora });
  useEffect(() => {
    ultimos.current = { fecharAgora, descartarAgora };
  });
  const fechar = useCallback(() => ultimos.current.fecharAgora(), []);
  const descartar = useCallback(() => ultimos.current.descartarAgora(), []);

  return {
    aberto,
    transacaoId,
    abrirNova: () => abrir(NOVA),
    abrirEdicao: (id: string) => abrir(id),
    fechar,
    descartar,
  };
};
