# Spécifications — Ressources (socle de ProjectDesk)

> **Statut : brouillon en cours de rédaction avec le porteur (2026-10-12).** Le porteur repart de
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

**DSI n'est pas une équipe** (porteur, 2026-10-12) : elle disparaît de partout (listes, menus,
sélecteurs, congés, timesheet…). Il n'y a pas de niveau au-dessus des équipes.

Les rôles se **cumulent** : une même personne peut être administrateur, responsable d'une équipe,
chef d'un projet et membre d'un autre.

## 3. Pour chaque ressource (personne)

- **Poste** : son métier (Chef de projet, Lead technique, Développeur…) — liste administrable.
  Le poste est descriptif : il ne donne aucun droit.
- **Rôle / accès** : ce qu'elle peut faire dans l'application (voir § 2 et § 4).
- **Statut** : Actif / Inactif.

## 4. Qui gère les ressources

Les **administrateurs**, **responsables d'équipe** et **chefs de projet** peuvent ajouter,
affecter, modifier et supprimer des ressources. Les membres non.

## 5. Questions ouvertes

1. **[À décider] Périmètre de gestion** : un responsable gère-t-il seulement les ressources de
   ses équipes, et un chef de projet seulement celles de ses projets ? (l'administrateur : tout)
2. **[À décider] Rattachement d'une personne** : une personne appartient-elle à une équipe
   (même sans projet, ex. un responsable), ou seulement aux projets où elle travaille ?
3. **[À décider] Rôle / accès** : est-il **déduit** de ses affectations (responsable de…, chef
   de…, membre de…) plus la case « Administrateur », ou **choisi** à part ?
4. **[À décider] Lecteur** : garde-t-on un rôle « Lecteur » sur un projet (consulte sans modifier) ?
5. **[À décider] Inactif** : une personne devient-elle inactive par une date de départ, par un
   simple bouton, ou les deux ? Que deviennent ses affectations ?
6. **[À décider] Supprimer** : supprimer une personne efface ses absences, heures et daily ;
   faut-il plutôt la passer « Inactive » et réserver la suppression aux administrateurs ?

## 6. Écart avec l'application actuelle (pour information)

- **DSI** existe en base comme « direction » (une ligne de `equipes`, et une organisation de
  connexion Neon Auth). Elle porte 3 fiches (Thomas ; Cerine Kerarma en double, dont « Cerine
  KERARMA ») et regroupe Applications, IA, AMOA. Sa suppression demande d'abord de décider où vont
  ces personnes (et leurs comptes de connexion) — **[À décider]**.

- Équipe : **un seul** responsable désigné aujourd'hui (`equipes.responsable_id`) → à étendre à plusieurs.
- Projet : un « chef » sur la fiche projet (`projets.chef_id`) **plus** des affectations
  « Chef de projet » → à unifier (plusieurs chefs par les affectations).
- Personne : rattachée à **une** équipe (`ressources.equipe_id`).
- Toute évolution de la base sera une migration additive, sans perte de données (règle n°8).
