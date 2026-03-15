import type { SnapshotRow } from './historico.types.js';
import type { HistoricoRepository } from './historico.types.js';

export class SnapshotService {
  constructor(private readonly repo: HistoricoRepository) {}

  async gerarSnapshot(familiaId: string, mesReferencia: string): Promise<SnapshotRow> {
    const existing = await this.repo.findSnapshot(familiaId, mesReferencia);
    if (existing) return existing;

    const [resumo, porCategoria, porUsuario] = await Promise.all([
      this.repo.getResumoTransacoesMes(familiaId, mesReferencia),
      this.repo.getTransacoesPorCategoria(familiaId, mesReferencia),
      this.repo.getTransacoesPorUsuario(familiaId, mesReferencia),
    ]);

    const saldo = (parseFloat(resumo.totalReceitas) - parseFloat(resumo.totalDespesas)).toFixed(2);

    return this.repo.insertSnapshot({
      familiaId,
      mesReferencia,
      totalReceitas: resumo.totalReceitas,
      totalDespesas: resumo.totalDespesas,
      saldo,
      dadosCategorias: porCategoria.map((r) => ({
        categoriaId: r.categoriaId,
        categoriaNome: r.categoriaNome,
        total: r.total,
      })),
      dadosUsuarios: porUsuario.map((r) => ({
        usuarioId: r.usuarioId,
        usuarioNome: r.usuarioNome,
        total: r.total,
      })),
    });
  }

  async marcarDivergente(familiaId: string, mesReferencia: string): Promise<void> {
    const snap = await this.repo.findSnapshot(familiaId, mesReferencia);
    if (!snap) return;
    await this.repo.marcarDivergente(familiaId, mesReferencia);
  }
}
