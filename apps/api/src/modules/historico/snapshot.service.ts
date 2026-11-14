import type { HistoricoRepository, ResultadoSnapshot } from './historico.types.js';

/** Subconjunto do logger do Fastify (`app.log`): logs em JSON estruturado. */
export interface LogDoSnapshot {
  info(dados: object, mensagem: string): void;
}

const LOG_NAO_OPERACIONAL: LogDoSnapshot = { info: () => undefined };

export class SnapshotService {
  constructor(
    private readonly repo: HistoricoRepository,
    private readonly log: LogDoSnapshot = LOG_NAO_OPERACIONAL,
  ) {}

  /** Idempotente: se o snapshot do mês já existe, devolve-o intacto com `criado=false`. */
  async gerarSnapshot(familiaId: string, mesReferencia: string): Promise<ResultadoSnapshot> {
    const existing = await this.repo.findSnapshot(familiaId, mesReferencia);
    if (existing) return { snapshot: existing, criado: false };

    const [resumo, porCategoria, porUsuario] = await Promise.all([
      this.repo.getResumoTransacoesMes(familiaId, mesReferencia),
      this.repo.getTransacoesPorCategoria(familiaId, mesReferencia),
      this.repo.getTransacoesPorUsuario(familiaId, mesReferencia),
    ]);

    const saldo = (parseFloat(resumo.totalReceitas) - parseFloat(resumo.totalDespesas)).toFixed(2);

    const resultado = await this.repo.insertSnapshot({
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
    if (!resultado.criado) this.registrarConflito(resultado);
    return resultado;
  }

  private registrarConflito({ snapshot }: ResultadoSnapshot): void {
    this.log.info(
      {
        familiaId: snapshot.familiaId,
        mesReferencia: snapshot.mesReferencia,
        snapshotId: snapshot.id,
      },
      'Snapshot mensal já existia: criação concorrente ignorada',
    );
  }

  async marcarDivergente(familiaId: string, mesReferencia: string): Promise<void> {
    const snap = await this.repo.findSnapshot(familiaId, mesReferencia);
    if (!snap) return;
    await this.repo.marcarDivergente(familiaId, mesReferencia);
  }
}
