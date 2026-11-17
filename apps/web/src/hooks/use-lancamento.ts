import type { TransacaoCreateRequest, TransacaoUpdateRequest } from '@nossagrana/types';
import { useEffect, useState } from 'react';

import type { Transacao } from '@/routes/contexto-logado';
import { transacaoService } from '@/services/core-financeiro.service';
import { novaChaveIdempotencia } from '@/services/idempotencia';
import { useTransacaoStore } from '@/stores/transacao.store';

import { usePainelLancar } from './use-painel-lancar';

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

/**
 * Painel de lançar (nova transação ou edição) e as chamadas de gravação ligadas a ele.
 * Quem está aberto e qual transação vêm do endereço (`usePainelLancar`); os dados da
 * transação em edição ficam em memória, indexados pelo id do endereço.
 */
export const useLancamento = (familiaId: string) => {
  const painel = usePainelLancar();
  const [emMemoria, setEmMemoria] = useState<TransacaoEmEdicao | null>(null);
  const sinalizarMudanca = useTransacaoStore((s) => s.sinalizarMudanca);
  const emEdicao = emMemoria?.id === painel.transacaoId ? emMemoria : null;

  // Recarga ou link com o id de uma transação que não está em memória: não há o que editar.
  const { transacaoId, fechar } = painel;
  useEffect(() => {
    if (transacaoId !== null && emMemoria?.id !== transacaoId) fechar();
  }, [transacaoId, emMemoria, fechar]);

  const encerrar = () => {
    painel.fechar();
    setEmMemoria(null);
  };

  const registrar = async (payload: TransacaoCreateRequest) => {
    if (!familiaId) return;
    // Chave nova por envio (#90). Reenvio após falha ainda gera outra: reuso até o sucesso é a #96.
    await transacaoService.registrar(payload, familiaId, novaChaveIdempotencia());
    sinalizarMudanca();
    painel.fechar();
  };

  const atualizar = async (id: string, payload: TransacaoUpdateRequest) => {
    if (!familiaId) return;
    await transacaoService.editar(id, payload, familiaId);
    sinalizarMudanca();
    encerrar();
  };

  const excluir = async (id: string) => {
    if (!familiaId) return;
    await transacaoService.excluir(id, familiaId);
    sinalizarMudanca();
    encerrar();
  };

  return {
    abrirNova: painel.abrirNova,
    abrirEdicao: (t: Transacao) => {
      setEmMemoria(paraEdicao(t));
      painel.abrirEdicao(t.id);
    },
    modal: {
      open: painel.aberto,
      familiaId,
      onClose: encerrar,
      onSubmit: registrar,
      transacaoParaEditar: emEdicao,
      onUpdate: atualizar,
      onDelete: excluir,
    },
  };
};
