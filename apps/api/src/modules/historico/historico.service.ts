import type { HistoricoDetalheResponse, HistoricoListResponse } from '@nossagrana/types';

import type { HistoricoRepository } from './historico.types.js';

export class HistoricoService {
  constructor(private readonly repo: HistoricoRepository) {}

  async list(familiaId: string): Promise<HistoricoListResponse> {
    const [meses, snapshots] = await Promise.all([
      this.repo.getMesesComTransacoes(familiaId),
      this.repo.listSnapshots(familiaId),
    ]);

    const snapMap = new Map(snapshots.map((s) => [s.mesReferencia, s]));

    // Identify months without snapshot and batch-load their summaries
    const mesesSemSnapshot = meses.filter((mes) => !snapMap.has(mes));
    const resumos = await this.repo.getResumoTransacoesBatch(familiaId, mesesSemSnapshot);
    const resumoMap = new Map(resumos.map((r) => [r.mesReferencia, r]));

    const result = meses.map((mes) => {
      const snap = snapMap.get(mes);
      if (snap) {
        return {
          mesReferencia: mes,
          totalReceitas: snap.totalReceitas,
          totalDespesas: snap.totalDespesas,
          saldo: snap.saldo,
          temSnapshot: true,
          divergente: snap.divergente,
          geradoEm: snap.geradoEm.toISOString(),
        };
      }
      const resumo = resumoMap.get(mes) ?? {
        totalReceitas: '0.00',
        totalDespesas: '0.00',
        saldo: '0.00',
      };
      return {
        mesReferencia: mes,
        totalReceitas: resumo.totalReceitas,
        totalDespesas: resumo.totalDespesas,
        saldo: resumo.saldo,
        temSnapshot: false,
        divergente: false,
        geradoEm: null,
      };
    });

    return { meses: result };
  }

  async detalhe(familiaId: string, mesReferencia: string): Promise<HistoricoDetalheResponse> {
    const [resumo, snap] = await Promise.all([
      this.repo.getResumoTransacoesMes(familiaId, mesReferencia),
      this.repo.findSnapshot(familiaId, mesReferencia),
    ]);

    return {
      mesReferencia,
      atual: {
        totalReceitas: resumo.totalReceitas,
        totalDespesas: resumo.totalDespesas,
        saldo: resumo.saldo,
      },
      snapshot: snap
        ? {
            totalReceitas: snap.totalReceitas,
            totalDespesas: snap.totalDespesas,
            saldo: snap.saldo,
            geradoEm: snap.geradoEm.toISOString(),
            divergente: snap.divergente,
            dadosCategorias: snap.dadosCategorias,
            dadosUsuarios: snap.dadosUsuarios,
          }
        : null,
    };
  }
}
