# DAT — Document d'Architecture Technique · Roadmap PM

> Document vivant : à mettre à jour à **chaque** évolution (menus, écrans, champs, règles,
> stockage). Voir la règle n°5 dans `CLAUDE.md`. Sa cohérence avec le code est contrôlée
> après chaque commit par `scripts/verifier-docs.js` (règle n°7).

| Version | Date       | Objet |
|---------|------------|-------|
| 0.1     | 2026-09-25 | Création du DAT à partir de l'existant (v1 de l'application) |
| 0.2     | 2026-09-25 | Règle n°7 : script de vérification des documents + hook post-commit (§ 7, § 8) |
| 0.3     | 2026-09-25 | Transfert du projet dans le dépôt ProjectDesk ; README racine (§ 7) |
| 0.4     | 2026-09-25 | Base Neon créée (schéma, RLS, Data API) et maquettes « connexion-bdd » — app pas encore branchée (§ 9) |
| 0.5     | 2026-09-25 | Déploiement Vercel : `vercel.json`, domaines déclarés dans Neon Auth (§ 9.5) |
| 0.6     | 2026-09-25 | Nouvelle cible « Pilotage Projet » : maquette de référence + maquettes complémentaires (§ 10) ; maquettes connexion-bdd retirées |

---

## 1. Objet de l'application

Application web **PC-first** de pilotage d'une roadmap produit/IT pour un chef de projet :
backlog de demandes, priorisation automatique (formules reprises d'un fichier Excel
« CDO ROADMAP »), suivi du pipeline DSI, vue trimestrielle, tableau de bord et simulateur de
capacité d'équipe.

## 2. Architecture générale

```
┌──────────────────────── Navigateur (poste du chef de projet) ────────────────────────┐
│                                                                                       │
│  index.html ── structure : menu latéral, barre de filtres, 5 vues, tiroir formulaire   │
│      │                                                                                │
│      ├── style.css   thème visuel (dense, grand écran, viewport 1280px)                │
│      ├── data.js     RÉFÉRENTIELS : listes de valeurs, couleurs, libellés, démo        │
│      └── app.js      LOGIQUE : état, calculs métier, rendu des vues, événements        │
│                          │                                                            │
│                          ▼                                                            │
│                   localStorage  (roadmap_pm_items_v1, roadmap_pm_capacity_v1)          │
│                          ▲                                                            │
│                          │  Import / Export fichiers  ◄──►  CSV (;) · JSON             │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

- **Type** : application 100 % statique (HTML/CSS/JS natif), aucune dépendance, aucun serveur,
  fonctionne hors-ligne.
- **Persistance** : `localStorage` du navigateur → données **locales au poste**, non partagées.
- **Échange** : import/export CSV (séparateur `;`, en-têtes = libellés métier) et JSON.
- **Ordre de chargement** : `data.js` puis `app.js` (app.js dépend des constantes globales de data.js).

### 2.1 Découpage de `app.js`

| Section (en-tête dans le code)   | Rôle | Fonctions principales |
|----------------------------------|------|-----------------------|
| State & persistence              | État global unique `state`, lecture/écriture localStorage | `loadData`, `saveData`, `saveCapacity`, `uid` |
| Business logic                   | **Seul endroit** des calculs métier | `computeScore`, `computeFixe`, `computeCle`, `enrichItems`, `getEnrichedItems` |
| Filtering / sorting / search     | Filtres de la barre du haut, recherche, tri | `applyFilters`, `sortItems` |
| Rendering: shell / navigation    | Routeur de vues (affiche la vue active) | `render`, `renderFilterOptions` |
| Vues                             | Une fonction de rendu par menu | `renderBacklog`, `renderKanban`, `renderTimeline`, `renderDashboard`, `renderCapacity` |
| Composants partagés              | Briques HTML réutilisables | `badge`, `cardHtml`, `kpiCard`, `barChart`, `escapeHtml`, `fmtDate` |
| Drawer                           | Formulaire latéral d'ajout / édition | `drawerFormHtml`, `openDrawer`, `saveDrawer`, `deleteItem` |
| Import / Export                  | CSV / JSON | `toCsv`, `parseCsv`, `downloadFile` |
| Bootstrap                        | Branchement des événements, démarrage | `initEvents` |

### 2.2 Cycle de rendu

```
Action utilisateur ─► modifie state (items / filters / view / sort)
                  ─► saveData() si donnée métier modifiée
                  ─► render()
                        └─► getEnrichedItems()  (score, fixe, clé, rang recalculés)
                        └─► render<VueActive>(items)
```
Le rendu est **entièrement reconstruit** à chaque action (simple, suffisant pour quelques
centaines de demandes).

## 3. Menus et écrans

Maquettes / captures de référence : `docs/maquettes/etat-actuel/`.

### 3.1 Menu latéral (navigation)

| Menu        | `data-view` | Section HTML       | Fonction de rendu   | Filtres appliqués | Capture |
|-------------|-------------|--------------------|---------------------|-------------------|---------|
| 📋 Backlog   | `backlog`   | `#view-backlog`    | `renderBacklog`     | Oui (+ tri colonnes) | `01-backlog.png` |
| 🗂️ Kanban    | `kanban`    | `#view-kanban`     | `renderKanban`      | Oui               | `02-kanban.png` |
| 📅 Roadmap   | `timeline`  | `#view-timeline`   | `renderTimeline`    | Oui (hors Annulée) | `03-roadmap.png` |
| 📊 Dashboard | `dashboard` | `#view-dashboard`  | `renderDashboard`   | **Non** (tout le backlog) | `04-dashboard.png` |
| ⚙️ Capacité  | `capacity`  | `#view-capacity`   | `renderCapacity`    | **Non** (tout le backlog) | `05-capacite.png` |

### 3.2 Actions du pied de menu

| Bouton                 | Effet |
|------------------------|-------|
| ⬆ Importer (CSV/JSON)  | **Remplace** tout le backlog par le fichier importé |
| ⬇ Exporter CSV         | Export des demandes enrichies (colonnes = `FIELD_LABELS`) |
| ⬇ Exporter JSON        | Export brut de `state.items` |
| ↺ Réinitialiser        | Recharge le jeu de démonstration + capacité par défaut (après confirmation) |

### 3.3 Barre supérieure (commune à toutes les vues)

Recherche plein texte (demande, demandeur, thématique, parcours, US) · filtres État,
Catégorie, Statut, Planification · bouton **+ Nouvelle demande** (ouvre le tiroir).

### 3.4 Détail des écrans

- **Backlog** : tableau Rang · Catégorie · Demande · Demandeur · État · Statut · Planification ·
  Score · JH · ★ (stratégique) · actions (éditer / supprimer). Tri par clic sur en-tête.
- **Kanban** : une colonne par statut de `STATUT_PIPELINE`, colonnes « hors flux »
  (`STATUT_HORS_FLUX`) à part. Glisser-déposer d'une carte = changement de `statut`.
- **Roadmap** : une colonne par trimestre (`TRIMESTRES`) + « Non planifié », cartes triées par
  rang, total JH par trimestre. Clic carte = édition.
- **Dashboard** : KPI (nb demandes, avancement, charge totale / restante), répartition par
  statut et par catégorie, top priorités.
- **Capacité** : paramètres équipe (nb dev, nb PO, TJM, jours ouvrés/trimestre) et tableau
  capacité dev vs charge planifiée par trimestre, surcharge en rouge.
- **Tiroir « Demande »** (`06-formulaire-demande.png`) : 4 sections — Identification,
  Priorisation (score calculé en lecture seule), Cadrage & Développement, Recette & MEP.

## 4. Modèle de données

### 4.1 Demande (`state.items[]`, clé localStorage `roadmap_pm_items_v1`)

| Champ | Libellé | Type / valeurs | Section formulaire |
|-------|---------|----------------|--------------------|
| `id` | — | chaîne générée (`uid()`) | technique |
| `demandeur`, `parcours`, `us`, `thematique` | cf. `FIELD_LABELS` | texte libre | Identification |
| `categorie` | Catégorie métier | `CATEGORIES` | Identification |
| `moisDemande` | Mois de la demande | date ISO | Identification |
| `demande`, `commentaires` | | texte long | Identification |
| `etat` | Etat | `ETATS` (Ouvert, Fermé, Annulé) | Priorisation |
| `prioriteDemandeur` | Priorité demandeur | 1 Haute · 2 Moyenne · 3 Basse | Priorisation |
| `strategique` | Stratégique | `OUI_NON` | Priorisation |
| `impactClient`, `impactCollaborateur` | | 1–3 | Priorisation |
| `complexite` | Complexité | 1–5 | Priorisation |
| `planification` | Planification | `TRIMESTRES` (T1 2026 → T4 2028) | Priorisation |
| `cadrageAmoa` | Cadrage AMOA | `CADRAGE_STATUTS` | Cadrage & Dév |
| `statut` | Statut | `ALL_STATUTS` (pipeline + hors flux) | Cadrage & Dév |
| `priseEnChargeDSI` | | `OUI_NON` | Cadrage & Dév |
| `chiffrageDSI` | Chiffrage DSI (JH) | nombre (pas 0,5) | Cadrage & Dév |
| `atterrissageChiffrage`, `sprintDSI` | | texte | Cadrage & Dév |
| `avancementDev` | Avancement dév (%) | 0–100 | Cadrage & Dév |
| `estimeMEP`, `dateMEP` | | date ISO | Recette & MEP |
| `statutRecette`, `statutMEP` | | `ITERATIONS` | Recette & MEP |

**Champs calculés** (non stockés, ajoutés par `enrichItems`) : `score`, `fixe`, `cle`, `rang`.

### 4.2 Capacité (`state.capacity`, clé `roadmap_pm_capacity_v1`)

`nbDev` (3) · `nbPO` (1) · `tjmDev` (800) · `tjmPO` (800) · `joursOuvresParTrimestre` (60) —
valeurs par défaut dans `DEFAULT_CAPACITY` (`data.js`).

### 4.3 Référentiels (`data.js`)

`CATEGORIES`, `ETATS`, `OUI_NON`, `CADRAGE_STATUTS`, `STATUT_PIPELINE`, `STATUT_HORS_FLUX`,
`ALL_STATUTS`, `ITERATIONS`, `TRIMESTRES`, `PRIORITE_LABELS`, `STATUT_COLORS`, `ETAT_COLORS`,
`CATEGORIE_COLORS`, `FIELD_LABELS`, `SEED_ITEMS`, `DEFAULT_CAPACITY`.

## 5. Règles métier

| Règle | Formule | Code |
|-------|---------|------|
| Score | `(0,5 × Impact client + 0,3 × Impact collab.) / (0,2 × Complexité)` (0 si complexité vide) | `computeScore` |
| Fixe | 1 si Stratégique = « Oui », sinon 0 | `computeFixe` |
| Clé de tri | `(1 − Fixe) × 100000 + Priorité × 1000 + (1000 − Score)` | `computeCle` |
| Rang DSI | Rang croissant sur la clé, **uniquement** les demandes hors « Terminé » / « Annulée » | `enrichItems` |
| Charge / trimestre | Σ `chiffrageDSI` des demandes non terminées / non annulées, par `planification` | `renderCapacity` |
| Capacité dev | `nbDev × joursOuvresParTrimestre` (JH / trimestre) | `renderCapacity` |

## 6. Points de cohérence (à vérifier avant toute nouvelle fonctionnalité)

Règles de conception à respecter :

1. Toute nouvelle liste de valeurs / couleur / libellé → `data.js`, jamais en dur dans une vue.
2. Tout nouveau calcul métier → section « Business logic » de `app.js`, exposé via
   `enrichItems` si utilisé par plusieurs vues.
3. Tout nouveau champ → `FIELD_LABELS` (sinon absent de l'export/import CSV) + formulaire
   du tiroir + § 4.1 de ce DAT.
4. Toute nouvelle vue → bouton dans `.nav`, `<section id="view-xxx">`, branche dans
   `render()`, ligne dans le § 3.1, maquette PNG.
5. Toute modification de la structure stockée → envisager une nouvelle version de clé
   localStorage (`_v2`) et une migration.

Incohérences connues dans l'existant (à arbitrer, non corrigées) :

| # | Constat | Impact |
|---|---------|--------|
| C1 | Dashboard et Capacité ignorent les filtres de la barre supérieure, les autres vues les appliquent | Chiffres différents selon la vue pour un même filtre |
| C2 | Deux notions proches : `etat` = « Annulé » et `statut` = « Annulée » ; le rang et la charge ne regardent que `statut` | Une demande à l'état « Annulé » mais statut actif reste classée et comptée |
| C3 | Le calcul de charge est fait dans `renderCapacity` (vue) et non dans « Business logic » | Non réutilisable (ex. Roadmap ou Dashboard) |
| C4 | `nbPO` / `tjmPO` sont saisis mais la charge PO n'est pas comparée | Paramètre sans effet visible hors affichage du coût |
| C5 | L'import **remplace** le backlog sans fusion | Risque de perte de données locales |
| C6 | Données locales au navigateur, pas de multi-utilisateur | À traiter si partage d'équipe requis (choix d'architecture ouvert) |

## 7. Arborescence du dépôt

```
ProjectDesk/
├── README.md                      # présentation du dépôt
├── CLAUDE.md                      # règles de travail permanentes
├── vercel.json                    # déploiement Vercel : « / » redirige vers roadmap-app/
├── .githooks/post-commit          # lance la vérification des documents après commit
├── scripts/verifier-docs.js       # contrôle doc ↔ code (règle n°7)
├── db/migrations/                 # scripts SQL versionnés de la base Neon (§ 9)
├── docs/
│   ├── DAT.md                     # ce document
│   └── maquettes/
│       ├── etat-actuel/           # captures PNG de chaque écran (référence)
│       └── pilotage-projet/       # maquette cible Pilotage Projet + compléments (§ 10)
└── roadmap-app/
    ├── index.html · style.css · data.js · app.js
    └── README.md                  # guide utilisateur
```

## 8. Outillage qualité documentaire

`scripts/verifier-docs.js` (Node.js, sans dépendance) vérifie après chaque commit :

| Contrôle | Source (code) | Cible (documentation) |
|----------|---------------|------------------------|
| Documents présents | — | `README.md`, `CLAUDE.md`, `docs/DAT.md`, `roadmap-app/README.md` |
| Menus décrits | `data-view` des boutons de `index.html` | § 3.1 |
| Champs décrits | clés de `FIELD_LABELS` (`data.js`) | § 4.1 |
| Fonctions existantes | fonctions `render*` / `compute*` citées | `app.js` |
| Captures existantes | fichiers `.png` cités | `docs/maquettes/etat-actuel/` |
| DAT suivi | code modifié dans le dernier commit | `docs/DAT.md` modifié aussi |

Activation du hook, une fois par poste : `git config core.hooksPath .githooks`.
Le hook **signale** sans annuler le commit ; les écarts sont corrigés au commit suivant.

## 9. Base de données Neon (en cours d'intégration)

> Statut : **base prête, application pas encore branchée** (elle utilise toujours le
> `localStorage`). Le branchement suit la validation des maquettes `docs/maquettes/pilotage-projet/` (§ 10).

### 9.1 Architecture cible

```
Navigateur (roadmap-app, statique, hébergé sur Vercel)
   │  1. connexion (email/mot de passe, Google) ──► Neon Auth (Better Auth)
   │                                                 └─ organisations, membres, invitations
   │  2. jeton JWT (15 min)
   ▼
Neon Data API (REST) ──► Postgres « neondb » (branche production, Francfort)
                           └─ règles RLS : on ne voit que les organisations dont on est membre
```

| Élément | Valeur |
|---------|--------|
| Projet Neon | `ProjectDesk` (`dark-lake-97562553`), branche `production` |
| Neon Auth | `https://ep-lucky-mud-b1gqp3gd.neonauth.c-5.eu-central-1.aws.neon.tech/neondb/auth` |
| Data API | `https://ep-lucky-mud-b1gqp3gd.apirest.c-5.eu-central-1.aws.neon.tech/neondb/rest/v1` |
| Migrations | `db/migrations/*.sql`, appliquées dans l'ordre, jamais modifiées une fois appliquées |

### 9.2 Tables

| Table | Rôle | Clé | Remarques |
|-------|------|-----|-----------|
| `demandes` | Backlog (une ligne = une demande, champs du § 4.1 en snake_case) | `id` (uuid) | `organisation_id` → `neon_auth.organization` ; traçabilité `cree_par`, `cree_le`, `modifie_par`, `modifie_le` |
| `capacites` | Paramètres du simulateur (§ 4.2), une ligne par organisation | `organisation_id` | valeurs par défaut = `DEFAULT_CAPACITY` |
| `neon_auth.*` | Utilisateurs, sessions, organisations, membres, invitations | — | gérées par Neon Auth, **ne pas modifier** |

Les listes de valeurs (statuts, catégories…) ne sont **pas** contrôlées en base : `data.js`
reste le référentiel unique (§ 6, règle 1). La base ne contrôle que les bornes numériques.

### 9.3 Sécurité

- Fonction `mes_organisations()` : organisations de l'utilisateur du jeton (lit `neon_auth.member`).
- RLS activée sur `demandes` et `capacites` : lecture/écriture limitées à `mes_organisations()`.
- Rôle `anonymous` : aucun droit. Test réalisé : sans jeton, 0 ligne lue, insertion refusée,
  schéma `neon_auth` inaccessible.

### 9.4 Points ouverts

| # | Sujet | État |
|---|-------|------|
| O1 | Droits par rôle (owner / admin / member) sur les données | Non décidé — aujourd'hui tous les membres lisent et modifient |
| O2 | Domaine Vercel à déclarer dans Neon Auth (domaines de confiance) | Fait (§ 9.5) — à compléter si un domaine personnalisé est ajouté |
| O3 | Invitations par email (nécessite la vérification d'email) | Désactivées : invitations visibles dans l'app |

### 9.5 Déploiement (Vercel)

- Projet Vercel : `project-desk` (équipe `ckitty8s-projects`), site 100 % statique, sans build.
- `vercel.json` redirige la racine `/` vers `/roadmap-app/` (les chemins relatifs de
  `index.html` vers `style.css`, `data.js`, `app.js` restent valides).
- Vercel publie la branche `main` : l'application n'est en ligne qu'après fusion dans `main`.
- Domaines de confiance déclarés dans Neon Auth (branche `production`) :

| Domaine | Nature |
|---------|--------|
| `https://project-desk-ckitty8s-projects.vercel.app` | Adresse stable de l'équipe (à privilégier) |
| `https://project-desk-jusy2piap-ckitty8s-projects.vercel.app` | Adresse d'un déploiement précis (change à chaque déploiement) |
| `localhost` | Autorisé par défaut (développement) |

> Tout nouveau domaine (domaine personnalisé, prévisualisation de branche) doit être ajouté
> dans Neon Console → Auth → Domains, sinon la connexion y sera refusée.

## 10. Nouvelle cible : « Pilotage Projet » (en cours de conception)

> Décision du porteur (2026-09-25) : la maquette `Pilotage_Projet.dc.html` **remplace Roadmap PM**.
> Ce DAT sera réécrit (v1.0) lors de la livraison du code ; les §§ 1 à 9 décrivent encore Roadmap PM.

### 10.1 Décisions

| Sujet | Décision |
|-------|----------|
| Périmètre | Les 10 écrans de la maquette, livrés en une fois |
| Organisation Neon Auth | 1 organisation = 1 équipe |
| Lecture | Tout membre d'une équipe lit toutes les équipes (section « Général ») |
| Écriture | Dans son équipe et ses projets (rôle projet Chef de projet / Membre ; Lecteur = lecture) |
| Administration | Administrateurs globaux : équipes, référentiels, champs du formulaire |
| Timesheet | Chacun saisit sa ligne (écran « Mon timesheet »), le chef d'équipe valide |
| Demandeurs | Compte « demandeur » : dépose et suit ses demandes, ne voit rien d'autre |
| Ancien schéma | Tables `demandes` / `capacites` (Roadmap PM, vides) supprimées ; `roadmap-app/` retiré |

### 10.2 Maquettes

| Dossier | Contenu |
|---------|---------|
| `docs/maquettes/pilotage-projet/` | 10 écrans + panneau projet (`01-gDash.png` … `11-panneau-projet.png`), rendus depuis `source/Pilotage_Projet.dc.html` |
| `docs/maquettes/pilotage-projet/complements/` | Écrans absents de la maquette : `connexion.png`, `choix-equipe.png`, `mon-timesheet.png`, `espace-demandeur.png`, `bloc-utilisateur.png` |

Remarques sur la maquette source : `support.js` d'origine non fourni (moteur de rendu réécrit dans
`source/support.js`) ; le Timesheet de la maquette affiche « NaN » (bug de données de la maquette,
sans objet dans l'application qui lira les heures en base).
