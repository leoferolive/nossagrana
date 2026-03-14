import type {
  DashboardGraficosResponse,
  DashboardOrcamentoItem,
  DashboardResumoResponse,
} from '@nossagrana/types';

import type { DashboardRepository } from './dashboard.types.js';

/** Retorna número de dias do mês YYYY-MM */
function diasNoMes(mesReferencia: string): number {
  const [ano, mes] = mesReferencia.split('-').map(Number);
  return new Date(ano, mes, 0).getDate();
}

/** Subtrai 1 mês de YYYY-MM */
function mesAnterior(mesReferencia: string): string {
  const [ano, mes] = mesReferencia.split('-').map(Number);
  const d = new Date(Date.UTC(ano, mes - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function calcularStatus(percentual: number): 'ok' | 'warning' | 'exceeded' {
  if (percentual >= 100) return 'exceeded';
  if (percentual >= 80) return 'warning';
  return 'ok';
}

export class DashboardService {
  constructor(private readonly repo: DashboardRepository) {}

  getMesReferenciaAtual(now: Date = new Date()): string {
    const partes = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(now);
    const ano = partes.find((p) => p.type === 'year')!.value;
    const mes = partes.find((p) => p.type === 'month')!.value;
    return `${ano}-${mes}`;
  }

  async getResumo(familiaId: string, mesReferencia: string): Promise<DashboardResumoResponse> {
    const resumo = await this.repo.getResumoMes(familiaId, mesReferencia);
    const mesPrev = mesAnterior(mesReferencia);

    // Tenta snapshot primeiro
    const snapshot = await this.repo.getSnapshotMes(familiaId, mesPrev);
    if (snapshot) {
      return {
        ...resumo,
        mesReferencia,
        mesAnterior: {
          mesReferencia: mesPrev,
          totalReceitas: snapshot.totalReceitas,
          totalDespesas: snapshot.totalDespesas,
          saldo: snapshot.saldo,
          fonteSnapshot: true,
        },
      };
    }

    // Re-agrega quando sem snapshot
    const resumoPrev = await this.repo.getResumoMes(familiaId, mesPrev);
    const temDados =
      parseFloat(resumoPrev.totalReceitas) > 0 || parseFloat(resumoPrev.totalDespesas) > 0;

    return {
      ...resumo,
      mesReferencia,
      mesAnterior: temDados
        ? { mesReferencia: mesPrev, ...resumoPrev, fonteSnapshot: false }
        : null,
    };
  }

  async getGraficos(
    familiaId: string,
    mesReferencia: string,
  ): Promise<DashboardGraficosResponse> {
    const [categoriasRaw, diasRaw] = await Promise.all([
      this.repo.getDistribuicaoCategorias(familiaId, mesReferencia),
      this.repo.getTransacoesPorDia(familiaId, mesReferencia),
    ]);

    // Calcula percentual (guard: soma zero → return [])
    const somaTotal = categoriasRaw.reduce((acc, c) => acc + parseFloat(c.total), 0);
    const distribuicaoCategorias =
      somaTotal === 0
        ? []
        : categoriasRaw.map((c) => ({
            ...c,
            percentual: Math.round((parseFloat(c.total) / somaTotal) * 1000) / 10,
          }));

    // Preenche array denso
    const totalDias = diasNoMes(mesReferencia);
    const [ano, mes] = mesReferencia.split('-');
    const diasMap = new Map(diasRaw.map((d) => [d.dia, d]));
    const evolucaoDiaria = Array.from({ length: totalDias }, (_, i) => {
      const dia = `${ano}-${mes}-${String(i + 1).padStart(2, '0')}`;
      return diasMap.get(dia) ?? { dia, totalDespesas: '0.00', totalReceitas: '0.00' };
    });

    return { distribuicaoCategorias, evolucaoDiaria };
  }

  async getOrcamento(
    familiaId: string,
    mesReferencia: string,
  ): Promise<DashboardOrcamentoItem[]> {
    const [orcamentos, gastos] = await Promise.all([
      this.repo.getOrcamentosVigentes(familiaId, mesReferencia),
      this.repo.getGastosPorCategoria(familiaId, mesReferencia),
    ]);

    if (orcamentos.length === 0) return [];

    const gastosMap = new Map(gastos.map((g) => [g.categoriaId, g.totalGasto]));

    return orcamentos.map((o) => {
      const totalGasto = gastosMap.get(o.categoriaId) ?? '0.00';
      const percentual =
        parseFloat(o.valorLimite) === 0
          ? 0
          : Math.round((parseFloat(totalGasto) / parseFloat(o.valorLimite)) * 1000) / 10;
      return {
        categoriaId: o.categoriaId,
        categoriaNome: o.categoriaNome,
        valorLimite: o.valorLimite,
        totalGasto,
        percentual,
        status: calcularStatus(percentual),
      };
    });
  }
}
