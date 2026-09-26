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

  // Jours de travail attendus par le client par personne et par an, si l'équipe n'a pas
  // d'objectif saisi pour l'année (table objectifs_jours_travail ; valeur du fichier du porteur)
  JOURS_TRAVAIL_CLIENT_DEFAUT: 218,

  // Sprints de 2 semaines : un sprint de référence sert à numéroter tous les autres
  SPRINT_REFERENCE: { numero: 19, debut: '2026-09-14' },
  DUREE_SPRINT_JOURS: 14,

  // Timesheet : journée de référence et cible d'occupation (dashboard)
  HEURES_PAR_JOUR: 7.5,

  // Calcul type Scrum (affiché à titre d'information dans Capacité par sprint) :
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
  calculScrum: `Méthode usuelle d’estimation de la capacité d’un sprint Scrum, donnée à titre indicatif : elle ne remplace pas la vélocité observée de l’équipe. Paramètres (config.js) : ${CONFIG.CEREMONIES_JOURS_SPRINT} j de cérémonies par personne, facteur de focus ${Math.round(CONFIG.FACTEUR_FOCUS * 100)} %.`,
  recapTravail: 'Pour chaque mois, sur les jours de semaine (fériés compris) : T = jours travaillés ; C = jours non travaillés (jours fériés et absences de tout type, une demi-journée compte 0,5).',
  objectifClient: 'Nombre de jours de travail attendus par le client pour chaque personne de l’équipe sur l’année. Reste à prendre = total travaillé − ce nombre : vert = jours de congé encore disponibles, rouge = jours pris en trop. Modifiable par un administrateur ou le responsable de l’équipe.',
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
  syntheseProjets: 'Pour chaque projet de l’unité : nombre de membres absents ce jour / nombre de membres. Orange = au moins un absent ; rouge = plus de la moitié.',
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
    'et pour les administrateurs : équipes, référentiels (listes et libellés) et jours fériés.',
    'Onglet Trucs et astuces : les KPI Agile (Scrum, Kanban) expliqués, avec des exemples calculés sur un projet (CDO par défaut).'],
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

/* ============================================================
   Mon dashboard › Administration › Trucs et astuces : KPI Agile.
   Chaque KPI = [clé, nom, définition / formule, lecture] ; l'exemple chiffré
   est calculé par l'écran (mon-admin.js) à partir du projet choisi.
   ============================================================ */
const KPI_AGILE = [
    { titre: 'Scrum', kpi: [
      ['velocite', 'Vélocité', 'Points (ou tickets) terminés par sprint ; moyenne glissante des 3 derniers sprints.', 'Sert à prévoir ; ne se compare pas entre équipes.'],
      ['capacite', 'Capacité', 'Jours-homme disponibles sur le sprint (absences, fériés, temps partiel déduits).', 'Onglet Capacité par sprint ; calcul type : (disponible − cérémonies) × focus.'],
      ['engagement', 'Engagement tenu (say/do)', 'Points terminés ÷ points engagés au sprint planning.', 'Cible 80–100 % ; en dessous, l’équipe s’engage trop.'],
      ['burndown', 'Burndown du sprint', 'Travail restant (points ou heures) jour par jour.', 'Une courbe plate = blocage ; une chute tardive = tickets trop gros.'],
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
      ['wip', 'Travail en cours (WIP)', 'Nombre d’éléments en cours, par colonne.', 'Loi de Little : cycle time moyen = WIP ÷ débit ; limiter le WIP raccourcit les délais.'],
      ['cfd', 'Diagramme de flux cumulé (CFD)', 'Nombre d’éléments par état, cumulé dans le temps.', 'Une bande qui s’élargit = goulet d’étranglement.'],
      ['age', 'Âge du travail en cours', 'Depuis combien de jours chaque élément est en cours.', 'Repère les éléments qui s’enlisent avant qu’ils ne dépassent le délai.'],
      ['efficacite', 'Efficacité du flux', 'Temps de travail actif ÷ lead time.', 'Souvent 15–40 % ; le reste est de l’attente.'],
      ['bloque', 'Temps bloqué', 'Durée et nombre de blocages par élément.', 'À croiser avec les « Blocages » du daily.'],
      ['sle', 'Engagement de délai (SLE)', 'Ex. : « 85 % des éléments livrés en moins de 10 jours ».', 'Se déduit de l’historique des cycle times.'] ] } ];
