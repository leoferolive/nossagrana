import path from 'node:path';

import { defineConfig } from 'vitest/config';

// Testes de data precisam dar o mesmo resultado em qualquer máquina. Com o fuso
// em UTC (caso do CI) os bugs de "dia seguinte depois das 21h" não aparecem,
// então o fuso fica fixo no da família. O pool é `forks`: os processos filhos
// herdam a variável.
process.env.TZ = 'America/Sao_Paulo';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'virtual:pwa-register': path.resolve(__dirname, './src/test/mocks/pwa-register.ts'),
    },
  },
  test: {
    // Por padrão o Vitest zera todo CSS, inclusive `?raw`; o teste de tokens precisa ler o texto de index.css.
    css: { include: [/index\.css/] },
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: process.env.CI ? 1 : 4,
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
