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
    'apps/api': {},
    'apps/web': {},
    'packages/types': {},
  },
};

export default config;
