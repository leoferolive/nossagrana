import { and, eq, gt, isNull } from 'drizzle-orm';

import type { ExecutorDrizzle, TransacaoDrizzle } from '../../db/executor.types.js';
import { convites, familias } from '../../db/schema.js';

/**
 * Exclusão lógica de família como operação de ciclo de vida (#66): marca
 * `deleted_at` e invalida os convites pendentes na MESMA transação — ou as
 * duas coisas acontecem, ou nenhuma. Extraído de `familia.repository.ts`
 * (débito de tamanho) para não crescê-lo.
 *
 * Invalidar = `expira_em` passa a ser o instante da exclusão: o convite fica
 * inutilizável sem coluna nova, preserva quem já o usou (`usado_por`) e não
 * "ressuscita" se a família for restaurada depois (novos convites são gerados).
 */
export class DrizzleFamiliaExclusao {
  constructor(private readonly executor: ExecutorDrizzle) {}

  /**
   * Ex.: `excluir({ familiaId })` → `true` na 1ª chamada; `false` se a família
   * não existe ou já estava excluída (nada é alterado).
   */
  async excluir(input: { familiaId: string }, agora: Date = new Date()): Promise<boolean> {
    return this.executor.transaction(async (tx) => {
      const excluida = await this.marcarComoExcluida(tx, input.familiaId, agora);
      if (!excluida) return false;
      await this.invalidarConvitesPendentes(tx, input.familiaId, agora);
      return true;
    });
  }

  private async marcarComoExcluida(tx: TransacaoDrizzle, familiaId: string, agora: Date) {
    const linhas = await tx
      .update(familias)
      .set({ deletedAt: agora })
      .where(and(eq(familias.id, familiaId), isNull(familias.deletedAt)))
      .returning({ id: familias.id });
    return linhas.length > 0;
  }

  private async invalidarConvitesPendentes(tx: TransacaoDrizzle, familiaId: string, agora: Date) {
    await tx
      .update(convites)
      .set({ expiraEm: agora })
      .where(
        and(
          eq(convites.familiaId, familiaId),
          isNull(convites.usadoPor),
          gt(convites.expiraEm, agora),
        ),
      );
  }
}
