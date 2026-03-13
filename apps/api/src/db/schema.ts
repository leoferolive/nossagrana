import { pgEnum, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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
