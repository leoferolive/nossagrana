import type {
  HistoricoDetalheResponse,
  HistoricoListResponse,
  SnapshotDadosCategoria,
  SnapshotDadosUsuario,
} from '@nossagrana/types';

export interface SnapshotRow {
  id: string;
  familiaId: string;
  mesReferencia: string;
  totalReceitas: string;
  totalDespesas: string;
  saldo: string;
  dadosCategorias: SnapshotDadosCategoria[];
  dadosUsuarios: SnapshotDadosUsuario[];
  divergente: boolean;
  geradoEm: Date;
}

export interface TransacaoResumoRow {
  mesReferencia: string;
  totalReceitas: string;
  totalDespesas: string;
  saldo: string;
}

export interface TransacaoCategoriaSumaRow {
  mesReferencia: string;
  categoriaId: string;
  categoriaNome: string;
  total: string;
}

export interface TransacaoUsuarioSumaRow {
  mesReferencia: string;
  usuarioId: string;
  usuarioNome: string;
  total: string;
}

export interface SnapshotInsertInput {
  familiaId: string;
  mesReferencia: string;
  totalReceitas: string;
  totalDespesas: string;
  saldo: string;
  dadosCategorias: SnapshotDadosCategoria[];
  dadosUsuarios: SnapshotDadosUsuario[];
}

export interface HistoricoRepository {
  listSnapshots(familiaId: string): Promise<SnapshotRow[]>;
  findSnapshot(familiaId: string, mesReferencia: string): Promise<SnapshotRow | null>;
  getResumoTransacoesMes(familiaId: string, mesReferencia: string): Promise<TransacaoResumoRow>;
  getMesesComTransacoes(familiaId: string): Promise<string[]>;
  marcarDivergente(familiaId: string, mesReferencia: string): Promise<void>;
  insertSnapshot(input: SnapshotInsertInput): Promise<SnapshotRow>;
  getTransacoesPorCategoria(
    familiaId: string,
    mesReferencia: string,
  ): Promise<TransacaoCategoriaSumaRow[]>;
  getTransacoesPorUsuario(
    familiaId: string,
    mesReferencia: string,
  ): Promise<TransacaoUsuarioSumaRow[]>;
}

export type { HistoricoDetalheResponse, HistoricoListResponse };
