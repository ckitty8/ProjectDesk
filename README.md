# ProjectDesk

**ProjectDesk** : application web multi-projets et multi-équipes (OKR, projets et roadmap, ressources,
congés et capacité, timesheet, daily, demandes entrantes), sur Neon (Postgres, Auth, Data API) et Vercel.

## Contenu

| Élément | Description |
|---------|-------------|
| [`app/`](app/) | **L'application** (HTML/CSS/JS natif, sans build). Lancement, premier administrateur, rôles : [README](app/README.md). |
| [`db/migrations/`](db/migrations/) | Scripts SQL de la base Neon, appliqués dans l'ordre (tables, droits RLS, données initiales). |
| [`docs/DAT.md`](docs/DAT.md) | Document d'Architecture Technique : architecture, menus, modèle de données, règles métier. |
| [`docs/maquettes/`](docs/maquettes/) | Maquette de référence `pilotage-projet/` (+ compléments) et captures de l'état actuel. |
| [`tests/`](tests/) | Serveur Neon simulé et parcours de test de bout en bout (Playwright). |
| [`CLAUDE.md`](CLAUDE.md) | Règles de travail permanentes du projet. |
| [`vercel.json`](vercel.json) | Déploiement Vercel (la racine du site ouvre `app/`). |
| [`scripts/verifier-docs.js`](scripts/verifier-docs.js) | Vérification de la cohérence documentation ↔ code, à lancer après chaque commit. |

## Après avoir cloné

```bash
git config core.hooksPath .githooks   # active la vérification des documents après chaque commit
node scripts/verifier-docs.js         # lancement manuel
node tests/parcours.js                # tests de bout en bout (Playwright requis)
```
