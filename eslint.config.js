import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'

export default tseslint.config(
  { ignores: ['out/**', 'dist/**', 'node_modules/**', 'release/**', 'coverage/**', 'resources/**', '.dev-data/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node }
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser }
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off'
    }
  },
  {
    // Node-run CommonJS scripts: e2e test suites (drive a real Electron
    // window over CDP — `window`/`document` inside their in-page
    // page.evaluate() callbacks are the real browser context, not a
    // reference-error) and one-off scripts/ utilities.
    files: ['tests/e2e/**/*.js', 'scripts/**/*.js', '*.config.js', '*.config.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.browser }
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-empty': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Node 19+ added a built-in global `crypto` (webcrypto); these scripts
      // predate that and intentionally shadow it with `require('crypto')`'s
      // much larger API (createHash, etc.) — not an accidental redeclare.
      'no-redeclare': 'off'
    }
  },
  {
    files: ['*.config.ts', '*.config.mjs', '*.mjs'],
    languageOptions: {
      globals: { ...globals.node }
    }
  }
)
