/**
 * Database fixture placeholder.
 *
 * Direct database access from E2E tests is not implemented yet. If direct DB
 * manipulation becomes necessary (e.g. to seed large datasets or verify
 * persisted state without going through the API), this file should export
 * Playwright fixtures that connect to PostgreSQL via `pg` or `postgres.js`.
 *
 * Example of what could be added here:
 *
 *   import { test as base } from '@playwright/test';
 *   import postgres from 'postgres';
 *
 *   const DB_URL = process.env.DATABASE_URL ?? 'postgresql://...';
 *
 *   type DbFixtures = { db: postgres.Sql };
 *
 *   export const test = base.extend<DbFixtures>({
 *     db: async ({}, use) => {
 *       const sql = postgres(DB_URL);
 *       await use(sql);
 *       await sql.end();
 *     },
 *   });
 */
