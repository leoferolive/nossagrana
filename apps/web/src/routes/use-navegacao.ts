import { useNavigate, useLocation } from 'react-router';

import { caminhoDaTela } from './caminhos';
import { temEntradaAnteriorDoApp } from './historico-do-app';

/**
 * Ponte entre o vocabulário de telas das páginas públicas (`irPara('extrato')`) e a navegação
 * por endereço (`irParaCaminho`). Ir para o endereço em que já
 * se está substitui a entrada, para tocar na aba ativa não empilhar histórico.
 */
export const useNavegacao = () => {
  const navigate = useNavigate();
  const { pathname, search, key, state } = useLocation();

  const irParaCaminho = (destino: string) => {
    void navigate(destino, { replace: destino === `${pathname}${search}` });
  };
  const irPara = (tela: string) => irParaCaminho(caminhoDaTela(tela));

  // Sem entrada anterior do app (link direto, recarga em nova aba) vai à origem do mapa.
  const voltarPara = (caminhoDeOrigem: string) => {
    if (temEntradaAnteriorDoApp(key, state)) void navigate(-1);
    else void navigate(caminhoDeOrigem, { replace: true });
  };

  return { irPara, irParaCaminho, voltarPara };
};
