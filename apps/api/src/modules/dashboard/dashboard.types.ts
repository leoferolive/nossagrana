// apps/api/src/modules/dashboard/dashboard.types.ts

export interface ResumoMes {
  totalReceitas: string;
  totalDespesas: string;
  saldo: string;
}

export interface SnapshotMes {
  totalReceitas: string;
  totalDespesas: string;
  saldo: string;
}

export interface CategoriaGasto {
  categoriaId: string;
  categoriaNome: string;
  total: string;
}

export interface DiaGasto {
  dia: string; // "YYYY-MM-DD"
  totalDespesas: string;
  totalReceitas: string;
}

export interface OrcamentoVigente {
  categoriaId: string;
  categoriaNome: string;
  valorLimite: string;
}

export interface GastoCategoria {
  categoriaId: string;
  totalGasto: string;
}

export interface DashboardRepository {
  getResumoMes(familiaId: string, mesReferencia: string): Promise<ResumoMes>;
  getSnapshotMes(familiaId: string, mesReferencia: string): Promise<SnapshotMes | null>;
  getDistribuicaoCategorias(familiaId: string, mesReferencia: string): Promise<CategoriaGasto[]>;
  getTransacoesPorDia(familiaId: string, mesReferencia: string): Promise<DiaGasto[]>;
  getOrcamentosVigentes(familiaId: string, mesReferencia: string): Promise<OrcamentoVigente[]>;
  getGastosPorCategoria(familiaId: string, mesReferencia: string): Promise<GastoCategoria[]>;
}
