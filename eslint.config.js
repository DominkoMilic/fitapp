// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettier,
  {
    ignores: [
      'dist/*',
      'node_modules/*',
      'supabase/functions/*',
      'docs/*',
      'coverage/*',
      '.expo/*',
      '.e2e/**',
    ],
  },
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Node scripts (E2E runners): Node globals and console output are expected.
    files: ['tests/e2e/**/*.js', 'scripts/**/*.js', 'scripts/**/*.mjs'],
    languageOptions: {
      globals: { Buffer: 'readonly', process: 'readonly', require: 'readonly', __dirname: 'readonly' },
    },
    rules: { 'no-console': 'off' },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // Screens can be opened without history (links, notifications, reloads): use goBack().
      'no-restricted-properties': [
        'error',
        { object: 'router', property: 'back', message: "Use goBack(fallback) from '@/navigation/back'." },
      ],
    },
  },
  {
    files: ['src/navigation/back.ts'],
    rules: { 'no-restricted-properties': 'off' },
  },
]);
