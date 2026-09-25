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
// Ils sont protégés en base (valeurs_referentiel.systeme = true : ni renommage ni suppression).
const STATUTS_PROJET = { PLANIFIE: 'Planifié', EN_COURS: 'En cours', A_RISQUE: 'À risque', EN_RETARD: 'En retard', TERMINE: 'Terminé' };
const STATUTS_TICKET = { A_FAIRE: 'À faire', EN_COURS: 'En cours', EN_REVUE: 'En revue', TERMINE: 'Terminé' };
const ROLES_PROJET = { CHEF: 'Chef de projet', MEMBRE: 'Membre', LECTEUR: 'Lecteur' };
const ABSENCE_CP = 'Congés payés';

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
