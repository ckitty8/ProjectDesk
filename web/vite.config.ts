/* ============================================================
   Configuration de la construction de la nouvelle application (migration React, docs/specifications/migration-react.md)
   - La nouvelle application est servie sur /v2/ (base) pendant la migration ; l'ancienne reste sur /app/.
   - Le résultat est écrit dans ../v2 (dossier généré, jamais versionné) : Vercel sert la racine du dépôt,
     donc /app/ (versionné) et /v2/ (construit à chaque déploiement) cohabitent.
   ============================================================ */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/v2/',
  plugins: [react()],
  build: { outDir: '../v2', emptyOutDir: true },
  test: { environment: 'node', include: ['src/**/*.test.ts'] }
});
