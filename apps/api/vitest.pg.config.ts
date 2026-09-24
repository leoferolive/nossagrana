import { defineConfig } from 'vitest/config';

/**
 * Testes contra PostgreSQL real (issue #58): exigem `PG_TEST_ADMIN_URL` de um
 * banco descartável. Rodar via `bash scripts/test-pg.sh` (sobe postgres:17-alpine).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.pg.test.ts'],
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
