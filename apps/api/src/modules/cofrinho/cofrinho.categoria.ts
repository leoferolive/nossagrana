import { and, eq } from 'drizzle-orm';

import type { ExecutorDrizzle } from '../../db/executor.types.js';
import { categorias } from '../../db/schema.js';
import type { BuscarCategoriaCofrinho } from './cofrinho.types.js';

/**
 * Categoria de sistema "Cofrinho" da família, lida ANTES de abrir a Unit of
 * Work (leitura pura; a FK composta garante que a transação gravada aponta
 * para uma categoria da mesma família). Compartilhada por cofrinho e templates.
 */
export function criarBuscaCategoriaCofrinho(executor: ExecutorDrizzle): BuscarCategoriaCofrinho {
  return async (familiaId) => {
    const [categoria] = await executor
      .select({ id: categorias.id })
      .from(categorias)
      .where(
        and(
          eq(categorias.familiaId, familiaId),
          eq(categorias.nome, 'Cofrinho'),
          eq(categorias.sistema, true),
        ),
      );
    if (!categoria) {
      throw new Error(
        `Categoria Cofrinho não encontrada na família ${familiaId}: esperado categoria de sistema "Cofrinho"`,
      );
    }
    return categoria;
  };
}
