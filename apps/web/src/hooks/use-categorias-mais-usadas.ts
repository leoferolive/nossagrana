import type { TransacaoListResponse } from '@nossagrana/types';
import { useEffect, useMemo, useState } from 'react';

import { transacaoService } from '@/services/core-financeiro.service';
import { useCategoriaStore } from '@/stores/categoria.store';
import { categoriasMaisUsadas } from '@/utils/categorias-mais-usadas';
import { getCurrentMonth, shiftMonth, getTodayLocalISO } from '@/utils/date';

type Transacao = TransacaoListResponse['transacoes'][number];

// O mês seguinte entra porque compra no cartão depois do fechamento tem `mesReferencia` do mês
// seguinte (e a API filtra por ele); o atual e os dois anteriores cobrem os 60 dias de `data`.
const MESES_ANTES = 2;
const MESES_DEPOIS = 1;

// Uma busca por família enquanto o app está aberto: reabrir o painel não refaz as três chamadas.
const buscasPorFamilia = new Map<string, Promise<Transacao[]>>();

/** Esquece as buscas guardadas (troca de família ou de conta). */
export const esquecerBuscasDeCategorias = (): void => buscasPorFamilia.clear();

const buscarUltimosMeses = async (familiaId: string): Promise<Transacao[]> => {
  const atual = getCurrentMonth();
  const meses = Array.from({ length: MESES_ANTES + MESES_DEPOIS + 1 }, (_, i) =>
    shiftMonth(atual, MESES_DEPOIS - i),
  );
  const respostas = await Promise.all(
    meses.map((mesReferencia) => transacaoService.listar({ mesReferencia }, familiaId)),
  );
  return respostas.flatMap((r) => r.transacoes);
};

const buscaDaFamilia = (familiaId: string): Promise<Transacao[]> => {
  const guardada = buscasPorFamilia.get(familiaId);
  if (guardada) return guardada;
  const busca = buscarUltimosMeses(familiaId);
  buscasPorFamilia.set(familiaId, busca);
  // Falha não fica guardada: a próxima abertura tenta de novo.
  busca.catch(() => buscasPorFamilia.delete(familiaId));
  return busca;
};

/**
 * Categorias do tipo mais usadas nos últimos 60 dias, para os chips do painel de lançar.
 * Enquanto a busca não termina, ou se ela falhar, devolve as primeiras do tipo.
 */
export const useCategoriasMaisUsadas = (familiaId: string, tipo: 'receita' | 'despesa') => {
  const categorias = useCategoriaStore((s) => s.categorias);
  const [recentes, setRecentes] = useState<Transacao[]>([]);

  useEffect(() => {
    if (!familiaId) return;
    let ativo = true;
    buscaDaFamilia(familiaId)
      .then((transacoes) => {
        if (ativo) setRecentes(transacoes);
      })
      .catch(() => {
        if (ativo) setRecentes([]);
      });
    return () => {
      ativo = false;
    };
  }, [familiaId]);

  return useMemo(
    () =>
      categoriasMaisUsadas({ transacoes: recentes, categorias, tipo, hoje: getTodayLocalISO() }),
    [recentes, categorias, tipo],
  );
};
