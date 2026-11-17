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
  usuarioId: string;
  valorLimite: string;
  vigenciaInicio: string;
}

export interface OrcamentoRepository {
  listVigentes(familiaId: string, mesReferencia: string): Promise<OrcamentoVigenteRow[]>;
  getGastosPorCategoria(familiaId: string, mesReferencia: string): Promise<Map<string, string>>;
  findAberto(familiaId: string, categoriaId: string): Promise<OrcamentoHistoricoRow | null>;
  encerrar(id: string, familiaId: string, vigenciaFim: string): Promise<void>;
  /** Encerra o limite vigente e insere o novo numa unidade só: ou grava os dois, ou nenhum. */
  substituirVigente(
    idVigente: string,
    vigenciaFimVigente: string,
    input: OrcamentoSetInput,
  ): Promise<void>;
  atualizarValor(id: string, familiaId: string, valorLimite: string): Promise<void>;
  insert(input: OrcamentoSetInput): Promise<OrcamentoHistoricoRow>;
  listHistorico(familiaId: string, categoriaId: string): Promise<OrcamentoHistoricoRow[]>;
}
