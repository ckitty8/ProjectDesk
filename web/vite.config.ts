/* ============================================================
   Configuration de la construction de la nouvelle application (migration React, docs/specifications/migration-react.md)
   - L'application est servie sur /app/ (base).
   - Le résultat est écrit dans ../app (dossier généré, jamais versionné) : Vercel sert la racine du dépôt après
     avoir lancé le build (vercel.json) .
   ============================================================ */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

/* Version affichée sous le menu : celle de package.json, alignée sur la dernière ligne d'historique du DAT */
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  base: '/app/',
  define: { __VERSION_APPLICATION__: JSON.stringify(version) },
  plugins: [react()],
  build: { outDir: '../app', emptyOutDir: true },
  test: { environment: 'node', include: ['src/**/*.test.{ts,tsx}'] }
});
