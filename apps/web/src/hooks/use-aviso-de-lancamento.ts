import type { TransacaoCreateRequest } from '@nossagrana/types';

import { transacaoService } from '@/services/core-financeiro.service';
import { useAvisoStore } from '@/stores/aviso.store';
import { useTransacaoStore } from '@/stores/transacao.store';

/**
 * Excluir o pai de um parcelamento ou de uma repetição não leva as filhas (ficam com
 * `transacao_pai_id` nulo), então só o lançamento simples tem "Desfazer".
 */
const podeDesfazer = (payload: TransacaoCreateRequest): boolean =>
  !payload.parcelado && !payload.recorrente;

/**
 * Desfaz o lançamento recém-criado excluindo exatamente aquele id, uma vez só. Lê a store na hora
 * (e não de um hook) e guarda a família no fechamento, para continuar valendo depois de a pessoa
 * trocar de tela.
 */
const criarDesfazer = (id: string, familiaId: string) => {
  let usado = false;
  return async () => {
    if (usado) return;
    usado = true;
    const { mostrar } = useAvisoStore.getState();
    try {
      await transacaoService.excluir(id, familiaId);
      useTransacaoStore.getState().sinalizarMudanca();
      mostrar({ mensagem: 'Lançamento desfeito' });
    } catch {
      mostrar({ mensagem: 'Não foi possível desfazer', tom: 'erro' });
    }
  };
};

/** Avisos que o painel de lançar mostra depois de gravar, editar ou excluir. */
export const useAvisoDeLancamento = (familiaId: string) => {
  const mostrar = useAvisoStore((s) => s.mostrar);
  return {
    avisarLancado: (payload: TransacaoCreateRequest, id: string) =>
      mostrar({
        mensagem: payload.tipo === 'receita' ? 'Receita lançada' : 'Despesa lançada',
        desfazer: podeDesfazer(payload) ? criarDesfazer(id, familiaId) : undefined,
      }),
    avisarEditado: () => mostrar({ mensagem: 'Alterações salvas' }),
    avisarExcluido: () => mostrar({ mensagem: 'Lançamento excluído' }),
  };
};
