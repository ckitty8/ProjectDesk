// Règles de qualité du code TypeScript / React (remplace scripts/audit-code.js à la bascule)
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['dist', '../v2'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Lisibilité (règle n°1 de CLAUDE.md) : pas de ligne démesurée
      'max-len': ['error', { code: 160, ignoreUrls: true, ignoreStrings: true, ignoreTemplateLiterals: true, ignoreComments: false }]
    }
  }
);
