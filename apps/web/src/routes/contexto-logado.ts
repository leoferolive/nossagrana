import type { TransacaoListResponse } from '@nossagrana/types';
import { useOutletContext } from 'react-router';

export type Transacao = TransacaoListResponse['transacoes'][number];

/** O que a área logada oferece às telas filhas, sem repassar propriedades em cadeia. */
export interface ContextoLogado {
  familiaId: string;
  onNovaTransacao: () => void;
  onEditarTransacao: (transacao: Transacao) => void;
  onLogout: () => void;
  detalhe: SelecaoDetalhe;
}

/** Cofrinho e fatura escolhidos. Passam para o endereço na tarefa "Cofrinho e fatura no endereço". */
export interface SelecaoDetalhe {
  cofrinhoId: string;
  faturaMetodoId: string | null;
  faturaMetodoNome: string;
  faturaMes: string;
  escolherCofrinho: (id: string) => void;
  escolherFatura: (id: string, nome: string, mes: string) => void;
}

export const useContextoLogado = () => useOutletContext<ContextoLogado>();
