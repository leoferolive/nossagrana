import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  ignore: ['docs/wireframes/**'],
  ignoreDependencies: ['lint-staged'],
  rules: {
    duplicates: 'off',
    exports: 'warn',
    types: 'warn',
  },
  workspaces: {
    '.': {
      entry: ['scripts/*.mjs'],
    },
    'apps/api': {
      entry: [
        'src/server.ts',
        'src/db/migrate.ts',
        'src/scripts/**/*.ts',
        'src/modules/auth/revoked-token-cleanup.job.ts',
      ],
    },
    'apps/web': {},
    'packages/types': {},
    'apps/e2e': {
      entry: ['tests/**/*.spec.ts', 'fixtures/**/*.ts', 'helpers/**/*.ts'],
    },
  },
};

export default config;
