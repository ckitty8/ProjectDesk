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

/* ============================================================
   Bouton « Aide » (en-tête) — guides affichés dans une fenêtre.
   GUIDE_ECRANS : à quoi sert chaque écran et comment l'utiliser (clé = id d'écran).
   GUIDES : pages générales du menu Aide. Chaque guide = liste de paragraphes.
   ============================================================ */
const GUIDE_ECRANS = {
  dashboard: ['Vue d’ensemble de toutes les équipes : indicateurs clés, objectifs (OKR) du trimestre, progression par trimestre et projets à surveiller.',
    'Choisissez le trimestre avec les boutons T1 à T4. Survolez les ⓘ pour le détail des calculs.'],
  projets: ['Tous les projets, groupés par équipe, en lecture seule.', 'Filtrez par équipe en haut à droite ; la flèche ▸ déplie les tickets ; un clic sur une ligne ouvre le détail du projet.'],
  ressources: ['Calendrier mensuel des absences et annuaire de toutes les personnes, en lecture seule.', 'Pour poser un congé : Mon dashboard › Gestion des ressources › Congés & capacité.'],
  administration: ['Consultation des équipes, référentiels et champs du formulaire de demande.', 'Pour les modifier (administrateurs) : Mon dashboard › Administration.'],
  timesheet: ['Heures déclarées par personne et par jour sur une semaine, avec le statut de chaque feuille.', 'Changez de semaine avec les flèches.'],
  dailyEquipes: ['Les notes de daily des personnes de vos équipes pour un jour donné, et les blocages signalés.', 'Filtrez par équipe ; changez de jour avec les flèches.'],
  daily: ['Votre note de daily : tapez, elle s’enregistre automatiquement.', 'Le modèle propose les rubriques Hier / Aujourd’hui / Blocages. Vos coéquipiers la lisent dans Général › Daily des équipes.'],
  mesProjets: ['Planning (Gantt) des projets où vous êtes affecté(e), avec votre rôle.', '« + Nouveau projet » crée un projet dans votre équipe ; un clic sur une barre ouvre le projet (nom, description, chef, membres).'],
  conges: ['Trois onglets : la grille mensuelle (poser les absences), le récap annuel (solde de congés) et la capacité par sprint.',
    'Dans la grille : choisissez un type d’absence, puis cliquez sur les jours. Les jours fériés sont affichés automatiquement.'],
  listeRessources: ['L’organisation complète : directions → équipes → projets → membres.',
    '« + Ajouter une direction », puis sur chaque ligne « + Équipe », « + Projet », « + Membre ». Le crayon modifie ; la corbeille supprime une unité vide.',
    'Onglets Postes et Types de contrat : les listes utilisées dans les fiches des personnes.'],
  monTimesheet: ['Saisissez vos heures par projet et par jour, puis soumettez la semaine.', 'Le responsable d’équipe valide ou renvoie la feuille ; une feuille validée n’est plus modifiable.'],
  monAdmin: ['Demandes adressées à votre équipe (à traiter, accepter, refuser, transformer en projet), formulaire de demande,',
    'et pour les administrateurs : équipes, référentiels (listes et libellés) et jours fériés.'],
  choixEquipe: ['Choisissez l’équipe dans laquelle vous travaillez ; vous pourrez en changer à tout moment (bas de la barre latérale).'],
  demandeur: ['Déposez une demande auprès d’une équipe et suivez son traitement.']
};
const GUIDES = {
  premiersPas: { titre: 'Premiers pas', paragraphes: [
    '1. Mon dashboard › Liste des ressources : « + Ajouter une direction », puis sur la direction « + Équipe ».',
    '2. Sur l’équipe : « + Membre » pour créer la fiche de chaque personne (avec son email : son compte y sera lié à sa connexion) et « + Projet ».',
    '3. Sur chaque projet : « + Membre » pour affecter les personnes avec leur rôle (Chef de projet, Membre, Lecteur).',
    '4. Mon dashboard › Administration › Équipes : invitez les personnes par email pour qu’elles se connectent.',
    '5. Congés & capacité : posez les absences ; Mon timesheet : saisissez les heures ; Daily : notez l’avancement du jour.'] },
  roles: { titre: 'Rôles et droits', paragraphes: [
    'Général : tout le monde consulte tout, rien ne s’y modifie.',
    'Mon dashboard : vous modifiez ce qui concerne vos équipes et vos projets.',
    'Rôle sur un projet : Chef de projet et Membre peuvent le modifier ; Lecteur le consulte seulement.',
    'Rôle dans une équipe : owner et admin invitent des membres et valident les feuilles de temps ; member travaille dans l’équipe.',
    'Administrateur : crée les directions et équipes, gère les listes (référentiels), le formulaire de demande et les jours fériés.',
    'Demandeur (compte sans équipe) : dépose des demandes et suit uniquement les siennes.'] }
};
