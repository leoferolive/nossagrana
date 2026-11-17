import { useEffect, useRef, useState } from 'react';

import { transacaoService } from '@/services/core-financeiro.service';
import { useTransacaoStore } from '@/stores/transacao.store';

interface EstadoDaCarga {
  setTransacoes: ReturnType<typeof useTransacaoStore.getState>['setTransacoes'];
  setCarregando: (carregando: boolean) => void;
  setFalhou: (falhou: boolean) => void;
  /** Chave da última carga que deu certo; vazia depois de uma falha. */
  chaveBoa: { current: string };
}

/**
 * Busca o mês e devolve o cancelamento (resposta de mês ou família que já mudou é descartada).
 * Carga "silenciosa" (mesma chave que já deu certo, como depois de gravar) não troca a lista por
 * "Carregando". Qualquer falha, silenciosa ou não, leva ao estado de erro: a lista antiga estaria
 * sem o que acabou de ser gravado.
 */
const carregarMes = (familiaId: string, mes: string, chave: string, estado: EstadoDaCarga) => {
  const { setTransacoes, setCarregando, setFalhou, chaveBoa } = estado;
  let ativo = true;
  if (chaveBoa.current !== chave) {
    setFalhou(false);
    setCarregando(true);
  }
  transacaoService
    .listar({ mesReferencia: mes }, familiaId)
    .then((res) => {
      if (!ativo) return;
      chaveBoa.current = chave;
      setTransacoes(res.transacoes);
      setFalhou(false);
    })
    .catch(() => {
      if (!ativo) return;
      chaveBoa.current = '';
      setTransacoes([]);
      setFalhou(true);
    })
    .finally(() => {
      if (ativo) setCarregando(false);
    });
  return () => {
    ativo = false;
  };
};

/**
 * Carrega o mês do Extrato e recarrega quando a store sinaliza uma gravação (`versao`).
 * `tentarDeNovo` repete a busca como se fosse a primeira (com "Carregando").
 */
export const useTransacoesDoMes = (familiaId: string, mesReferencia: string) => {
  const setTransacoes = useTransacaoStore((s) => s.setTransacoes);
  const setCarregando = useTransacaoStore((s) => s.setCarregando);
  const versao = useTransacaoStore((s) => s.versao);
  const [falhou, setFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const chaveBoa = useRef('');

  useEffect(() => {
    if (!familiaId) return;
    const chave = `${familiaId}|${mesReferencia}|${tentativa}`;
    return carregarMes(familiaId, mesReferencia, chave, {
      setTransacoes,
      setCarregando,
      setFalhou,
      chaveBoa,
    });
  }, [familiaId, mesReferencia, tentativa, versao, setCarregando, setTransacoes]);

  return { falhou, tentarDeNovo: () => setTentativa((n) => n + 1) };
};
