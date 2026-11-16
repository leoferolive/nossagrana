import { useEffect, useState } from 'react';

import type {
  DashboardOrcamentoResponse,
  MetodoPagamentoListResponse,
  TemplateTransacaoListItem,
  TransacaoListResponse,
} from '@nossagrana/types';

import { cofrinhoService } from '../services/cofrinho.service';
import {
  coreFinanceiroService,
  metodoPagamentoService,
  transacaoService,
} from '../services/core-financeiro.service';
import { templateTransacaoService } from '../services/template-transacao.service';
import { vencimentoDaFatura } from '../utils/fatura';

export interface ContagemDoMes {
  parcial: number;
  total: number;
}

export interface FaturaDoMes {
  metodoId: string;
  nome: string;
  vencimento: string | null;
}

export interface ResumoDoPlano {
  contas: ContagemDoMes | null;
  limites: ContagemDoMes | null;
  cofrinhosAtivos: number | null;
  faturas: FaturaDoMes[];
}

const RESUMO_VAZIO: ResumoDoPlano = {
  contas: null,
  limites: null,
  cofrinhosAtivos: null,
  faturas: [],
};

type Transacao = TransacaoListResponse['transacoes'][number];
type MetodoPagamento = MetodoPagamentoListResponse['metodosPagamento'][number];

const normalizar = (texto: string | null): string => (texto ?? '').trim().toLowerCase();

/**
 * Uma conta do mês conta como lançada quando há transação do mês com o nome do modelo: é como a
 * API grava o que "Salvar Lançamentos" cria (descrição = nome do modelo).
 */
const contarContas = (
  modelos: TemplateTransacaoListItem[],
  transacoes: Transacao[],
): ContagemDoMes => {
  const descricoes = new Set(transacoes.map((t) => normalizar(t.descricao)));
  const lancadas = modelos.filter((m) => descricoes.has(normalizar(m.nome)));
  return { parcial: lancadas.length, total: modelos.length };
};

const contarLimites = (orcamento: DashboardOrcamentoResponse): ContagemDoMes => ({
  parcial: orcamento.filter((item) => item.status === 'exceeded').length,
  total: orcamento.length,
});

const faturasDoMes = (metodos: MetodoPagamento[], mes: string): FaturaDoMes[] =>
  metodos
    .filter((m) => m.tipo === 'credito' && m.ativo)
    .map((m) => ({
      metodoId: m.id,
      nome: m.nome,
      vencimento: vencimentoDaFatura(mes, m.dataFechamento, m.dataVencimento),
    }));

// Cada resumo é buscado e calculado isolado: o `async` converte até um erro síncrono ou uma
// resposta fora do formato em rejeição, e uma falha só tira o resumo da própria linha.
const resolver = <T>(busca: () => Promise<T>) => (async () => busca())();

const buscarContas = async (familiaId: string, mes: string) => {
  const [modelos, transacoes] = await Promise.all([
    templateTransacaoService.listar(familiaId),
    transacaoService.listar({ mesReferencia: mes }, familiaId),
  ]);
  return contarContas(modelos.templates, transacoes.transacoes);
};

const buscarResumo = async (familiaId: string, mes: string) => {
  const [contas, limites, faturas, cofrinhos] = await Promise.allSettled([
    resolver(() => buscarContas(familiaId, mes)),
    resolver(async () =>
      contarLimites(await coreFinanceiroService.getDashboardOrcamento(familiaId, mes)),
    ),
    resolver(async () =>
      faturasDoMes((await metodoPagamentoService.listar(familiaId)).metodosPagamento, mes),
    ),
    resolver(async () => (await cofrinhoService.listar(familiaId)).cofrinhos.length),
  ]);
  const resumo: ResumoDoPlano = {
    contas: contas.status === 'fulfilled' ? contas.value : null,
    limites: limites.status === 'fulfilled' ? limites.value : null,
    cofrinhosAtivos: cofrinhos.status === 'fulfilled' ? cofrinhos.value : null,
    faturas: faturas.status === 'fulfilled' ? faturas.value : [],
  };
  const falhou = [contas, limites, faturas, cofrinhos].some((r) => r.status === 'rejected');
  return { resumo, falhou };
};

/** Os resumos das linhas de Planejar, reaproveitando os serviços das telas de destino. */
export const usePlanejar = (familiaId: string, mes: string) => {
  const [estado, setEstado] = useState({ carregando: true, falhou: false, resumo: RESUMO_VAZIO });

  useEffect(() => {
    let atual = true;
    setEstado((anterior) => ({ ...anterior, carregando: true, falhou: false }));
    void buscarResumo(familiaId, mes).then((resultado) => {
      if (atual) setEstado({ carregando: false, ...resultado });
    });
    return () => {
      atual = false;
    };
  }, [familiaId, mes]);

  return estado;
};
