# Spécification — Un rôle unique par personne (fusion « rôle d'accès » + « rôle projet »)

> **Statut : plan à valider par le porteur (2026-11-02). Rien n'est codé ni migré.**
> Les décisions ci-dessous viennent des réponses du porteur ; la conversion des données existantes (§ 3) demande son accord explicite avant toute écriture (règle n°8).

| Date       | Décision du porteur |
|------------|---------------------|
| 2026-11-02 | « Je veux fusionner rôle projet et rôle d'accès pour en faire un qui se nomme **Rôle** » ; choix : **un seul rôle par personne** (vraie fusion), valeurs **sans doublon** |
| 2026-11-02 | Droits : **Chef de projet > Membre > Utilisateur** (le Membre n'a plus les droits du Chef) |
| 2026-11-02 | Le chef d'un projet reste le champ **« Chef de projet » du projet** (`projets.chef_id`) ; les affectations n'ont plus de rôle par ligne |

## 1. Aujourd'hui : deux notions

| | Rôle d'accès | Rôle projet |
|---|---|---|
| Portée | toute l'application, **un seul par personne** | **un par projet** (affectation) |
| Valeurs | Administrateur (statut), Direction, Responsable d'équipe, Projet, Utilisateur, Lecture seule | Chef de projet, Membre, Lecteur |
| Stockage | `roles_acces`, `roles_prevus`, `responsables_equipe`, matrice `droits_roles` | `affectations.role`, référentiel `role` |
| Effet | droits de la matrice, périmètre de lecture, menus | qui peut modifier un projet (`peut_editer_projet`), « Équipe projet » |

Données actuelles : 14 affectations (7 Chef de projet, 7 Membre, 0 Lecteur), 2 rôles d'accès enregistrés, 3 prévus, aucune personne avec des rôles projet différents d'un projet à l'autre.

## 2. Demain : un seul « Rôle »

Six valeurs, plus deux statuts qui restent à part (case « Administrateur » dans Rôles ; Créateur, fixe) :

| Rôle | Portée | Ce qu'il permet | Remplace |
|---|---|---|---|
| **Direction** | sa direction et ses équipes | comme aujourd'hui | accès Direction |
| **Responsable d'équipe** | son équipe | comme aujourd'hui | accès Responsable d'équipe |
| **Chef de projet** | ses projets | tout sur ses projets : modifier le projet, affecter, sprints, MEP, envoi du daily ; daily et heures | accès Projet + rôle projet Chef de projet |
| **Membre** | ses projets | daily et heures ; **sprints et MEP de ses projets** ; ne modifie pas le projet, n'affecte pas, pas d'envoi du daily | rôle projet Membre |
| **Utilisateur** | lui-même | daily, heures, congés ; lecture ; ne modifie aucun projet | accès Utilisateur |
| **Lecture seule** | ce qu'on lui ouvre | lecture seule | accès Lecture seule + rôle projet Lecteur |

- **Un rôle par personne** : plus de rôle différent d'un projet à l'autre. Une personne affectée à plusieurs projets a le même rôle sur tous.
- Les **affectations** restent (qui travaille sur quel projet) mais sans rôle par ligne : « Équipe projet » liste les personnes et leur rôle personnel.
- Le **chef d'un projet** est le champ `projets.chef_id` ; son rôle personnel doit être Chef de projet ou supérieur.
- Le **nom et le prénom, l'équipe, le profil** ne changent pas.

## 3. Conversion des données existantes (à valider personne par personne)

| Fiche | Aujourd'hui | Demain : **Rôle** |
|---|---|---|
| Paul SHERRAT | accès Direction (+ administrateur) | **Direction** |
| Anne CASELLI | rôle prévu Responsable d'équipe (responsable désignée d'Applications) | **Responsable d'équipe** (reste prévu) |
| Dina BELMAHJOUB | rôle prévu Responsable d'équipe | **Responsable d'équipe** (reste prévu) |
| Christelle LABBE | accès Projet + Chef de projet sur 6 projets (+ créatrice, administratrice) | **Chef de projet** |
| Thomas LELIEVRE | rôle prévu Projet + Chef de projet sur 1 projet | **Chef de projet** (reste prévu) |
| Cerine KERARMA (compte) | aucun rôle d'accès (Utilisateur par défaut) + Membre sur 3 projets | **Membre** |
| Nouha BENJELBEN | aucun rôle d'accès + Membre sur 3 projets | **Membre** |
| Lenaic HOUSSOU | aucun rôle d'accès + Membre sur 1 projet | **Membre** |
| Cerine Kerarma (2e fiche, sans compte) | aucun rôle, aucune affectation | **Utilisateur** |

Règle générale (nouvelles fiches et comptes) : rôle choisi dans Administration › Rôles ; par défaut **Utilisateur**. En cas de conflit (rôles projet différents), le plus élevé l'emporte : Direction > Responsable d'équipe > Chef de projet > Membre > Utilisateur > Lecture seule.

À noter : Cerine, Nouha et Lenaic gagnent le droit de saisir les sprints et MEP de leurs projets (rôle Membre), qu'elles n'ont pas aujourd'hui (accès Utilisateur).

## 4. Changements en base (migrations additives d'abord)

1. **Migration A (additive)** : valeurs de `roles_acces` / `roles_prevus` élargies (`chef`, `membre` ; `projet` conservé le temps de la conversion) ; nouvelles fonctions `peut_saisir_projet` (Chef de projet et Membre affectés) et `peut_editer_projet` réécrite (Chef de projet affecté, ou chef désigné, ou gestionnaire de l'unité) ; matrice `droits_roles` : colonnes `chef` et `membre` ajoutées (copie des droits de `projet`, puis Membre limité aux sprints/MEP/saisies).
2. **Conversion** (écritures, **après accord sur le tableau du § 3**) : `roles_acces`, `roles_prevus` et matrice.
3. **Migration B** : règles de lecture / écriture basculées sur le rôle unique (`sprints_projet`, `mises_en_production`, `repartitions_sprint`, `affectations`, `projets`, envoi du daily).
4. **Nettoyage (plus tard, après validation en production)** : colonne `affectations.role` et référentiel `role` retirés ; valeur `projet` retirée.

## 5. Changements d'écran (maquettes PNG à valider avant le code)

- **Administration › Ressources** : « Rôles projet » et « Rôles d'accès » deviennent une seule entrée **Rôle** (lecture seule, 6 valeurs avec portée, droits et nombre de personnes) ; **Profil** inchangé.
- **Administration › Rôles** : une seule liste « Rôle » par personne (6 valeurs) + case Administrateur.
- **Matrice des droits** : colonnes Direction, Responsable d'équipe, Chef de projet, Membre, Utilisateur, Lecture seule (+ Administrateur).
- **Fiche d'une personne** : « Rôle » unique, plus de rôle par projet. **Affectation** (Liste des ressources, nouveau projet) : choix des personnes sans rôle. **Panneau projet** : « Équipe projet » avec le rôle personnel, le chef désigné en tête.
- **Simulation de rôles** (Administration créateur) : 6 cartes.
- **Documents** : DAT (§ 3, § 4, § 5, § 6, § 10), glossaire des rôles, aides, tests.

## 6. Livraison en étapes (chaque étape est validée avant la suivante)

1. **Maquettes** des écrans du § 5, validées par le porteur.
2. **Migration A** + code qui lit les deux modèles (aucun changement visible) — comptages vérifiés.
3. **Conversion des données** (accord sur le § 3) puis bascule du code sur le rôle unique.
4. **Migration B** (règles de la base) + vérification des 6 rôles par la simulation.
5. **Nettoyage** (retrait de `affectations.role`, du référentiel `role`, de `projet`).

## 7. Risques

- Réécriture des règles de sécurité de la base (sprints, MEP, projets, affectations, envoi du daily) : tests de chaque rôle avant mise en ligne.
- Perte de la nuance « Chef sur un projet, Membre sur un autre » (acceptée par le porteur : un seul rôle).
- Rôles prévus : ils suivent la même règle (email vérifié pour appliquer Direction, Responsable d'équipe, Chef de projet, Membre).
