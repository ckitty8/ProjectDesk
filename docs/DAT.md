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

---

## 1. Objet

**ProjectDesk** (nom affiché dans l'application, paramètre `NOM_APPLICATION` de `config.js`) :
application web **multi-projets, multi-équipes** de pilotage : objectifs (OKR), projets et
roadmap, tickets, ressources, congés et capacité, feuilles de temps, notes de daily, demandes
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

### 2.1 Fichiers de l'application

| Fichier | Rôle |
|---------|------|
| `app/js/config.js` | Nom affiché de l'application, URL Neon, paramètres métier (droit CP, sprints, heures/jour, cible d'occupation), libellés système, statuts techniques |
| `app/js/api.js` | Appels Neon Auth (session, jeton, organisations, invitations) et Data API (`lire`, `creer` avec upsert, `modifier`, `supprimer`, `executer`) ; conversion camelCase ↔ snake_case |
| `app/js/calculs.js` | **Seul endroit des règles de calcul** (§ 6) : fonctions pures |
| `app/js/etat.js` | État global, chargement, navigation, délégation d'événements (`data-action`, `data-action-change`, `data-action-saisie`, `data-action-envoi`), droits d'affichage |
| `app/js/composants.js` | Badges, pastilles, avatars, barres, onglets, KPI, listes (échappement HTML `esc`) |
| `app/js/coquille.js` | Barre latérale, en-tête, fil d'Ariane, bloc utilisateur |
| `app/js/panneau-projet.js` | Panneau latéral « Projet » (détail/édition) et « Nouveau projet » |
| `app/js/modale.js` | Fenêtres : affectations, fiche ressource, équipe (membres, invitations), objectifs |
| `app/js/ecrans/*.js` | Un fichier par écran (§ 3) |
| `app/css/theme.css` | Jetons de la maquette (couleurs, typographie) et composants |

## 3. Menus et écrans

Captures de l'application : `docs/maquettes/etat-actuel/` (générées par `tests/parcours.js`).

### 3.1 Écrans plein écran

| Écran (`etat.ecran`) | Fichier | Rôle | Capture |
|------|---------|------|---------|
| `connexion` | `connexion.js` | Connexion / création de compte (email + mot de passe), Google | `01-connexion.png` |
| `choixEquipe` | `choix-equipe.js` | Équipes de l'utilisateur, invitations reçues, accès demandeur | `02-choix-equipe.png` |
| `demandeur` | `espace-demandeur.js` | Formulaire de demande (champs administrés) + « Mes demandes » | `16-espace-demandeur.png` |

### 3.2 Section « Général » (lecture)

| Écran | Fichier | Contenu | Capture |
|-------|---------|---------|---------|
| `dashboard` | `dashboard.js` | KPI, objectifs du trimestre (T1–T4), progression par trimestre et par équipe, projets à surveiller | `03-dashboard.png` |
| `projets` | `projets.js` | Projets groupés par équipe, filtre d'équipe, tickets dépliables, panneau en lecture | `04-projets.png` |
| `ressources` | `ressources.js` | Calendrier mensuel des absences (composant `Calendrier`) + annuaire | `05-ressources.png` |
| `administration` | `administration.js` | Onglets Équipes / Référentiels / Champs, **consultation** (lien vers Mon dashboard › Administration pour les administrateurs) | `06-administration.png` |
| `timesheet` | `timesheet.js` | Heures par personne et par jour d'une semaine, complétude, statut des feuilles | `07-timesheet.png` |
| `dailyEquipes` | `daily-equipes.js` | Daily des membres de mes équipes pour un jour : filtre d'équipe, « Blocages du jour », membres sans note (et absence) — maquette `daily-equipes.png` | `17-daily-equipes.png` |

### 3.3 Section « Mon dashboard » (édition)

| Écran | Fichier | Contenu | Capture |
|-------|---------|---------|---------|
| `daily` | `daily.js` | Ma note du jour (enregistrement auto après 0,8 s ; lisible par mes coéquipiers), modèle, historique | `08-daily.png` |
| `mesProjets` | `mes-projets.js` | Gantt des projets où je suis affecté ; « + Nouveau projet », « Objectifs de l'équipe » | `09-mes-projets.png`, `10-panneau-projet.png` |
| `conges` | `conges.js` | Trois **onglets** : Grille mensuelle éditable (« pinceau » par type d'absence), Récap annuel (mêmes personnes que la grille), Capacité par sprint | `11-conges.png` |
| `listeRessources` | `liste-ressources.js` | Onglets (maquettes `arborescence-ressources.png`, `direction-espace-travail.png`, `liste-ressources-board.png`) : **Organisation** — une seule arborescence **Direction → Équipe → Projet → Membres** (rôle sur le projet), plus les personnes sans projet de chaque unité ; colonnes ressources, responsable / rôle, statut ; boutons « + Ajouter une direction », « + Équipe » (déjà rattachée), « + Projet », « + Membre » (sur une unité : nouvelle fiche ; sur un projet : affectation), modifier, supprimer (unité vide seulement) ; recherche sur unités, projets et personnes ; unités dépliées et projets repliés par défaut, « Tout déplier ». **Postes** et **Types de contrat** — valeurs, nombre de ressources, statut, renommage (propagé aux fiches), suppression si inutilisée. Ouvert **sans équipe** pour un administrateur | `12-liste-ressources.png`, `18-postes.png` |
| `monTimesheet` | `mon-timesheet.js` | Saisie de mes heures, soumission ; validation/renvoi par le responsable d'équipe | `13-mon-timesheet.png` |
| `monAdmin` | `mon-admin.js` | Demandes adressées à mon équipe (colonnes + fiche de traitement) ; formulaire de demande + aperçu ; **Équipes** (créer / modifier, membres, invitations — administrateurs et responsables) ; **Référentiels** (administrateurs). Ouvert sans équipe pour un administrateur | `14-mon-admin.png`, `15-formulaire.png` |

### 3.4 Éléments ajoutés par rapport à la maquette

Nécessaires au fonctionnement, dans le style de la maquette (maquettes des compléments
validées : `docs/maquettes/pilotage-projet/complements/`) :
- écrans connexion, choix d'équipe, espace demandeur, Mon timesheet, bloc utilisateur ;
- fenêtre **Objectifs de l'équipe** (saisie des OKR et de la progression des résultats clés) ;
- panneau **Nouveau projet** (aussi ouvert par « Créer le projet » sur une demande acceptée) : code, nom,
  description, chef de projet ; résultat clé, dates et statut ne sont pas demandés à la création
  (statut « Planifié » par défaut ; un projet sans dates n'apparaît pas dans le Gantt de Mes projets) ;
- **ajout / statut de tickets** dans le panneau projet ; panneau projet **modifiable** (nom, description,
  chef, début, fin, statut, avancement, suppression du projet), ouvert aussi depuis l'icône ✎ d'un
  projet dans Liste des ressources ;
- fenêtres **fiche ressource** et **équipe** (membres Neon Auth, invitations) ;
- dans la fenêtre d'affectation, lien **« + Nouveau membre »** : crée la fiche dans l'équipe du
  projet puis revient à l'affectation, personne sélectionnée et projet coché.

## 4. Modèle de données (migrations `002_pilotage_projet.sql`, `003_lecture_administrateurs.sql`, `004_daily_equipes.sql`, `005_directions_postes_contrats.sql`, `006_direction_espace_travail.sql`, `007_valeurs_systeme_renommables.sql`)

Colonnes en snake_case ; l'application les manipule en camelCase (conversion dans `api.js`).
Toutes les tables métier ont `modifie_par` / `modifie_le` (trigger `tracer_modification()`).

| Table | Contenu | Clé / liens |
|-------|---------|-------------|
| `administrateurs` | Administrateurs globaux (`user_id` Neon Auth) | `user_id` |
| `equipes` | Unité = organisation Neon Auth « reconnue », espace de travail (membres, projets, demandes) : `nom`, `prefixe` (codes projet), `couleur`, `responsable_id`, `type` (`direction` / `equipe`), `parent_id` (direction de rattachement d'une équipe, un seul niveau), `actif` (une unité inactive n'est plus proposée dans le formulaire de demande) | `id` = `neon_auth.organization.id` ; `parent_id` → `equipes` |
| `referentiels` | Listes administrables : `type`, `prio`, `stp`, `stt`, `role`, `abs`, `poste`, `contrat` | `id` |
| `valeurs_referentiel` | `libelle`, `abrege`, `couleur`, `actif`, `systeme`, `cle` (clé technique d'une valeur système, ex. `chef`, `en_cours`, `cp`), `ordre` | → `referentiels` |
| `champs_formulaire` | Formulaire de demande : `ordre`, `libelle`, `type`, `obligatoire`, `referentiel_id`, `cle`, `systeme` | |
| `jours_feries` | `jour`, `libelle` (2026–2027) | `jour` |
| `ressources` | Personnes : `equipe_id`, `nom`, `poste` (référentiel `poste`), `type_contrat` (référentiel `contrat`), `capacite` (%), `email`, `user_id` (compte lié) | → `equipes` |
| `objectifs` | OKR : `equipe_id`, `annee`, `trimestre`, `code`, `titre`, `confiance` | → `equipes` |
| `resultats_cles` | `objectif_id`, `code`, `libelle`, `progression` (0–100) | → `objectifs` |
| `projets` | `code` (unique), `nom`, `equipe_id`, `resultat_cle_id`, `chef_id`, `debut`, `fin`, `statut`, `avancement` | → `equipes`, `resultats_cles`, `ressources` |
| `affectations` | `projet_id`, `ressource_id`, `role` (Chef de projet / Membre / Lecteur) | unique (projet, ressource) |
| `tickets` | `projet_id`, `numero` (ex. PF-14.3), `titre`, `statut`, `priorite`, `assigne_id` | → `projets` |
| `absences` | `ressource_id`, `jour`, `type` | clé (ressource, jour) |
| `temps_saisis` | `ressource_id`, `projet_id`, `jour`, `heures` | unique (ressource, projet, jour) |
| `feuilles_temps` | `ressource_id`, `semaine` (lundi), `statut` (en_saisie / soumise / validee / a_completer), `commentaire` | clé (ressource, semaine) |
| `notes_daily` | `user_id`, `jour`, `texte` | clé (user, jour) |
| `demandes` | `numero` (DEM-047), `titre`, `type`, `description`, `equipe_id`, `priorite`, `date_souhaitee`, `budget`, `valeurs` (jsonb des champs ajoutés), `statut` (nouvelle / analyse / acceptee / refusee), `commentaire`, `demandeur_id`, `demandeur_nom`, `service`, `projet_id` | → `equipes`, `projets` |
| `neon_auth.*` | Utilisateurs, sessions, organisations, membres, invitations | gérées par Neon Auth — **ne pas modifier** |

Historique : la migration `001_schema_initial.sql` (Roadmap PM) créait `demandes` (backlog) et
`capacites` ; toutes deux ont été supprimées par la migration 002 (tables vides). La migration
005 créait une table `directions` (regroupement sans espace de travail) ; la migration 006 l'a
remplacée par `equipes.type` / `equipes.parent_id` (table vide, accord du porteur).

Les **libellés système** (statuts de projet et de ticket, rôles, « Congés payés ») sont
utilisés par les calculs et les droits. Depuis la migration 007 ils sont **renommables** par un
administrateur : chaque valeur système porte une clé technique `cle` (non modifiable), l'app
remplace au chargement les constantes de `config.js` par les libellés actuels
(`synchroniserLibellesSysteme()` dans `etat.js`, table `LIBELLES_SYSTEME`), la fonction
`peut_editer_projet` reconnaît les rôles par leur clé, les valeurs par défaut des colonnes passent
par `libelle_systeme(referentiel, cle)`, et le trigger `propager_renommage_valeur()` recopie le
nouveau libellé dans les données (projets, tickets, affectations, absences, demandes, ressources).
Une valeur système reste non supprimable (trigger `proteger_valeur_systeme()`) ; on peut la désactiver.

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
| `absences`, `temps_saisis`, `feuilles_temps` | membres, administrateurs | la personne elle-même ou son équipe |
| `notes_daily` | auteur, personnes partageant une équipe avec lui, administrateurs | auteur |
| `demandes` | le demandeur (les siennes), les membres et les administrateurs | dépôt : tout connecté (en son nom, statut « nouvelle ») ; traitement : équipe destinataire |
| toutes | — | rôle `anonymous` : aucun droit |

Contrôles complémentaires (triggers) : `controler_feuille_temps()` (validation/renvoi réservés
au responsable ; feuille validée figée), `controler_temps_saisi()` (heures d'une semaine validée
non modifiables), `controler_suppression_equipe()` (unité avec ressources, projets ou équipes rattachées non
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
| Récap congés : jours par type, solde CP = `DROIT_CP_ANNUEL` − CP pris | `Calculs.recapConges` |
| Capacité (j-h) : Σ jours ouvrés × capacité, disponible = hors absences | `Calculs.capacitePeriode` |
| Sprints de 14 jours numérotés depuis `SPRINT_REFERENCE` (fin = vendredi de la 2e semaine) | `Calculs.sprintDe`, `Calculs.sprintsAutour` |
| Heures attendues = jours ouvrés non absents × `HEURES_PAR_JOUR` × capacité | `Calculs.heuresAttendues` |
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
   - compte sans équipe ni droit d'administration → espace demandeur.
3. **Création d'équipe** (administrateur) : organisation Neon Auth (le créateur en devient
   `owner`) puis ligne `equipes` ; si aucune équipe n'était ouverte, la nouvelle s'ouvre. Invitation de membres par email (fenêtre équipe) ; la personne
   accepte depuis l'écran de choix d'équipe.
4. **Demande** : dépôt (demandeur) → Nouvelle → En analyse → Acceptée / Refusée (équipe) →
   « Créer le projet » (lien `demandes.projet_id`).
5. **Temps** : saisie (`temps_saisis`) → « Soumettre » (`feuilles_temps.statut = soumise`)
   → Valider / Renvoyer (responsable).

## 8. Déploiement

- `vercel.json` redirige `/` vers `/app/` et envoie `Cache-Control: no-cache` pour `/app/*` (le
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
| `tests/parcours.js` | Parcours Playwright de bout en bout (48 contrôles, dont « Général en lecture seule », l'aller-retour Google simulé, le parcours administrateur sans équipe le daily des équipes et le board des ressources) + captures `docs/maquettes/etat-actuel/` |
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
