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
La logique métier (`domaine/`), les données (`donnees/`) et les écrans (`ecrans/`) arrivent aux phases 2 à 5.
