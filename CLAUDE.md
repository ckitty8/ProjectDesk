# Règles de travail du projet

Ce fichier est lu automatiquement au début de chaque session Claude Code.
Les règles ci-dessous sont **permanentes** : elles s'appliquent à toute évolution du dépôt,
sauf consigne contraire explicite du porteur du projet.

## Les règles

> Numérotation reprise des instructions du porteur du projet (pas de règle n°6 à ce jour).

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

## Check-list avant chaque commit

- [ ] Maquette PNG faite et validée (si changement d'écran)
- [ ] Code commenté, lisible
- [ ] Référentiels / calculs centralisés (pas de duplication)
- [ ] `docs/DAT.md` à jour + ligne d'historique
- [ ] `node tests/parcours.js` → tous les contrôles passent (captures régénérées)

## Après chaque commit

- [ ] `node scripts/verifier-docs.js` → « ✔ Documents vérifiés »
- [ ] Relecture humaine des documents : README, DAT, CLAUDE.md cohérents entre eux
