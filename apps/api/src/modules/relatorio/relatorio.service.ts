import type {
  RelatorioDistribuicaoResponse,
  RelatorioPorUsuarioResponse,
  RelatorioTendenciasResponse,
} from '@nossagrana/types';

import type { RelatorioRepository } from './relatorio.types.js';

// Helper: compute YYYY-MM that is N months before mesReferencia
function mesAntesN(mesReferencia: string, n: number): string {
  const [ano, mes] = mesReferencia.split('-').map(Number);
  const d = new Date(Date.UTC(ano, mes - 1 - n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

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

    const resultados = await Promise.all(
      mesRefs.map(async (mes) => {
        const transacoes = await this.repo.getTransacoes(familiaId, mes);
        let totalReceitas = 0;
        let totalDespesas = 0;
        for (const t of transacoes) {
          if (t.tipo === 'receita') totalReceitas += parseFloat(t.valor);
          else totalDespesas += parseFloat(t.valor);
        }
        return {
          mesReferencia: mes,
          totalReceitas: totalReceitas.toFixed(2),
          totalDespesas: totalDespesas.toFixed(2),
          saldo: (totalReceitas - totalDespesas).toFixed(2),
        };
      }),
    );

    return { meses: resultados };
  }
}
