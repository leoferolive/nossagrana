import { useEffect, useState } from 'react';

import type { DashboardOrcamentoResponse, MetodoPagamentoListResponse } from '@nossagrana/types';

import { cofrinhoService } from '../services/cofrinho.service';
import { coreFinanceiroService, metodoPagamentoService } from '../services/core-financeiro.service';
import { templateTransacaoService } from '../services/template-transacao.service';

export interface ContagemDoMes {
  parcial: number;
  total: number;
}

export interface DiasDoCartao {
  fechamento: number | null;
  vencimento: number | null;
}

export interface FaturaDoMes {
  metodoId: string;
  nome: string;
  dias: DiasDoCartao;
}

export interface ResumoDoPlano {
  contas: number | null;
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

type MetodoPagamento = MetodoPagamentoListResponse['metodosPagamento'][number];

// Mês sem orçamento não tem o que resumir: "0 de 0" seria ruído, então a linha fica sem resumo.
const contarLimites = (orcamento: DashboardOrcamentoResponse): ContagemDoMes | null =>
  orcamento.length === 0
    ? null
    : {
        parcial: orcamento.filter((item) => item.status === 'exceeded').length,
        total: orcamento.length,
      };

const faturasDoMes = (metodos: MetodoPagamento[]): FaturaDoMes[] =>
  metodos
    .filter((m) => m.tipo === 'credito' && m.ativo)
    .map((m) => ({
      metodoId: m.id,
      nome: m.nome,
      dias: { fechamento: m.dataFechamento, vencimento: m.dataVencimento },
    }));

// Cada resumo é buscado e calculado isolado: o `async` converte até um erro síncrono ou uma
// resposta fora do formato em rejeição, e uma falha só tira o resumo da própria linha.
const resolver = <T>(busca: () => Promise<T>) => (async () => busca())();

const buscarResumo = async (familiaId: string, mes: string) => {
  const [contas, limites, faturas, cofrinhos] = await Promise.allSettled([
    resolver(async () => (await templateTransacaoService.listar(familiaId)).templates.length),
    resolver(async () =>
      contarLimites(await coreFinanceiroService.getDashboardOrcamento(familiaId, mes)),
    ),
    resolver(async () =>
      faturasDoMes((await metodoPagamentoService.listar(familiaId)).metodosPagamento),
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
