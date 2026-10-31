---
name: revue-qualite
description: Revue complète de ProjectDesk avant reprise par une équipe humaine — nettoie le code (code mort, lignes inutiles), vérifie qu'il est lisible et compréhensible par un développeur, contrôle la cohérence entre les pages et les liens entre elles, audite la base Neon (liaisons, droits, données) puis met les documents à jour. À lancer après une série d'évolutions, ou quand le porteur demande « revue », « nettoyage », « audit », « code propre ».
---

# Revue qualité de ProjectDesk

Objectif du porteur du projet (2026-10-08) : **une application propre, sans ligne inutile ni code
mort, qu'une équipe de développeurs humains peut reprendre facilement.** Les règles de
`CLAUDE.md` s'appliquent pendant toute la revue (en particulier la règle n°8 : **aucune donnée
modifiée sans l'accord explicite du porteur**).

Déroulé : 1 → 6 dans l'ordre. Chaque étape produit des constats ; on corrige ce qui relève du
code et de la documentation, on **propose** (sans l'appliquer) ce qui touche à la base.

## 1. Code : contrôle automatique

```bash
npm --prefix web run verifier
```

Résultat attendu : aucune erreur. Il enchaîne :

| Contrôle | Règle |
|---|---|
| Types (`tsc`, mode strict) | aucune erreur de type, pas d'index non vérifié |
| ESLint | variables et imports inutilisés (code mort), longueur de ligne, règles React |
| Vitest | logique métier (`web/src/domaine/`) et composants testés |
| Build | l'application se construit dans `app/` |

À relire à la main (le linter ne les voit pas) : `console.log` / `debugger` / `TODO` oubliés, fonctions de plus de 60 lignes,
fonctions de 10 lignes ou plus sans commentaire, couleurs `#RRGGBB` hors de `domaine/config.ts` / `theme.css`, code en double.

Pour chaque erreur de code mort : vérifier avec `grep -rn "<nom>" web/src/` puis **supprimer** le
code (et son commentaire). Ne jamais construire un nom d'action ou de fonction par concaténation :
le contrôle ne le verrait pas, et un développeur non plus.

## 2. Code : relecture humaine (lisibilité)

Relire **tous** les fichiers modifiés depuis la dernière revue (`git log --stat`), puis survoler les
autres. La question à se poser : *un développeur qui découvre le projet comprend-il ce fichier sans
aide ?* Pour chaque fichier, vérifier :
- **en-tête** `/* ==== … ==== */` : à quoi sert le fichier, d'où vient le besoin (maquette, date) ;
- **un commentaire par fonction non triviale** : ce qu'elle fait et pourquoi ;
- **règles métier** (formule, seuil, liste) commentées avec leur source ;
- **noms en français** cohérents avec les tables SQL ; pas d'abréviation obscure ;
- **découpage** : un écran = un objet `Ecrans.x` avec `rendre()` court qui assemble des méthodes
  nommées (`indicateurs()`, `carteMembres()`, `lignePersonne()`…) ; les données calculées une fois
  (`donnees()`, `contexte()`) puis passées aux méthodes — jamais une fonction de 80 lignes de gabarits ;
- **HTML lisible** : gabarits coupés entre les balises (une ligne ≈ un bloc), pas de mise en forme en
  dur : classes de `theme.css` ; `style="…"` seulement pour un réglage unique ou une valeur calculée
  (couleur d'une équipe, largeur d'une barre) ;
- **couleurs** : `COULEURS` / `TONS` (`config.js`), `C.badgeTon(texte, 'succes')` pour un badge ;
- **pas d'astuce « clever »** : une ligne qu'il faut relire trois fois est réécrite en plusieurs lignes ;
- **pas de code commenté** laissé « au cas où », pas de paramètre ni d'import inutilisé
  (y compris dans `tests/` et `scripts/`).

### Non-régression visuelle d'un nettoyage

Un nettoyage ne doit **rien** changer à l'écran. Les captures de `tests/parcours.js` sont
reproductibles (identifiants numérotés dans le serveur simulé, notifications masquées à la capture) :
1. partir d'un dépôt propre (`git status` vide) ;
2. nettoyer, puis `node tests/parcours.js` ;
3. `git status docs/maquettes/etat-actuel` : **aucune capture modifiée**. Une capture modifiée =
   un changement visuel à comprendre (souvent une classe moins prioritaire qu'un sélecteur existant,
   ex. `select.champ` l'emporte sur `.largeur-auto`) et à corriger avant de continuer.

## 3. Cohérence entre les pages et liens entre elles

- `node tests/parcours.js` → tous les contrôles passent (parcours de bout en bout, captures).
- Une **règle = un seul endroit** (règle n°4) :
  - calculs dans `web/src/domaine/` : chercher dans `web/src/ecrans/` des calculs refaits
    (`HEURES_PAR_JOUR`, `* capacite`, sommes de jours, filtres de présence…) ;
  - listes de personnes : `ressourcesPresentes` / `ressourcesActives` (DAT § 2, menus liés) ;
  - droits d'affichage : fonctions de `etat.js` (`peutPiloterProjet`, `peutGererEquipe`, `peutLireDailyProjet`…), miroir
    des règles RLS ; jamais un test de rôle recopié dans un écran ; liste des rôles : `ROLES_CHOISISSABLES` / `ROLES_ACCES` (`config.js`), cartes `Simulation.ROLES` ;
  - listes métier : référentiels en base (`valeursDe`), jamais une liste en dur dans un écran.
- Une même notion porte **le même nom** partout (menu, titre d'écran, DAT, guide d'aide).
- Les écrans de la section **Suivi de mes équipes** (ex-« Général ») restent en lecture seule, hors validation des feuilles de temps (contrôle du parcours).
- Relire le § « Points de cohérence » du DAT et vérifier que chaque point est toujours vrai.

## 4. Base de données : liaisons et données (lecture seule)

Exécuter `db/audit/verifier-bdd.sql` sur la branche `production` (outil Neon `run_sql`, projet
`dark-lake-97562553`). La requête est **en lecture seule** ; chaque ligne est un écart :
- structure et sécurité : table sans RLS, sans règle, sans clé primaire, droit au rôle `anonymous`,
  fonction `SECURITY DEFINER` sans `search_path`, clé étrangère sans index ;
- **fonction non référencée en base** : chercher son appel dans `web/src/` (`executer('<nom>')`) et
  dans les flux externes (ex. `daily_projet` appelé par Power Automate) ; sinon c'est du code mort ;
- données : valeurs hors référentiel, doublons d'email, dates incohérentes, heures ou absences hors
  présence, sprints sans dates, plan de charge > 100 %, etc.

Compléter par une comparaison **migrations ↔ base** : toute table, colonne ou fonction présente en
base doit être créée par un fichier de `db/migrations/` (et réciproquement), sinon la base n'est
plus reconstructible.

**Corrections** : préparer un fichier `db/migrations/NNN_<objet>.sql` commenté, le montrer au
porteur et attendre son « ok ». Structure additive (index, contrainte) : accord simple. Suppression
(fonction, table, colonne) ou modification de données : accord **explicite**, branche de sauvegarde
Neon avant **seulement si le porteur le demande** (décision du 2026-10-18 : plus de branche de sauvegarde, une seule base), comptage des données avant / après, puis `update_data_api` (DAT § 10).

## 5. Documents

- `node scripts/verifier-docs.js` → « ✔ Documents vérifiés ».
- Relire et mettre à jour : `README.md`, `web/README.md`, `CLAUDE.md`, `docs/DAT.md` (dont § 2.1
  fichiers, § 3 écrans, § 4 tables, § 6 règles de calcul, § 9 nombre de contrôles des tests,
  § 11 outillage, § 12 points ouverts). Ils doivent décrire le code **tel qu'il est**.
- Ligne d'historique dans le DAT.

## 6. Rapport au porteur

Un tableau court : contrôle, résultat, ce qui a été corrigé, ce qui attend son accord (base), ce
qui reste à juger (avertissements gardés et pourquoi). Puis livraison selon `CLAUDE.md`
(branche de travail puis `main`, statut Vercel).

## Ajouter une vérification

Un nouveau besoin de contrôle s'ajoute **dans les contrôles**  (`web/eslint.config.js`, un test Vitest ou
`db/audit/verifier-bdd.sql`), avec un commentaire qui dit pourquoi, plutôt que dans cette liste :
un contrôle automatique ne s'oublie pas.
