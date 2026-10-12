# Spécifications — Ressources (socle de ProjectDesk)

> **Statut : brouillon en cours de rédaction avec le porteur (2026-10-12) — réponses aux 6 premières questions intégrées.** Le porteur repart de
> zéro sur la gestion des ressources : elle conditionne tout le reste de l'application.
> Aucune maquette ni aucun code tant que ce document n'est pas validé. Les points marqués
> **[À décider]** attendent la réponse du porteur.

## 1. Les trois niveaux

1. **Équipe** (ex. Applications, IA, AMOA)
2. **Projet**, rattaché à une équipe (ex. VISTA, CDO dans Applications)
3. **Membres** de chaque projet

## 2. Qui fait quoi (relations)

| Rôle | Où | Combien par élément | Une personne peut… |
|------|----|---------------------|--------------------|
| Responsable d'équipe | une équipe | **1 ou plusieurs** par équipe | être responsable de **plusieurs équipes** |
| Chef de projet | un projet | **1 ou plusieurs** par projet | être chef de **plusieurs projets** |
| Membre | un projet | **1 ou plusieurs** par projet | travailler dans **plusieurs projets** |
| Administrateur | toute l'application | — | **cumuler** : être aussi responsable, chef de projet ou membre |

**DSI n'est pas une équipe** (porteur, 2026-10-12) : **supprimée le 2026-10-12** (base, application,
connexion). Il n'y a pas de niveau au-dessus des équipes.

Les rôles se **cumulent** : une même personne peut être administrateur, responsable d'une équipe,
chef d'un projet et membre d'un autre.

## 3. Pour chaque ressource (personne)

- **Poste** : son métier (Chef de projet, Lead technique, Développeur…) — liste administrable.
  Le poste est descriptif : il ne donne aucun droit.
- **Rôle / accès** : voir § 5.
- **Statut** : Actif / Inactif (voir § 6).

**Rattachement** (décision du 2026-10-12) : une personne **n'appartient pas à une équipe**. Elle
est rattachée **seulement par ce qu'elle fait** :
- responsable d'une ou plusieurs équipes ;
- chef de projet, membre ou lecteur d'un ou plusieurs projets.

Une personne sans aucune affectation figure dans une liste « Sans affectation ».

## 4. Qui gère les ressources

| Qui | Périmètre |
|-----|-----------|
| Administrateur | tout |
| Responsable d'équipe | les personnes de **ses équipes** (de leurs projets) |
| Chef de projet | les personnes de **ses projets** |
| Membre, Lecteur | rien |

Gérer = ajouter, affecter, modifier, passer inactive. **Supprimer** définitivement une personne
est réservé aux **administrateurs** (cela efface ses congés, heures et daily).

## 5. Rôles et accès aux écrans

- Un **rôle** donne accès à certains **écrans** (ex. un rôle ouvre Mon dashboard, un autre non).
- Chaque rôle contient la **liste des profils** (personnes) qui l'ont.
- Les rôles d'affectation restent : responsable d'équipe, chef de projet, membre, **lecteur**.
- **Lecteur** sur un projet : consulte sans modifier ; il **n'a pas accès au menu Mon dashboard**.
- Les rôles se cumulent (un administrateur peut aussi être responsable, chef ou membre).

## 6. Statut Actif / Inactif

- Une personne devient inactive par une **date de départ** ou par un **bouton** (les deux).
- Une personne inactive **garde ses affectations** (historique) mais **n'apparaît plus** nulle
  part dans l'application (listes, sélecteurs, congés, timesheet, daily).

## 7. Questions ouvertes

1. **[À décider] Doublon Cerine** : il reste deux fiches dans Applications — « Cerine KERARMA »
   (compte de connexion lié) et « Cerine Kerarma » (sans compte, arrivée le 23/03/2026). Laquelle garder ?
2. **[À décider] Liste des rôles et écrans** : quels rôles (ex. Administrateur, Responsable,
   Chef de projet, Membre, Lecteur) et quels écrans pour chacun ? Le rôle d'une personne est-il
   **choisi** par un administrateur (liste des profils dans le rôle) ou **déduit** de ses
   affectations ?
3. **[À décider] Congés & timesheet** : aujourd'hui groupés par équipe d'appartenance. Sans
   appartenance, une personne apparaîtra sous **chaque équipe** de ses projets : est-ce voulu ?

## 8. Écart avec l'application actuelle (pour information)

- **DSI supprimée le 2026-10-12** (sauvegarde Neon « sauvegarde-avant-suppression-dsi-2026-10-12 ») :
  Applications, IA, AMOA détachées ; fiches Thomas et « Cerine KERARMA » rattachées à Applications
  et leurs comptes ajoutés à l'équipe Applications (accès conservé) ; fiche « Cerine Kerarma » vide
  de DSI (sans compte ni donnée) supprimée ; ligne `equipes`, membres, invitations et organisation
  de connexion DSI supprimés. Compteurs vérifiés : projets 2, affectations 3, absences 155, temps 1.

- Équipe : **un seul** responsable désigné aujourd'hui (`equipes.responsable_id`) → à étendre à plusieurs.
- Projet : un « chef » sur la fiche projet (`projets.chef_id`) **plus** des affectations
  « Chef de projet » → à unifier (plusieurs chefs par les affectations).
- Personne : rattachée à **une** équipe (`ressources.equipe_id`) → n'est plus une appartenance ;
  les droits d'équipe (aujourd'hui : membres de l'organisation de connexion de l'équipe) devront
  venir des rôles et affectations.
- Rôles : aujourd'hui fixes (administrateur, owner / admin / member d'une équipe, rôle sur projet) ;
  les écrans accessibles par rôle sont à créer.
- Toute évolution de la base sera une migration additive, sans perte de données (règle n°8).
