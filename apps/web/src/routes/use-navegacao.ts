import { useNavigate, useLocation } from 'react-router';

import { caminhoDaTela } from './caminhos';

/**
 * Ponte entre o vocabulário de telas que as páginas e o AppShell ainda usam
 * (`onNavigate('extrato')`) e a navegação por endereço. Ir para o endereço em que já
 * se está substitui a entrada, para tocar na aba ativa não empilhar histórico.
 */
export const useNavegacao = () => {
  const navigate = useNavigate();
  const { pathname, search, key } = useLocation();

  const irParaCaminho = (destino: string) => {
    void navigate(destino, { replace: destino === `${pathname}${search}` });
  };
  const irPara = (tela: string) => irParaCaminho(caminhoDaTela(tela));

  // `key === 'default'` é a primeira entrada do histórico: a tela foi aberta por link direto
  // ou recarga numa nova aba, e não há tela anterior do app para a qual voltar.
  const voltarPara = (caminhoDeOrigem: string) => {
    if (key !== 'default') void navigate(-1);
    else void navigate(caminhoDeOrigem, { replace: true });
  };

  return { irPara, irParaCaminho, voltarPara };
};
