/* ============================================================
   Configuration de la construction de la nouvelle application (migration React, docs/specifications/migration-react.md)
   - L'application est servie sur /app/ (base).
   - Le résultat est écrit dans ../app (dossier généré, jamais versionné) : Vercel sert la racine du dépôt après
     avoir lancé le build (vercel.json) .
   ============================================================ */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/app/',
  plugins: [react()],
  build: { outDir: '../app', emptyOutDir: true },
  test: { environment: 'node', include: ['src/**/*.test.{ts,tsx}'] }
});
