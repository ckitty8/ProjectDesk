# Règles de travail du projet

Ce fichier est lu automatiquement au début de chaque session Claude Code.
Les règles ci-dessous sont **permanentes** : elles s'appliquent à toute évolution du dépôt,
sauf consigne contraire explicite du porteur du projet.

## Les règles

> Numérotation reprise des instructions du porteur du projet (pas de règle n°6 à ce jour ; règle n°8 ajoutée le 2026-09-26).

1. **Code lisible et modifiable par un tech lead humain.**
   - Pas de framework, de build ou de dépendance ajoutés sans nécessité démontrée.
     **Exception validée par le porteur (2026-10-27)** : la migration vers React + TypeScript
     (Vite, TanStack Query, React Router, Vitest), dans `web/` ; voir § « Migration React ».
   - Fonctions courtes, noms explicites (en français pour le métier, cohérents avec les tables SQL).
   - Pas d'astuce « clever » : on préfère 5 lignes claires à 1 ligne obscure.

2. **Commenter le code.**
   - En-tête de section (`/* ==== ... ==== */`) pour chaque bloc fonctionnel.
   - Un commentaire par fonction non triviale : *ce qu'elle fait* et *pourquoi*.
   - Toute règle métier (formule, seuil, liste de valeurs) est commentée avec sa source.

3. **Front : produire un PNG (maquette) avant de coder.**
   - Toute création ou modification d'écran commence par une maquette PNG déposée dans
     `docs/maquettes/<nom-de-la-fonctionnalite>/`, montrée au porteur du projet avant le code.
   - Les captures de l'état actuel des écrans sont dans `docs/maquettes/etat-actuel/` et
     doivent être régénérées après chaque changement visuel livré (`node tests/parcours.js`).
   - Migration React : un écran migré **à l'identique** n'a pas besoin de nouvelle maquette (les
     captures actuelles en tiennent lieu) ; tout écran nouveau ou modifié reste soumis à cette règle.

4. **Cohérence entre les fonctionnalités** (l'architecture finale n'est pas figée).
   - Listes métier (types, priorités, statuts, rôles, absences) : **en base**, table
     `valeurs_referentiel` (administrable). Constantes techniques : `web/src/domaine/config.ts`.
   - Un seul endroit pour les calculs métier : `web/src/domaine/` (fonctions pures testées).
     Les écrans consomment, ils ne recalculent pas.
   - Droits : toujours en base (règles RLS) ; l'application ne fait que masquer les boutons.
   - Réutiliser les composants existants (`web/src/composants/` : panneau, fenêtres, calendrier…)
     avant d'en créer de nouveaux.
   - Avant d'ajouter une fonctionnalité, vérifier le § « Points de cohérence » du DAT.

5. **Mettre à jour le DAT à chaque évolution.**
   - Document : `docs/DAT.md` (architecture, menus, modèle de données, flux, règles métier).
   - Toute modification de menu, d'écran, de champ, de règle de calcul ou de stockage met à
     jour le DAT **dans le même commit**, et ajoute une ligne à son historique.

7. **À la fin de chaque commit, vérifier tous les documents.**
   - Relire `README.md`, `CLAUDE.md`, `docs/DAT.md`, `web/README.md` et les captures de
     `docs/maquettes/` : ils doivent décrire le code tel qu'il est après le commit.
   - Lancer `node scripts/verifier-docs.js` (automatique après chaque commit si le hook est
     activé : `git config core.hooksPath .githooks`).
   - Tout écart signalé est corrigé dans un commit suivant, avant de passer à autre chose.

8. **Les évolutions ne touchent jamais aux données** (consigne du porteur, 2026-09-26).
   - Une évolution demandée ne modifie, ne supprime ni ne déplace aucune donnée existante
     (absences, ressources, projets, affectations…). Toute écriture en base autre qu'une
     migration de structure additive demande l'accord explicite du porteur.
   - **Pas de branche de sauvegarde Neon avant une migration** (porteur, 2026-10-18 : « pas la
     peine de faire des sauvegardes, garde 1 BDD ») : on travaille sur la seule branche
     `production`. Seule la sauvegarde « sauvegarde-avant-035-037-2026-10-18 » est conservée ;
     les autres branches ont été supprimées avec son accord. Compter les données avant / après reste de mise.
   - Après une migration : recharger le cache de la Data API (DAT § 10) puis vérifier que
     l'application affiche toujours les données (ex. nombre d'absences inchangé).
   - Le chargement de l'application ne doit jamais vider l'écran si une lecture échoue
     (chargement tolérant de `web/src/donnees/`, DAT § 2).

## Spécifications validées (fonctionnalités à venir)

Décisions du porteur à respecter lors du développement des fonctionnalités concernées :

- **Roadmap** (en attente : demandes gérées dans Azure DevOps depuis le 2026-10-05) :
  `docs/specifications/roadmap.md` (rang de traitement DSI, sprint en liste
  déroulante alimentée par Administration).

## Migration React (terminée le 2026-10-31, version 2.68)

Historique et décisions : `docs/specifications/migration-react.md`.

- L'application est dans `web/` (React + TypeScript, Vite) et servie sur `/app/` : `app/` est le **résultat du build**
  (ignoré par git, jamais modifié à la main). L'ancienne application JavaScript est supprimée ; retour arrière possible
  via l'historique git (commit `5f0c7a2`, version 2.67).
- Travail **directement sur `main`**.
- Le Gantt et la roadmap interactifs sont **hors périmètre** (à développer après la migration).
- Les règles n°2, 4, 5, 7 et 8 s'appliquent au code TypeScript (commentaires, un seul endroit pour les calculs :
  `web/src/domaine/`, DAT à jour, documents vérifiés, aucune donnée touchée).

## Check-list avant chaque commit

- [ ] Maquette PNG faite et validée (si changement d'écran)
- [ ] Code commenté, lisible
- [ ] Aucune donnée existante modifiée (règle n°8)
- [ ] Référentiels / calculs centralisés (pas de duplication)
- [ ] `docs/DAT.md` à jour + ligne d'historique
- [ ] `npm --prefix web run verifier` → types, lint, tests unitaires et build passent
- [ ] `node tests/parcours.js` → tous les contrôles passent (captures régénérées)

## Revue qualité

Après une série d'évolutions (ou à la demande du porteur) : skill **`revue-qualite`**
(`.claude/skills/revue-qualite/SKILL.md`) — nettoyage du code, lisibilité, cohérence entre les
pages, audit de la base (`db/audit/verifier-bdd.sql`, lecture seule), mise à jour des documents.
Objectif du porteur : aucune ligne inutile ni code mort ; une application reprenable par une
équipe de développeurs humains.

## Fin de session

- Quand le porteur dit « fin de session » (ou « on a fini », « avant de merger ») : appliquer le skill
  `next-skill-advisor` (`.claude/skills/`), qui propose les prochaines étapes sans rien lancer sans accord.

## Après chaque commit

- [ ] Livraison : pousser la branche de travail puis **`main`** (mise en ligne Vercel sur
  `project-desk-sepia.vercel.app`). La branche `roadmap` n'est **plus** mise à jour (consigne du
  porteur, 2026-10-13) ; la branche `gestion-des-ressources` est abandonnée (même date).

- [ ] Fin de développement : envoyer au porteur le lien de la version de `main` en ligne
  (https://project-desk-sepia.vercel.app) avec le numéro de version livré (consigne du porteur, 2026-10-23).

- [ ] `node scripts/verifier-docs.js` → « ✔ Documents vérifiés »
- [ ] Relecture humaine des documents : README, DAT, CLAUDE.md cohérents entre eux
