/* ============================================================
   Configuration de l'application ProjectDesk
   ------------------------------------------------------------
   - URL publiques des services Neon (pas des secrets : la sécurité
     repose sur le jeton de connexion et les règles RLS en base).
   - Paramètres métier techniques (non administrables).
   Les listes métier (types, priorités, statuts, rôles, absences)
   sont en base : table valeurs_referentiel (écran Administration).
   ============================================================ */
'use strict';

const CONFIG = {
  // Nom de l'application affiché (barre latérale, connexion, espace demandeur, onglet du navigateur)
  NOM_APPLICATION: 'ProjectDesk',
  // Propriétaire du logiciel (licence propriétaire LICENSE, demande du porteur 2026-10-12) :
  // mention « © année propriétaire » sur la connexion, en bas du menu et dans le menu Aide
  PROPRIETAIRE: 'CIRITEC',
  ANNEE_DROITS: 2026,

  // Neon Auth (Better Auth) et Neon Data API — projet Neon « ProjectDesk », branche production.
  // Surchargeables pour les tests via window.CONFIG_SURCHARGE (voir tests/serveur-simule.js).
  NEON_AUTH_URL: 'https://ep-lucky-mud-b1gqp3gd.neonauth.c-5.eu-central-1.aws.neon.tech/neondb/auth',
  DATA_API_URL: 'https://ep-lucky-mud-b1gqp3gd.apirest.c-5.eu-central-1.aws.neon.tech/neondb/rest/v1',

  // Sprints de 2 semaines : un sprint de référence sert à numéroter tous les autres
  SPRINT_REFERENCE: { numero: 19, debut: '2026-09-14' },
  DUREE_SPRINT_JOURS: 14,

  // Timesheet : journée de référence et cible d'occupation (dashboard)
  HEURES_PAR_JOUR: 7.5,

  // Calcul type Scrum (exemple chiffré de Trucs et astuces) :
  // temps des cérémonies par personne et par sprint de 2 semaines (planning 4 h, daily 10 × 15 min,
  // revue 2 h, rétrospective 1,5 h, affinage du backlog ~1,5 h ≈ 11,5 h ≈ 1,5 j) et facteur de
  // focus (part du temps restant réellement consacrée au sprint : interruptions, support, réunions).
  CEREMONIES_JOURS_SPRINT: 1.5,
  FACTEUR_FOCUS: 0.8,
  CIBLE_OCCUPATION: 85,

  // Projets « à surveiller » : échéance dans moins de N jours
  ALERTE_ECHEANCE_JOURS: 30,

  // Bouton Aide › « Contacter l'administrateur » : adresse email (vide = entrée masquée)
  CONTACT_AIDE: ''
};

// Libellés « système » des référentiels, utilisés par les calculs.
// Valeurs initiales ; au chargement, synchroniserLibellesSysteme() (etat.js) les remplace par
// les libellés actuels de la base, retrouvés par leur clé technique (valeurs_referentiel.cle =
// nom de la propriété en minuscules, ex. EN_COURS → 'en_cours') : un administrateur peut donc
// les renommer (migration 007) sans casser les calculs.
const STATUTS_PROJET = { PLANIFIE: 'Planifié', EN_COURS: 'En cours', A_RISQUE: 'À risque', EN_RETARD: 'En retard', TERMINE: 'Terminé' };
const ROLES_PROJET = { CHEF: 'Chef de projet', MEMBRE: 'Membre', LECTEUR: 'Lecteur' };
/* Rôles d'accès d'une personne : ce qu'elle peut voir et faire. Les six premiers se choisissent
   dans Administration › Rôles (maquette docs/maquettes/roles-droits/, porteur « ok étape 1 »
   2026-10-13) ; chacun correspond à des droits appliqués en base (migration 030 : administrateurs,
   responsables_equipe, rôle dans l'organisation Neon Auth, roles_acces), d'où des clés fixes.
   « Chef de projet » se déduit de ses projets ; « Pas encore de compte » de sa fiche. */
const ROLES_ACCES = {
  admin: { libelle: 'Administrateur', texte: '#0033AD', fond: '#E8EEFF' },
  direction: { libelle: 'Direction', texte: '#3B2A8C', fond: '#E9E6FA' },
  responsable: { libelle: 'Responsable d’équipe', texte: '#5B2DA0', fond: '#EDE6FA' },
  projet: { libelle: 'Projet', texte: '#0B6B4F', fond: '#E3F5EC' },
  utilisateur: { libelle: 'Utilisateur', texte: '#4A5363', fond: '#F1F3F7' },
  lecture: { libelle: 'Lecture seule', texte: '#6B7485', fond: '#F4F5F7' },
  chef: { libelle: 'Chef de projet', texte: '#8A5300', fond: '#FFF1D6' },
  sansCompte: { libelle: 'Pas encore de compte', texte: '#A32020', fond: '#FDECEC' }
};
// Rôles proposés dans Administration › Rôles (dans cet ordre)
const ROLES_CHOISISSABLES = ['admin', 'direction', 'responsable', 'projet', 'utilisateur', 'lecture'];

/* Matrice des droits (Administration créateur depuis le 2026-10-23, auparavant Administration › Rôles ; maquette docs/maquettes/roles-droits/, porteur « ok étape 2 »
   2026-10-13). Clés fixes : chacune est reliée à des règles de la base (migration 031, fonction a_droit) ;
   les NIVEAUX (oui / lecture / non) se règlent dans l'application (table droits_roles). */
const DROITS = [
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
  { cle: 'conges_equipe', section: 'dashboard', menu: 'Congés', libelle: 'Congés des autres personnes' },
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
// Menus ouverts à tous, sans droit de menu : affichés dans la matrice pour qu'elle couvre tous les menus (leurs onglets ont un droit)
const MENUS_SANS_DROIT = [{ section: 'dashboard', menu: 'Trucs et astuces', libelle: 'Fiches pratiques' }];
/* Sections de la matrice des droits (porteur 2026-10-18) : les droits sont rangés sous la section de
   l'application où ils s'exercent — « Suivi de mes équipes » (lecture, daily des équipes, validation des
   timesheets) puis « Mon dashboard » (saisies, ressources, projets, administration, accès). */
const SECTIONS_DROITS = [{ cle: 'suivi', libelle: 'Suivi de mes équipes' }, { cle: 'dashboard', libelle: 'Mon dashboard' }];
// Niveaux d'un droit : libellé et classe CSS de la liste de la matrice (theme.css)
const NIVEAUX_DROIT = {
  oui: { libelle: 'Oui', classe: 'niveau-oui' }, lecture: { libelle: 'Lecture', classe: 'niveau-lecture' }, non: { libelle: 'Non', classe: 'niveau-non' }
};
// Périmètre de chaque rôle : sur quoi porte un « Oui » de la matrice
const PERIMETRES = {
  createur: 'Tout, toutes équipes', admin: 'Tout', direction: 'Sa direction et ses équipes', responsable: 'Son équipe',
  projet: 'Ses projets', utilisateur: 'Lui-même et ses projets', lecture: 'Ce qu’on lui ouvre'
};
const ABSENCES = { CP: 'Congés payés', FERIE: 'Jours férié' };   // CP : décompté du droit annuel ; FERIE : affiché sur les jours fériés
// Référentiel en base → objet de libellés système ci-dessus
/* Envoi du daily par e-mail (demande du porteur, 2026-10-06) : mode choisi PAR PROJET depuis le
   2026-10-07 (Administration › Envoi du daily, table envois_daily_projet, migration 019).
   - power_automate : un flux Power Automate planifié lit le daily du projet à une adresse
     protégée par une clé, puis l'envoie depuis la boîte de l'utilisateur (pro ou perso) ;
   - direct : l'application envoie elle-même l'e-mail à l'heure choisie (tâche planifiée Vercel). */
const MODES_ENVOI_DAILY = [
  { valeur: 'aucun', libelle: 'Désactivé' },
  { valeur: 'power_automate', libelle: 'Power Automate' },
  { valeur: 'direct', libelle: 'Envoi direct' }
];
/* Statuts d'une mise en production (porteur 2026-10-23, maquette roadmap-mep-sprints/) : même liste
   que la contrainte de la table mises_en_production (migration 039) ; ton = couleur du badge (TONS) */
const STATUTS_MEP = [
  { valeur: 'prevue', libelle: 'Prévue', ton: 'info' },
  { valeur: 'faite', libelle: 'Faite', ton: 'succes' },
  { valeur: 'reportee', libelle: 'Reportée', ton: 'attention' }
];
const ENVOI_DAILY_DEFAUT = { mode: 'aucun', heure: '09:30', jours: '1,2,3,4,5', sansFeries: true, destinataires: '' };
/* Méthodes de gestion de projet (référentiel « methode », migration 022 ; demande du porteur 2026-10-08) :
   choisies à la création du projet ; des menus dépendront de la méthode (gestion multi-projet).
   Libellés système (renommables en Administration › Référentiels, retrouvés par leur clé). */
const METHODES_PROJET = { SCRUM: 'Agile Scrum', KANBAN: 'Agile Kanban', CASCADE: 'Cascade', CYCLE_V: 'Cycle en V', TEST_LEARN: 'Test & Learn' };
// Description affichée sous chaque méthode dans le formulaire de création (clé technique → texte)
const DESCRIPTIONS_METHODES = {
  scrum: 'Sprints de 2 semaines, backlog priorisé, vélocité.',
  kanban: 'Flux continu, limites de travail en cours, lead time.',
  cascade: 'Phases successives : besoin, conception, réalisation, recette.',
  cycle_v: 'Cascade avec une phase de test en miroir de chaque phase de conception.',
  test_learn: 'Projets IA : expériences courtes, hypothèse et critère de succès fixés avant, puis décision.'
};
const LIBELLES_SYSTEME = { stp: STATUTS_PROJET, role: ROLES_PROJET, abs: ABSENCES, methode: METHODES_PROJET };

// Statuts techniques (contraintes CHECK en base) et leur affichage
/* Palette de l'application (charte de la maquette pilotage-projet/) : couleurs utilisées par le code.
   Les couleurs des équipes et des valeurs de référentiel sont, elles, en base (administrables). */
const COULEURS = {
  primaire: '#003CC8', barreClaire: '#8CA6E8', succes: '#0F8A6B', alerte: '#D98A1C', danger: '#D14343',
  violet: '#7A3FC2', createur: '#5B2A9E', orange: '#B25E09', neutre: '#4A5363', pale: '#8A93A3', effacer: '#B3BAC7'
};
// Tons des badges : couleur du texte et du fond (C.badgeTon)
const TONS = {
  neutre: { texte: '#4A5363', fond: '#F1F3F7' }, succes: { texte: '#0B6B4F', fond: '#E3F5EC' },
  info: { texte: '#0033AD', fond: '#E8EEFF' }, attention: { texte: '#8A4B00', fond: '#FFF3E0' },
  violet: { texte: '#5B2DA0', fond: '#EDE6FA' }
};
const STATUTS_FEUILLE = {
  en_saisie: { libelle: 'En saisie', fond: '#E8EEFF', texte: '#0033AD' },
  soumise: { libelle: 'Soumise', fond: '#F1E9FB', texte: '#5E2CA5' },
  validee: { libelle: 'Validée', fond: '#E3F5EC', texte: '#0B6B4F' },
  a_completer: { libelle: 'À compléter', fond: '#FFF1DC', texte: '#8A4B00' }
};

// Surcharge éventuelle (tests automatisés avec un serveur simulé)
if (window.CONFIG_SURCHARGE) Object.assign(CONFIG, window.CONFIG_SURCHARGE);

/* ============================================================
   Bulles d'information (composant C.aide) — un seul endroit pour les textes.
   Chaque clé est utilisée à côté de l'élément qu'elle explique ; une valeur peut
   être une fonction quand le texte dépend d'un libellé administrable.
   ============================================================ */
const AIDES = {
  sectionGeneral: 'Vue consolidée de toutes les équipes, en lecture seule — seule exception : ' +
    'les responsables d’équipe y valident les feuilles de temps de leurs équipes (Timesheet).',
  sectionMoi: 'Ce que vous modifiez : vos notes, vos projets, les congés et l’organisation de vos équipes, vos heures, les sprints des projets.',
  avancementMoyen: 'Moyenne de l’avancement (%) des projets non terminés.',
  projetsRisque: 'Projets au statut « À risque » ou « En retard ».',
  tauxOccupation: `Heures saisies ÷ heures attendues de la semaine. Attendu = jours ouvrés (hors week-ends, fériés ` +
    `et absences) × ${CONFIG.HEURES_PAR_JOUR} h × capacité de chaque personne. Cible : ${CONFIG.CIBLE_OCCUPATION} %.`,
  projetsSurveiller: `Projets à risque, en retard, ou dont l’échéance tombe dans les ${CONFIG.ALERTE_ECHEANCE_JOURS} prochains jours.`,
  pinceau: 'Choisissez un type puis cliquez sur un jour pour le poser ; cliquer à nouveau le retire. ' +
    'Les jours fériés (JF) s’affichent automatiquement et ne se cliquent pas. « ½ » = demi-journée.',
  datesPresence: 'Facultatives. Les jours avant l’arrivée et après le départ ne comptent ni en jours travaillés, ni ' +
    'en congés, ni dans la capacité.',
  recapTravail: 'Pour chaque mois, sur les jours de semaine : C = congés posés dans le calendrier (tous types, une demi-journée ' +
    'compte 0,5 ; les jours fériés ne sont pas des congés) ; T = jours travaillés = jours de semaine − jours fériés − congés.',
  sprintsProjet: 'Chaque projet a ses propres sprints, saisis ici (Mon dashboard › Projets et Roadmap › Sprints), affichés par année : pour chacun, le numéro (« Sprint 1 ' +
    '»), l’année, le nom de la version, sa date de début et sa date de fin.',
  productOwners: () => `Product Owner = personne affectée au projet avec le rôle « ${ROLES_PROJET.CHEF} » (ou chef ` +
    `inscrit sur la fiche du projet). Un projet peut en avoir un, deux ou plus ; les membres sont listés en dessous.`,
  statutPersonne: '« Actif » ou « Inactif » : une personne devient inactive dès qu’une date de fin est saisie (fiche), ou en cliquant sur « Actif ' +
    '» (date de fin = aujourd’hui) ; cliquer sur « Inactif » la réactive. Les inactifs sont regroupés dans la section repliable « Inactifs ».',
  roleAcces: 'Ce que la personne peut voir et faire : Administrateur, Direction, Responsable d’équipe, Projet, Utilisateur ou Lecture seule. Il se choisit dans ' +
    'Administration › Rôles (administrateurs). Personne pas encore connectée, ou email non vérifié : le rôle est prévu et ' +
    's’applique à sa connexion. Les rôles de projet (Chef de projet, Membre, Lecteur) se donnent projet par projet.',
  valeursListe: 'Renommer une valeur met à jour toutes les fiches qui l’utilisent. Une valeur utilisée ne peut pas être supprimée : passez-la en Inactive.',
  completude: `Heures saisies ÷ heures attendues du mois. Attendu = jours de semaine hors fériés, ` +
    `absences et jours hors présence × ${CONFIG.HEURES_PAR_JOUR} h × capacité de la personne.`,
  aValider: 'Feuilles soumises par les membres : le responsable d’équipe (rôle owner ou admin) les valide ou les renvoie. Une feuille validée est figée.',
  dailyVisibilite: 'Un daily par projet. Il est lu (Suivi de mes équipes › Daily des équipes) par les personnes affectées au projet, par le ' +
    'responsable de l’unité du projet et des unités au-dessus, et par les administrateurs. Un jour de congé d’une journée, aucun daily n’est attendu.',
  referentielSysteme: 'Valeurs « système » : utilisées par les calculs et les droits. Renommables (les données suivent), désactivables, mais non supprimables.',
  joursFeries: 'Exclus des jours ouvrés (capacité, timesheet, heures attendues) et affichés « JF » dans les calendriers.',
  rolesEquipe: 'Chaque équipe est un espace de connexion : owner et admin invitent des membres et valident les feuilles de temps ; member travaille dans l’équipe.',
  syntheseProjets: 'Pour chaque projet de l’unité : nombre de membres absents ce jour / nombre de membres. Orange = au moins un absent ; rouge = plus de la moitié.',
  avancementProjet: 'Avancement (%) du projet.',
  envoiDaily: 'Chaque projet en cours choisit son mode. Power Automate : votre flux planifié lit le daily du projet (adresse + clé du projet) et l’envoie ' +
    'depuis votre boîte, pro ou perso. Envoi direct : l’application envoie l’e-mail à l’heure ' +
      'choisie. Réglable par le chef du projet, les responsables de son unité et les administrateurs.'
};

/* ============================================================
   Bouton « Aide » (en-tête) — guides affichés dans une fenêtre.
   GUIDE_ECRANS : à quoi sert chaque écran et comment l'utiliser (clé = id d'écran).
   GUIDES : pages générales du menu Aide. Chaque guide = liste de paragraphes.
   ============================================================ */
const GUIDE_ECRANS = {
  dashboard: ['Vue d’ensemble de toutes les équipes : indicateurs clés et projets à surveiller.',
    'Survolez les ⓘ pour le détail des calculs.'],
  projets: ['Tous les projets, groupés par équipe, en lecture seule.', 'Filtrez par équipe en haut à droite ; un clic sur une ligne ouvre le détail du projet.'],
  ressources: ['Calendrier mensuel des absences et annuaire de toutes les personnes, en lecture seule.',
    'Pour poser un congé : Mon dashboard › Gestion des ressources › Congés.'],
  timesheet: ['Heures déclarées par personne sur un mois (saisie mensuelle), avec la complétude et le statut de chaque feuille.', 'Changez de mois avec les flèches.'],
  dailyEquipes: ['Le daily de vos projets pour un jour donné, et les blocages signalés. Le responsable d’une unité voit tous les projets ' +
    'de son unité et des équipes rattachées.', 'Filtrez par projet ; changez de jour avec les flèches. Les absents (congés) sont signalés.'],
  daily: ['Un daily par projet où vous êtes affecté(e) : Hier, Aujourd’hui, Blocages ; tapez, il s’enregistre automatiquement.',
    'Un jour de congé (Congés), aucun daily n’est attendu. Le champ « Hier » rappelle ce que vous aviez prévu la veille.'],
  mesProjets: ['« + Nouveau projet » crée un projet dans votre équipe ; un projet se modifie depuis Liste des ressources.',
    'Saisissez les mises en production (date, version, nombre de bugs, d’incidents et d’US livrés, statut) des projets que vous pouvez modifier ; ' +
    'chaque champ s’enregistre dès qu’il change.',
    'Tout le monde les voit dans Suivi de mes équipes › Projets et Roadmap › Planning projet (repères ▲).'],
  mesSprints: ['Créez les sprints de chaque projet : numéro, année, version, date de début et de fin ; chaque champ s’enregistre dès qu’il change.',
    'Ils s’affichent dans Suivi de mes équipes › Projets et Roadmap › Planning projet.'],
  conges: ['Deux onglets : la grille mensuelle (poser les absences) et le récap annuel (jours travaillés et congés par mois).',
    'Dans la grille : choisissez un type d’absence, puis cliquez sur les jours. Les jours fériés sont affichés automatiquement.'],
  listeRessources: ['L’organisation par équipe : à gauche les équipes, leur responsable et leurs projets ; à droite le détail de ce que vous choisissez.',
    'Une équipe : son responsable (même hors projet), ses projets et tous ses membres avec leur rôle ' +
      'd’accès. Un projet : ses Product Owners, puis ses membres. Actifs et Inactifs se replient d’un clic.',
    '« Fiche » modifie une personne : dates d’arrivée et de départ, rôle d’accès (Administrateur, Responsable d’équipe, Membre), ses projets.',
    'Postes et Types de contrat (en bas à gauche) : les listes utilisées dans les fiches des personnes.'],
  monTimesheet: ['Saisissez vos heures du mois, par projet et par jour (JF = férié, Abs = absence posée), puis soumettez le mois.',
    'Le responsable d’équipe la valide ou la renvoie dans « Suivi de mes équipes » ; une feuille validée n’est plus modifiable.'],
  adminCreateur: ['Réservée au créateur. Simulation des rôles : voir l’application comme une personne avec un rôle donné, ' +
    'en lecture seule ; le bandeau violet permet de changer de rôle ou de revenir.',
    'Matrice des droits : ce que chaque rôle peut faire (Oui, Lecture, Non), menu par menu et onglet par onglet ; modifiable par le créateur seul.',
    'Qui a quel rôle : les personnes rangées sous leur rôle d’accès.'],
  monAdmin: ['Onglet Rôles (administrateurs) : le rôle d’accès de chaque personne.',
    'Onglet Comptes en attente (administrateurs) : les personnes inscrites qui n’ont pas encore accès ; choisissez leur équipe et leur fiche, puis « Donner l’accès ».',
    'Pour les administrateurs : équipes, référentiels (listes et libellés) et jours fériés.',
    'Les KPI Agile sont dans le menu Mon dashboard › Trucs et astuces.'],
  astuces: ['Deux thèmes en haut : « Agile » (KPI Scrum et Kanban, rôles Scrum) et « Roadmap » (construire et faire vivre une roadmap).',
    'KPI Agile : choisissez un projet en haut ; chaque KPI est illustré par un exemple calculé sur ce projet (« réel » si les données existent, sinon « illustratif »).'],
  choixEquipe: ['Choisissez l’équipe dans laquelle vous travaillez ; vous pourrez en changer à tout moment (bas de la barre latérale).']
};
const GUIDES = {
  premiersPas: { titre: 'Premiers pas', paragraphes: [
    '1. Mon dashboard › Liste des ressources : « + Ajouter une équipe », puis choisissez-la à gauche.',
    '2. Sur l’équipe : « + Personne » pour créer la fiche de chaque personne (avec son email : son compte y sera lié à sa connexion) et « + Projet ».',
    '3. Sur chaque projet : « + Ajouter un Product Owner » et « + Membre » pour affecter les personnes avec leur rôle (Chef de projet = Product Owner, Membre, Lecteur).',
    '4. Mon dashboard › Administration › Équipes : invitez les personnes par email pour qu’elles se connectent.',
    '5. Congés : posez les absences ; Saisir mes heures : saisissez vos heures ; Daily : notez l’avancement du jour.'] },
  roles: { titre: 'Rôles et droits', paragraphes: [
    'Suivi de mes équipes : tout le monde consulte tout ; seuls les responsables d’équipe y valident les feuilles de temps (Timesheet).',
    'Mon dashboard : vous modifiez ce qui concerne vos équipes et vos projets.',
    'Rôle sur un projet : Chef de projet et Membre peuvent le modifier ; Lecteur le consulte seulement.',
    'Rôle dans une équipe : owner et admin invitent des membres et valident les feuilles de temps ; member travaille dans l’équipe.',
    'Administrateur : crée les directions et équipes, gère les listes (référentiels) et les jours fériés, donne l’accès aux comptes en attente.',
    'Administrateurs : nomment les rôles d’accès de chacun (Administration › Rôles), y compris d’autres administrateurs.',
    'Créateur (un seul compte, ★ dans le bloc utilisateur) : tous les droits sur toutes les équipes, même sans en être membre.',
    'Compte sans équipe : attend qu’un administrateur lui donne l’accès (Administration › Comptes en attente), puis entre directement.'] }
};

/* ============================================================
   Mon dashboard › Trucs et astuces : KPI Agile.
   Chaque KPI = [clé, nom, définition / formule, lecture] ; l'exemple chiffré
   est calculé par l'écran (mon-admin.js) à partir du projet choisi.
   ============================================================ */
const KPI_AGILE = [
    { titre: 'Scrum', kpi: [
      ['velocite', 'Vélocité', 'Points (ou éléments du backlog) terminés par sprint ; moyenne glissante des 3 derniers sprints.',
        'Sert à prévoir ; ne se compare pas entre équipes.'],
      ['capacite', 'Capacité', 'Jours-homme disponibles sur le sprint (absences, fériés, temps partiel déduits).',
        'Calcul type : (disponible − cérémonies) × focus.'],
      ['engagement', 'Engagement tenu (say/do)', 'Points terminés ÷ points engagés au sprint planning.', 'Cible 80–100 % ; en dessous, l’équipe s’engage trop.'],
      ['burndown', 'Burndown du sprint', 'Travail restant (points ou heures) jour par jour.', 'Une courbe plate = blocage ; une chute tardive = éléments trop gros.'],
      ['burnup', 'Burnup de release', 'Travail terminé cumulé face au périmètre total.', 'Montre aussi l’ajout de périmètre en cours de route.'],
      ['objectif', 'Objectif de sprint atteint', 'Part des sprints dont l’objectif est atteint.', 'Plus parlant que la vélocité pour le métier.'],
      ['focus', 'Facteur de focus', 'Vélocité ÷ jours-homme disponibles.', 'Stable = prévisions fiables.'],
      ['debordement', 'Débordement (carry-over)', 'Points non terminés reportés au sprint suivant.', 'Doit rester faible.'],
      ['defauts', 'Défauts échappés', 'Anomalies trouvées après la livraison (par sprint ou par release).', 'Indicateur de qualité.'],
      ['imprevus', 'Dette et imprévus', 'Part du sprint consacrée aux anomalies et demandes non planifiées.', 'Au-delà de 20 %, prévoir une marge dans la capacité.'],
      ['bonheur', 'Bonheur de l’équipe', 'Note de 1 à 5 recueillie en rétrospective.', 'Signal précoce de surcharge.'] ] },
    { titre: 'Kanban', kpi: [
      ['leadTime', 'Lead time', 'Délai entre la demande et la livraison.', 'Ce que vit le demandeur ; à suivre en médiane et 85e centile.'],
      ['cycleTime', 'Cycle time', 'Délai entre le début du travail et la livraison.', 'Ce que maîtrise l’équipe ; base des engagements de délai.'],
      ['debit', 'Débit (throughput)', 'Nombre d’éléments terminés par semaine.', 'Sert aux prévisions (méthode Monte-Carlo).'],
      ['wip', 'Travail en cours (WIP)', 'Nombre d’éléments en cours, par colonne.',
        'Loi de Little : cycle time moyen = WIP ÷ débit ; limiter le WIP raccourcit les délais.'],
      ['cfd', 'Diagramme de flux cumulé (CFD)', 'Nombre d’éléments par état, cumulé dans le temps.', 'Une bande qui s’élargit = goulet d’étranglement.'],
      ['age', 'Âge du travail en cours', 'Depuis combien de jours chaque élément est en cours.',
        'Repère les éléments qui s’enlisent avant qu’ils ne dépassent le délai.'],
      ['efficacite', 'Efficacité du flux', 'Temps de travail actif ÷ lead time.', 'Souvent 15–40 % ; le reste est de l’attente.'],
      ['bloque', 'Temps bloqué', 'Durée et nombre de blocages par élément.', 'À croiser avec les « Blocages » du daily.'],
      ['sle', 'Engagement de délai (SLE)', 'Ex. : « 85 % des éléments livrés en moins de 10 jours ».', 'Se déduit de l’historique des cycle times.'] ] } ];

/* ============================================================
   Organigramme des rôles Agile Scrum (Trucs et astuces, demande du porteur 2026-10-08)
   Version détaillée : Product Ownership partagé entre PO fonctionnel et PO technique,
   équipe de développement avec tech lead, développeurs, QA, et rôles d'appui (UX/UI, DevOps).
   Sources : Scrum Guide 2020 (PO, Scrum Master, Developers) ; PO technique, tech lead et QA
   = rôles d'organisation usuels des équipes Scrum en entreprise (non définis par le Scrum Guide).
   famille → couleur de la carte (FAMILLES_ROLES_SCRUM).
   ============================================================ */
const FAMILLES_ROLES_SCRUM = {
  metier: { libelle: 'Métier', couleur: '#4A5363' },
  produit: { libelle: 'Produit', couleur: '#003CC8' },
  facilitation: { libelle: 'Facilitation', couleur: '#7A3FC2' },
  technique: { libelle: 'Technique', couleur: '#0F8A6B' },
  qualite: { libelle: 'Qualité', couleur: '#B25E09' }
};
const ROLES_SCRUM = {
  sponsor: { titre: 'Sponsor / Direction métier', famille: 'metier',
    mission: 'Commanditaire : finance le produit et fixe le cap.',
    actions: ['Arbitre budget et priorités stratégiques', 'Valide la roadmap avec les PO', 'Lève les blocages hors de l’équipe'],
    ceremonies: ['Revue (jalons)'] },
  partiesPrenantes: { titre: 'Parties prenantes & utilisateurs', famille: 'metier', pointille: true,
    mission: 'Expriment les besoins et utilisent le produit.',
    actions: ['Remontent besoins et irritants au PO fonctionnel', 'Testent les incréments livrés', 'Donnent leur avis en revue de sprint'],
    ceremonies: ['Revue'] },
  poFonctionnel: { titre: 'PO fonctionnel', famille: 'produit', sousTitre: 'Product Owner',
    mission: 'Porte la vision produit et la valeur métier.',
    actions: ['Rédige les user stories et critères d’acceptation', 'Priorise le backlog fonctionnel', 'Recette et accepte les fonctionnalités'],
    lien: '↔ QA : critères d’acceptation', ceremonies: ['Planning', 'Affinage', 'Revue'] },
  poTechnique: { titre: 'PO technique', famille: 'produit', sousTitre: 'Technical Product Owner',
    mission: 'Porte le backlog technique et sa valeur.',
    actions: ['Dette, architecture, sécurité, performance, montées de version',
      'Co-priorise avec le PO fonctionnel un backlog unique', 'Interlocuteur infra, sécurité et architecture'],
    lien: '↔ Tech lead : solutions et backlog technique', ceremonies: ['Planning', 'Affinage', 'Revue'] },
  scrumMaster: { titre: 'Scrum Master', famille: 'facilitation', pointille: true, sousTitre: 'au service de toute l’équipe',
    mission: 'Garant du cadre Scrum et de l’amélioration continue.',
    actions: ['Anime les cérémonies (daily, rétro…)', 'Lève les obstacles, protège l’équipe des interruptions', 'Suit les KPI : vélocité, burndown, say/do'],
    ceremonies: ['Toutes'] },
  techLead: { titre: 'Tech lead', famille: 'technique', sousTitre: 'référent technique',
    mission: 'Garant de la qualité technique de l’équipe.',
    actions: ['Conçoit les solutions avec le PO technique', 'Revues de code, normes, choix techniques', 'Découpe et estime avec l’équipe, accompagne les développeurs'],
    ceremonies: ['Planning', 'Affinage', 'Daily', 'Rétro'] },
  developpeurs: { titre: 'Développeurs', famille: 'technique', sousTitre: 'front, back, mobile',
    mission: 'Réalisent l’incrément du sprint.',
    actions: ['Développent les user stories', 'Tests unitaires, revues croisées', 'Estiment et s’engagent sur le sprint'],
    ceremonies: ['Toutes'] },
  qa: { titre: 'QA / Testeurs', famille: 'qualite', sousTitre: 'assurance qualité',
    mission: 'Garantissent que ce qui est livré fonctionne.',
    actions: ['Stratégie et cas de test avec le PO fonctionnel', 'Automatisent la non-régression', 'Vérifient la Definition of Done, remontent les anomalies'],
    ceremonies: ['Planning', 'Affinage', 'Daily', 'Revue'] },
  uxUi: { titre: 'UX / UI', famille: 'produit', pointille: true, sousTitre: 'si besoin',
    mission: 'Conçoivent l’expérience utilisateur.',
    actions: ['Parcours et maquettes', 'Tests utilisateurs', 'Design system'],
    ceremonies: ['Affinage', 'Revue'] },
  devops: { titre: 'DevOps', famille: 'technique', pointille: true, sousTitre: 'si besoin',
    mission: 'Industrialisent la livraison.',
    actions: ['Intégration et déploiement continus (CI/CD)', 'Environnements de recette et de production', 'Supervision'],
    ceremonies: ['Daily', 'Rétro'] }
};
/* Qui fait quoi : ● = responsable, ○ = contribue (colonnes = clés de ROLES_SCRUM) */
const QUI_FAIT_QUOI_SCRUM = {
  colonnes: ['poFonctionnel', 'poTechnique', 'scrumMaster', 'techLead', 'developpeurs', 'qa'],
  lignes: [
    ['Vision et roadmap du produit', '●', '○', '', '○', '', ''],
    ['User stories et critères d’acceptation', '●', '○', '', '○', '○', '○'],
    ['Backlog technique (dette, architecture, sécurité)', '○', '●', '', '●', '○', ''],
    ['Priorisation du backlog', '●', '●', '', '○', '', ''],
    ['Conception technique', '', '○', '', '●', '○', ''],
    ['Développement et tests unitaires', '', '', '', '○', '●', ''],
    ['Tests fonctionnels et non-régression', '○', '', '', '', '○', '●'],
    ['Recette et acceptation', '●', '○', '', '', '', '○'],
    ['Animation des cérémonies', '○', '○', '●', '', '', ''],
    ['Levée des obstacles', '', '', '●', '○', '', '']
  ]
};

/* ============================================================
   Trucs et astuces › Roadmap (demande du porteur 2026-10-12, maquette docs/maquettes/astuces-agile-roadmap/)
   Fiche pratique en lecture seule : définition, chaîne vision → sprint, trois formats de roadmap,
   format conseillé selon la méthode du projet (METHODES de la création de projet), bonnes
   pratiques et pièges. Sources : pratiques usuelles de product management (roadmap
   « Now / Next / Later ») et de gestion de projet (Gantt, cycle en V).
   ============================================================ */
const ROADMAP_ASTUCES = {
  definition: 'Une roadmap dit où l’on va et pourquoi — pas la liste des tâches datées.',
  precision: 'Elle traduit la vision en grandes étapes ; le détail vit dans le backlog et ' +
    'les sprints. Sa précision diminue avec l’horizon : sûr pour le trimestre, indicatif au-delà.',
  // Chaîne de la vision au sprint : [étape, explication, couleur]
  chaine: [
    ['Vision', 'Pourquoi le produit existe (3 à 5 ans)', '#003CC8'],
    ['Roadmap', 'Grandes étapes par horizon, reliées à la vision', '#0F8A6B'],
    ['Backlog', 'Éléments priorisés, détaillés juste à temps', '#B25E09'],
    ['Sprint / release', 'Ce qui est livré et montré', '#4A5363']],
  // Formats : titre, sous-titre, couleur du titre, fond des 3 exemples, 3 exemples [titre, détail], quand l'utiliser
  formats: [
    { titre: 'Now / Next / Later', sousTitre: 'Horizons sans dates fermes', couleur: '#0F8A6B', fond: ['#E3F5EC', '#FFF1D6', '#F1F3F7'],
      exemples: [['Now', 'engagé, en cours'], ['Next', 'prochain, à affiner'], ['Later', 'idées, à valider']], quand: 'produit, incertitude forte, Kanban.' },
    { titre: 'Datée (Gantt)', sousTitre: 'Jalons, dépendances, chemin critique', couleur: '#003CC8', fond: ['#E8EEFF', '#E8EEFF', '#E8EEFF'],
      exemples: [['Cadrage', '→ 15/11'], ['Réalisation', '→ 31/01'], ['Recette', '→ 28/02']], quand: 'cascade, cycle en V, contrat ou contrainte réglementaire.' }],
  // Selon la méthode du projet : [méthode, format conseillé, unité de planification, revue de la roadmap]
  methodes: [
    ['Agile Scrum', 'Now / Next / Later', 'Releases et objectifs de sprint', 'À chaque sprint review'],
    ['Agile Kanban', 'Now / Next / Later', 'Flux continu, éléments priorisés', 'Mensuelle (revue de flux)'],
    ['Cascade', 'Datée (Gantt)', 'Phases et jalons', 'Comité de pilotage'],
    ['Cycle en V', 'Datée (Gantt), conception et recettes en miroir', 'Phases, livrables, recettes', 'Comité de pilotage, à chaque jalon'],
    ['Test & Learn', 'Now / Next / Later par phase (exploration → pilote)', 'Expériences de 2 semaines', 'À chaque décision go / no-go']],
  bonnesPratiques: [
    'Partir du résultat attendu (problème à résoudre), pas de la fonctionnalité',
    'Relier chaque étape à la vision du produit',
    'Précision décroissante : trimestre sûr, au-delà indicatif',
    'Vérifier la capacité (congés) avant de s’engager',
    'Revoir à date fixe et afficher la date de mise à jour',
    'Adapter le niveau de détail au public (direction, équipe, métiers)'],
  pieges: [
    'Promettre des dates fermes à plus de 6 mois',
    'Confondre roadmap et backlog (trop de détail)',
    'Une roadmap jamais mise à jour',
    'Tout en priorité 1',
    'Oublier les dépendances entre équipes',
    'Ajouter sans retirer : la capacité n’est pas extensible']
};

/* ============================================================
   Trucs et astuces › Test & Learn (demande du porteur 2026-10-15 : méthode utilisée pour les projets IA)
   Fiche pratique en lecture seule : boucle hypothèse → décision, carte d'expérience, phases d'un
   projet IA avec critères de passage, indicateurs propres à l'IA, rituels, bonnes pratiques et pièges.
   Sources : démarche « Build-Measure-Learn » (Lean Startup, E. Ries), pratiques usuelles
   d'évaluation des systèmes d'IA générative (jeu d'évaluation de référence, évaluation humaine).
   Exemples tirés des projets IA de l'équipe (Chatbot CDO, Vie de Ville).
   ============================================================ */
const TEST_AND_LEARN = {
  definition: 'Test & Learn : avancer par petites expériences mesurées plutôt que par un grand plan figé.',
  precision: 'Adapté aux projets IA, où l’on ne sait pas à l’avance si le modèle sera assez fiable : chaque ' +
    'expérience teste une hypothèse en peu de temps, avec un critère de succès fixé AVANT, puis on décide.',
  // Boucle : [étape, explication, couleur]
  boucle: [
    ['Hypothèse', '« Nous croyons que… pour… mesuré par… »', '#003CC8'],
    ['Expérience', 'Le plus petit test qui répond (POC, prototype, pilote)', '#7A3FC2'],
    ['Mesure', 'Jeu d’évaluation, retours utilisateurs, coûts', '#0F8A6B'],
    ['Apprentissage', 'Ce qui marche, ce qui ne marche pas, pourquoi', '#B25E09'],
    ['Décision', 'Persévérer, pivoter ou arrêter', '#D14343']],
  // Carte d'expérience : [rubrique, à remplir, exemple]
  carte: [
    ['Hypothèse', 'Ce que l’on croit et pour qui', 'Le chatbot CDO répond seul à 70 % des questions des commerciaux sur les lots'],
    ['Expérience', 'Le test minimal, son périmètre', '50 vraies questions posées au chatbot par 3 commerciaux'],
    ['Mesure', 'L’indicateur et comment on le relève', 'Taux de bonnes réponses, noté par le PO fonctionnel'],
    ['Critère de succès', 'Fixé avant le test', '≥ 70 % de bonnes réponses, 0 réponse dangereuse'],
    ['Durée', 'Boîte de temps courte', '2 semaines'],
    ['Résultat', 'Chiffres obtenus', '62 % de bonnes réponses ; erreurs sur les prix grille'],
    ['Décision', 'Persévérer / pivoter / arrêter, et la suite', 'Pivoter : ajouter la grille des prix à la base de connaissance, retester']],
  // Phases d'un projet IA : [phase, objectif, durée indicative, critère de passage (go / no-go)]
  phases: [
    ['1. Exploration', 'Vérifier que le cas d’usage a de la valeur et que les données existent', '1 à 2 semaines', 'Données accessibles, sponsor et utilisateurs identifiés'],
    ['2. Preuve de concept (POC)', 'Montrer que l’IA sait faire sur un petit jeu de test', '2 à 4 semaines', 'Critère de qualité atteint sur le jeu d’évaluation'],
    ['3. Pilote', 'Tester avec de vrais utilisateurs, en conditions réelles', '4 à 8 semaines', 'Adoption, satisfaction, coût par requête acceptable'],
    ['4. Industrialisation', 'Mettre en production : sécurité, supervision, support', 'selon le périmètre', 'Validation sécurité / RGPD, exploitation prête'],
    ['5. Amélioration continue', 'Suivre la qualité et itérer (prompts, données, modèle)', 'en continu', 'Indicateurs stables ou en hausse']],
  // Ce que l'on mesure sur un projet IA : [indicateur, définition, exemple]
  indicateurs: [
    ['Taux de bonnes réponses', 'Réponses justes ÷ réponses évaluées, sur un jeu de référence', '31 / 50 = 62 %'],
    ['Hallucinations', 'Réponses inventées ou fausses présentées comme vraies', '3 sur 50 questions'],
    ['Couverture', 'Questions auxquelles l’IA sait répondre ÷ questions posées', '80 %'],
    ['Satisfaction', 'Note ou pouce levé des utilisateurs', '4,1 / 5'],
    ['Coût par requête', 'Coût du modèle et de l’infrastructure ÷ nombre de requêtes', '0,02 € / question'],
    ['Temps de réponse', 'Délai moyen entre la question et la réponse', '3,5 s'],
    ['Adoption', 'Utilisateurs actifs ÷ utilisateurs visés', '18 / 40 commerciaux']],
  rituels: [
    'Revue d’expérience chaque semaine : résultats, décision, prochaine hypothèse',
    'Journal des apprentissages partagé (ce qui a été testé, chiffres, décision)',
    'Démo courte aux utilisateurs à la fin de chaque expérience',
    'Point go / no-go avec le sponsor à la fin de chaque phase'],
  bonnesPratiques: [
    'Écrire l’hypothèse et le critère de succès avant de tester',
    'Constituer tôt un jeu d’évaluation (questions et réponses attendues)',
    'Tester avec de vraies données et de vrais utilisateurs dès que possible',
    'Versionner prompts, données et modèle pour comparer les essais',
    'Vérifier sécurité, RGPD et règles de données (DLP) dès l’exploration',
    'Garder des expériences courtes : 2 semaines maximum'],
  pieges: [
    'Tester sans critère de succès, puis « trouver » que c’est réussi',
    'Juger la qualité sur quelques exemples choisis',
    'Industrialiser un POC sans pilote utilisateur',
    'Ignorer le coût par requête jusqu’à la mise en production',
    'Ne jamais arrêter une piste qui ne donne pas de résultat',
    'Oublier de noter ce qui a échoué (et pourquoi)']
};
