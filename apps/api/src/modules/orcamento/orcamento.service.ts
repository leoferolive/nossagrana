import type { OrcamentoHistoricoResponse, OrcamentoListResponse } from '@nossagrana/types';

import type { ReferenciaOwnershipChecker } from '../../shared/referencia-ownership/referencia-ownership.types.js';
import { mesAnterior } from '../../utils/date.js';
import type { OrcamentoRepository, OrcamentoSetInput } from './orcamento.types.js';

function calcularStatus(percentual: number): 'ok' | 'warning' | 'exceeded' {
  if (percentual >= 100) return 'exceeded';
  if (percentual >= 80) return 'warning';
  return 'ok';
}

export class OrcamentoService {
  constructor(
    private readonly repo: OrcamentoRepository,
    private readonly referencias: ReferenciaOwnershipChecker,
  ) {}

  async list(familiaId: string, mesReferencia: string): Promise<OrcamentoListResponse> {
    const [vigentes, gastos] = await Promise.all([
      this.repo.listVigentes(familiaId, mesReferencia),
      this.repo.getGastosPorCategoria(familiaId, mesReferencia),
    ]);

    const orcamentos = vigentes.map((o) => {
      const totalGasto = gastos.get(o.categoriaId) ?? '0.00';
      const percentual =
        parseFloat(o.valorLimite) === 0
          ? 0
          : Math.round((parseFloat(totalGasto) / parseFloat(o.valorLimite)) * 1000) / 10;
      return {
        id: o.id,
        categoriaId: o.categoriaId,
        categoriaNome: o.categoriaNome,
        valorLimite: o.valorLimite,
        vigenciaInicio: o.vigenciaInicio,
        vigenciaFim: o.vigenciaFim,
        totalGasto,
        percentual,
        status: calcularStatus(percentual),
      };
    });

    return { orcamentos };
  }

  async set(input: OrcamentoSetInput): Promise<void> {
    const aberto = await this.repo.findAberto(input.familiaId, input.categoriaId);
    // Orçamento novo exige categoria ativa; ajustar um já vigente não.
    await this.referencias.validar({
      familiaId: input.familiaId,
      categoria: { id: input.categoriaId, exigirAtiva: !aberto },
    });
    if (aberto) {
      const vigFimCandidate = mesAnterior(input.vigenciaInicio);
      // Guard: vigenciaFim must not precede the record's own start (same-month edge case)
      const vigFim =
        vigFimCandidate >= aberto.vigenciaInicio ? vigFimCandidate : aberto.vigenciaInicio;
      await this.repo.encerrar(aberto.id, input.familiaId, vigFim);
    }
    await this.repo.insert(input);
  }

  async historico(familiaId: string, categoriaId: string): Promise<OrcamentoHistoricoResponse> {
    const rows = await this.repo.listHistorico(familiaId, categoriaId);
    return {
      historico: rows.map((r) => ({
        id: r.id,
        categoriaId: r.categoriaId,
        valorLimite: r.valorLimite,
        vigenciaInicio: r.vigenciaInicio,
        vigenciaFim: r.vigenciaFim,
        criadoEm: r.criadoEm.toISOString(),
      })),
    };
  }
}
