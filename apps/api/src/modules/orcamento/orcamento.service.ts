import type { OrcamentoHistoricoResponse, OrcamentoListResponse } from '@nossagrana/types';

import type { ReferenciaOwnershipChecker } from '../../shared/referencia-ownership/referencia-ownership.types.js';
import { mesAnterior } from '../../utils/date.js';
import { LimiteVigenciaAnteriorError, LimiteVigenciaDuplicadaError } from './orcamento.errors.js';
import type {
  OrcamentoHistoricoRow,
  OrcamentoRepository,
  OrcamentoSetInput,
} from './orcamento.types.js';

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
    try {
      await this.gravar(input);
    } catch (erro) {
      if (!(erro instanceof LimiteVigenciaDuplicadaError)) throw erro;
      // Outra requisição gravou esta vigência entre a consulta e a escrita: tenta
      // uma vez de novo, agora achando a linha dela para atualizar no lugar.
      await this.gravar(input);
    }
  }

  private async gravar(input: OrcamentoSetInput): Promise<void> {
    const aberto = await this.repo.findAberto(input.familiaId, input.categoriaId);
    // Orçamento novo exige categoria ativa; ajustar um já vigente não.
    await this.referencias.validar({
      familiaId: input.familiaId,
      categoria: { id: input.categoriaId, exigirAtiva: !aberto },
    });
    // Mesma vigência: atualiza no lugar. Encerrar e inserir deixaria duas linhas
    // do mesmo mês (a encerrada com início e fim iguais) na lista.
    if (aberto?.vigenciaInicio === input.vigenciaInicio) {
      await this.repo.atualizarValor(aberto.id, input.familiaId, input.valorLimite);
      return;
    }
    if (aberto) {
      // Antes de qualquer escrita: recusar depois de encerrar deixaria estado parcial.
      if (input.vigenciaInicio < aberto.vigenciaInicio) {
        throw new LimiteVigenciaAnteriorError(input.vigenciaInicio, aberto.vigenciaInicio);
      }
      await this.encerrarAberto(aberto, input);
    }
    await this.repo.insert(input);
  }

  private async encerrarAberto(
    aberto: OrcamentoHistoricoRow,
    input: OrcamentoSetInput,
  ): Promise<void> {
    // vigenciaInicio > aberto.vigenciaInicio (garantido por gravar), então o mês anterior
    // nunca precede o início do próprio limite.
    await this.repo.encerrar(aberto.id, input.familiaId, mesAnterior(input.vigenciaInicio));
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
