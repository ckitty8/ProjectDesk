/* ============================================================
   Constantes métier de ProjectDesk (portage TypeScript de app/js/config.js — phase 2 de la migration)
   ------------------------------------------------------------
   Seules les constantes qui servent aux calculs, aux droits et aux menus sont portées ici ; les textes d'aide
   et les couleurs d'interface arrivent avec les écrans (phases 4 et 5). Les listes métier modifiables
   (statuts, rôles de projet, absences…) sont en base (valeurs_referentiel) : les objets ci-dessous portent
   leurs libellés « système », remplacés au chargement par les libellés actuels de la base (phase 3).
   ============================================================ */

/** Paramètres techniques non administrables (source : app/js/config.js, valeurs du porteur) */
export const CONFIG = {
  // Jours de travail attendus par le client par personne et par an, si l'équipe n'a pas d'objectif saisi
  // pour l'année (table objectifs_jours_travail ; valeur du fichier du porteur)
  JOURS_TRAVAIL_CLIENT_DEFAUT: 218,

  // Sprints de 2 semaines : un sprint de référence sert à numéroter tous les autres
  SPRINT_REFERENCE: { numero: 19, debut: '2026-09-14' },
  DUREE_SPRINT_JOURS: 14,

  // Timesheet : journée de référence
  HEURES_PAR_JOUR: 7.5,

  // Calcul type Scrum (exemple chiffré de Trucs et astuces) : temps des cérémonies par personne et par sprint
  // de 2 semaines (planning 4 h, daily 10 × 15 min, revue 2 h, rétrospective 1,5 h, affinage ~1,5 h ≈ 1,5 j) et
  // facteur de focus (part du temps restant réellement consacrée au sprint).
  CEREMONIES_JOURS_SPRINT: 1.5,
  FACTEUR_FOCUS: 0.8,
  // Cible d'occupation (Dashboard général), en %
  CIBLE_OCCUPATION: 85,

  // Projets « à surveiller » : échéance dans moins de N jours
  ALERTE_ECHEANCE_JOURS: 30
} as const;

/** Libellés système des statuts de projet (référentiel « stp ») ; remplacés au chargement par ceux de la base */
export const STATUTS_PROJET = { PLANIFIE: 'Planifié', EN_COURS: 'En cours', A_RISQUE: 'À risque', EN_RETARD: 'En retard', TERMINE: 'Terminé' };

/** Libellés système des rôles sur un projet (référentiel « role ») */
export const ROLES_PROJET = { CHEF: 'Chef de projet', MEMBRE: 'Membre', LECTEUR: 'Lecteur' };

/** Types d'absence système (CP : décompté du droit annuel ; FERIE : affiché sur les jours fériés) */
export const ABSENCES = { CP: 'Congés payés', FERIE: 'Jours férié' };

/** Clé d'un rôle d'accès (Administration › Rôles) */
export type RoleAcces = 'admin' | 'direction' | 'responsable' | 'projet' | 'utilisateur' | 'lecture';

/** Rôles d'accès choisissables, dans l'ordre de la matrice des droits */
export const ROLES_CHOISISSABLES: readonly RoleAcces[] = ['admin', 'direction', 'responsable', 'projet', 'utilisateur', 'lecture'];

/** Niveau d'un droit dans la matrice */
export type Niveau = 'oui' | 'lecture' | 'non';

/** Libellé de chaque rôle d'accès (couleurs d'interface : phase 4) */
export const LIBELLES_ROLES: Record<RoleAcces, string> = {
  admin: 'Administrateur', direction: 'Direction', responsable: 'Responsable d’équipe', projet: 'Projet',
  utilisateur: 'Utilisateur', lecture: 'Lecture seule'
};

/** Périmètre de chaque rôle : sur quoi porte un « Oui » de la matrice */
export const PERIMETRES = {
  createur: 'Tout, toutes équipes', admin: 'Tout', direction: 'Sa direction et ses équipes', responsable: 'Son équipe',
  projet: 'Ses projets', utilisateur: 'Lui-même et ses projets', lecture: 'Ce qu’on lui ouvre'
};

/** Statuts d'une mise en production (même liste que la contrainte de la table mises_en_production, migration 039) */
export const STATUTS_MEP = [
  { valeur: 'prevue', libelle: 'Prévue', ton: 'info' },
  { valeur: 'faite', libelle: 'Faite', ton: 'succes' },
  { valeur: 'reportee', libelle: 'Reportée', ton: 'attention' }
];

/** Sections de la matrice des droits */
export const SECTIONS_DROITS = [{ cle: 'suivi', libelle: 'Suivi de mes équipes' }, { cle: 'dashboard', libelle: 'Mon dashboard' }] as const;

/** Menus ouverts à tous, sans droit de menu (leurs onglets ont un droit) */
export const MENUS_SANS_DROIT = [{ section: 'dashboard', menu: 'Trucs et astuces', libelle: 'Fiches pratiques' }] as const;

/** Un droit de la matrice : menu ou onglet de la barre latérale (clés fixes, reliées aux règles de la base) */
export interface Droit {
  cle: string;
  section: 'suivi' | 'dashboard';
  menu: string;
  libelle: string;
  /** Libellé de l'onglet (droit d'onglet) */
  onglet?: string;
  /** Écran et identifiant de l'onglet masqué si le droit est « Non » */
  ecran?: string;
  id?: string;
  /** Droit dont le niveau est repris si celui-ci manque en base (migrations 037 et 038) */
  repli?: string;
}

/** La matrice des droits : un droit par menu, puis un droit par onglet */
export const DROITS: readonly Droit[] = [
  /* menu : menu de la barre latérale où le droit s'exerce (colonne « Menu » de la matrice, porteur 2026-10-18).
     Suivi de mes équipes : un droit par menu (option B du porteur, migration 037). Si l'un de ces droits
     manque en base, il reprend le niveau de l'ancien droit commun « general » (repli, niveauDuRole). */
  /* onglet : droit d'un onglet (porteur 2026-10-18, maquette docs/maquettes/matrice-par-onglet/, migration 038) —
     ligne « ↳ Onglet » de la matrice ; ecran + id : écran et identifiant de l'onglet masqué si le droit est « Non »
     (ongletPermis, etat.js). Repli : droit dont l'onglet reprend le niveau (valeur de départ de la migration 038). */
  { cle: 'suivi_dashboard', section: 'suivi', menu: 'Dashboard général', libelle: 'Consulter les indicateurs et les projets à surveiller', repli: 'general' },
  { cle: 'daily_equipes', section: 'suivi', menu: 'Daily des équipes', libelle: 'Lire le daily des équipes' },
  { cle: 'onglet_daily_fil', section: 'suivi', menu: 'Daily des équipes', onglet: 'Fil des dailys', ecran: 'dailyEquipes', id: 'fil',
    libelle: 'Notes de la semaine, blocages ouverts', repli: 'daily_equipes' },
  // Synthèse : au départ administrateurs, direction et responsables (mêmes valeurs que « fiches_ressources »)
  { cle: 'onglet_daily_synthese', section: 'suivi', menu: 'Daily des équipes', onglet: 'Synthèse de l’équipe', ecran: 'dailyEquipes', id: 'synthese',
    libelle: 'Synthèse par projet et par personne', repli: 'fiches_ressources' },
  { cle: 'suivi_projets', section: 'suivi', menu: 'Projets et Roadmap', libelle: 'Consulter les projets et la roadmap des équipes', repli: 'general' },
  { cle: 'suivi_ressources', section: 'suivi', menu: 'Gestion des ressources', libelle: 'Consulter le calendrier des congés et la liste des ressources', repli: 'general' },
  { cle: 'onglet_ressources_calendrier', section: 'suivi', menu: 'Gestion des ressources', onglet: 'Calendrier', ecran: 'ressources', id: 'calendrier',
    libelle: 'Congés des équipes, anniversaires', repli: 'suivi_ressources' },
  { cle: 'onglet_ressources_liste', section: 'suivi', menu: 'Gestion des ressources', onglet: 'Liste des ressources', ecran: 'ressources', id: 'liste',
    libelle: 'Personnes, projets, anniversaires', repli: 'suivi_ressources' },
  { cle: 'suivi_timesheet', section: 'suivi', menu: 'Timesheet', libelle: 'Consulter les feuilles de temps des équipes', repli: 'general' },
  { cle: 'valider_timesheet', section: 'suivi', menu: 'Timesheet', libelle: 'Valider / renvoyer les feuilles de temps' },
  { cle: 'mon_dashboard', section: 'dashboard', menu: 'Daily · Saisir mes heures', libelle: 'Saisir son daily, ses heures et ses congés' },
  { cle: 'projets', section: 'dashboard', menu: 'Projets et Roadmap', libelle: 'Mises en production, projets' },
  // Sous-menu Sprints (2026-10-23, auparavant onglet d'Administration ; clé inchangée, enregistrée en base)
  { cle: 'onglet_admin_sprints', section: 'dashboard', menu: 'Projets et Roadmap', onglet: 'Sprints', ecran: 'mesSprints', id: 'sprints',
    libelle: 'Dates des sprints des projets', repli: 'mon_dashboard' },
  { cle: 'conges_equipe', section: 'dashboard', menu: 'Congés', libelle: 'Congés et objectif de jours des autres' },
  { cle: 'onglet_conges_grille', section: 'dashboard', menu: 'Congés', onglet: 'Grille mensuelle', ecran: 'conges', id: 'grille',
    libelle: 'Saisie des congés du mois', repli: 'mon_dashboard' },
  { cle: 'onglet_conges_recap', section: 'dashboard', menu: 'Congés', onglet: 'Récap annuel', ecran: 'conges', id: 'recap',
    libelle: 'Jours travaillés et congés de l’année', repli: 'mon_dashboard' },
  { cle: 'fiches_ressources', section: 'dashboard', menu: 'Liste des ressources', libelle: 'Fiches des personnes, dates d’arrivée et de fin' },
  { cle: 'affecter', section: 'dashboard', menu: 'Liste des ressources', libelle: 'Affecter des personnes aux projets' },
  { cle: 'administration', section: 'dashboard', menu: 'Administration', libelle: 'Équipes, référentiels, jours fériés' },
  { cle: 'comptes', section: 'dashboard', menu: 'Administration', onglet: 'Comptes en attente', ecran: 'monAdmin', id: 'comptes',
    libelle: 'Donner l’accès aux comptes en attente' },
  // Équipes : au départ administrateurs, direction et responsables (mêmes valeurs que « fiches_ressources »)
  { cle: 'onglet_admin_equipes', section: 'dashboard', menu: 'Administration', onglet: 'Équipes', ecran: 'monAdmin', id: 'equipes',
    libelle: 'Créer et modifier les équipes', repli: 'fiches_ressources' },
  { cle: 'onglet_admin_referentiels', section: 'dashboard', menu: 'Administration', onglet: 'Référentiels', ecran: 'monAdmin', id: 'referentiels',
    libelle: 'Listes de valeurs', repli: 'administration' },
  { cle: 'onglet_admin_feries', section: 'dashboard', menu: 'Administration', onglet: 'Jours fériés', ecran: 'monAdmin', id: 'feries',
    libelle: 'Calendrier des jours fériés', repli: 'administration' },
  // « piloter » ne règle que l'envoi du daily (Plan de charge retiré en 2.40, porteur 2026-10-23)
  { cle: 'piloter', section: 'dashboard', menu: 'Administration', libelle: 'Envoi du daily par e-mail' },
  { cle: 'onglet_admin_envoi_daily', section: 'dashboard', menu: 'Administration', onglet: 'Envoi du daily', ecran: 'monAdmin', id: 'envoiDaily',
    libelle: 'Envoi du daily par e-mail, projet par projet', repli: 'piloter' },
  { cle: 'roles', section: 'dashboard', menu: 'Administration', onglet: 'Rôles', ecran: 'monAdmin', id: 'roles',
    libelle: 'Rôles des utilisateurs et matrice des droits' },
  { cle: 'nommer_admin', section: 'dashboard', menu: 'Administration', onglet: 'Nommer un administrateur', libelle: 'Nommer ou retirer un administrateur' },
  // Trucs et astuces : un droit par thème (au départ comme l'ancien droit commun « general »)
  { cle: 'onglet_astuces_agile', section: 'dashboard', menu: 'Trucs et astuces', onglet: 'Agile', ecran: 'astuces', id: 'agile',
    libelle: 'KPI Agile, rôles Scrum', repli: 'general' },
  { cle: 'onglet_astuces_roadmap', section: 'dashboard', menu: 'Trucs et astuces', onglet: 'Roadmap', ecran: 'astuces', id: 'roadmap',
    libelle: 'Fiche pratique Roadmap', repli: 'general' },
  { cle: 'onglet_astuces_test_learn', section: 'dashboard', menu: 'Trucs et astuces', onglet: 'Test & Learn', ecran: 'astuces', id: 'testLearn',
    libelle: 'Fiche pratique Test & Learn', repli: 'general' }
];
