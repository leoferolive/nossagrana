import type {
  OrcamentoHistoricoResponse,
  OrcamentoItem,
  OrcamentoListResponse,
} from '@nossagrana/types';

export interface OrcamentoVigenteRow {
  id: string;
  categoriaId: string;
  categoriaNome: string;
  valorLimite: string;
  vigenciaInicio: string;
  vigenciaFim: string | null;
}

export interface OrcamentoHistoricoRow {
  id: string;
  categoriaId: string;
  valorLimite: string;
  vigenciaInicio: string;
  vigenciaFim: string | null;
  criadoEm: Date;
}

export interface OrcamentoSetInput {
  familiaId: string;
  categoriaId: string;
  categoriaNome?: string;
  usuarioId: string;
  valorLimite: string;
  vigenciaInicio: string;
}

export interface OrcamentoRepository {
  listVigentes(familiaId: string, mesReferencia: string): Promise<OrcamentoVigenteRow[]>;
  getGastosPorCategoria(familiaId: string, mesReferencia: string): Promise<Map<string, string>>;
  findAberto(familiaId: string, categoriaId: string): Promise<OrcamentoHistoricoRow | null>;
  encerrar(id: string, familiaId: string, vigenciaFim: string): Promise<void>;
  insert(input: OrcamentoSetInput): Promise<OrcamentoHistoricoRow>;
  listHistorico(familiaId: string, categoriaId: string): Promise<OrcamentoHistoricoRow[]>;
}

export type { OrcamentoHistoricoResponse, OrcamentoItem, OrcamentoListResponse };
