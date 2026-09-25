# ProjectDesk

Outils de pilotage de projet pour chef de projet, pensés pour le poste de travail (PC-first).

## Contenu

| Élément | Description |
|---------|-------------|
| [`roadmap-app/`](roadmap-app/) | **Roadmap PM** : backlog, Kanban, roadmap trimestrielle, dashboard, simulateur de capacité. Application statique : ouvrir `roadmap-app/index.html`. Voir son [README](roadmap-app/README.md). |
| [`db/migrations/`](db/migrations/) | Scripts SQL de la base Neon (tables, sécurité par organisation). |
| [`docs/DAT.md`](docs/DAT.md) | Document d'Architecture Technique : architecture, menus, modèle de données, règles métier. |
| [`docs/maquettes/`](docs/maquettes/) | Maquettes PNG (faites avant tout développement front) et captures de l'état actuel. |
| [`CLAUDE.md`](CLAUDE.md) | Règles de travail permanentes du projet. |
| [`scripts/verifier-docs.js`](scripts/verifier-docs.js) | Vérification de la cohérence documentation ↔ code, à lancer après chaque commit. |

## Après avoir cloné

```bash
git config core.hooksPath .githooks   # active la vérification des documents après chaque commit
node scripts/verifier-docs.js         # lancement manuel
```
