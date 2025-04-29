import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import globals from 'globals';

export default defineConfig([
  {
    files: [
      '*.js',
      'src/**/*.js',
      'examples/**/*.js'
    ],
    plugins: {
      js
    },
    extends: ['js/recommended'],
    ignores: [
      'examples/browser/**/*'
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      'no-trailing-spaces': 'warn',
      'no-unused-vars': [
        'warn',
        {
          'args': 'all',
          'vars': 'all',
          'caughtErrors': 'all',
          'argsIgnorePattern': '^_',
          'varsIgnorePattern': '^_',
          'caughtErrorsIgnorePattern': '^_'
        }
      ],
      'indent': [
        'warn',
        2,
        {
          'SwitchCase': 1
        }
      ],
      'quotes': [
        'warn',
        'single'
      ],
      'semi': [
        'warn',
        'always'
      ],
      'no-empty': 'off',
      'multiline-comment-style': 1
    }
  }
]);