import type { TransacaoCreateRequest, TransacaoUpdateRequest } from '@nossagrana/types';
import { useState } from 'react';

import type { Transacao } from '@/routes/contexto-logado';
import { transacaoService } from '@/services/core-financeiro.service';
import { novaChaveIdempotencia } from '@/services/idempotencia';

interface TransacaoEmEdicao {
  id: string;
  tipo: 'receita' | 'despesa';
  valor: string;
  categoriaId: string;
  descricao: string | null;
  data: string;
  metodoPagamentoId: string | null;
}

const paraEdicao = (t: Transacao): TransacaoEmEdicao => ({
  id: t.id,
  tipo: t.tipo,
  valor: t.valor,
  categoriaId: t.categoriaId,
  descricao: t.descricao,
  data: t.data,
  metodoPagamentoId: t.metodoPagamentoId,
});

/** Painel de lançar (nova transação ou edição) e as chamadas de gravação ligadas a ele. */
export const useLancamento = (familiaId: string) => {
  const [aberto, setAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<TransacaoEmEdicao | null>(null);

  const encerrar = () => {
    setAberto(false);
    setEmEdicao(null);
  };

  const registrar = async (payload: TransacaoCreateRequest) => {
    if (!familiaId) return;
    // Chave nova por envio (#90). Reenvio após falha ainda gera outra: reuso até o sucesso é a #96.
    await transacaoService.registrar(payload, familiaId, novaChaveIdempotencia());
    setAberto(false);
  };

  const atualizar = async (id: string, payload: TransacaoUpdateRequest) => {
    if (!familiaId) return;
    await transacaoService.editar(id, payload, familiaId);
    encerrar();
  };

  const excluir = async (id: string) => {
    if (!familiaId) return;
    await transacaoService.excluir(id, familiaId);
    encerrar();
  };

  return {
    abrirNova: () => setAberto(true),
    abrirEdicao: (t: Transacao) => {
      setEmEdicao(paraEdicao(t));
      setAberto(true);
    },
    modal: {
      open: aberto,
      familiaId,
      onClose: encerrar,
      onSubmit: registrar,
      transacaoParaEditar: emEdicao,
      onUpdate: atualizar,
      onDelete: excluir,
    },
  };
};
