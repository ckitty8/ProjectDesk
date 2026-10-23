# Backlog de développement · ProjectDesk

> **Brouillon à valider par le porteur.** Backlog de l'équipe de développement (ce n'est pas une
> fonctionnalité de l'application) : il suit ce qui est **fait**, **en cours** et **prévu**.
> Il complète le DAT (`docs/DAT.md`), qui reste la référence de l'architecture et dont
> l'historique détaille chaque livraison.

## 1. Conventions

**Hiérarchie** : un **Epic** (grand thème) contient des **Features** (capacité livrable) qui se
découpent en **US** (user stories, une valeur pour un utilisateur). Un **Bug** est un défaut
constaté ; il se rattache à la Feature concernée.

| Type | Préfixe | Exemple | Règle |
|------|---------|---------|-------|
| Epic | `EP-nn` | `EP-05 Congés et capacité` | Thème stable, rarement créé |
| Feature | `FT-nn.m` | `FT-05.3 Capacité par sprint` | Rattachée à un seul Epic |
| US | `US-nnn` | `US-041 Saisir la part idéale d'un sprint` | Rédigée « En tant que … je veux … afin de … », rattachée à une Feature |
| Bug | `BUG-nnn` | `BUG-004 Congés absents après chargement` | Rattaché à une Feature, avec sa cause et son correctif |

**Statuts** : ✅ Fait · 🔄 En cours · 🕓 Prévu · ⏸ En attente (décision du porteur) · ✖ Abandonné.

**Priorité** (éléments non faits) : P1 (prochain), P2 (ensuite), P3 (souhaité).

**Colonne « DAT »** : version de l'historique du DAT où l'élément a été livré (traçabilité vers la
description complète, la maquette et les décisions du porteur).

**Entretien** : à chaque évolution, ajouter ou faire avancer les lignes concernées dans le même
commit que le DAT. Un nouvel identifiant = le numéro suivant du même type (jamais réutilisé).

## 2. Vue d'ensemble

| Epic | Thème | Fait | En cours | Prévu / en attente |
|------|-------|------|----------|--------------------|
| EP-01 | Socle technique et déploiement | 8 | 0 | 0 |
| EP-02 | Connexion et comptes | 6 | 0 | 2 |
| EP-03 | Rôles et droits d'accès | 7 | 0 | 1 |
| EP-04 | Ressources et équipes | 8 | 0 | 1 |
| EP-05 | Congés et capacité | 6 | 0 | 1 |
| EP-06 | Temps : saisie, validation, plan de charge | 5 | 0 | 0 |
| EP-07 | Daily | 6 | 0 | 1 |
| EP-08 | Projets, sprints, mises en production, roadmap | 3 | 0 | 3 |
| EP-09 | Aide et Trucs & astuces | 4 | 0 | 1 |
| EP-10 | Qualité, documentation et outillage | 6 | 0 | 0 |
| **Total** | | **59** | **0** | **10** |

---

## EP-01 · Socle technique et déploiement

Application HTML/CSS/JS native sans build, base Neon (Postgres, Auth, Data API), mise en ligne Vercel.

| Type | ID | Intitulé | Statut | DAT |
|------|----|----------|--------|-----|
| Feature | FT-01.1 | Application « Pilotage Projet » : schéma, RLS, Data API, tests de bout en bout | ✅ | 0.4 – 1.0 |
| Feature | FT-01.2 | Déploiement Vercel et domaines autorisés dans Neon Auth | ✅ | 0.5, 1.1, 1.3 |
| Feature | FT-01.3 | Données toujours à jour sans F5 (`no-store`, `no-cache`, `?v=`, rafraîchissement en arrière-plan) | ✅ | 1.18, 1.25, 1.29, 1.53 |
| Feature | FT-01.4 | Lecture paginée de toutes les tables et chargement tolérant aux erreurs | ✅ | 1.26, 1.38 |
| Bug | BUG-001 | Table `directions` absente du cache de schéma après migration → rechargement de la Data API ajouté à la procédure | ✅ | 1.9, 1.12 |
| Bug | BUG-002 | « permission denied for schema auth » à chaque modification → `tracer_modification()` en `SECURITY DEFINER` | ✅ | 1.27 |
| Bug | BUG-003 | Congés « perdus » : une table illisible bloquait tout le chargement (base intacte) | ✅ | 1.38 |
| Bug | BUG-004 | Absences d'été non chargées (plafond de lignes de la Data API) | ✅ | 1.26 |

## EP-02 · Connexion et comptes

| Type | ID | Intitulé | Statut | DAT |
|------|----|----------|--------|-----|
| Feature | FT-02.1 | Connexion e-mail + mot de passe et Google, messages d'erreur explicites | ✅ | 1.1, 1.2 |
| Feature | FT-02.2 | Mot de passe oublié (e-mail de réinitialisation Neon Auth) | ✅ | 1.54 |
| Feature | FT-02.3 | Vérification de l'e-mail par code à 6 chiffres | ✅ | 1.88 |
| Feature | FT-02.4 | Comptes en attente d'accès : donner l'accès, choix de l'équipe, de la fiche et du rôle | ✅ | 1.83 |
| Feature | FT-02.5 | Ouverture directe : équipe mémorisée, administrateur sans écran de choix | ✅ | 1.4, 1.55 |
| Bug | BUG-005 | « Donner l'accès » non pris en compte (acceptation d'invitation) → acceptation par la base | ✅ | 1.86 |
| Feature | FT-02.6 | Connexion Google avec les identifiants du projet (O3) | 🕓 P2 | § 12 |
| Feature | FT-02.7 | Activer l'exigence de vérification de l'e-mail après essai du porteur (O4) | 🕓 P2 | § 12 |

## EP-03 · Rôles et droits d'accès

| Type | ID | Intitulé | Statut | DAT |
|------|----|----------|--------|-----|
| Feature | FT-03.1 | Rôle Créateur et simulation des rôles | ✅ | 1.84, 1.85 |
| Feature | FT-03.2 | Affecter les rôles d'accès aux utilisateurs (tableau « Utilisateurs et rôles ») | ✅ | 2.03, 2.05 |
| Feature | FT-03.3 | Six rôles d'accès | ✅ | 2.07, 2.22 |
| Feature | FT-03.4 | Matrice des droits réglable : par fonctionnalité, par menu, par onglet | ✅ | 2.08, 2.19, 2.21 |
| Feature | FT-03.5 | Administration créateur : Simulation, Matrice des droits, Qui a quel rôle | ✅ | 2.31, 2.36 |
| Feature | FT-03.6 | Simulation de rôle sur les fiches sans compte (phase de recette) | ✅ | 2.35 |
| Feature | FT-03.7 | Retrait du rôle « Lecteur d'équipe » du rôle d'accès | ✅ | 1.94 |
| Feature | FT-03.8 | Gestion des administrateurs globaux depuis l'application (O5) | 🕓 P3 | § 12 |

## EP-04 · Ressources et équipes

| Type | ID | Intitulé | Statut | DAT |
|------|----|----------|--------|-----|
| Feature | FT-04.1 | Directions, équipes, projets : arborescence puis navigation + détail | ✅ | 1.8, 1.10, 1.11, 1.90 |
| Feature | FT-04.2 | Fiche ressource : dates d'arrivée, de départ, naissance, statut Actif / Inactif | ✅ | 1.40, 1.51, 1.52, 2.17 |
| Feature | FT-04.3 | Menus liés : une personne apparaît là où elle est présente | ✅ | 1.68 – 1.70 |
| Feature | FT-04.4 | Référentiels (postes, contrats, types) renommables et administrables | ✅ | 1.14 |
| Feature | FT-04.5 | Affectations : « + Membre », « + Nouveau membre », personne existante, rattachement sans projet | ✅ | 1.15, 1.16, 2.09, 2.10 |
| Feature | FT-04.6 | Projets : création, modification, suppression, Product Owners, chef de projet | ✅ | 1.13, 1.18, 1.20, 1.92, 2.04 |
| Feature | FT-04.7 | Gestion des ressources en deux onglets : Calendrier et Liste (colonne Projets, anniversaires) | ✅ | 2.17, 2.18, 2.25 |
| Feature | FT-04.8 | Ressources : retrait de la notion de ticket | ✅ | 1.45 |
| Feature | FT-04.9 | Masquer l'année de naissance côté base, vue dédiée (O9) | 🕓 P3 | § 12 |

## EP-05 · Congés et capacité

| Type | ID | Intitulé | Statut | DAT |
|------|----|----------|--------|-----|
| Feature | FT-05.1 | Grille mensuelle des absences, types, jours fériés, demi-journées, import | ✅ | 1.17, 1.19, 1.22 – 1.24 |
| Feature | FT-05.2 | Vues par équipe et par projet, synthèse absents / membres | ✅ | 1.34 |
| Feature | FT-05.3 | Récap annuel : jours travaillés, congés, reste à prendre, objectif client | ✅ | 1.35, 1.39 |
| Feature | FT-05.4 | Capacité par sprint : indicateurs, vélocité, répartition saisie par sprint, méthode Scrum | ✅ | 1.36, 1.47 – 1.50, 2.34 |
| Feature | FT-05.5 | Menu Capacité séparé de Congés | ✅ | 2.26 |
| Bug | BUG-006 | Récap : la colonne C comptait aussi les jours fériés (9 jours de trop en 2026) | ✅ | 1.39 |
| Feature | FT-05.6 | Indicateurs « évolution vs trimestre précédent » (O6) | 🕓 P3 | § 12 |

## EP-06 · Temps : saisie, validation, plan de charge

| Type | ID | Intitulé | Statut | DAT |
|------|----|----------|--------|-----|
| Feature | FT-06.1 | Saisie mensuelle des heures, soumission du mois | ✅ | 1.64, 2.28 |
| Feature | FT-06.2 | Suivi des feuilles et validation par le responsable d'équipe | ✅ | 1.62, 1.89 |
| Feature | FT-06.3 | Plan de charge (prévisionnel par projet, temps réel par sprint) | ✅ | 1.77, 1.78 |
| Feature | FT-06.4 | Plan de charge réservé au créateur | ✅ | 2.23 |
| Feature | FT-06.5 | Menus Timesheet réorganisés (Saisir mes heures en menu à part) | ✅ | 1.61, 1.79, 1.95, 2.28 |

## EP-07 · Daily

| Type | ID | Intitulé | Statut | DAT |
|------|----|----------|--------|-----|
| Feature | FT-07.1 | Daily des équipes en lecture (fil, blocages, synthèse) | ✅ | 1.6, 2.13, 2.14 |
| Feature | FT-07.2 | Daily par projet : Hier / Aujourd'hui / Blocages, lié aux congés | ✅ | 1.56, 1.72 |
| Feature | FT-07.3 | Réglage de l'envoi du daily par projet (mode, heure, jours, destinataires) | ✅ | 1.65, 1.67, 1.73 |
| Feature | FT-07.4 | Export du daily en Excel | ✅ | 1.76 |
| Feature | FT-07.5 | Import du CR Daily Excel du porteur | ✅ | 2.12 |
| Bug | BUG-007 | Enregistrement de l'envoi du daily refusé (chaînes vides envoyées en null) | ✅ | 1.67 |
| Feature | FT-07.6 | Envoi effectif du daily (tâche planifiée Vercel + service d'envoi) (O8) | 🕓 P1 | § 12 |

## EP-08 · Projets, sprints, mises en production, roadmap

| Type | ID | Intitulé | Statut | DAT |
|------|----|----------|--------|-----|
| Feature | FT-08.1 | Sprints d'un projet saisis à la main (numéro, année, début, fin) | ✅ | 1.58, 1.63, 2.01 |
| Feature | FT-08.2 | Mises en production (saisie dans Mon dashboard) | ✅ | 2.33, 2.37 |
| Feature | FT-08.3 | Planning projet (sprints et mises en production sur une frise) | ✅ | 2.32, 2.38 |
| Feature | FT-08.4 | Spécification Roadmap (rang de traitement DSI, sprint en liste) | ⏸ | roadmap.md |
| Feature | FT-08.5 | Gantt des projets (contenu retiré, « on le développera plus tard ») | 🕓 P3 | 2.37 |
| Feature | FT-08.6 | Recherche ⌘K de l'en-tête (affichée, inactive) (O1) | 🕓 P3 | § 12 |

## EP-09 · Aide et Trucs & astuces

| Type | ID | Intitulé | Statut | DAT |
|------|----|----------|--------|-----|
| Feature | FT-09.1 | Bulles ⓘ et bouton Aide (aide sur l'écran, premiers pas, rôles) | ✅ | 1.32, 1.33, 1.66 |
| Feature | FT-09.2 | Trucs et astuces : KPI Agile, Rôles Scrum, fiche Roadmap | ✅ | 1.36, 1.37, 1.60, 1.80, 1.97 |
| Feature | FT-09.3 | Méthode Test & Learn (projets IA) | ✅ | 2.15 |
| Feature | FT-09.4 | Affichage écran étroit (Galaxy Z Fold 7 déplié) | ✅ | 1.87 |
| Feature | FT-09.5 | Recette réelle avec jetons réels, par le porteur (O7) | 🕓 P1 | § 12 |

## EP-10 · Qualité, documentation et outillage

| Type | ID | Intitulé | Statut | DAT |
|------|----|----------|--------|-----|
| Feature | FT-10.1 | DAT et vérification des documents après chaque commit (hook) | ✅ | 0.1, 0.2 |
| Feature | FT-10.2 | Section « Suivi de mes équipes » en lecture seule, contrôlée par les tests | ✅ | 1.7 |
| Feature | FT-10.3 | Revue qualité outillée (skill, audit du code, audit de la base) et nettoyages | ✅ | 1.74, 1.81, 2.00, 2.02, 2.29 |
| Feature | FT-10.4 | Livrables documentaires (spécifications, cahier de recette, guide utilisateur, cadrage) | ✅ | 2.16 |
| Feature | FT-10.5 | Propriété CIRITEC : licence et mentions | ✅ | 1.98, 1.99 |
| Feature | FT-10.6 | Skills de fin de session, déploiement, incident | ✅ | 2.30 |

---

## 3. Prochaines US prévues (éléments non faits, à détailler)

| ID | Feature | US | Priorité | Statut |
|----|---------|----|----------|--------|
| US-001 | FT-07.6 | En tant que chef de projet, je veux que le daily soit envoyé automatiquement à l'heure réglée, afin de ne plus l'envoyer à la main. | P1 | 🕓 |
| US-002 | FT-09.5 | En tant que porteur, je veux recetter l'application avec de vrais comptes, afin de valider les droits en conditions réelles. | P1 | 🕓 |
| US-003 | FT-02.6 | En tant qu'utilisateur, je veux me connecter avec Google sans identifiants partagés, afin de passer en production. | P2 | 🕓 |
| US-004 | FT-02.7 | En tant qu'administrateur, je veux que l'e-mail soit vérifié avant l'accès, afin de sécuriser les comptes. | P2 | 🕓 |

## 4. Bugs ouverts

Aucun bug ouvert à ce jour.
