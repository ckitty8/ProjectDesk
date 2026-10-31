# Migration vers React et TypeScript

Décision du porteur du projet : **2026-10-27**. Travail direct sur `main`.
Ce document est la référence de la migration ; chaque phase terminée y est cochée et ajoute une ligne à l'historique du DAT.

## Décisions validées

| Sujet | Décision |
|---|---|
| Pile | Vite, React, TypeScript en mode strict |
| Adresse provisoire | La nouvelle application est servie sur `/v2/` ; l'ancienne reste sur `/app/` jusqu'à une **bascule unique** à la fin |
| Navigation | React Router (une adresse par écran) |
| Données | TanStack Query (remplace `chargerDonnees` et `recharger`) |
| Style | `app/css/theme.css` conservé tel quel (copié dans `web/`) pour éviter tout écart visuel |
| Client base / authentification | `api.js` porté en TypeScript, sans bibliothèque supplémentaire |
| Tests | Vitest pour la logique (calculs, droits, périmètre) ; Playwright pour les écrans |
| Qualité du code | ESLint + `tsc` + détection du code mort, en remplacement de `scripts/audit-code.js` à la bascule |
| Gel | Pas d'évolution sur l'ancienne application, sauf correctifs ; une nouveauté demandée en cours de route est faite en React si son écran est déjà migré |
| Gantt et roadmap interactifs | **Hors périmètre** : fonctionnalité à développer plus tard, après la migration |
| Base de données | Inchangée (droits, données, migrations) — règle n°8 |

## Principe : la production reste fonctionnelle à chaque commit

- Le nouveau code vit dans `web/`. L'ancienne application (`app/`) n'est pas modifiée par la migration.
- Un build qui échoue sur Vercel ne remplace pas le dernier déploiement réussi : `/app/` reste en ligne.
- La nouvelle application est construite dans `v2/` à la racine (dossier généré, jamais versionné) et servie sur `/v2/`.
- Les contrôles actuels (`tests/parcours.js`, `scripts/audit-code.js`) continuent de protéger l'ancienne application jusqu'à la bascule.

## Phases

| # | Phase | Contenu | Sortie attendue | Sessions |
|---|---|---|---|---|
| 0 | Cadrage | Plan, règles de `CLAUDE.md`, ligne d'historique du DAT | Règles à jour | 1 |
| 1 | Socle | `web/` (Vite, React, TypeScript, ESLint, Vitest), build Vercel, page vide sur `/v2/`, scripts de contrôle | `/v2/` en ligne, `/app/` intact | 2 |
| 2 | Logique métier typée | `config`, `calculs`, droits, périmètre, matrice en TypeScript pur, avec tests Vitest | Logique testée sans écran | 3 |
| 3 | Données et session | Connexion, jeton, chargement des tables, simulation de rôle | Connexion et chargement sur `/v2/` | 3 |
| 4 | Composants de base | Boutons, tableaux, onglets, panneau, fenêtre, calendrier, bandeau | Catalogue de composants | 3 |
| 5 | Écrans | Quatre vagues (ci-dessous) | Chaque vague testée avant la suivante | 10 à 12 |
| 6 | Bascule et nettoyage | `/app/` pointe vers la nouvelle application, suppression de l'ancien code, DAT et README | Une seule application | 2 |

Total estimé : 24 à 26 sessions (à réviser après la phase 1).

### Vagues de la phase 5

- **A** : Connexion, Choix d'équipe, Dashboard général, Trucs et astuces.
- **B** : Projets et Planning projet, Timesheet, Daily des équipes, Gestion des ressources (calendrier).
- **C** : Daily, Saisir mes heures, Congés, Sprints, Mises en production.
- **D** : Liste des ressources, Administration, Rôles, Simulation, Matrice des droits, toutes les fenêtres.

## Règles de conduite

1. Chaque commit sur `main` laisse `/app/` intact et fonctionnel.
2. Chaque vague d'écrans a ses contrôles Playwright écrits en même temps, et une comparaison des captures avec `docs/maquettes/etat-actuel/`.
3. Les contrôles de logique deviennent des tests unitaires ; les contrôles d'écran sont réécrits par rôle et par texte visible (plus de dépendance aux variables globales).
4. Migration à l'identique : les captures actuelles tiennent lieu de maquette. Tout écran **nouveau ou modifié** reste soumis à la règle n°3 (maquette PNG validée avant le code).
5. Le DAT est mis à jour à chaque phase (une ligne d'historique) ; le README à la bascule.
6. Aucune donnée touchée (règle n°8) ; aucune migration SQL n'est nécessaire.

## Risques et parades

- **Tests couplés à l'état global** (135 `page.evaluate`) : réécriture progressive, la logique d'abord en tests unitaires.
- **Droits et périmètre (migration 042)** : couverts par des tests dédiés en phase 2, avant tout écran.
- **Double maintenance** : limitée par le gel.
- **Réglages Vercel** (dossier racine, commande de build) : à confirmer dans la console Vercel du projet ; le build est déclaré dans `vercel.json`.

## Notes de la phase 5

- Vague A livrée : Connexion, Choix d'équipe, Dashboard général, Trucs et astuces, avec la coquille (barre latérale, en-tête, Aide).
  Les adresses sont dans `web/src/routes.ts` ; un écran non migré affiche « pas encore migré » (`migre: false`).
- Vague B livrée : Projets et Planning projet, Timesheet (validation), Daily des équipes (export Excel), Gestion des ressources (calendrier). Le panneau Projet est en lecture seule ; sa modification arrive avec la vague C (Mon dashboard › Projets et Roadmap).
- Vague C livrée : Daily, Saisir mes heures, Congés (grille et récap), Sprints, Mises en production, création de projet et panneau Projet modifiable. Reste pour la vague D : « + Membre » du panneau Projet (fenêtre d'affectation).
- Pour migrer un écran : composant dans `web/src/ecrans/`, entrée dans `web/src/ecrans/index.ts`, `migre: true` dans `routes.ts`,
  contrôles dans `tests/v2.js`, captures comparées à `docs/maquettes/etat-actuel/`.

## Avancement

- [x] Phase 0 — Cadrage (2026-10-27)
- [x] Phase 1 — Socle (2026-10-27)
- [x] Phase 2 — Logique métier typée (2026-10-27)
- [x] Phase 3 — Données et session (2026-10-27)
- [x] Phase 4 — Composants de base (2026-10-27)
- [ ] Phase 5 — Écrans : [x] vague A (2026-10-27), [x] B (2026-10-31), [x] C (2026-10-31), [ ] D
- [ ] Phase 6 — Bascule et nettoyage
