import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts'],
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: process.env.CI ? 1 : undefined,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/server.ts',
        'src/**/*.test.ts',
        'src/scripts/**',
        'src/**/*.routes.ts',
        'src/**/*.types.ts',
        'src/modules/email/email.console-sender.ts',
        'src/modules/email/email.smtp-sender.ts',
      ],
      lines: 80,
      functions: 80,
      branches: 70,
      statements: 80,
    },
  },
});
