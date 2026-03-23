import type {
  RelatorioDistribuicaoResponse,
  RelatorioPorUsuarioResponse,
  RelatorioTendenciasResponse,
} from '@nossagrana/types';

export interface RelatorioTransacaoRow {
  familiaId: string;
  tipo: 'receita' | 'despesa';
  valor: string;
  categoriaId: string;
  categoriaNome: string;
  categoriaSistema: boolean;
  mesReferencia: string;
  usuarioId: string;
  usuarioNome: string;
}

export interface RelatorioRepository {
  getTransacoes(familiaId: string, mesReferencia: string): Promise<RelatorioTransacaoRow[]>;
}

export type {
  RelatorioDistribuicaoResponse,
  RelatorioPorUsuarioResponse,
  RelatorioTendenciasResponse,
};
