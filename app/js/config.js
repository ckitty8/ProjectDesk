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

  // Neon Auth (Better Auth) et Neon Data API — projet Neon « ProjectDesk », branche production.
  // Surchargeables pour les tests via window.CONFIG_SURCHARGE (voir tests/serveur-simule.js).
  NEON_AUTH_URL: 'https://ep-lucky-mud-b1gqp3gd.neonauth.c-5.eu-central-1.aws.neon.tech/neondb/auth',
  DATA_API_URL: 'https://ep-lucky-mud-b1gqp3gd.apirest.c-5.eu-central-1.aws.neon.tech/neondb/rest/v1',

  // Congés : droit annuel de congés payés (jours ouvrés)
  DROIT_CP_ANNUEL: 25,

  // Sprints de 2 semaines : un sprint de référence sert à numéroter tous les autres
  SPRINT_REFERENCE: { numero: 19, debut: '2026-09-14' },
  DUREE_SPRINT_JOURS: 14,

  // Timesheet : journée de référence et cible d'occupation (dashboard)
  HEURES_PAR_JOUR: 7.5,
  CIBLE_OCCUPATION: 85,

  // Projets « à surveiller » : échéance dans moins de N jours
  ALERTE_ECHEANCE_JOURS: 30
};

// Libellés « système » des référentiels, utilisés par les calculs.
// Valeurs initiales ; au chargement, synchroniserLibellesSysteme() (etat.js) les remplace par
// les libellés actuels de la base, retrouvés par leur clé technique (valeurs_referentiel.cle =
// nom de la propriété en minuscules, ex. EN_COURS → 'en_cours') : un administrateur peut donc
// les renommer (migration 007) sans casser les calculs.
const STATUTS_PROJET = { PLANIFIE: 'Planifié', EN_COURS: 'En cours', A_RISQUE: 'À risque', EN_RETARD: 'En retard', TERMINE: 'Terminé' };
const STATUTS_TICKET = { A_FAIRE: 'À faire', EN_COURS: 'En cours', EN_REVUE: 'En revue', TERMINE: 'Terminé' };
const ROLES_PROJET = { CHEF: 'Chef de projet', MEMBRE: 'Membre', LECTEUR: 'Lecteur' };
const ABSENCES = { CP: 'Congés payés', FERIE: 'Jours férié' };   // CP : décompté du droit annuel ; FERIE : affiché sur les jours fériés
// Référentiel en base → objet de libellés système ci-dessus
const LIBELLES_SYSTEME = { stp: STATUTS_PROJET, stt: STATUTS_TICKET, role: ROLES_PROJET, abs: ABSENCES };

// Statuts techniques (contraintes CHECK en base) et leur affichage
const STATUTS_DEMANDE = {
  nouvelle: { libelle: 'Nouvelle', fond: '#E8EEFF', texte: '#0033AD', point: '#003CC8' },
  analyse: { libelle: 'En analyse', fond: '#FFF1DC', texte: '#8A4B00', point: '#D98A1C' },
  acceptee: { libelle: 'Acceptée', fond: '#E3F5EC', texte: '#0B6B4F', point: '#0F8A6B' },
  refusee: { libelle: 'Refusée', fond: '#F1F3F7', texte: '#4A5363', point: '#8A93A3' }
};
const STATUTS_FEUILLE = {
  en_saisie: { libelle: 'En saisie', fond: '#E8EEFF', texte: '#0033AD' },
  soumise: { libelle: 'Soumise', fond: '#F1E9FB', texte: '#5E2CA5' },
  validee: { libelle: 'Validée', fond: '#E3F5EC', texte: '#0B6B4F' },
  a_completer: { libelle: 'À compléter', fond: '#FFF1DC', texte: '#8A4B00' }
};
const CONFIANCES = { haute: ['#E3F5EC', '#0B6B4F'], moyenne: ['#FFF1DC', '#8A4B00'], faible: ['#FDE8E8', '#A32020'] };
const TYPES_CHAMP = ['Texte court', 'Texte long', 'Liste', 'Date', 'Nombre', 'Fichier'];

// Surcharge éventuelle (tests automatisés avec un serveur simulé)
if (window.CONFIG_SURCHARGE) Object.assign(CONFIG, window.CONFIG_SURCHARGE);

/* ============================================================
   Bulles d'information (composant C.aide) — un seul endroit pour les textes.
   Chaque clé est utilisée à côté de l'élément qu'elle explique ; une valeur peut
   être une fonction quand le texte dépend d'un libellé administrable.
   ============================================================ */
const AIDES = {
  sectionGeneral: 'Vue consolidée de toutes les équipes, en lecture seule : rien ne s’y modifie, même pour un administrateur.',
  sectionMoi: 'Ce que vous modifiez : vos notes, vos projets, les congés et l’organisation de vos équipes, vos heures, les demandes de votre équipe.',
  avancementMoyen: 'Moyenne de l’avancement (%) des projets non terminés.',
  projetsRisque: 'Projets au statut « À risque » ou « En retard ».',
  tauxOccupation: `Heures saisies ÷ heures attendues de la semaine. Attendu = jours ouvrés (hors week-ends, fériés et absences) × ${CONFIG.HEURES_PAR_JOUR} h × capacité de chaque personne. Cible : ${CONFIG.CIBLE_OCCUPATION} %.`,
  projetsSurveiller: `Projets à risque, en retard, ou dont l’échéance tombe dans les ${CONFIG.ALERTE_ECHEANCE_JOURS} prochains jours.`,
  pinceau: 'Choisissez un type puis cliquez sur un jour pour le poser ; cliquer à nouveau le retire. Les jours fériés (JF) s’affichent automatiquement et ne se cliquent pas. « ½ » = demi-journée.',
  // Fonction : le libellé du type décompté est administrable (lu au moment de l'affichage)
  droitAnnuel: () => `Solde = droit annuel (${CONFIG.DROIT_CP_ANNUEL} j) − jours de « ${ABSENCES.CP} ». Les autres types ne sont pas décomptés. Une demi-journée compte 0,5.`,
  capaciteSprint: 'Par sprint de 2 semaines : jours-homme disponibles / théoriques. Théorique = jours ouvrés × capacité (%) de chaque personne ; disponible = théorique moins les absences.',
  ressourcesUnite: 'Nombre de fiches de l’unité et de ses équipes ; « dont N en direct » = personnes rattachées à la direction elle-même.',
  responsableRole: 'Unité : son responsable. Projet : son chef. Personne : son rôle sur le projet (Chef de projet et Membre peuvent le modifier, Lecteur le consulte).',
  statutUnite: 'Une unité inactive reste visible mais n’est plus proposée dans le formulaire de demande. Une unité ne peut être supprimée que vide.',
  valeursListe: 'Renommer une valeur met à jour toutes les fiches qui l’utilisent. Une valeur utilisée ne peut pas être supprimée : passez-la en Inactive.',
  completude: 'Heures saisies ÷ heures attendues de la semaine, toutes personnes confondues.',
  aValider: 'Feuilles soumises par les membres : le responsable d’équipe (rôle owner ou admin) les valide ou les renvoie. Une feuille validée est figée.',
  dailyVisibilite: 'Vos notes sont lisibles par les personnes de vos équipes (Général › Daily des équipes) et par les administrateurs.',
  referentielSysteme: 'Valeurs « système » : utilisées par les calculs et les droits. Renommables (les données suivent), désactivables, mais non supprimables.',
  joursFeries: 'Exclus des jours ouvrés (capacité, timesheet, heures attendues) et affichés « JF » dans les calendriers.',
  rolesEquipe: 'Chaque équipe est un espace de connexion : owner et admin invitent des membres et valident les feuilles de temps ; member travaille dans l’équipe.',
  avancementProjet: 'Avancement (%) du projet ; « x/y » = tickets terminés sur le total.'
};
