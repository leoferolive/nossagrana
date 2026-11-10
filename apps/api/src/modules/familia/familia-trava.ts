import { and, eq, isNull } from 'drizzle-orm';

import type { TransacaoDrizzle } from '../../db/executor.types.js';
import { familias } from '../../db/schema.js';

/**
 * Trava a linha da família ATIVA com `FOR SHARE`, serializando a transação com
 * a exclusão (`UPDATE familias SET deleted_at`): o INSERT filho só toma lock de
 * CHAVE (FK), que não conflita com esse UPDATE (#147, #149).
 *
 * Ex.: `if (!(await travarFamiliaAtiva(tx, familiaId))) return null;`
 * Retorna `false` se a família não existe ou está excluída (nada deve ser gravado).
 */
export async function travarFamiliaAtiva(
  tx: TransacaoDrizzle,
  familiaId: string,
): Promise<boolean> {
  const linhas = await tx
    .select({ id: familias.id })
    .from(familias)
    .where(and(eq(familias.id, familiaId), isNull(familias.deletedAt)))
    .for('share');
  return linhas.length > 0;
}
