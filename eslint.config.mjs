import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import sonarjs from 'eslint-plugin-sonarjs';
import eslintConfigPrettier from 'eslint-config-prettier';

// Emoji e símbolos de texto (✕ ✓ ◀ ▶ ← → ↑ ↓ ⚠) não renderizam igual em todo aparelho e não têm nome
// acessível; a interface usa só ícones de lucide-react (decisão 11 da nova UI). Os pares
// \uD83C-\uD83E cobrem os emojis acima do plano básico sem depender da flag `u`.
const SIMBOLO_DE_TEXTO =
  '[\\u00D7\\u2190-\\u21FF\\u25A0-\\u25FF\\u2600-\\u27BF\\u2B00-\\u2BFF\\uFE0F]|[\\uD83C-\\uD83E][\\uDC00-\\uDFFF]';
// "+ Nova Categoria": o "+" no começo do texto de um botão também faz papel de ícone (Plus).
const MAIS_COMO_ICONE = '^\\s*\\+ [A-Za-z\\u00C0-\\u00FF]';
const MENSAGEM_SEM_EMOJI =
  'Use um ícone de lucide-react; a interface não usa emoji nem símbolo de texto como ícone';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/.turbo/**',
      '**/vite.config.ts.timestamp-*',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { sonarjs },
    rules: {
      complexity: ['warn', 10],
      'max-depth': ['warn', 4],
      'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['warn', { max: 50, skipBlankLines: true, skipComments: true }],
      'max-params': ['warn', 5],
      'sonarjs/cognitive-complexity': ['warn', 15],
      'sonarjs/no-duplicate-string': ['warn', { threshold: 5 }],
      'sonarjs/no-identical-functions': 'warn',
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: `JSXText[value=/${SIMBOLO_DE_TEXTO}/]`,
          message: MENSAGEM_SEM_EMOJI,
        },
        {
          selector: `JSXText[value=/${MAIS_COMO_ICONE}/]`,
          message: MENSAGEM_SEM_EMOJI,
        },
        {
          selector: `Literal[value=/${SIMBOLO_DE_TEXTO}/]`,
          message: MENSAGEM_SEM_EMOJI,
        },
        {
          selector: `TemplateElement[value.raw=/${SIMBOLO_DE_TEXTO}/]`,
          message: MENSAGEM_SEM_EMOJI,
        },
      ],
    },
  },
  {
    // Fixture do Playwright sem dependência exige o `{}` como primeiro argumento: é como o
    // Playwright descobre de quais fixtures a função precisa (ver a documentação de fixtures).
    files: ['apps/e2e/fixtures/**'],
    rules: { 'no-empty-pattern': ['error', { allowObjectPatternsAsParameters: true }] },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'apps/e2e/**'],
    rules: {
      'max-lines-per-function': 'off',
      'max-lines': 'off',
      'sonarjs/no-duplicate-string': 'off',
    },
  },
  eslintConfigPrettier,
);
