import type { TransacaoListResponse } from '@nossagrana/types';
import { createContext, useContext } from 'react';

type Transacao = TransacaoListResponse['transacoes'][number];

/** O que as linhas do Extrato precisam da tela, sem repassar por props em cadeia. */
export interface DadosDoExtrato {
  nomeDaCategoria: (id: string | null) => string;
  /** Nome da forma de pagamento; `null` quando o lançamento não tem. */
  nomeDoMetodo: (id: string | null) => string | null;
  onAbrir: (transacao: Transacao) => void;
}

export const ExtratoContexto = createContext<DadosDoExtrato | null>(null);

export const useDadosDoExtrato = (): DadosDoExtrato => {
  const dados = useContext(ExtratoContexto);
  if (!dados) throw new Error('LinhaDeLancamento precisa estar dentro de ExtratoContexto.Provider');
  return dados;
};
