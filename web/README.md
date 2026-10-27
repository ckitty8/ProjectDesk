# ProjectDesk — nouvelle application (React + TypeScript)

Migration en cours : voir [`docs/specifications/migration-react.md`](../docs/specifications/migration-react.md).
L'application actuelle (`app/`, servie sur `/app/`) reste inchangée jusqu'à la bascule ; celle-ci est servie sur `/v2/`.

| Commande (depuis `web/`) | Rôle |
|---|---|
| `npm ci` | Installe les dépendances (versions figées par `package-lock.json`) |
| `npm run dev` | Serveur de développement (http://localhost:5173/v2/) |
| `npm run verifier` | Types (`tsc`), qualité (`eslint`), tests unitaires (`vitest`), puis construction |
| `npm run build` | Construit l'application dans `../v2` (dossier généré, non versionné) |

Déploiement : `vercel.json` à la racine lance `npm --prefix web ci && npm --prefix web run build`, puis sert
la racine du dépôt (`/app/` versionné, `/v2/` construit).

Organisation du code : `src/main.tsx` (point d'entrée), `src/App.tsx` (routes), `src/routes.ts` (table des écrans).
`src/domaine/` : logique métier pure en TypeScript (phase 2) — `config`, `types`, `dates`, `calculs`, `daily`, `droits`, `perimetre`, `menus`,
chacun avec ses tests (`*.test.ts`) ; `parite.test.ts` compare le portage à l'ancien `app/js/calculs.js` (temporaire).
`src/donnees/` (phase 3) : `api` (client Neon Auth + Data API), `tables` (23 tables, tris, filtres), `chargement` (lecture tolérante),
`compte` (session, équipes, rôles), `contexte` + `simulation` (droits et simulation de rôle), `SessionProvider` (TanStack Query).
`src/ecrans/` : connexion et diagnostic provisoires. `src/composants/` (phase 4) : boutons, badges, cartes, onglets, tableau, panneau, modale, bandeau de simulation, calendrier ; catalogue visible sur `/v2/composants`.
Les vrais écrans arrivent en phase 5.

Contrôle de bout en bout : `npm run build` puis, depuis la racine du dépôt, `node tests/v2.js` (serveur Neon simulé + Playwright).
