import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Bootstrap table to enable real Drizzle migrations from now on.
export const schemaVersion = pgTable('schema_version', {
  id: uuid('id').defaultRandom().primaryKey(),
  label: text('label').notNull().default('bootstrap'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
