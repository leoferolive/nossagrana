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

    const result = await Promise.all(
      meses.map(async (mes) => {
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
        const resumo = await this.repo.getResumoTransacoesMes(familiaId, mes);
        return {
          mesReferencia: mes,
          totalReceitas: resumo.totalReceitas,
          totalDespesas: resumo.totalDespesas,
          saldo: resumo.saldo,
          temSnapshot: false,
          divergente: false,
          geradoEm: null,
        };
      }),
    );

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
