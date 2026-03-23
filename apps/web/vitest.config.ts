import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'virtual:pwa-register': path.resolve(__dirname, './src/test/mocks/pwa-register.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    pool: process.env.CI ? 'threads' : 'forks',
    poolOptions: {
      threads: {
        maxThreads: process.env.CI ? 1 : undefined,
      },
      forks: {
        maxForks: undefined,
      },
    },
    fileParallelism: !process.env.CI,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/test/**', 'src/main.tsx'],
      lines: 80,
      functions: 80,
      branches: 70,
      statements: 80,
    },
  },
});
