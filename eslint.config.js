import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'public/ort', 'ml/data', 'ml/node_modules']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // ESLint 9 does not see JSX usage like <Page />, so capitalised names
      // (components) are exempt, both as variables and as parameters.
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^[A-Z]' }],
    },
  },
  {
    // The route table is configuration, a context file exports its provider
    // together with its hook (Section 3.5), and SandboxFrame exports
    // buildDocument() beside the component (Listing 4). Fast refresh just does a
    // full reload for these files, so the export rule is off for them.
    files: ['src/app/router.jsx', 'src/context/*.jsx', 'src/features/audit/SandboxFrame.jsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    // The model's offline pipeline (ml/) and build scripts run in Node.
    files: ['ml/**/*.mjs', 'scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Build and test configuration runs in Node.
    files: ['*.config.js', 'tests/**/*.{js,jsx}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  // Last: turn off stylistic rules that Prettier owns.
  prettier,
]);
