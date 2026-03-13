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
