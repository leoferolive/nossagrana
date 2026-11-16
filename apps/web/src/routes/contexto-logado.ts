import type { TransacaoListResponse } from '@nossagrana/types';
import { useOutletContext } from 'react-router';

export type Transacao = TransacaoListResponse['transacoes'][number];

/** O que a área logada oferece às telas filhas, sem repassar propriedades em cadeia. */
export interface ContextoLogado {
  familiaId: string;
  onNovaTransacao: () => void;
  onEditarTransacao: (transacao: Transacao) => void;
  onLogout: () => void;
}

export const useContextoLogado = () => useOutletContext<ContextoLogado>();
