# Spécifications — Roadmap (intégration du fichier `CDO-ROADMAP-NEW.xlsm`)

> **Statut : en attente (mis à jour le 2026-10-08).** Depuis le 2026-10-05, les demandes sont gérées
> dans **Azure DevOps** : les demandes, le formulaire et les tickets ont été retirés de ProjectDesk
> (tables supprimées par la migration 020). Ces décisions restent la référence si une roadmap des
> demandes revient dans ProjectDesk (ou pour un import depuis Azure DevOps) ; elles ne s'appliquent
> à aucun écran actuel. Une fois livrée, ses règles passeront dans `docs/DAT.md` (§ 3, § 4, § 6).

| Date       | Décision |
|------------|----------|
| 2026-10-05 | Règle de classement des demandes (rang de traitement DSI) — § 1 |
| 2026-10-05 | Sprint : liste déroulante alimentée par Administration — § 2 |
| 2026-10-05 | Maquettes de design à valider : `docs/maquettes/roadmap/` (4 pistes) |
| 2026-10-05 | Design retenu : **vue Liste + vue Kanban** — § 3 |
| 2026-10-08 | Spécification mise en attente : demandes gérées dans Azure DevOps (retrait du 2026-10-05) |
| 2026-11-04 | Saisie des demandes par les chefs de projet : Mon dashboard › Projet › Roadmap (version 3.07) — § 7 |
| 2026-11-03 | 3 premières demandes (les plus récentes de 2026) en base, rang et score calculés (version 3.06, migration 057) — § 6 |
| 2026-11-03 | Colonnes réglables dans Administration › Roadmap (version 3.05, migration 056) — § 5 |
| 2026-11-03 | Reprise : menu **Roadmap** de Vue d’ensemble affiché avec le **tableau vide** (19 colonnes retenues du fichier, version 3.04) ; source des demandes à décider — § 4 |

## 1. Rang de traitement DSI (règle reprise du fichier Excel)

**Objet :** classer automatiquement les demandes dans l'ordre où la DSI doit les traiter
(rang 1 = en premier). L'utilisateur ne saisit que les informations métier ; le score et le
rang sont **calculés** par l'application (fonctions pures dans `app/js/calculs.js`, règle n°4)
et la liste se réordonne dès qu'une valeur change.

**Score** — « est-ce que ça vaut le coup ? » = ce que la demande rapporte ÷ ce qu'elle coûte :

```
Score = (0,5 × impact client + 0,3 × impact collaborateur) ÷ (0,2 × complexité)
```

- impacts client et collaborateur : 1, 2 ou 3 ; complexité : 1 à 5 ;
- l'impact client pèse plus que l'impact collaborateur (0,5 contre 0,3).

**Ordre de tri**, critère par critère :

1. **Stratégique d'abord** : une demande « Stratégique = Oui » passe devant toutes les autres ;
2. **puis la priorité du demandeur** : 1, puis 2, puis 3 ;
3. **puis le score** : à égalité, le score le plus élevé passe devant.

Dans l'Excel, ce tri passe par deux colonnes techniques (`Fixe` = 1 si stratégique ;
`Clé` = (1 − Fixe) × 100 000 + priorité × 1 000 + (1 000 − score), rang = clé croissante).
L'application applique directement les trois critères ; ces colonnes ne sont **pas** reprises.

**Exemples (fichier du porteur)**

| Demande | Stratégique | Priorité | Impacts client / collab. | Complexité | Score | Rang |
|---------|-------------|----------|--------------------------|------------|-------|------|
| Fiscalité « Bailleur privé » | Oui | 1 | 3 / 1 | 1 | 9   | 1er |
| API filtrée sur la BU URBAT  | Oui | 1 | 1 / 2 | 1 | 5,5 | 2e  |

**Complexité non saisie** : l'Excel donne alors un score de 0 (la demande tombe en bas de sa
catégorie). L'application affiche à la place **« complexité à saisir »** et place ces demandes
après celles de même priorité ayant un score (20 des 70 demandes ouvertes du fichier sont
concernées).

## 2. Sprint d'une demande

- Le champ **Sprint** est une **liste déroulante** (pas de saisie libre).
- Ses valeurs sont **celles configurées dans Administration** : un seul endroit pour la liste
  des sprints, qu'utilisent la roadmap et les autres écrans (règle n°4).
- Liste utilisée : les **sprints du projet** saisis dans Mon dashboard › Projets et Roadmap › Sprints (Administration › Sprints jusqu’en 2.38)
  (nom de la version, début, fin — table `sprints_projet`, migration 014), affichés
  « nom · début → fin ».
- À l'import, chaque nom de sprint du fichier (Acrux, Alcor, 1.15.0, « Sprint 64 - 2025 »…)
  doit correspondre à une valeur de cette liste ; une valeur inconnue est signalée, pas créée
  en silence.

## 3. Écran retenu : vue Liste et vue Kanban

Maquettes : `docs/maquettes/roadmap/retenu-1-vue-liste.png`, `retenu-2-fiche-demande.png`,
`retenu-3-vue-kanban.png` (pistes 1 et 2 ; les pistes 3 « planification par sprint » et
4 « matrice valeur / effort » ne sont pas retenues).

- Emplacement : Mon dashboard › Projets et Roadmap, onglet **« Roadmap fonctionnelle »** à côté
  du Gantt des projets ; choix du projet (CDO par défaut) ; même vue en lecture seule dans Général.
- Indicateurs : demandes ouvertes, en recette (DSI / PO), chiffrage restant (j-h), complexité à saisir.
- Bascule **☰ Liste / ▦ Kanban**, puis filtres communs aux deux vues : statut, parcours, demandeur.
- **Vue Liste** : tableau trié par rang (§ 1) — rang, ★ stratégique, demande et parcours,
  demandeur, priorité, impacts client / collaborateur, complexité, score (ou « complexité à
  saisir »), statut, sprint, chiffrage.
- **Vue Kanban** : une colonne par statut ouvert, cartes triées par rang (rang, score, demande,
  parcours, sprint) ; glisser une carte change son statut.
- Clic sur une ligne ou une carte : **fiche** dans le panneau latéral (identification,
  priorisation, développement et recette ; sprint en liste déroulante — § 2 ; score et rang calculés).

## 4. Tableau livré vide (2026-11-03, version 3.04)

Porteur : « construis le tableau sans alimenter les données ». Le menu **Roadmap** de Vue d’ensemble (juste après Projet, ouvert
à tous) affiche l'en-tête du tableau, sans aucune demande ni table en base. Colonnes : `BLOCS_ROADMAP` (`web/src/domaine/config.ts`).

| Bloc | Colonnes reprises du fichier |
|------|------------------------------|
| Identification de la demande | Rang (calculé), Demande, Demandeur, Parcours, Catégorie métier, Thématique, US |
| Priorisation | Stratégique, Priorité demandeur, Impact client, Impact collaborateur, Score (calculé) |
| Cadrage AMOA | Cadrage AMOA |
| Développement & recette | Statut, Complexité, Pris en charge DSI, Chiffrage DSI (j-h), Sprint DSI, Date de MEP |

Écartées : Etat (déduit du statut), Avancement dév (doublon du statut), Statut recette et Statut MEP (quasi constants),
Planification (11 lignes sur 213), Mois de la demande (vide à 53 %), Atterrissage chiffrage, Estimé MEP, Fixe et Clé
(colonnes techniques du rang). Commentaires : réservés à la fiche d'une demande.

**Reste à décider** avant d'alimenter le tableau : source des demandes (saisie dans ProjectDesk, import du fichier ou
Azure DevOps), rattachement à un projet, saisie dans Mon dashboard, et nettoyage des valeurs du fichier (doublons de
demandeurs et de parcours, espaces en fin de valeur, statuts incohérents) — aucune donnée n'est importée sans accord (règle n°8).

## 5. Colonnes réglables : Administration › Roadmap (2026-11-03, version 3.05)

Porteur : « dans le menu administration, un onglet roadmap où je peux ajouter ou supprimer les colonnes de mon tableau ; pour chaque
colonne, choisir si c'est une liste déroulante ou une saisie libre ». Maquette `docs/maquettes/admin-roadmap-colonnes/`, validée.

- Colonnes en base : table `colonnes_roadmap` (migration 056), 19 colonnes de départ (§ 4) ; le tableau de Vue d’ensemble › Roadmap les suit.
- Par colonne : nom, bloc, ordre dans le bloc, type **Liste déroulante** (valeurs dans un référentiel `rdm_…`, vide au départ) ou
  **Saisie libre** (format Texte, Nombre ou Date). Sprint DSI : liste des sprints du projet (§ 2).
- Rang et Score : colonnes calculées, ni supprimables ni changées de type.
- Supprimer une colonne supprime sa liste déroulante et ses valeurs ; repasser en saisie libre garde les valeurs (retour en liste possible).
- Réservé aux administrateurs (droit « administration »).

Choix pris par défaut, faute de réponse explicite (modifiables) : formats Texte / Nombre / Date, 19 colonnes de départ, Sprint DSI = sprints du projet,
administrateurs seulement.

## 6. Premières demandes (2026-11-03, version 3.06)

Porteur : « prends 3 lignes du fichier que je t'ai donné, les 3 plus récentes pour 2026, et alimente la partie [tableau] ».
Table `demandes_roadmap` (migration 057) : les valeurs d'une demande sont rangées par colonne (id de `colonnes_roadmap`), donc une colonne
ajoutée ou renommée dans Administration › Roadmap ne casse rien. Rang et Score ne sont pas stockés : `domaine/roadmap.ts` les calcule (§ 1).

| Rang | Demande (fichier, ligne) | Mois | Stratégique | Score |
|------|--------------------------|------|-------------|-------|
| 1 | Ajouter priorité d'affichage au niveau du flux tranche commerciale (16) | 15/06/2026 | Oui | 5,25 |
| 2 | Ajouter plusieurs liens vidéos dans CDO (illimités) (39) | 01/07/2026 | Non | 3,5 |
| 3 | Modifier dans le template du mandat de com le montant de la prestation e-business (85) | 24/07/2026 | Non | complexité à saisir |

Les valeurs de listes utilisées par ces 3 demandes ont été ajoutées aux listes déroulantes (26 valeurs).

**À venir** : saisie des demandes par les chefs de projet dans Mon dashboard (droit déjà prévu en base : `peut_gerer_projet`) ; écran à maquetter
(règle n°3), avec le choix du projet de rattachement (deux projets « CDO » existent : Applications et AMOA).

## 7. Saisie par les chefs de projet (2026-11-04, version 3.07)

Maquette `docs/maquettes/saisie-demandes-roadmap/` validée (« Go »). Mon dashboard › Projet › **Roadmap** (3e sous-menu) :

- choix du projet parmi ceux que je gère (chef de projet affecté, responsable de l'unité, administrateur — règle `peut_gerer_projet`) ;
- liste des demandes du projet, classées par rang de traitement DSI **global** (le rang compare toutes les demandes) ;
- fiche : un champ par colonne d'Administration › Roadmap, au type de la colonne ; Rang et Score calculés en direct ; Demande obligatoire.

Choix appliqués par défaut (modifiables) : les 3 demandes du 2026-11-03 restent **sans projet** (visibles des administrateurs sous
« Sans projet ») ; les valeurs des listes déroulantes restent réglées par l'administrateur (Administration › Roadmap).
