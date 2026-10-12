# Spécifications — Ressources (socle de ProjectDesk)

> **Statut : validée par le porteur le 2026-10-12, avec les maquettes `docs/maquettes/ressources-v2/` (fiche, rôles et menus).**
> Vocabulaire : on dit **Chef de projet** (et non Product Owner), porteur 2026-10-12.
> **Liste des ressources : le porteur garde le design de production** (navigation à gauche, détail à
> droite) avec les fonctionnalités ci-dessous (DAT 2.01) ; l'organigramme (variante C de
> `ressources-v2-variantes/`) va dans **Suivi de mes équipes › Dashboard général**, visible de
> **tous les profils** avec toutes les équipes, en consultation (porteur, 2026-10-12). Le porteur repart de
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

Gérer = ajouter, affecter, modifier, passer inactive. Une personne créée par un chef de projet ou un
responsable est **obligatoirement affectée** à l'un des projets qu'il gère ; seul un administrateur peut
la laisser « Sans affectation » (porteur, 2026-10-12). **Supprimer** définitivement une personne
est réservé aux **administrateurs** (cela efface ses congés, heures et daily).

## 5. Rôles et accès aux écrans (validé le 2026-10-12)

- Un **rôle** décide quels **menus** une personne voit.
- Le rôle est **déduit automatiquement** de ce que fait la personne : responsable d'une équipe →
  rôle Responsable ; chef d'un projet → rôle Chef de projet ; membre → Membre ; lecteur → Lecteur.
  Seul **Administrateur** se coche à la main. Les rôles se **cumulent** : une personne voit les
  menus de tous ses rôles.
- **Lecteur** : consulte sans modifier ; **pas d'accès à Mon dashboard**.

Menus par rôle (réglage par défaut, validé) :

| Menu | Administrateur | Responsable d'équipe | Chef de projet | Membre | Lecteur |
|---|---|---|---|---|---|
| Suivi de mes équipes (dashboard, daily des équipes, projets) | oui | oui | oui | oui | oui, lecture seule |
| Mon dashboard (daily, congés, saisir mes heures) | oui | oui | oui | oui | non |
| Liste des ressources (gérer les personnes) | tout | ses équipes | ses projets | non | non |
| Plan de charge | oui | oui | oui | non | non |
| Valider les timesheets | oui | oui | non | non | non |
| Administration | oui | non | non | non | non |

**Réglage** : ce tableau (menus × rôles) est modifiable dans **Administration**, dans un onglet
visible **uniquement du créateur**.

**Congés & capacité, timesheet** (porteur, 2026-10-12) : déjà gérés, on garde le fonctionnement
actuel (vues « Par équipe » — chaque personne une seule fois — et « Par projet », sans doublon).

## 6. Statut Actif / Inactif

- Une personne devient inactive par une **date de départ** ou par un **bouton** (les deux).
- Une personne inactive **garde ses affectations** (historique) mais **n'apparaît plus** nulle
  part dans l'application (listes, sélecteurs, congés, timesheet, daily).

## 7. Questions ouvertes

Aucune. (Doublon Cerine : le porteur garde les deux fiches, 2026-10-12.)

## 8. Écart avec l'application actuelle (pour information)

- **DSI supprimée le 2026-10-12** (sauvegarde Neon « sauvegarde-avant-suppression-dsi-2026-10-12 ») :
  Applications, IA, AMOA détachées ; fiches Thomas et « Cerine KERARMA » rattachées à Applications
  et leurs comptes ajoutés à l'équipe Applications (accès conservé) ; fiche « Cerine Kerarma » vide
  de DSI (sans compte ni donnée) supprimée ; ligne `equipes`, membres, invitations et organisation
  de connexion DSI supprimés. Compteurs vérifiés : projets 2, affectations 3, absences 155, temps 1.

- Équipe : plusieurs responsables (`responsables_equipe`, migration 027) ; l'ancien champ unique n'est plus modifiable (DAT 2.03).
- Projet : chefs unifiés en affectations « Chef de projet » (DAT 2.03) ; le champ de la fiche projet
  n'est plus modifiable. Christelle, inscrite chef de CDO seulement sur la fiche, a été ajoutée en
  affectation « Chef de projet » de CDO le 2026-10-12 (accord du porteur, règle n°8 ; affectations 3 → 4).
- Personne : rattachée à **une** équipe (`ressources.equipe_id`) → n'est plus une appartenance ;
  les droits d'équipe (aujourd'hui : membres de l'organisation de connexion de l'équipe) devront
  venir des rôles et affectations.
- Rôles : aujourd'hui fixes (administrateur, owner / admin / member d'une équipe, rôle sur projet) ;
  les écrans accessibles par rôle sont à créer.
- Toute évolution de la base sera une migration additive, sans perte de données (règle n°8).
