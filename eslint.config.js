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
    ignores: [
      'examples/browser/**/*'
    ],
    plugins: {
      js
    },
    extends: ['js/recommended'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
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
      'no-empty': 'off',
      // deprecated rules
      'no-trailing-spaces': 'warn',
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
      'multiline-comment-style': 1
    }
  }
]);