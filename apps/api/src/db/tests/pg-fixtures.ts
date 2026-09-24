import type postgres from 'postgres';

/** IDs de uma família semeada com um registro de cada tabela referenciada. */
export interface FamiliaSemeada {
  familiaId: string;
  usuarioId: string;
  categoriaId: string;
  metodoPagamentoId: string;
  cofrinhoId: string;
  transacaoId: string;
}

async function inserirId(query: Promise<postgres.Row[]>): Promise<string> {
  const [row] = await query;
  if (!row) throw new Error('Insert do seed não retornou linha: esperado RETURNING id');
  return row.id as string;
}

async function semearCadastros(sql: postgres.Sql, familiaId: string, usuarioId: string) {
  const categoriaId = await inserirId(
    sql`INSERT INTO categorias (familia_id, nome, tipo, criado_por)
        VALUES (${familiaId}, 'Mercado', 'despesa', ${usuarioId}) RETURNING id`,
  );
  const metodoPagamentoId = await inserirId(
    sql`INSERT INTO metodos_pagamento (familia_id, nome, tipo, usuario_dono_id)
        VALUES (${familiaId}, 'Pix', 'pix', ${usuarioId}) RETURNING id`,
  );
  const cofrinhoId = await inserirId(
    sql`INSERT INTO cofrinhos (familia_id, nome, criado_por)
        VALUES (${familiaId}, 'Viagem', ${usuarioId}) RETURNING id`,
  );
  return { categoriaId, metodoPagamentoId, cofrinhoId };
}

/**
 * Semeia uma família com categoria, método, cofrinho e uma transação que usa
 * todos eles — o próprio seed já é o caso "mesma família passa".
 */
export async function semearFamilia(sql: postgres.Sql, nome: string): Promise<FamiliaSemeada> {
  const usuarioId = await inserirId(
    sql`INSERT INTO users (nome, email, senha_hash)
        VALUES (${nome}, ${`${nome.toLowerCase()}@example.com`}, 'hash') RETURNING id`,
  );
  const familiaId = await inserirId(sql`INSERT INTO familias (nome) VALUES (${nome}) RETURNING id`);
  const cadastros = await semearCadastros(sql, familiaId, usuarioId);
  const transacaoId = await inserirId(
    sql`INSERT INTO transacoes (familia_id, tipo, valor, categoria_id, data, mes_referencia,
          metodo_pagamento_id, usuario_registrou_id, cofrinho_id)
        VALUES (${familiaId}, 'despesa', '10.00', ${cadastros.categoriaId}, '2026-09-01', '2026-09',
          ${cadastros.metodoPagamentoId}, ${usuarioId}, ${cadastros.cofrinhoId}) RETURNING id`,
  );
  return { familiaId, usuarioId, transacaoId, ...cadastros };
}

/** Transação da família `f` apontando para `pai` (parcela/recorrência). */
export function inserirTransacaoFilha(
  sql: postgres.Sql,
  f: FamiliaSemeada,
  paiId: string | null,
): Promise<postgres.Row[]> {
  return sql`INSERT INTO transacoes (familia_id, tipo, valor, categoria_id, data, mes_referencia,
      usuario_registrou_id, transacao_pai_id)
    VALUES (${f.familiaId}, 'despesa', '5.00', ${f.categoriaId}, '2026-10-01', '2026-10',
      ${f.usuarioId}, ${paiId}) RETURNING id`;
}
