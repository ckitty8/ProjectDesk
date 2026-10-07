# DAT — Document d'Architecture Technique · ProjectDesk

> Document vivant : à mettre à jour à **chaque** évolution (menus, écrans, tables, règles,
> droits). Voir la règle n°5 dans `CLAUDE.md`. Sa cohérence avec le code est contrôlée
> après chaque commit par `scripts/verifier-docs.js` (règle n°7).

| Version | Date       | Objet |
|---------|------------|-------|
| 0.1     | 2026-09-25 | Création du DAT à partir de l'existant (Roadmap PM) |
| 0.2     | 2026-09-25 | Règle n°7 : script de vérification des documents + hook post-commit |
| 0.3     | 2026-09-25 | Transfert du projet dans le dépôt ProjectDesk |
| 0.4     | 2026-09-25 | Base Neon (schéma Roadmap PM, RLS, Data API) |
| 0.5     | 2026-09-25 | Déploiement Vercel, domaines déclarés dans Neon Auth |
| 0.6     | 2026-09-25 | Nouvelle cible « Pilotage Projet » : maquette de référence + compléments |
| 1.0     | 2026-09-25 | **Pilotage Projet livré** : migration 002, application `app/`, tests de bout en bout ; Roadmap PM retiré |
| 1.1     | 2026-09-25 | Domaines Vercel `project-desk.vercel.app` et `…-git-main-…` autorisés ; messages d'erreur de connexion explicites (§ 8) |
| 1.2     | 2026-09-25 | Connexion Google : échange du vérificateur de session au retour, jeton lu dans `set-auth-jwt`, erreurs de retour affichées (§ 7) |
| 1.3     | 2026-09-25 | Adresse de production corrigée : `project-desk-sepia.vercel.app` autorisée, `project-desk.vercel.app` (projet tiers) retirée (§ 8) |
| 1.4     | 2026-09-25 | Administrateurs : lecture de tout sans équipe (migration 003), entrée directe dans l'outil ; ouverture automatique de l'équipe unique ou nouvellement créée (§ 5.2, § 7) |
| 1.5     | 2026-09-25 | Nom affiché « ProjectDesk » (paramètre `NOM_APPLICATION`), sous-titre « Multi-projets · Multi-équipes » retiré (§ 1, § 2.1) |
| 1.6     | 2026-09-25 | Nouvel écran Général › Daily des équipes ; notes de daily lisibles par les coéquipiers (migration 004) ; notes chargées sur 90 jours (§ 2, § 3.2, § 5, § 6) |
| 1.7     | 2026-09-25 | **Section Général strictement en lecture seule** : édition des équipes et référentiels déplacée dans Mon dashboard › Administration ; contrôle automatique (§ 3, § 9, § 10) |
| 1.8     | 2026-09-25 | **Liste des ressources en « board »** : onglets Équipes (arborescence Directions & équipes, recherche, statut, suppression si vide), Affectations, Postes, Types de contrat ; migration 005 (`directions`, statut des équipes, `type_contrat`, référentiels `poste` / `contrat`) (§ 3.3, § 4, § 5) |
| 1.9     | 2026-09-25 | Incident « table directions absente du cache de schéma » : rechargement du cache Data API ajouté à la procédure de migration (§ 10) |
| 1.10    | 2026-09-25 | **Direction = espace de travail** (maquette `direction-espace-travail.png`) : directions et équipes dans la même table `equipes` (`type`, `parent_id`), table `directions` supprimée (migration 006) (§ 3.3, § 4, § 5) |
| 1.11    | 2026-09-25 | **Liste des ressources = arborescence Direction → Équipe → Projet → Membres** (maquette `arborescence-ressources.png`) ; onglet Affectations fusionné ; écran ouvert sans équipe pour un administrateur ; « Nouveau projet » accepte l'équipe choisie (§ 3.3) |
| 1.12    | 2026-09-25 | Incident « column equipes.direction_id does not exist » (cache Data API après la migration 006) : procédure de migration corrigée, `notify` insuffisant (§ 10) |
| 1.13    | 2026-09-25 | « Nouveau projet » : champs Résultat clé visé, Début, Fin et Statut retirés (§ 3.4) |
| 1.14    | 2026-09-25 | Valeurs système des référentiels **renommables** (clé technique `cle`, renommage propagé aux données, droits par clé) — migration 007 (§ 4, § 5) |
| 1.15    | 2026-09-25 | Affectation : « + Nouvelle personne » depuis « + Membre » (fiche créée puis sélectionnée) (§ 3.4) |
| 1.16    | 2026-09-25 | Libellé unique « Membre » : « + Personne » → « + Membre », « + Nouvelle personne » → « + Nouveau membre » (§ 3.3, § 3.4) |
| 1.17    | 2026-09-25 | Congés & capacité : trois onglets au lieu de trois blocs ; récap annuel sur les personnes de la grille (et non plus l'équipe ouverte seule) (§ 3.3) |
| 1.18    | 2026-09-25 | Données à jour sans F5 (lectures `no-store`, `no-cache` Vercel) ; panneau projet modifiable (nom, description, chef, dates) et supprimable, ouvert depuis Liste des ressources (§ 3.4, § 8) |
| 1.19    | 2026-09-25 | Types d'absence (données) : Congés validé (vert, décompté du droit annuel, clé `cp`), Congés prévisionnel (orange), Jours férié (marron) ; Formation désactivé ; en-tête du récap annuel = libellé du type décompté (§ 3.3) |
| 1.20    | 2026-09-25 | Panneau projet : objectif, résultat clé, période, statut, avancement et tickets retirés (§ 3.4) |
| 1.21    | 2026-09-25 | Calendriers (Congés & capacité, Général › Gestion des ressources) : sélecteur de mois déplacé juste au-dessus du calendrier, à gauche (§ 3.2, § 3.3) |
| 1.22    | 2026-09-25 | Jours fériés affichés par défaut dans les calendriers avec le type « Jours férié » (clé `ferie`, migration 008) (§ 4) |
| 1.23    | 2026-09-25 | Mon dashboard › Administration : onglet **Jours fériés** (administrateurs) pour gérer la table `jours_feries` (§ 3.3) |
| 1.24    | 2026-09-25 | Absences à la demi-journée (`absences.duree`, migration 009) : récap, solde, capacité et heures attendues comptent 0,5 ; calendrier « ½ ». Import de l'onglet Planning de `Calendrier_2026.xlsx` (117 absences « Congés validé », 2 fiches créées) (§ 4, § 6) |
| 1.25    | 2026-09-25 | Rafraîchissement des données en arrière-plan (changement d'écran, retour sur l'onglet) (§ 2) |
| 1.26    | 2026-09-25 | Lecture paginée de toutes les tables (plafond de lignes de la Data API : les absences d'été importées n'étaient pas chargées) ; serveur simulé plafonné à 50 lignes (§ 2, § 9) |
| 1.27    | 2026-09-26 | Incident « permission denied for schema auth » à chaque modification : `tracer_modification()` passe en `SECURITY DEFINER` (migration 010) ; calendrier des congés groupé comme Liste des ressources (§ 3.3, § 5) |
| 1.28    | 2026-09-26 | Liste des ressources : une personne sans projet qui dirige une unité est affichée « Responsable de l’unité » (et non « sans projet ») (§ 3.3) |
| 1.29    | 2026-09-26 | `no-cache` étendu à tout le site : à l'ouverture (sans F5) le navigateur resservait d'anciennes copies (page et données) (§ 8) |
| 1.30    | 2026-09-26 | Calendrier des congés : le responsable d'une unité sans affectation est affiché en tête de l'unité (et non sous « Sans projet ») (§ 3.3) |
| 1.31    | 2026-09-26 | Liste des ressources : le responsable d'une unité (sans projet) est affiché juste sous l'unité, avant ses équipes et projets (§ 3.3) |
| 1.32    | 2026-09-26 | Bulles d'information « ⓘ » (composant `C.aide`, textes `AIDES`) : sections, KPI, congés, liste des ressources, timesheet, daily, administration, projets (§ 2.1, § 10) |
| 1.33    | 2026-09-26 | Bouton **Aide** dans l'en-tête : aide sur l'écran courant, premiers pas, rôles et droits, contact de l'administrateur (paramètre `CONTACT_AIDE`) (§ 2.1, § 10) |
| 1.34    | 2026-09-26 | Calendriers des congés : vues « Par équipe » (une ligne par personne + synthèse absents / membres par projet) et « Par projet » ; calcul `absentsDuJour` (§ 3, § 6) |
| 1.35    | 2026-09-26 | Récap annuel = jours travaillés / congés / reste à prendre (onglet « Jours de congés » du porteur) ; objectif client par équipe et par année (migration 011) (§ 3.3, § 4, § 5.2, § 6) |
| 1.36    | 2026-09-26 | Capacité par sprint : calcul type Scrum à titre d’information (`Calculs.capaciteScrum`) ; menu Aide › « Trucs et astuces · KPI Agile » (Scrum et Kanban) (§ 2.1, § 3.3, § 6) |
| 1.37    | 2026-09-26 | KPI Agile déplacés du menu Aide vers Mon dashboard › Administration › **Trucs et astuces**, avec exemples chiffrés sur un projet (CDO par défaut) (§ 3.3, § 6) |
| 1.38    | 2026-09-26 | Incident « congés perdus » (base intacte, 155 absences) : une table illisible (ex. `objectifs_jours_travail` inconnue de la Data API) bloquait tout le chargement. Chargement tolérant (`chargerDonnees`) : l'affichage précédent est conservé, message d'alerte ; cache Data API rechargé (§ 2) |
| 1.39    | 2026-09-27 | Récap annuel : la colonne C ne compte plus les jours fériés (elle affichait congés + fériés, soit 9 jours de trop en 2026) ; T = jours de semaine − fériés − congés (§ 6) |
| 1.40    | 2026-09-27 | **Dates d'arrivée et de départ** (facultatives) sur la fiche d'une personne (migration 012, additive) : jours hors présence exclus du récap annuel et de la capacité, objectif client proratisé ; maquettes `date-arrivee/` (§ 3.3, § 3.4, § 4, § 6) |
| 1.41    | 2026-09-27 | Capacité par sprint et calcul type Scrum **par projet** (sélecteur « Tous les projets » / un projet), ligne de total retirée ; maquette `capacite-par-projet/` (§ 3.3) |
| 1.42    | 2026-09-27 | Calcul type Scrum : explication de la formule masquée par défaut, bouton « Voir le calcul » / « Masquer le calcul » en haut à droite (§ 3.3) |
| 1.43    | 2026-09-27 | Capacité par sprint : flèche ▸ / ▾ sur chaque projet pour afficher le détail par personne (§ 3.3) |
| 1.45    | 2026-09-27 | **Notion de ticket retirée** : l'application pilote des projets, pas des tickets. Colonne et dépliage des tickets (Projets et Roadmap), KPI « Tickets ouverts » (dashboard), calculs `compteTickets` / `ticketsOuverts` / `statsTickets`, chargement de la table et référentiel « Statuts ticket » (masqué : `REFERENTIELS_MASQUES`) retirés ; exemples KPI Agile illustratifs. Base inchangée (table `tickets` vide conservée) (§ 1, § 3, § 4, § 6) |
| 1.46    | 2026-09-27 | **Onglet « Capacité par sprint » retiré** (à reprendre) : tableau par projet, détail par personne, calcul type Scrum et sa pop-in, sélecteur de projet, textes d'aide, styles, fonction sprintsAutour, helper `membresProjet`, maquettes `capacite-par-projet/` et tests associés supprimés. Conservés car utilisés ailleurs : `capacitePeriode`, `capaciteScrum`, `sprintDe` (exemples des KPI Agile) (§ 2.1, § 3.3, § 6) |
| 1.47    | 2026-09-27 | Congés & capacité : bouton « Méthode de calcul Scrum » (pop-in : capacité, capacité engageable, vélocité, répartition idéale d'un sprint en 8 catégories) ; paramètres `REPARTITION_SPRINT`, `SPRINTS_MOYENNE_VELOCITE` (config.js). Maquette de l'onglet refusée, non livrée (§ 3.3, § 6) |
| 1.48    | 2026-09-27 | Congés & capacité : onglet **Capacité par projet et par sprint** créé, vide pour le moment ; le bouton « Méthode de calcul Scrum » y est déplacé (en haut à droite de l'onglet) (§ 3.3) |
| 1.49    | 2026-09-27 | Onglet renommé **Capacité** (au lieu de « Capacité par projet et par sprint ») (§ 3.3) |
| 1.50    | 2026-09-27 | **Onglet Capacité construit** (maquette `capacite-saisie/` validée) : indicateurs, capacité des membres, vélocité avec saisie des points engagés / terminés, répartition du sprint avec saisie des jours réels ; tables `sprints_projet` et `repartitions_sprint` (migration 013, additive) ; `Calculs.velocite`, `Calculs.repartitionSprint` (§ 3.3, § 4, § 5, § 6) |
| 1.51    | 2026-10-05 | Liste des ressources : colonnes **Début / Fin** (dates d'arrivée et de départ) et statut **Actif / Inactif** des personnes (calculé, aucune donnée ajoutée). Tests rendus indépendants de la date du jour (mois du calendrier fixé ; défaut `confiance` des objectifs dans le serveur simulé, comme en base) (§ 3.3, § 9) |
| 1.52    | 2026-10-05 | Liste des ressources : dates de début et de fin **saisissables sur la ligne** de chaque personne ; une date de fin rend la ressource **Inactive** et la **masque** de la liste (bouton « Afficher les ressources inactives ») (§ 3.3) |
| 1.53    | 2026-10-05 | Rechargement forcé du code après une livraison : version `?v=` sur chaque fichier JS/CSS de `index.html` (= version du DAT, à changer à chaque livraison) — la Liste des ressources (début, fin, statut) restait invisible chez le porteur avec l'ancienne copie (§ 8) |
| 1.54    | 2026-10-05 | Connexion : **« Mot de passe oublié ? »** — email de réinitialisation envoyé par Neon Auth (`/request-password-reset`), retour sur l'application avec `?token=`, choix du nouveau mot de passe (`/reset-password`). Personne d'autre ne voit ni ne choisit le mot de passe (§ 7) |
| 1.55    | 2026-10-05 | Ouverture : un **administrateur** n'a plus d'écran de choix d'équipe — équipe mémorisée, sinon sa première équipe (hors direction) ; « Changer » reste disponible (§ 7) |
| 1.56    | 2026-10-05 | **Daily** : saisie en trois champs — Hier (la veille), Aujourd’hui, Blocages (`Calculs.decouperDaily` / `composerDaily`, stockage inchangé : un texte par jour au format des rubriques). **Liste des ressources** : statut retiré des unités (gardé sur les projets) ; statut des personnes cliquable (Actif → date de fin = aujourd’hui ; Inactif → date de fin retirée) (§ 3.3, § 6) |
| 1.57    | 2026-10-05 | Branche `roadmap` (spécifications de la roadmap) fusionnée ; chaque livraison met à jour `main` **et** `roadmap` (CLAUDE.md) |
| 1.58    | 2026-10-05 | **Sprints par projet** saisis dans Mon dashboard › Administration › **Sprints** (version, début, fin ; migration 014, additive : colonnes `nom`, `debut`, `fin` de `sprints_projet`) ; l'onglet Capacité navigue dans les sprints du projet (bouton « Sprints du projet »). Calendrier global `SPRINT_REFERENCE` conservé pour les exemples des KPI Agile (§ 3.3, § 4, § 6) |
| 1.59    | 2026-10-05 | **Demandes retirées** (gérées dans Azure DevOps) : onglets Demandes entrantes et Formulaire de demande (Mon dashboard › Administration), Champs du formulaire (Général › Administration), espace demandeur, création d'un projet depuis une demande ; référentiels « Types de demande » et « Priorités » masqués. Tables `demandes` et `champs_formulaire` et leurs données conservées en base (§ 3, § 4, § 7) |
| 1.60    | 2026-10-05 | **Trucs et astuces** devient un menu à part de Mon dashboard (écran `astuces`, fichier `astuces.js`), retiré des onglets d'Administration (§ 2.1, § 3.3) |
| 1.61    | 2026-10-05 | **Mon timesheet** devient un sous-menu : « Saisir mes heures » (écran `monTimesheet`, inchangé) et **« Mon historique »** (écran `mesTemps`, fichier `mes-temps.js`, maquette `mon-timesheet-historique/`) : bilan d'un mois — heures saisies / attendues, remplissage, semaines validées, détail par semaine (lien vers la saisie) et par projet (calcul du bilan mensuel, retiré en 1.62). Lecture seule, aucune donnée modifiée (§ 3.3, § 6) |
| 1.62    | 2026-10-05 | **Mon timesheet** : sous-menus **« Saisir mes heures »** (écran `monTimesheet` : mon temps sur les projets où je suis affecté, sans le bloc « À valider ») et **« Suivi de mes équipes »** (écran `suiviEquipes`, fichier `suivi-equipes.js`, maquette `mon-timesheet-suivi-equipes/`) : feuilles de la semaine des personnes de mes équipes, indicateurs, Valider / Renvoyer pour le responsable. Tableau partagé avec Général › Timesheet (`tableauFeuilles`, colonne « Total / attendu »). « Mon historique » (`mesTemps` et son calcul du bilan mensuel) retiré. Aucune donnée modifiée (§ 3.2, § 3.3, § 6) |
| 1.63    | 2026-10-05 | **Sprints : numéro et année** (migration 015, additive : colonnes `numero_sprint` et `annee` de `sprints_projet`, index d'unicité projet + année + numéro sur les lignes renseignées). Administration › Sprints : colonnes Sprint n° (affiché « Sprint N ») / Année / Version / Début / Fin, puces par année, numéro et année pré-remplis, doublon refusé ; libellé « Sprint N · version » partout (`nomSprint`) (§ 3.3, § 4) |
| 1.64    | 2026-10-06 | **Saisie des heures mensuelle** : Saisir mes heures = grille du mois (une colonne par jour de semaine, JF / Abs / hors présence non saisissables), « Soumettre le mois » ; Suivi de mes équipes et Général › Timesheet au mois (saisi / attendu, complétude, statut ; `MoisTemps`, `tableauFeuilles`). Feuille mensuelle = `feuilles_temps.semaine` au 1er du mois. Migration 016 : `controler_temps_saisi()` verrouille les heures d'un mois validé (fonction seule, aucune table ni donnée modifiée). Heures attendues hors jours de non-présence (`Calculs.heuresAttenduesMois`, maquette `saisie-mensuelle/`) (§ 3.2, § 3.3, § 4, § 5, § 6, § 7) |
| 1.65    | 2026-10-06 | **Envoi du daily par e-mail, réglé par équipe** (maquette `envoi-daily/`) : onglet Mon dashboard › Administration › **Envoi du daily** (administrateurs et responsables d'équipe) — mode (`MODES_ENVOI_DAILY` : Désactivé, Power Automate, Envoi direct), heure, jours, sauf fériés, destinataires ; fenêtre **« Configurer le flux »** (URI, corps avec la clé de l'équipe, pas-à-pas, aperçu, renouvellement de la clé). Migration 017 (additive) : tables `envois_daily`, `cles_envoi_daily`, fonctions `cle_envoi_daily`, `daily_equipe` (appelable sans compte avec la clé), `html_texte`. Envoi direct : réglable, envoi effectif à venir (étape 2) (§ 3.3, § 4, § 5, § 7, § 12) |
| 1.66    | 2026-10-06 | **Bulles ⓘ jamais coupées** : position calculée sur la fenêtre (`C.placerBulle`, `position: fixed`, au-dessus de l'icône s'il n'y a pas la place) — la bulle de la barre latérale était coupée par le menu qui défile (§ 2.1) |
| 1.67    | 2026-10-06 | **Envoi du daily, corrections** : (1) enregistrement refusé par la base (« null value in column destinataires ») — les chaînes vides étaient envoyées en null ; `Api.creer` accepte une liste `garderVides` (destinataires, jours) ; le serveur simulé applique désormais les colonnes NOT NULL ; (2) l'onglet ne liste que les **équipes** : une direction (ex. DSI) est un service qui regroupe des équipes, sans daily propre (§ 2.1, § 3.3, § 9) |
| 1.68    | 2026-10-06 | **Menus liés** : une personne désactivée (date de fin) disparaît de tous les écrans — Congés & capacité (grille, récap, synthèse par projet, capacité), Gestion des ressources (calendrier, annuaire), Timesheet et Suivi de mes équipes, Daily des équipes, panneau projet, sélecteurs, compteurs (`ressourcesActives`, `estActive`, etat.js) ; règle ajoutée au § 10 (point 7) ; test sur tous les écrans |
| 1.69    | 2026-10-06 | **Menus liés, correction** : une personne n'est plus masquée sur toute la période mais seulement là où elle n'est pas présente — visible avant sa date de fin (ex. Lenaic, parti le 30/09 : présent jusqu'en septembre, absent à partir d'octobre), dans le récap de l'année de son départ, et au prorata dans la capacité (`Calculs.estPresentSur`, `ressourcesPresentes`, `estPresenteSur`) ; § 10 point 7 réécrit ; test avant / après départ |
| 1.70    | 2026-10-06 | **Listes de ressources** : une personne avec une date de fin reste affichée avec le statut **Inactif** — annuaire de Gestion des ressources (colonne Statut, « fin le … ») et Liste des ressources (inactifs affichés par défaut, bouton « Masquer ») ; les écrans par période gardent la règle de présence (§ 3.2, § 3.3, § 10) |
| 1.71    | 2026-10-06 | Bouton **« Aujourd’hui »** dans Congés & capacité : grille mensuelle → mois en cours (aussi dans Général › Gestion des ressources, même composant `Calendrier`), récap annuel → année en cours, onglet Capacité → sprint en cours (actions `calendrierAujourdhui`, `capaciteAujourdhui`) (§ 3.2, § 3.3) |
| 1.72    | 2026-10-07 | **Daily par projet**, lié aux congés et aux projets (maquette `daily-par-projet/`) : Mon dashboard › Daily = une carte par projet affecté (Hier / Aujourd'hui / Blocages), jour de congé → aucun daily attendu ; Général › Daily des équipes = daily de **mes projets** seulement, le responsable d'une unité voit tous les projets de son unité et des unités rattachées. Migration 018 (additive) : table `notes_daily_projet`, fonction `peut_lire_daily_projet` (RLS), e-mail `daily_equipe` regroupé par projet et limité aux personnes présentes. Ancienne note unique conservée (« note générale ») (§ 3.2, § 3.3, § 4, § 5) |
| 1.44    | 2026-09-27 | Calcul type Scrum : formule déplacée dans une pop-in (bouton « Comment est-ce calculé ? » en haut à droite), avec un exemple chiffré sur CDO (membres, jours ouvrés, absences, cérémonies, focus) (§ 2.1, § 3.3) |

---

## 1. Objet

**ProjectDesk** (nom affiché dans l'application, paramètre `NOM_APPLICATION` de `config.js`) :
application web **multi-projets, multi-équipes** de pilotage : objectifs (OKR), projets et
roadmap, ressources, congés et capacité, feuilles de temps, notes de daily, demandes
entrantes (formulaire administrable). Maquette de référence :
`docs/maquettes/pilotage-projet/source/Pilotage_Projet.dc.html`.

La barre latérale a deux sections :
- **Général** (badge « Lecture seule ») : vue consolidée de **toutes** les équipes — **aucune
  modification possible** dans cette section, y compris pour un administrateur (règle vérifiée
  automatiquement par `tests/parcours.js`) ;
- **Mon dashboard** (badge « Édition ») : ce que l'utilisateur modifie (ses notes, ses projets,
  les congés et affectations de ses équipes, ses heures, les demandes de son équipe).

## 2. Architecture

```
┌──────────── Navigateur (app/ — HTML/CSS/JS natif, sans build, hébergé sur Vercel) ────────────┐
│ index.html → config.js · api.js · calculs.js · etat.js · composants.js · coquille.js           │
│              panneau-projet.js · modale.js · ecrans/*.js (un fichier par écran)                │
└───────┬──────────────────────────────────────────────┬────────────────────────────────────────┘
        │ 1. connexion (cookie de session)             │ 3. lecture / écriture REST
        ▼                                              │    + jeton JWT (Authorization: Bearer)
  Neon Auth (Better Auth)                              ▼
  utilisateurs · organisations (= équipes)     Neon Data API ──► Postgres « neondb »
  membres (owner/admin/member) · invitations          │          (branche production, Francfort)
        │ 2. jeton JWT (15 min)                        │          règles RLS + triggers
        └──────────────────────────────────────────────┘
```

| Élément | Valeur |
|---------|--------|
| Projet Neon | `ProjectDesk` (`dark-lake-97562553`), branche `production` |
| Neon Auth | `https://ep-lucky-mud-b1gqp3gd.neonauth.c-5.eu-central-1.aws.neon.tech/neondb/auth` |
| Data API | `https://ep-lucky-mud-b1gqp3gd.apirest.c-5.eu-central-1.aws.neon.tech/neondb/rest/v1` |
| Hébergement | Vercel, projet `project-desk` (équipe `ckitty8s-projects`), branche `main` |

Principes :
- **Aucun serveur applicatif** : le navigateur appelle Neon Auth et la Data API ; la base est
  le seul juge des droits (RLS). Les droits calculés côté écran (`etat.js`) ne servent qu'à
  masquer les boutons inutiles.
- **Aucune dépendance** JavaScript, aucun build (règle n°1). Polices IBM Plex (Google Fonts).
- Toutes les tables sont chargées à l'ouverture (volumétrie d'équipes projet) ; après chaque
  écriture, seules les tables touchées sont rechargées (`executer()` / `recharger()`). Exception :
  les notes de daily ne sont chargées que sur les `JOURS_DAILY` (90) derniers jours ; un écran peut
  déclarer `auChargement()` pour rafraîchir ses données à l'ouverture.
- **Lecture paginée** (`Api.lire`) : la Data API plafonne le nombre de lignes par réponse ; chaque table
  est lue page par page (`limit` / `offset`) jusqu'à une page vide, avec un ordre stable (tri d'affichage
  + clé unique, `ordreDe()` dans `etat.js`). Sans cela, seules les premières absences étaient chargées.
- Toutes les données sont **relues en arrière-plan** à chaque changement d'écran et au retour sur
  l'onglet du navigateur (`rafraichirDonnees()`), sans redessiner pendant une saisie : les changements
  faits ailleurs (autre utilisateur, import en base) apparaissent sans F5.
- **Chargement tolérant** (`chargerDonnees()`, incident du 2026-09-26) : chaque table est lue
  indépendamment ; une table en échec **garde ses données précédentes** (liste vide au premier
  chargement) et un message d'alerte s'affiche ; une relecture entièrement vide alors que des équipes
  étaient chargées (session ou droits momentanément perdus) est ignorée. Une lecture ne peut donc
  jamais vider l'écran — les données, elles, ne sont modifiées que par une action de l'utilisateur.

### 2.1 Fichiers de l'application

| Fichier | Rôle |
|---------|------|
| `app/js/config.js` | Nom affiché de l'application, URL Neon, paramètres métier (droit CP, sprints, heures/jour, cible d'occupation), libellés système, statuts techniques |
| `app/js/api.js` | Appels Neon Auth (session, jeton, organisations, invitations) et Data API (`lire`, `creer` avec upsert, `modifier`, `supprimer`, `executer`) ; conversion camelCase ↔ snake_case |
| `app/js/calculs.js` | **Seul endroit des règles de calcul** (§ 6) : fonctions pures |
| `app/js/etat.js` | État global, chargement, navigation, délégation d'événements (`data-action`, `data-action-change`, `data-action-saisie`, `data-action-envoi`), droits d'affichage |
| `app/js/composants.js` | Badges, pastilles, avatars, barres, onglets, KPI, listes, **bulles d'information `aide(clé)`** (textes dans `AIDES` de `config.js` ; positionnées par `placerBulle` pour n'être jamais coupées) (échappement HTML `esc`) |
| `app/js/coquille.js` | Barre latérale, en-tête, fil d'Ariane, **bouton Aide** (menu : aide sur l'écran, premiers pas, rôles et droits, contact si `CONTACT_AIDE` est renseigné ; textes `GUIDE_ECRANS` / `GUIDES` de `config.js`), bloc utilisateur |
| `app/js/panneau-projet.js` | Panneau latéral « Projet » (détail/édition) et « Nouveau projet » |
| `app/js/modale.js` | Fenêtres : méthode de calcul Scrum, affectations, fiche ressource (dont dates d’arrivée et de départ facultatives), équipe (membres, invitations), objectifs |
| `app/js/ecrans/*.js` | Un fichier par écran (§ 3) |
| `app/css/theme.css` | Jetons de la maquette (couleurs, typographie) et composants |

## 3. Menus et écrans

Captures de l'application : `docs/maquettes/etat-actuel/` (générées par `tests/parcours.js`).

### 3.1 Écrans plein écran

| Écran (`etat.ecran`) | Fichier | Rôle | Capture |
|------|---------|------|---------|
| `connexion` | `connexion.js` | Connexion / création de compte (email + mot de passe), Google | `01-connexion.png` |
| `choixEquipe` | `choix-equipe.js` | Équipes de l'utilisateur, invitations reçues ; compte sans équipe : invité à demander une invitation | `02-choix-equipe.png` |

### 3.2 Section « Général » (lecture)

| Écran | Fichier | Contenu | Capture |
|-------|---------|---------|---------|
| `dashboard` | `dashboard.js` | KPI, objectifs du trimestre (T1–T4), progression par trimestre et par équipe, projets à surveiller | `03-dashboard.png` |
| `projets` | `projets.js` | Projets groupés par équipe, filtre d'équipe, panneau en lecture | `04-projets.png` |
| `ressources` | `ressources.js` | Calendrier mensuel des absences (composant `Calendrier`, personnes présentes sur le mois) + annuaire de **toutes** les fiches avec colonne **Statut** (Actif / Inactif dès qu'une date de fin est saisie, « fin le … », inactifs grisés en fin de liste) | `05-ressources.png` |
| `administration` | `administration.js` | Onglets Équipes / Référentiels / Champs, **consultation** (lien vers Mon dashboard › Administration pour les administrateurs) | `06-administration.png` |
| `timesheet` | `timesheet.js` | Feuilles **du mois** par personne (navigation `MoisTemps`) : projets, saisi / attendu, complétude, statut ; tableau `tableauFeuilles` partagé avec Suivi de mes équipes | `07-timesheet.png` |
| `dailyEquipes` | `daily-equipes.js` | **Daily par projet** du jour (maquette `daily-par-projet/`) : seulement les projets que je peux lire (`peutLireDailyProjet` = règle `peut_lire_daily_projet` en base : affecté(e) au projet ; responsable de l'unité du projet ou d'une unité parente, ex. Anne pour Applications ; administrateur) ; filtre par projet, « Blocages du jour » (avec le projet), par projet une carte par membre affecté hors Lecteur et présent ce jour-là : sa note, ou « pas de daily » avec son absence (congés) | `17-daily-equipes.png` |

### 3.3 Section « Mon dashboard » (édition)

| Écran | Fichier | Contenu | Capture |
|-------|---------|---------|---------|
| `daily` | `daily.js` | **Un daily par projet** où je suis affecté(e) (Chef de projet, Membre ; projet en cours) — maquette `daily-par-projet/` : par projet trois champs **Hier (la veille)**, **Aujourd’hui**, **Blocages** (enregistrement auto après 0,8 s), « Hier » rappelle l'« Aujourd'hui » de la veille ; « n / N projets renseignés » ; **lié aux congés** : jour d'absence d'une journée → « aucun daily attendu », cartes repliées (demi-journée : saisie ouverte) ; historique (projets renseignés ou congé) ; ancienne note unique affichée en « note générale » | `08-daily.png` |
| `mesProjets` | `mes-projets.js` | Gantt des projets où je suis affecté ; « + Nouveau projet », « Objectifs de l'équipe » | `09-mes-projets.png`, `10-panneau-projet.png` |
| `conges` | `conges.js` | Trois **onglets** : Grille mensuelle éditable (« pinceau » par type d'absence ; sélecteur **Par équipe** (chaque personne une seule fois sous son unité, responsable en tête, étiquettes de ses projets, puis synthèse « absents / membres » par projet) / **Par projet** (membres du projet choisi + sa synthèse) — maquettes `conges-sans-doublon/`, pistes 2 et 3), Récap annuel (reprise de l'onglet « Jours de congés » du porteur : par mois T = travaillés / C = congés (fériés exclus), totaux, **reste à prendre** = total travaillé − jours attendus par le client, objectif modifiable par équipe et par année — maquette `recap-jours-travailles.png`). Onglet **Capacité** (fichier `capacite.js`, objet `Capacite`, maquette `capacite-saisie/`) : projet (CDO par défaut) et sprint parmi **les sprints saisis du projet** (‹ ›, sprint en cours par défaut ; bouton « Sprints du projet » → Administration › Sprints ; maquette `sprints-projet/`) ; indicateurs disponible / engageable / vélocité moyenne / prévision ; capacité des membres (calculée) ; **vélocité** : points engagés et terminés **saisis** par sprint, say/do ; **répartition du sprint** : idéal par catégorie (calculé) et jours réels **saisis**, écart. Champs désactivés si le projet n'est pas modifiable. Bouton **« Méthode de calcul Scrum »** en haut à droite : pop-in des formules (`Modale.methodeCapacite`, maquette `capacite-scrum/`) | `11-conges.png` |
| `listeRessources` | `liste-ressources.js` | Onglets (maquettes `arborescence-ressources.png`, `direction-espace-travail.png`, `liste-ressources-board.png`) : **Organisation** — une seule arborescence **Direction → Équipe → Projet → Membres** (rôle sur le projet), plus les personnes sans projet de chaque unité ; colonnes ressources, responsable / rôle, **début / fin** des personnes **saisis directement sur la ligne** (`date_arrivee`, `date_depart`, modifiables par l'équipe de la personne), statut (projets : statut ; personnes : **Inactif dès qu'une date de fin est saisie**, `estInactive`, badge cliquable pour rendre inactive ou réactiver ; plus de statut affiché sur les unités) ; les ressources inactives restent **affichées « Inactif »** (depuis 1.70), bouton « Masquer les ressources inactives (n) » pour les cacher ; boutons « + Ajouter une direction », « + Équipe » (déjà rattachée), « + Projet », « + Membre » (sur une unité : nouvelle fiche ; sur un projet : affectation), modifier, supprimer (unité vide seulement) ; recherche sur unités, projets et personnes ; unités dépliées et projets repliés par défaut, « Tout déplier ». **Postes** et **Types de contrat** — valeurs, nombre de ressources, statut, renommage (propagé aux fiches), suppression si inutilisée. Ouvert **sans équipe** pour un administrateur | `12-liste-ressources.png`, `18-postes.png` |
| `monTimesheet` | `mon-timesheet.js` | Sous-menu **Mon timesheet › Saisir mes heures** — saisie **mensuelle** (maquette `saisie-mensuelle/`) : une ligne par projet où je suis affecté (Chef de projet ou Membre), une colonne par jour de semaine du mois ; JF (férié), Abs (absence d'une journée), — (hors présence) non saisissables, demi-journée saisissable ; totaux par projet, par jour et du mois / attendu ; « Soumettre le mois » | `13-mon-timesheet.png` |
| `suiviEquipes` | `suivi-equipes.js` | Sous-menu **Mon timesheet › Suivi de mes équipes** (maquettes `mon-timesheet-suivi-equipes/`, `saisie-mensuelle/`) : mois choisi (‹ ›) ; indicateurs heures saisies, complétude, feuilles à compléter, feuilles à valider ; personnes de mes équipes (projets, saisi / attendu, complétude, statut) avec **Valider / Renvoyer** des feuilles soumises pour le responsable d'équipe (owner/admin). Même tableau que Général › Timesheet (`tableauFeuilles`) | `20-suivi-equipes.png` |
| `monAdmin` | `mon-admin.js` | **Envoi du daily** (administrateurs et responsables : une ligne par **équipe**, directions exclues — mode, heure, jours, sauf fériés, destinataires ; « Configurer le flux » Power Automate, fenêtre `Modale.envoiPowerAutomate`) ; **Sprints** (sprints de chaque projet : Sprint n°, année, version, début, fin ; affichage par année) ; **Équipes** (créer / modifier, membres, invitations — administrateurs et responsables) ; **Référentiels** et **Jours fériés** (administrateurs : ajout, date, libellé, suppression, par année). Ouvert sans équipe pour un administrateur. (Demandes entrantes et formulaire de demande retirés le 2026-10-05 : gérés dans Azure DevOps.) | `14-mon-admin.png` |
| `astuces` | `astuces.js` | **Trucs et astuces** (menu à part de Mon dashboard depuis le 2026-10-05, auparavant onglet d'Administration) : KPI Agile Scrum et Kanban de `KPI_AGILE`, avec un exemple chiffré par KPI calculé sur un projet choisi, CDO par défaut — « réel » si les données existent, sinon « illustratif » ; lecture seule | `19-astuces.png` |

### 3.4 Éléments ajoutés par rapport à la maquette

Nécessaires au fonctionnement, dans le style de la maquette (maquettes des compléments
validées : `docs/maquettes/pilotage-projet/complements/`) :
- écrans connexion, choix d'équipe, Mon timesheet, bloc utilisateur ;
- fenêtre **Objectifs de l'équipe** (saisie des OKR et de la progression des résultats clés) ;
- panneau **Nouveau projet** (aussi ouvert par « Créer le projet » sur une demande acceptée) : code, nom,
  description, chef de projet ; résultat clé, dates et statut ne sont pas demandés à la création
  (statut « Planifié » par défaut ; un projet sans dates n'apparaît pas dans le Gantt de Mes projets) ;
- panneau projet réduit (demande du porteur) à : nom, description, chef de projet, équipe projet
  (membres et rôles), suppression du projet — **modifiable** si `peutEditerProjet` ; objectif, résultat
  clé, période, statut, avancement et tickets n'y figurent plus (colonnes conservées en base). Ouvert
  aussi depuis l'icône ✎ d'un projet dans Liste des ressources ;
- fenêtres **fiche ressource** et **équipe** (membres Neon Auth, invitations) ;
- dans la fenêtre d'affectation, lien **« + Nouveau membre »** : crée la fiche dans l'équipe du
  projet puis revient à l'affectation, personne sélectionnée et projet coché.

## 4. Modèle de données (migrations `002_pilotage_projet.sql`, `003_lecture_administrateurs.sql`, `004_daily_equipes.sql`, `005_directions_postes_contrats.sql`, `006_direction_espace_travail.sql`, `007_valeurs_systeme_renommables.sql`, `008_type_jour_ferie.sql`, `009_demi_journees.sql`, `010_tracer_modification_definer.sql`, `011_objectifs_jours_travail.sql`, `012_dates_presence.sql`, `013_saisies_capacite.sql`, `014_sprints_saisis.sql`, `015_numero_annee_sprints.sql`, `016_feuilles_temps_mensuelles.sql`, `017_envoi_daily.sql`, `018_daily_par_projet.sql`)

Colonnes en snake_case ; l'application les manipule en camelCase (conversion dans `api.js`).
Toutes les tables métier ont `modifie_par` / `modifie_le` (trigger `tracer_modification()`).

| Table | Contenu | Clé / liens |
|-------|---------|-------------|
| `administrateurs` | Administrateurs globaux (`user_id` Neon Auth) | `user_id` |
| `equipes` | Unité = organisation Neon Auth « reconnue », espace de travail (membres, projets) : `nom`, `prefixe` (codes projet), `couleur`, `responsable_id`, `type` (`direction` / `equipe`), `parent_id` (direction de rattachement d'une équipe, un seul niveau), `actif` (une unité inactive n'est plus proposée dans le formulaire de demande) | `id` = `neon_auth.organization.id` ; `parent_id` → `equipes` |
| `referentiels` | Listes administrables : `type`, `prio`, `stp`, `stt`, `role`, `abs`, `poste`, `contrat` | `id` |
| `valeurs_referentiel` | `libelle`, `abrege`, `couleur`, `actif`, `systeme`, `cle` (clé technique d'une valeur système, ex. `chef`, `en_cours`, `cp`, `ferie` ; posable une fois puis figée), `ordre` | → `referentiels` |
| `champs_formulaire` | **Non utilisée depuis le 2026-10-05** (demandes gérées dans Azure DevOps ; table conservée en base) — formulaire de demande : `ordre`, `libelle`, `type`, `obligatoire`, `referentiel_id`, `cle`, `systeme` | |
| `jours_feries` | `jour`, `libelle` (2026–2027) | `jour` |
| `ressources` | Personnes : `equipe_id`, `nom`, `poste` (référentiel `poste`), `type_contrat` (référentiel `contrat`), `capacite` (%), `email`, `user_id` (compte lié), `date_arrivee` / `date_depart` (facultatives, départ ≥ arrivée — migration 012) | → `equipes` |
| `objectifs` | OKR : `equipe_id`, `annee`, `trimestre`, `code`, `titre`, `confiance` | → `equipes` |
| `resultats_cles` | `objectif_id`, `code`, `libelle`, `progression` (0–100) | → `objectifs` |
| `projets` | `code` (unique), `nom`, `equipe_id`, `resultat_cle_id`, `chef_id`, `debut`, `fin`, `statut`, `avancement` | → `equipes`, `resultats_cles`, `ressources` |
| `affectations` | `projet_id`, `ressource_id`, `role` (Chef de projet / Membre / Lecteur) | unique (projet, ressource) |
| `tickets` | **Non utilisée** : la notion de ticket est retirée de l'application (2026-09-27) ; table vide conservée en base en attendant l'accord du porteur pour la supprimer | → `projets` |
| `objectifs_jours_travail` | Jours de travail attendus par le client : `equipe_id`, `annee`, `jours` (défaut `JOURS_TRAVAIL_CLIENT_DEFAUT` = 218 si absent) | clé (équipe, année) |
| `sprints_projet` | **Sprints de chaque projet** : `projet_id`, `numero` (attribué à l'ajout), `nom` (version), `debut`, `fin` (saisis dans Administration › Sprints — migration 014), `numero_sprint` (affiché « Sprint N ») et `annee` (migration 015 ; un numéro par projet et par année), `points_engages`, `points_termines` (onglet Capacité — migration 013) | clé (projet, sprint) → `projets` |
| `repartitions_sprint` | Jours réellement passés par catégorie (onglet Capacité) : `projet_id`, `numero`, `categorie` (libellé de `REPARTITION_SPRINT`), `jours` — migration 013 | clé (projet, sprint, catégorie) → `projets` |
| `envois_daily` | **Envoi du daily par équipe** (migration 017) : `equipe_id` (clé), `mode` (aucun / power_automate / direct), `heure`, `jours` (« 1,2,3,4,5 », 1 = lundi), `sans_feries`, `destinataires` (adresses séparées par des virgules) | une ligne par équipe |
| `cles_envoi_daily` | Clé secrète d'une équipe pour lire son daily sans compte (`equipe_id`, `cle`) ; **aucun droit direct** : lue seulement par `cle_envoi_daily` et `daily_equipe` | une ligne par équipe |
| `absences` | `ressource_id`, `jour`, `type`, `duree` (1 = journée, 0,5 = demi-journée ; migration 009) | clé (ressource, jour) |
| `temps_saisis` | `ressource_id`, `projet_id`, `jour`, `heures` | unique (ressource, projet, jour) |
| `feuilles_temps` | `ressource_id`, `semaine` (**1er jour du mois** : feuille mensuelle depuis 1.64 ; un lundi pour les anciennes feuilles hebdomadaires), `statut` (en_saisie / soumise / validee / a_completer), `commentaire` | clé (ressource, semaine) |
| `notes_daily` | `user_id`, `jour`, `texte` — ancienne note unique du jour (avant 1.72), conservée et affichée en « note générale » | clé (user, jour) |
| `notes_daily_projet` | **Daily par projet** (migration 018) : `user_id`, `jour`, `projet_id`, `texte` (format des rubriques Hier / Aujourd'hui / Blocages) | clé (user, jour, projet) |
| `demandes` | **Non utilisée depuis le 2026-10-05** (demandes gérées dans Azure DevOps ; table et données conservées en base) — `numero` (DEM-047), `titre`, `type`, `description`, `equipe_id`, `priorite`, `date_souhaitee`, `budget`, `valeurs` (jsonb des champs ajoutés), `statut` (nouvelle / analyse / acceptee / refusee), `commentaire`, `demandeur_id`, `demandeur_nom`, `service`, `projet_id` | → `equipes`, `projets` |
| `neon_auth.*` | Utilisateurs, sessions, organisations, membres, invitations | gérées par Neon Auth — **ne pas modifier** |

Historique : la migration `001_schema_initial.sql` (Roadmap PM) créait `demandes` (backlog) et
`capacites` ; toutes deux ont été supprimées par la migration 002 (tables vides). La migration
005 créait une table `directions` (regroupement sans espace de travail) ; la migration 006 l'a
remplacée par `equipes.type` / `equipes.parent_id` (table vide, accord du porteur).

Les **libellés système** (statuts de projet, rôles, « Congés payés ») sont
utilisés par les calculs et les droits. Depuis la migration 007 ils sont **renommables** par un
administrateur : chaque valeur système porte une clé technique `cle` (non modifiable), l'app
remplace au chargement les constantes de `config.js` par les libellés actuels
(`synchroniserLibellesSysteme()` dans `etat.js`, table `LIBELLES_SYSTEME`), la fonction
`peut_editer_projet` reconnaît les rôles par leur clé, les valeurs par défaut des colonnes passent
par `libelle_systeme(referentiel, cle)`, et le trigger `propager_renommage_valeur()` recopie le
nouveau libellé dans les données (projets, affectations, absences, demandes, ressources).
Une valeur système reste non supprimable (trigger `proteger_valeur_systeme()`) ; on peut la désactiver.
Le type d'absence de clé `ferie` (« Jours férié », migration 008) sert à afficher **par défaut** les
jours de la table `jours_feries` dans les calendriers (couleur et abrégé du type ; « F » gris s'il est
désactivé) ; ces cases ne sont ni cliquables ni décomptées.

## 5. Sécurité

### 5.1 Fonctions (SECURITY DEFINER)

| Fonction | Rôle |
|----------|------|
| `mes_equipes()` | Équipes (enregistrées dans `equipes`) dont l'utilisateur est membre Neon Auth |
| `est_membre_equipe()` | Au moins une équipe → droit de lecture global |
| `est_admin()` | Présent dans `administrateurs` |
| `est_responsable_equipe(equipe)` | Rôle `owner` ou `admin` dans l'organisation |
| `mes_ressources()` | Fiches ressources liées au compte |
| `peut_editer_projet(projet)` | Membre de l'équipe du projet, ou affecté « Chef de projet » / « Membre » |
| `lier_ma_ressource()` | Lie le compte à la fiche ressource de même email (appelée à la connexion) |
| `cle_envoi_daily(équipe, renouveler)` | Clé d'envoi du daily d'une équipe (créée au besoin, renouvelable) — administrateurs et responsable de l'équipe seulement |
| `daily_equipe(équipe, clé, jour)` | Daily de l'équipe prêt à envoyer (`objet`, `html`, `texte`, `destinataires`, `a_envoyer`) ; exécutable par `anonymous` **avec la bonne clé** (flux Power Automate) ; depuis 1.72 **regroupé par projet** de l'équipe (projets en cours, membres hors Lecteur présents ce jour-là, sans daily / absents, blocages en tête) |
| `peut_lire_daily_projet(projet)` | Règle de lecture du daily d'un projet (RLS de `notes_daily_projet`) |
| `libelle_systeme(referentiel, cle)` | Libellé actuel d'une valeur système (valeurs par défaut des colonnes) |
| `partage_une_equipe(user)` | L'utilisateur connecté partage au moins une équipe avec `user` (lecture des daily) |

### 5.2 Matrice des droits (RLS)

| Tables | Lecture | Écriture |
|--------|---------|----------|
| `equipes`, `referentiels`, `valeurs_referentiel`, `champs_formulaire`, `jours_feries` | tout utilisateur connecté | administrateurs |
| `administrateurs` | administrateurs (et sa propre ligne) | administrateurs |
| `ressources` | membres, administrateurs | équipe concernée, administrateurs |
| `objectifs`, `resultats_cles` | membres, administrateurs | équipe concernée |
| `projets` | membres, administrateurs | création : équipe ; modification : `peut_editer_projet` ; suppression : équipe |
| `affectations`, `tickets` | membres, administrateurs | `peut_editer_projet` |
| `objectifs_jours_travail` | membres, administrateurs | administrateurs, responsables de l'équipe |
| `sprints_projet`, `repartitions_sprint` | membres, administrateurs | `peut_editer_projet`, administrateurs |
| `envois_daily` | membres, administrateurs | responsable de l'équipe (`est_responsable_equipe`), administrateurs |
| `cles_envoi_daily` | personne (fonctions seulement) | personne (fonctions seulement) |
| `absences`, `temps_saisis`, `feuilles_temps` | membres, administrateurs | la personne elle-même ou son équipe |
| `notes_daily` | auteur, personnes partageant une équipe avec lui, administrateurs | auteur |
| `notes_daily_projet` | auteur ; `peut_lire_daily_projet(projet)` : affectés au projet, responsable (fiche `responsable_id` ou owner/admin) de l'unité du projet ou d'une unité parente, administrateurs | auteur |
| `demandes` | le demandeur (les siennes), les membres et les administrateurs | dépôt : tout connecté (en son nom, statut « nouvelle ») ; traitement : équipe destinataire |
| toutes | — | rôle `anonymous` : aucun droit |

Le trigger de traçabilité `tracer_modification()` est `SECURITY DEFINER` (migration 010) : le rôle
`authenticated` n'a pas l'usage du schéma `auth` (propriété de Neon), seules les fonctions à droits du
propriétaire peuvent appeler `auth.user_id()` à l'exécution (les règles RLS et valeurs par défaut, déjà
résolues, n'en ont pas besoin). Toute nouvelle fonction PL/pgSQL appelant `auth.user_id()` doit donc être
`SECURITY DEFINER` avec `search_path = ''`.

Contrôles complémentaires (triggers) : `controler_feuille_temps()` (validation/renvoi réservés
au responsable ; feuille validée figée), `controler_temps_saisi()` (heures d'un mois validé —
ou d'une ancienne semaine validée — non modifiables, migration 016), `controler_suppression_equipe()` (unité avec ressources, projets ou équipes rattachées non
supprimable), `controler_rattachement_equipe()` (une équipe ne se rattache qu'à une direction ;
une direction n'est rattachée à rien et ne redevient « équipe » que sans équipes rattachées), `propager_renommage_valeur()`
(renommer un poste / type de contrat met à jour les fiches ressources), `controler_suppression_valeur()`
(poste / type de contrat utilisé non supprimable).

Tests réalisés en base (bloc annulé, sans jeton) : aucune donnée métier lisible, insertion
refusée sur `referentiels`, `administrateurs` et `demandes` (usurpation).

## 6. Règles de calcul (`app/js/calculs.js`)

| Règle | Fonction |
|-------|----------|
| Projets actifs = statut ≠ « Terminé » | `Calculs.projetsActifs` |
| Avancement moyen = moyenne des `avancement` | `Calculs.avancementMoyen` |
| À surveiller = « À risque », « En retard » ou échéance ≤ `ALERTE_ECHEANCE_JOURS` | `Calculs.projetsASurveiller` |
| Progression d'un objectif = moyenne de ses résultats clés | `Calculs.progressionObjectif` |
| Atteinte trimestrielle d'une équipe = moyenne des objectifs du trimestre | `Calculs.atteinteTrimestre` |
| Récap congés : jours par type (demi-journée = 0,5), solde CP = `DROIT_CP_ANNUEL` − CP pris | `Calculs.recapConges` |
| Jours travaillés (mois) : sur les jours de semaine, C = absences de tout type hors jours fériés (demi-journée = 0,5), T = jours de semaine − fériés − C ; jours hors présence (avant `date_arrivee`, après `date_depart`) exclus, mois entièrement hors présence affichés « — » ; reste à prendre = Σ T − objectif client proratisé (objectif × jours de semaine de présence ÷ jours de semaine de l'année, arrondi à 0,5) | `Calculs.joursTravaillesMois`, `Calculs.recapJoursTravailles` |
| Vélocité : moyenne des points terminés saisis sur les `SPRINTS_MOYENNE_VELOCITE` (3) sprints précédents ; prévision = vélocité × capacité du sprint ÷ capacité moyenne de ces sprints ; say/do = terminés ÷ engagés | `Calculs.velocite` |
| Répartition idéale d'un sprint : jours par catégorie = disponible × part (`Calculs.repartitionSprint`), comparée aux jours réels saisis ; parts `REPARTITION_SPRINT` (User stories 40, Incidents prod 10, Bugs qualif 10, Tests 10, Technique 8, Documentation 5, Autres 2, Cérémonies 15 %) — proposition à valider par le porteur | `config.js` |
| Capacité type Scrum (exemples des KPI Agile, Trucs et astuces) : engageable = (disponible − Σ capacité × `CEREMONIES_JOURS_SPRINT`) × `FACTEUR_FOCUS` | `Calculs.capaciteScrum` |
| Synthèse d'un projet : absents du jour / membres (demi-journée = 0,5) ; « partiel » si ≥ 1 absent, « critique » si plus de la moitié | `Calculs.absentsDuJour` |
| Capacité (j-h) : Σ jours ouvrés × capacité, disponible = hors absences (demi-journée = 0,5) ; jours hors présence de la personne exclus (`Calculs.estPresent`) | `Calculs.capacitePeriode` |
| Sprints de 14 jours numérotés depuis `SPRINT_REFERENCE` (fin = vendredi de la 2e semaine) | `Calculs.sprintDe` |
| Heures attendues = (jours de semaine hors fériés − absences, demi-journée = 0,5, hors jours de non-présence) × `HEURES_PAR_JOUR` × capacité ; au mois pour le timesheet, à la semaine pour le taux d'occupation du Dashboard | `Calculs.heuresAttenduesMois`, `Calculs.heuresAttendues` |
| Taux d'occupation = heures saisies / heures attendues (semaine courante) | `Calculs.tauxOccupation` |
| Code projet suivant = PREFIXE-(max + 1) | `Calculs.prochainCodeProjet` |
| Jours ouvrés : hors week-ends et `jours_feries` | `Calculs.estJourOuvre` |
| Note de daily découpée en rubriques (ligne sans tiret = titre, ex. Hier / Aujourd'hui / Blocages) | `Calculs.rubriquesDaily` |
| Blocages = lignes de la rubrique « Blocages », hors « Aucun », « RAS », « néant », « rien » | `Calculs.blocagesDaily` |

## 7. Parcours principaux

1. **Connexion** → `lier_ma_ressource()` → chargement des organisations, invitations et tables
   → rôles par équipe (`get-full-organization`).
   - Email / mot de passe : `/sign-in/email`, puis `/get-session`.
   - Google : `/sign-in/social` (retour = page de l'application) → Google → Neon Auth → retour
     sur l'application avec `?neon_auth_session_verifier=…`, que `/get-session` échange contre la
     session (même mécanisme que le kit officiel `@neondatabase/neon-js`) ; le paramètre est
     ensuite retiré de l'adresse. En cas d'échec, `?error=…` est traduit sur l'écran de connexion.
   - Jeton de la Data API : en-tête `set-auth-jwt` de `/get-session`, sinon `/token` ; renouvelé
     une minute avant expiration (15 min).
2. **Écran d'arrivée** :
   - une seule équipe (ou équipe mémorisée sur le poste) → ouverte directement, dashboard ;
   - plusieurs équipes sans mémoire → écran de choix d'équipe ;
   - administrateur sans équipe → directement dans l'outil (dashboard, ou Administration si
     aucune équipe n'existe, Mon dashboard › Administration) ; les autres écrans « Mon dashboard »
     l'invitent à ouvrir/créer une équipe ;
   - compte sans équipe ni droit d'administration → écran de choix d'équipe (attente d'une invitation).
3. **Création d'équipe** (administrateur) : organisation Neon Auth (le créateur en devient
   `owner`) puis ligne `equipes` ; si aucune équipe n'était ouverte, la nouvelle s'ouvre. Invitation de membres par email (fenêtre équipe) ; la personne
   accepte depuis l'écran de choix d'équipe.
4. **Demande** : retiré le 2026-10-05 — les demandes sont gérées dans Azure DevOps.
5. **Temps** (mensuel) : saisie (`temps_saisis`) → « Soumettre le mois » (`feuilles_temps.statut = soumise`, semaine = 1er du mois)
   → Valider / Renvoyer (responsable).

6. **Envoi du daily (Power Automate)** : Administration › Envoi du daily → mode « Power Automate » → « Configurer le flux » (clé de l'équipe) → flux planifié : HTTP POST `…/rpc/daily_equipe` {p_equipe, p_cle} → si `a_envoyer` → « Envoyer un e-mail (V2) » (objet, html, destinataires).

## 8. Déploiement

- `vercel.json` redirige `/` vers `/app/` et envoie `Cache-Control: no-cache` pour tout le site (`/(.*)`, dont `/app/`) (le
  navigateur revalide les fichiers : une nouvelle version est prise au rechargement) ; site statique, sans build.
- Les lectures Data API sont faites avec `cache: 'no-store'` (`api.js`) : sans cela le navigateur
  pouvait resservir une ancienne réponse après une écriture (données à jour seulement après F5).
- Vercel publie la branche `main`.
- Domaines de confiance déclarés dans Neon Auth (sinon : « Invalid callbackURL » / « Invalid origin ») :

| Domaine | Nature |
|---------|--------|
| `https://project-desk-sepia.vercel.app` | **Adresse de production** (celle à communiquer aux utilisateurs) |
| `https://project-desk-ckitty8s-projects.vercel.app` | Adresse stable de l'équipe Vercel |
| `https://project-desk-git-main-ckitty8s-projects.vercel.app` | Adresse de la branche `main` |
| `https://project-desk-jusy2piap-ckitty8s-projects.vercel.app` | Un déploiement précis (change à chaque déploiement) |
| `localhost` | Développement |

  Ne déclarer **que des adresses appartenant au projet Vercel** (`project-desk.vercel.app`,
  déclarée par erreur puis retirée, appartient à un autre projet). En cas d'adresse refusée,
  l'écran de connexion affiche l'adresse exacte à ajouter.
  Tout nouveau domaine doit être ajouté (Console Neon → Auth → Domains). Les adresses de
  prévisualisation par déploiement ne sont volontairement pas couvertes par un joker
  (`*.vercel.app` autoriserait des sites tiers).
- Premier administrateur : après création de son compte, insérer son identifiant dans
  `administrateurs` (voir `app/README.md`).

## 9. Tests

| Outil | Contenu |
|-------|---------|
| `tests/serveur-simule.js` | Neon Auth (dont Google simulé) + Data API simulés en mémoire, données de la maquette (comptes `camille@test.fr` administratrice/owner, `thomas@test.fr` membre, `elodie@test.fr` demandeuse, `admin@test.fr` administratrice sans équipe ; mot de passe `motdepasse`) |
| `tests/parcours.js` | Parcours Playwright de bout en bout (69 contrôles, dont « Général en lecture seule », l'aller-retour Google simulé, le parcours administrateur sans équipe le daily des équipes et le board des ressources) + captures `docs/maquettes/etat-actuel/` |
| `scripts/verifier-docs.js` | Cohérence documentation ↔ code après chaque commit (§ 11) |

Les règles RLS ne sont pas simulées : elles sont vérifiées en base et lors de la recette réelle.

## 10. Points de cohérence (avant toute nouvelle fonctionnalité)

1. Liste métier modifiable par les utilisateurs → référentiel en base (`valeurs_referentiel`),
   jamais en dur ; constante technique → `config.js`.
2. Calcul métier → `calculs.js` (fonction pure), cité au § 6.
3. Nouvelle table → migration numérotée `db/migrations/NNN_*.sql` (jamais modifier une migration
   appliquée), GRANT + RLS + trigger de traçabilité, citée au § 4 et au § 5.2. **Après
   application, recharger le cache de schéma de la Data API en réenregistrant sa configuration**
   (console Neon › Data API › Save, ou outil MCP `update_data_api` avec les mêmes réglages) **avant**
   de publier le code. `notify pgrst, 'reload schema'` **ne suffit pas** sur Neon (constaté deux fois) :
   sans rechargement, l'app affiche « Could not find the table … in the schema cache » ou
   « column … does not exist » (colonne supprimée encore connue du cache).
4. Nouvel écran → fichier `app/js/ecrans/`, entrée de menu dans `coquille.js`, balise `<script>`
   dans `index.html`, maquette PNG validée, ligne au § 3, capture dans `tests/parcours.js`.
5. Droits : toujours en base (RLS) ; `etat.js` ne fait que masquer.
6. **Section Général = lecture seule** : un écran `section: 'general'` n'affiche aucun champ,
   formulaire ni action d'écriture ; toute modification va dans « Mon dashboard ». Une nouvelle
   action de lecture utilisée en Général doit être ajoutée à `ACTIONS_LECTURE` dans `tests/parcours.js`.
7. **Menus liés : une personne apparaît là où elle est présente.** Toute liste de personnes part de
   `etat.js` — jamais de `etat.d.ressources` directement : écran sur une période (mois de la grille,
   année du récap, mois du timesheet, sprint, jour du daily) → `ressourcesPresentes(debut, fin)` /
   `estPresenteSur(id, debut, fin)` (`Calculs.estPresentSur` : arrivée ≤ fin et départ ≥ début) ;
   écran « maintenant » (annuaire, sélecteurs, compteurs) → `ressourcesActives()` / `estActive(id)`.
   Une personne partie le 30/09 reste visible en septembre et disparaît à partir d'octobre. Exception :
   les **listes de ressources** (annuaire de Gestion des ressources, Liste des ressources) montrent
   toutes les fiches, la personne y passe « Inactif » dès que sa date de fin est saisie. Les données restent en base (règle n°8).
- Explication d'un élément (règle de calcul, droit, statut) → bulle `C.aide('clé')`, texte ajouté à
  `AIDES` dans `config.js` (un seul endroit pour les textes d'aide). Nouvel écran → ajouter son guide
  dans `GUIDE_ECRANS` (bouton Aide › « Aide sur cet écran »).

## 11. Outillage qualité documentaire

`scripts/verifier-docs.js` (Node.js, sans dépendance) contrôle après chaque commit :

| Contrôle | Source (code) | Cible |
|----------|---------------|-------|
| Documents présents | — | `README.md`, `CLAUDE.md`, `docs/DAT.md`, `app/README.md` |
| Écrans décrits | fichiers `app/js/ecrans/*.js` | § 3 |
| Menus décrits | identifiants des menus de `app/js/coquille.js` | § 3 |
| Fonctions de calcul existantes | fonctions « Calculs.… » citées au § 6 | `app/js/calculs.js` |
| Captures existantes | fichiers `.png` cités | `docs/maquettes/**` |
| Tables décrites | `create table` des migrations | § 4 |
| DAT suivi | code ou SQL modifié dans le dernier commit | `docs/DAT.md` modifié aussi |

Activation du hook, une fois par poste : `git config core.hooksPath .githooks`.

## 12. Points ouverts

| # | Sujet | État |
|---|-------|------|
| O1 | Recherche ⌘K (en-tête) | Affichée, inactive — à concevoir |
| O2 | Pièces jointes des demandes (stockage de fichiers) | Champ affiché, non fonctionnel — Neon Object Storage envisageable |
| O3 | Connexion Google : identifiants partagés de Neon | À remplacer par ceux du projet avant la production |
| O4 | Invitations par email (nécessite la vérification d'email) | Désactivées : invitations visibles dans l'écran de choix d'équipe |
| O5 | Gestion des administrateurs globaux depuis l'application | Aujourd'hui par SQL (table `administrateurs`) |
| O6 | Indicateurs « évolution vs trimestre précédent » de la maquette (+2 vs T3…) | Non calculés (pas d'historique figé) |
| O7 | Recette réelle (connexion, RLS avec jetons réels) | À faire par le porteur (le conteneur de développement n'accède pas à Neon Auth) |
| O8 | Envoi **direct** du daily (étape 2) | Réglable dans Administration › Envoi du daily ; envoi effectif à brancher (tâche planifiée Vercel + service d'envoi, clé saisie par le porteur dans Vercel) |
