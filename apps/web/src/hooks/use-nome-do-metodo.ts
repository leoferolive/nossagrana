import { useEffect } from 'react';

import { metodoPagamentoService } from '@/services/core-financeiro.service';
import { useMetodoPagamentoStore } from '@/stores/metodo-pagamento.store';

/**
 * Nome do método de pagamento do endereço (ex.: o cartão da fatura). Carrega a lista da
 * família quando o método ainda não está na store, o que acontece em link direto e recarga.
 */
export const useNomeDoMetodo = (familiaId: string, metodoId: string): string | null => {
  const setMetodos = useMetodoPagamentoStore((s) => s.setMetodos);
  const nome = useMetodoPagamentoStore((s) => s.metodos.find((m) => m.id === metodoId)?.nome);

  useEffect(() => {
    if (!familiaId || nome) return;
    metodoPagamentoService
      .listar(familiaId)
      .then((res) => setMetodos(res.metodosPagamento))
      .catch(() => {});
  }, [familiaId, metodoId, nome, setMetodos]);

  return nome ?? null;
};
