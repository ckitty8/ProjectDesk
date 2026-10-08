# Règles de travail du projet

Ce fichier est lu automatiquement au début de chaque session Claude Code.
Les règles ci-dessous sont **permanentes** : elles s'appliquent à toute évolution du dépôt,
sauf consigne contraire explicite du porteur du projet.

## Les règles

> Numérotation reprise des instructions du porteur du projet (pas de règle n°6 à ce jour ; règle n°8 ajoutée le 2026-09-26).

1. **Code lisible et modifiable par un tech lead humain.**
   - Pas de framework, de build ou de dépendance ajoutés sans nécessité démontrée.
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

4. **Cohérence entre les fonctionnalités** (l'architecture finale n'est pas figée).
   - Listes métier (types, priorités, statuts, rôles, absences) : **en base**, table
     `valeurs_referentiel` (administrable). Constantes techniques : `app/js/config.js`.
   - Un seul endroit pour les calculs métier : `app/js/calculs.js` (fonctions pures).
     Les écrans consomment, ils ne recalculent pas.
   - Droits : toujours en base (règles RLS) ; l'application ne fait que masquer les boutons.
   - Réutiliser les composants existants (`app/js/composants.js`, panneau, modale, calendrier)
     avant d'en créer de nouveaux.
   - Avant d'ajouter une fonctionnalité, vérifier le § « Points de cohérence » du DAT.

5. **Mettre à jour le DAT à chaque évolution.**
   - Document : `docs/DAT.md` (architecture, menus, modèle de données, flux, règles métier).
   - Toute modification de menu, d'écran, de champ, de règle de calcul ou de stockage met à
     jour le DAT **dans le même commit**, et ajoute une ligne à son historique.

7. **À la fin de chaque commit, vérifier tous les documents.**
   - Relire `README.md`, `CLAUDE.md`, `docs/DAT.md`, `app/README.md` et les captures de
     `docs/maquettes/` : ils doivent décrire le code tel qu'il est après le commit.
   - Lancer `node scripts/verifier-docs.js` (automatique après chaque commit si le hook est
     activé : `git config core.hooksPath .githooks`).
   - Tout écart signalé est corrigé dans un commit suivant, avant de passer à autre chose.

8. **Les évolutions ne touchent jamais aux données** (consigne du porteur, 2026-09-26).
   - Une évolution demandée ne modifie, ne supprime ni ne déplace aucune donnée existante
     (absences, ressources, projets, affectations…). Toute écriture en base autre qu'une
     migration de structure additive demande l'accord explicite du porteur.
   - Après une migration : recharger le cache de la Data API (DAT § 10) puis vérifier que
     l'application affiche toujours les données (ex. nombre d'absences inchangé).
   - Le chargement de l'application ne doit jamais vider l'écran si une lecture échoue
     (`chargerDonnees()` dans `app/js/etat.js`, DAT § 2).

## Spécifications validées (fonctionnalités à venir)

Décisions du porteur à respecter lors du développement des fonctionnalités concernées :

- **Roadmap** (en attente : demandes gérées dans Azure DevOps depuis le 2026-10-05) :
  `docs/specifications/roadmap.md` (rang de traitement DSI, sprint en liste
  déroulante alimentée par Administration).

## Check-list avant chaque commit

- [ ] Maquette PNG faite et validée (si changement d'écran)
- [ ] Code commenté, lisible
- [ ] Aucune donnée existante modifiée (règle n°8)
- [ ] Référentiels / calculs centralisés (pas de duplication)
- [ ] `docs/DAT.md` à jour + ligne d'historique
- [ ] Version `?v=` des fichiers de `app/index.html` alignée sur la version du DAT (sinon le navigateur garde l'ancien code)
- [ ] `node tests/parcours.js` → tous les contrôles passent (captures régénérées)
- [ ] `node scripts/audit-code.js` → aucune erreur (pas de code mort, pas de lien cassé)

## Revue qualité

Après une série d'évolutions (ou à la demande du porteur) : skill **`revue-qualite`**
(`.claude/skills/revue-qualite/SKILL.md`) — nettoyage du code, lisibilité, cohérence entre les
pages, audit de la base (`db/audit/verifier-bdd.sql`, lecture seule), mise à jour des documents.
Objectif du porteur : aucune ligne inutile ni code mort ; une application reprenable par une
équipe de développeurs humains.

## Après chaque commit

- [ ] Livraison : pousser la branche de travail puis **`main`** (mise en ligne Vercel) **et la branche `roadmap`**, qui doivent rester identiques (consigne du porteur, 2026-10-05)

- [ ] `node scripts/verifier-docs.js` → « ✔ Documents vérifiés »
- [ ] Relecture humaine des documents : README, DAT, CLAUDE.md cohérents entre eux
