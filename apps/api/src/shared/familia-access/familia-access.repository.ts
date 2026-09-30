import { and, eq } from 'drizzle-orm';

import type { db } from '../../db/client.js';
import { familias, usuarioFamilia } from '../../db/schema.js';

export type AcessoFamilia = 'ativa' | 'excluida' | 'sem_acesso';

/** Consulta vínculo e exclusão lógica na mesma leitura para HTTP e WebSocket. */
export async function verificarAcessoFamilia(
  database: typeof db,
  usuarioId: string,
  familiaId: string,
): Promise<AcessoFamilia> {
  const [membership] = await database
    .select({ deletedAt: familias.deletedAt })
    .from(usuarioFamilia)
    .innerJoin(familias, eq(usuarioFamilia.familiaId, familias.id))
    .where(and(eq(usuarioFamilia.usuarioId, usuarioId), eq(usuarioFamilia.familiaId, familiaId)))
    .limit(1);

  if (!membership) return 'sem_acesso';
  return membership.deletedAt ? 'excluida' : 'ativa';
}
