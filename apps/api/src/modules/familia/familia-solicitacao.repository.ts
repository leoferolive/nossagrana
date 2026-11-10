import { and, eq, isNull } from 'drizzle-orm';

import type { ExecutorDrizzle, TransacaoDrizzle } from '../../db/executor.types.js';
import { familias, solicitacoesEntrada, usuarioFamilia } from '../../db/schema.js';
import type {
  CreatedFamiliaJoinRequest,
  RequestFamiliaJoinInput,
  ReviewedFamiliaJoinRequest,
} from './familia.types.js';

interface RevisaoInput {
  solicitacaoId: string;
  familiaId: string;
  adminId: string;
  acao: 'aprovar' | 'rejeitar';
}

/**
 * Solicitação e revisão de entrada coordenadas com a exclusão da família (#149,
 * mesma classe de corrida de #66/#147). O INSERT em `solicitacoes_entrada` /
 * `usuario_familia` só toma lock de CHAVE na linha da família (FK), que não
 * conflita com o `UPDATE familias SET deleted_at` da exclusão — então uma
 * solicitação criada ou aprovada depois de a família ser excluída entraria
 * numa família excluída e reapareceria numa restauração. Por isso a transação
 * primeiro trava a linha da família com `FOR SHARE` exigindo `deleted_at IS
 * NULL` (padrão de `DrizzleConviteCriador`):
 *  - exclusão em curso: o `FOR SHARE` espera o commit dela, não acha família
 *    ativa e nada é gravado;
 *  - operação em curso: a exclusão espera o commit dela.
 */
export class DrizzleSolicitacaoEntrada {
  constructor(private readonly executor: ExecutorDrizzle) {}

  /**
   * Ex.: `solicitar({ familiaId, usuarioId })` → a solicitação pendente; `null`
   * se a família não existe ou está excluída (nada é gravado).
   */
  async solicitar(input: RequestFamiliaJoinInput): Promise<CreatedFamiliaJoinRequest | null> {
    return this.executor.transaction(async (tx) => {
      if (!(await this.travarFamiliaAtiva(tx, input.familiaId))) return null;
      return this.inserir(tx, input);
    });
  }

  /** `null` se a solicitação não está pendente na família, ou a família está excluída. */
  async revisar(
    input: RevisaoInput,
    agora: Date = new Date(),
  ): Promise<ReviewedFamiliaJoinRequest | null> {
    return this.executor.transaction(async (tx) => {
      if (!(await this.travarFamiliaAtiva(tx, input.familiaId))) return null;
      const status = input.acao === 'aprovar' ? 'aprovada' : 'rejeitada';
      const pendente = await this.buscarPendente(tx, input);
      if (!pendente) return null;
      const revisada = await this.registrarResposta(tx, pendente.id, status, input.adminId, agora);
      if (status === 'aprovada') await this.vincularMembro(tx, pendente);
      return revisada;
    });
  }

  private async travarFamiliaAtiva(tx: TransacaoDrizzle, familiaId: string): Promise<boolean> {
    const linhas = await tx
      .select({ id: familias.id })
      .from(familias)
      .where(and(eq(familias.id, familiaId), isNull(familias.deletedAt)))
      .for('share');
    return linhas.length > 0;
  }

  private async inserir(
    tx: TransacaoDrizzle,
    input: RequestFamiliaJoinInput,
  ): Promise<CreatedFamiliaJoinRequest> {
    const [criada] = await tx
      .insert(solicitacoesEntrada)
      .values({ familiaId: input.familiaId, usuarioId: input.usuarioId, status: 'pendente' })
      .returning({
        id: solicitacoesEntrada.id,
        familiaId: solicitacoesEntrada.familiaId,
        usuarioId: solicitacoesEntrada.usuarioId,
        solicitadoEm: solicitacoesEntrada.solicitadoEm,
      });
    if (!criada) {
      throw new Error(
        `Solicitação do usuário ${input.usuarioId} na família ${input.familiaId} não retornou linha: esperado 1`,
      );
    }
    return { ...criada, status: 'pendente' };
  }

  private async buscarPendente(tx: TransacaoDrizzle, input: RevisaoInput) {
    const [pendente] = await tx
      .select({
        id: solicitacoesEntrada.id,
        familiaId: solicitacoesEntrada.familiaId,
        usuarioId: solicitacoesEntrada.usuarioId,
      })
      .from(solicitacoesEntrada)
      .where(
        and(
          eq(solicitacoesEntrada.id, input.solicitacaoId),
          eq(solicitacoesEntrada.familiaId, input.familiaId),
          eq(solicitacoesEntrada.status, 'pendente'),
        ),
      )
      .limit(1);
    return pendente;
  }

  private async registrarResposta(
    tx: TransacaoDrizzle,
    id: string,
    status: 'aprovada' | 'rejeitada',
    adminId: string,
    agora: Date,
  ): Promise<ReviewedFamiliaJoinRequest> {
    const [revisada] = await tx
      .update(solicitacoesEntrada)
      .set({ status, respondidoEm: agora, respondidoPor: adminId })
      .where(eq(solicitacoesEntrada.id, id))
      .returning({
        id: solicitacoesEntrada.id,
        familiaId: solicitacoesEntrada.familiaId,
        usuarioId: solicitacoesEntrada.usuarioId,
        solicitadoEm: solicitacoesEntrada.solicitadoEm,
      });
    if (!revisada) {
      throw new Error(`Solicitação ${id} não retornou linha após a revisão: esperado 1`);
    }
    return { ...revisada, status, respondidoEm: agora, respondidoPor: adminId };
  }

  private async vincularMembro(
    tx: TransacaoDrizzle,
    pendente: { familiaId: string; usuarioId: string },
  ): Promise<void> {
    await tx
      .insert(usuarioFamilia)
      .values({ usuarioId: pendente.usuarioId, familiaId: pendente.familiaId, role: 'membro' })
      .onConflictDoNothing();
  }
}
