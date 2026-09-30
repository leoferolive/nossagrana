import { and, eq, isNull } from 'drizzle-orm';

import type { ExecutorDrizzle, TransacaoDrizzle } from '../../db/executor.types.js';
import { convites, familias } from '../../db/schema.js';
import { montarNovoConvite } from './familia-convite.js';
import type { CreatedFamiliaInvite, CreateFamiliaInviteInput } from './familia.types.js';

/**
 * Criação de convite coordenada com a exclusão da família (#66, review do PR
 * #146). O INSERT sozinho só toma lock de CHAVE na linha da família (FK), que
 * não conflita com o `UPDATE familias SET deleted_at` da exclusão — então um
 * convite inserido depois do `UPDATE convites` da exclusão escaparia da
 * invalidação e ressuscitaria numa restauração. Por isso a transação primeiro
 * trava a linha da família com `FOR SHARE` (conflita com o UPDATE da exclusão)
 * exigindo `deleted_at IS NULL`:
 *  - exclusão em curso: o `FOR SHARE` espera o commit dela, reavalia o filtro,
 *    não acha família ativa e nenhum convite é criado;
 *  - criação em curso: a exclusão espera o commit do convite e o seu
 *    `UPDATE convites` (2º statement, novo snapshot) já o enxerga e expira.
 */
export class DrizzleConviteCriador {
  constructor(private readonly executor: ExecutorDrizzle) {}

  /**
   * Ex.: `criar({ familiaId, criadoPor })` → o convite; `null` se a família não
   * existe ou está excluída (nada é gravado).
   */
  async criar(
    input: CreateFamiliaInviteInput,
    agora: Date = new Date(),
  ): Promise<CreatedFamiliaInvite | null> {
    return this.executor.transaction(async (tx) => {
      const ativa = await this.travarFamiliaAtiva(tx, input.familiaId);
      if (!ativa) return null;
      return this.inserir(tx, input, agora);
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
    input: CreateFamiliaInviteInput,
    agora: Date,
  ): Promise<CreatedFamiliaInvite> {
    const { codigo, expiraEm } = montarNovoConvite(agora);
    const [criado] = await tx
      .insert(convites)
      .values({ familiaId: input.familiaId, criadoPor: input.criadoPor, codigo, expiraEm })
      .returning({
        id: convites.id,
        familiaId: convites.familiaId,
        codigo: convites.codigo,
        expiraEm: convites.expiraEm,
        criadoPor: convites.criadoPor,
        dataCriacao: convites.dataCriacao,
      });
    if (!criado) {
      throw new Error(`Convite da família ${input.familiaId} não retornou linha: esperado 1`);
    }
    return criado;
  }
}
