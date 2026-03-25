import type {
  RelatorioDistribuicaoResponse,
  RelatorioPorUsuarioResponse,
  RelatorioTendenciasResponse,
} from '@nossagrana/types';

import { mesAntesN } from '../../utils/date.js';
import type { RelatorioRepository } from './relatorio.types.js';

export class RelatorioService {
  constructor(private readonly repo: RelatorioRepository) {}

  async distribuicao(
    familiaId: string,
    mesReferencia: string,
  ): Promise<RelatorioDistribuicaoResponse> {
    const transacoes = await this.repo.getTransacoes(familiaId, mesReferencia);
    const despesas = transacoes.filter((t) => t.tipo === 'despesa' && !t.categoriaSistema);

    const map = new Map<string, { nome: string; total: number }>();
    for (const t of despesas) {
      const existing = map.get(t.categoriaId);
      if (existing) existing.total += parseFloat(t.valor);
      else map.set(t.categoriaId, { nome: t.categoriaNome, total: parseFloat(t.valor) });
    }

    const soma = Array.from(map.values()).reduce((acc, v) => acc + v.total, 0);

    const distribuicao = Array.from(map.entries())
      .map(([categoriaId, { nome, total }]) => ({
        categoriaId,
        categoriaNome: nome,
        total: total.toFixed(2),
        percentual: soma === 0 ? 0 : Math.round((total / soma) * 1000) / 10,
      }))
      .sort((a, b) => parseFloat(b.total) - parseFloat(a.total));

    return { mesReferencia, distribuicao };
  }

  async porUsuario(familiaId: string, mesReferencia: string): Promise<RelatorioPorUsuarioResponse> {
    const transacoes = await this.repo.getTransacoes(familiaId, mesReferencia);
    const despesas = transacoes.filter((t) => t.tipo === 'despesa' && !t.categoriaSistema);

    const map = new Map<string, { nome: string; total: number }>();
    for (const t of despesas) {
      const existing = map.get(t.usuarioId);
      if (existing) existing.total += parseFloat(t.valor);
      else map.set(t.usuarioId, { nome: t.usuarioNome, total: parseFloat(t.valor) });
    }

    const soma = Array.from(map.values()).reduce((acc, v) => acc + v.total, 0);

    const porUsuario = Array.from(map.entries())
      .map(([usuarioId, { nome, total }]) => ({
        usuarioId,
        usuarioNome: nome,
        total: total.toFixed(2),
        percentual: soma === 0 ? 0 : Math.round((total / soma) * 1000) / 10,
      }))
      .sort((a, b) => parseFloat(b.total) - parseFloat(a.total));

    return { mesReferencia, porUsuario };
  }

  async tendencias(
    familiaId: string,
    mesReferencia: string,
    meses: number,
  ): Promise<RelatorioTendenciasResponse> {
    // Build array of YYYY-MM strings from oldest to newest
    const mesRefs = Array.from({ length: meses }, (_, i) =>
      mesAntesN(mesReferencia, meses - 1 - i),
    );

    // Single batch query instead of N individual queries
    const todasTransacoes = await this.repo.getTransacoesBatch(familiaId, mesRefs);

    // Group by mesReferencia in memory
    const porMes = new Map<string, { totalReceitas: number; totalDespesas: number }>();
    for (const mes of mesRefs) {
      porMes.set(mes, { totalReceitas: 0, totalDespesas: 0 });
    }
    for (const t of todasTransacoes) {
      const entry = porMes.get(t.mesReferencia);
      if (entry) {
        if (t.tipo === 'receita') entry.totalReceitas += parseFloat(t.valor);
        else entry.totalDespesas += parseFloat(t.valor);
      }
    }

    const resultados = mesRefs.map((mes) => {
      const { totalReceitas, totalDespesas } = porMes.get(mes)!;
      return {
        mesReferencia: mes,
        totalReceitas: totalReceitas.toFixed(2),
        totalDespesas: totalDespesas.toFixed(2),
        saldo: (totalReceitas - totalDespesas).toFixed(2),
      };
    });

    return { meses: resultados };
  }
}
