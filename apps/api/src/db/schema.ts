import { eq } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// Bootstrap table to enable real Drizzle migrations from now on.
export const schemaVersion = pgTable('schema_version', {
  id: uuid('id').defaultRandom().primaryKey(),
  label: text('label').notNull().default('bootstrap'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  nome: text('nome').notNull(),
  email: text('email').notNull().unique(),
  senhaHash: text('senha_hash').notNull(),
  dataCriacao: timestamp('data_criacao', { withTimezone: true }).defaultNow().notNull(),
});

export const familias = pgTable('familias', {
  id: uuid('id').defaultRandom().primaryKey(),
  nome: text('nome').notNull(),
  dataCriacao: timestamp('data_criacao', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const usuarioFamiliaRole = pgEnum('usuario_familia_role', ['admin', 'membro']);

export const usuarioFamilia = pgTable(
  'usuario_familia',
  {
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => users.id),
    familiaId: uuid('familia_id')
      .notNull()
      .references(() => familias.id),
    role: usuarioFamiliaRole('role').notNull().default('membro'),
    dataEntrada: timestamp('data_entrada', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.usuarioId, table.familiaId],
    }),
  ],
);

export const convites = pgTable('convites', {
  id: uuid('id').defaultRandom().primaryKey(),
  familiaId: uuid('familia_id')
    .notNull()
    .references(() => familias.id),
  codigo: text('codigo').notNull().unique(),
  criadoPor: uuid('criado_por')
    .notNull()
    .references(() => users.id),
  expiraEm: timestamp('expira_em', { withTimezone: true }).notNull(),
  usadoPor: uuid('usado_por').references(() => users.id),
  usadoEm: timestamp('usado_em', { withTimezone: true }),
  dataCriacao: timestamp('data_criacao', { withTimezone: true }).defaultNow().notNull(),
});

export const solicitacaoEntradaStatus = pgEnum('solicitacao_entrada_status', [
  'pendente',
  'aprovada',
  'rejeitada',
]);

export const solicitacoesEntrada = pgTable('solicitacoes_entrada', {
  id: uuid('id').defaultRandom().primaryKey(),
  familiaId: uuid('familia_id')
    .notNull()
    .references(() => familias.id),
  usuarioId: uuid('usuario_id')
    .notNull()
    .references(() => users.id),
  status: solicitacaoEntradaStatus('status').notNull().default('pendente'),
  solicitadoEm: timestamp('solicitado_em', { withTimezone: true }).defaultNow().notNull(),
  respondidoEm: timestamp('respondido_em', { withTimezone: true }),
  respondidoPor: uuid('respondido_por').references(() => users.id),
});

export const categoriaTipo = pgEnum('categoria_tipo', ['receita', 'despesa']);

export const categorias = pgTable('categorias', {
  id: uuid('id').defaultRandom().primaryKey(),
  familiaId: uuid('familia_id')
    .notNull()
    .references(() => familias.id),
  nome: text('nome').notNull(),
  tipo: categoriaTipo('tipo').notNull(),
  ativo: boolean('ativo').notNull().default(true),
  sistema: boolean('sistema').notNull().default(false),
  criadoPor: uuid('criado_por')
    .notNull()
    .references(() => users.id),
  criadoEm: timestamp('criado_em', { withTimezone: true }).defaultNow().notNull(),
});

export const metodoPagamentoTipo = pgEnum('metodo_pagamento_tipo', [
  'credito',
  'debito',
  'pix',
  'dinheiro',
]);

export const metodosPagamento = pgTable('metodos_pagamento', {
  id: uuid('id').defaultRandom().primaryKey(),
  familiaId: uuid('familia_id')
    .notNull()
    .references(() => familias.id),
  nome: text('nome').notNull(),
  tipo: metodoPagamentoTipo('tipo').notNull(),
  dataFechamento: integer('data_fechamento'),
  dataVencimento: integer('data_vencimento'),
  usuarioDonoId: uuid('usuario_dono_id')
    .notNull()
    .references(() => users.id),
  ativo: boolean('ativo').notNull().default(true),
  criadoEm: timestamp('criado_em', { withTimezone: true }).defaultNow().notNull(),
});

export const transacaoTipo = pgEnum('transacao_tipo', ['receita', 'despesa']);
export const transacaoFrequencia = pgEnum('transacao_frequencia', [
  'mensal',
  'semanal',
  'quinzenal',
]);

export const transacoes = pgTable(
  'transacoes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    familiaId: uuid('familia_id')
      .notNull()
      .references(() => familias.id),
    tipo: transacaoTipo('tipo').notNull(),
    valor: numeric('valor', { precision: 14, scale: 2 }).notNull(),
    categoriaId: uuid('categoria_id')
      .notNull()
      .references(() => categorias.id),
    descricao: text('descricao'),
    data: date('data').notNull(),
    mesReferencia: text('mes_referencia').notNull(),
    metodoPagamentoId: uuid('metodo_pagamento_id').references(() => metodosPagamento.id),
    usuarioRegistrouId: uuid('usuario_registrou_id')
      .notNull()
      .references(() => users.id),
    recorrente: boolean('recorrente').notNull().default(false),
    frequencia: transacaoFrequencia('frequencia'),
    dataFimRecorrencia: date('data_fim_recorrencia'),
    parcelado: boolean('parcelado').notNull().default(false),
    numeroParcelas: integer('numero_parcelas'),
    parcelaAtual: integer('parcela_atual'),
    valorTotal: numeric('valor_total', { precision: 14, scale: 2 }),
    valorParcela: numeric('valor_parcela', { precision: 14, scale: 2 }),
    transacaoPaiId: uuid('transacao_pai_id'),
    cofrinhoId: uuid('cofrinho_id'),
    criadoEm: timestamp('criado_em', { withTimezone: true }).defaultNow().notNull(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('transacoes_familia_id_idx').on(table.familiaId),
    index('transacoes_mes_referencia_idx').on(table.mesReferencia),
    index('transacoes_usuario_registrou_id_idx').on(table.usuarioRegistrouId),
    index('transacoes_categoria_id_idx').on(table.categoriaId),
    index('transacoes_metodo_pagamento_id_idx').on(table.metodoPagamentoId),
    index('transacoes_transacao_pai_id_idx').on(table.transacaoPaiId),
  ],
);

export const orcamentoCategoria = pgTable(
  'orcamento_categoria',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    familiaId: uuid('familia_id')
      .notNull()
      .references(() => familias.id),
    categoriaId: uuid('categoria_id')
      .notNull()
      .references(() => categorias.id),
    valorLimite: numeric('valor_limite', { precision: 14, scale: 2 }).notNull(),
    vigenciaInicio: text('vigencia_inicio').notNull(),
    vigenciaFim: text('vigencia_fim'),
    criadoPor: uuid('criado_por')
      .notNull()
      .references(() => users.id),
    criadoEm: timestamp('criado_em', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('orcamento_categoria_familia_categoria_idx').on(table.familiaId, table.categoriaId),
  ],
);

export const snapshotsMensais = pgTable(
  'snapshots_mensais',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    familiaId: uuid('familia_id')
      .notNull()
      .references(() => familias.id),
    mesReferencia: text('mes_referencia').notNull(),
    totalReceitas: numeric('total_receitas', { precision: 14, scale: 2 }).notNull(),
    totalDespesas: numeric('total_despesas', { precision: 14, scale: 2 }).notNull(),
    saldo: numeric('saldo', { precision: 14, scale: 2 }).notNull(),
    dadosCategorias: jsonb('dados_categorias').notNull(),
    dadosUsuarios: jsonb('dados_usuarios').notNull(),
    divergente: boolean('divergente').notNull().default(false),
    geradoEm: timestamp('gerado_em', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('snapshots_mensais_familia_id_idx').on(table.familiaId),
    index('snapshots_mensais_mes_referencia_idx').on(table.mesReferencia),
    index('snapshots_mensais_familia_mes_idx').on(table.familiaId, table.mesReferencia),
  ],
);

export const cofrinhoStatus = pgEnum('cofrinho_status', ['ativo', 'encerrado']);
export const movimentacaoCofrinhoTipo = pgEnum('movimentacao_cofrinho_tipo', [
  'aporte',
  'retirada',
]);

export const cofrinhos = pgTable(
  'cofrinhos',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    familiaId: uuid('familia_id')
      .notNull()
      .references(() => familias.id),
    nome: text('nome').notNull(),
    emoji: text('emoji'),
    descricao: text('descricao'),
    metaValor: numeric('meta_valor', { precision: 12, scale: 2 }),
    saldoAtual: numeric('saldo_atual', { precision: 12, scale: 2 }).notNull().default('0'),
    status: cofrinhoStatus('status').notNull().default('ativo'),
    criadoPor: uuid('criado_por')
      .notNull()
      .references(() => users.id),
    criadoEm: timestamp('criado_em', { withTimezone: true }).defaultNow().notNull(),
    encerradoEm: timestamp('encerrado_em', { withTimezone: true }),
  },
  (table) => [index('cofrinhos_familia_id_idx').on(table.familiaId)],
);

export const movimentacoesCofrinhos = pgTable(
  'movimentacoes_cofrinho',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    cofrinhoId: uuid('cofrinho_id')
      .notNull()
      .references(() => cofrinhos.id),
    familiaId: uuid('familia_id')
      .notNull()
      .references(() => familias.id),
    tipo: movimentacaoCofrinhoTipo('tipo').notNull(),
    valor: numeric('valor', { precision: 12, scale: 2 }).notNull(),
    descricao: text('descricao'),
    transacaoId: uuid('transacao_id').references(() => transacoes.id),
    registradoPor: uuid('registrado_por')
      .notNull()
      .references(() => users.id),
    registradoEm: timestamp('registrado_em', { withTimezone: true }).defaultNow().notNull(),
    mesReferencia: text('mes_referencia').notNull(),
  },
  (table) => [
    index('movimentacoes_cofrinho_cofrinho_id_idx').on(table.cofrinhoId),
    index('movimentacoes_cofrinho_familia_id_idx').on(table.familiaId),
  ],
);

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    used: boolean('used').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('password_reset_tokens_token_hash_idx').on(table.tokenHash),
    index('password_reset_tokens_user_id_idx').on(table.userId),
  ],
);

export const revokedRefreshTokens = pgTable(
  'revoked_refresh_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tokenHash: text('token_hash').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('revoked_refresh_tokens_token_hash_idx').on(table.tokenHash),
    index('revoked_refresh_tokens_user_id_idx').on(table.userId),
  ],
);

export const templatesTransacao = pgTable(
  'templates_transacao',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    familiaId: uuid('familia_id')
      .notNull()
      .references(() => familias.id),
    nome: text('nome').notNull(),
    tipo: transacaoTipo('tipo').notNull(),
    categoriaId: uuid('categoria_id').references(() => categorias.id),
    metodoPagamentoId: uuid('metodo_pagamento_id').references(() => metodosPagamento.id),
    cofrinhoId: uuid('cofrinho_id').references(() => cofrinhos.id),
    ordem: integer('ordem').notNull().default(0),
    valorPadrao: numeric('valor_padrao', { precision: 14, scale: 2 }),
    ativo: boolean('ativo').notNull().default(true),
    criadoPor: uuid('criado_por')
      .notNull()
      .references(() => users.id),
    criadoEm: timestamp('criado_em', { withTimezone: true }).defaultNow().notNull(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_templates_transacao_familia_id').on(table.familiaId),
    uniqueIndex('uq_templates_transacao_familia_nome_tipo')
      .on(table.familiaId, table.nome, table.tipo)
      .where(eq(table.ativo, true)),
  ],
);
