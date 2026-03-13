import { getTableColumns } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { users } from './schema.js';

describe('database schema', () => {
  it('defines users table with required columns', () => {
    const columns = getTableColumns(users);

    expect(Object.keys(columns)).toEqual([
      'id',
      'nome',
      'email',
      'senhaHash',
      'dataCriacao',
    ]);
    expect(columns.id.notNull).toBe(true);
    expect(columns.email.notNull).toBe(true);
    expect(columns.senhaHash.notNull).toBe(true);
    expect(columns.dataCriacao.notNull).toBe(true);
  });
});
