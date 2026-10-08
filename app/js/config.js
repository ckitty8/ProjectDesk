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
  // Vélocité : moyenne glissante sur les N derniers sprints terminés (pratique Scrum usuelle : 3)
  SPRINTS_MOYENNE_VELOCITE: 3,
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
const ENVOI_DAILY_DEFAUT = { mode: 'aucun', heure: '09:30', jours: '1,2,3,4,5', sansFeries: true, destinataires: '' };
/* Répartition idéale du temps d'un sprint par catégorie de travail (demande du porteur 2026-09-27).
   Source : pratiques Scrum usuelles, à ajuster par le porteur. Total = 100 %. La part
   « Cérémonies / réunions » (15 %) correspond à CEREMONIES_JOURS_SPRINT (1,5 j) sur un sprint
   de 10 jours ouvrés : les deux règles restent cohérentes. */
const REPARTITION_SPRINT = [
  { categorie: 'User stories', part: 40, couleur: '#003CC8', aide: 'Fonctionnalités à valeur métier (le cœur du sprint).' },
  { categorie: 'Incidents (prod)', part: 10, couleur: '#D14343', aide: 'Réserve pour les incidents de production non planifiables.' },
  { categorie: 'Bugs (qualif)', part: 10, couleur: '#D98A1C', aide: 'Corrections des anomalies trouvées en qualification.' },
  { categorie: 'Tests', part: 10, couleur: '#0F8A6B', aide: 'Tests, recette, automatisation.' },
  { categorie: 'Technique (serveur, cache, API)', part: 8, couleur: '#7A3FC2', aide: 'Socle technique, dette, performance.' },
  { categorie: 'Documentation', part: 5, couleur: '#4A5363', aide: 'Documentation fonctionnelle et technique.' },
  { categorie: 'Autres sujets', part: 2, couleur: '#8A93A3', aide: 'Imprévus divers.' },
  { categorie: 'Cérémonies / réunions', part: 15, couleur: '#B25E09', aide: 'Planning, daily, revue, rétrospective, affinage.' }
];

/* Méthodes de gestion de projet (référentiel « methode », migration 022 ; demande du porteur 2026-10-08) :
   choisies à la création du projet ; des menus dépendront de la méthode (gestion multi-projet).
   Libellés système (renommables en Administration › Référentiels, retrouvés par leur clé). */
const METHODES_PROJET = { SCRUM: 'Agile Scrum', KANBAN: 'Agile Kanban', CASCADE: 'Cascade', CYCLE_V: 'Cycle en V' };
// Description affichée sous chaque méthode dans le formulaire de création (clé technique → texte)
const DESCRIPTIONS_METHODES = {
  scrum: 'Sprints de 2 semaines, backlog priorisé, vélocité.',
  kanban: 'Flux continu, limites de travail en cours, lead time.',
  cascade: 'Phases successives : besoin, conception, réalisation, recette.',
  cycle_v: 'Cascade avec une phase de test en miroir de chaque phase de conception.'
};
const LIBELLES_SYSTEME = { stp: STATUTS_PROJET, role: ROLES_PROJET, abs: ABSENCES, methode: METHODES_PROJET };

// Statuts techniques (contraintes CHECK en base) et leur affichage
const STATUTS_FEUILLE = {
  en_saisie: { libelle: 'En saisie', fond: '#E8EEFF', texte: '#0033AD' },
  soumise: { libelle: 'Soumise', fond: '#F1E9FB', texte: '#5E2CA5' },
  validee: { libelle: 'Validée', fond: '#E3F5EC', texte: '#0B6B4F' },
  a_completer: { libelle: 'À compléter', fond: '#FFF1DC', texte: '#8A4B00' }
};
const CONFIANCES = { haute: ['#E3F5EC', '#0B6B4F'], moyenne: ['#FFF1DC', '#8A4B00'], faible: ['#FDE8E8', '#A32020'] };

// Surcharge éventuelle (tests automatisés avec un serveur simulé)
if (window.CONFIG_SURCHARGE) Object.assign(CONFIG, window.CONFIG_SURCHARGE);

/* ============================================================
   Bulles d'information (composant C.aide) — un seul endroit pour les textes.
   Chaque clé est utilisée à côté de l'élément qu'elle explique ; une valeur peut
   être une fonction quand le texte dépend d'un libellé administrable.
   ============================================================ */
const AIDES = {
  sectionGeneral: 'Vue consolidée de toutes les équipes, en lecture seule : rien ne s’y modifie, même pour un administrateur.',
  sectionMoi: 'Ce que vous modifiez : vos notes, vos projets, les congés et l’organisation de vos équipes, vos heures, les sprints des projets.',
  avancementMoyen: 'Moyenne de l’avancement (%) des projets non terminés.',
  projetsRisque: 'Projets au statut « À risque » ou « En retard ».',
  tauxOccupation: `Heures saisies ÷ heures attendues de la semaine. Attendu = jours ouvrés (hors week-ends, fériés et absences) × ${CONFIG.HEURES_PAR_JOUR} h × capacité de chaque personne. Cible : ${CONFIG.CIBLE_OCCUPATION} %.`,
  projetsSurveiller: `Projets à risque, en retard, ou dont l’échéance tombe dans les ${CONFIG.ALERTE_ECHEANCE_JOURS} prochains jours.`,
  pinceau: 'Choisissez un type puis cliquez sur un jour pour le poser ; cliquer à nouveau le retire. Les jours fériés (JF) s’affichent automatiquement et ne se cliquent pas. « ½ » = demi-journée.',
  datesPresence: 'Facultatives. Les jours avant l’arrivée et après le départ ne comptent ni en jours travaillés, ni en congés, ni dans la capacité ; les jours attendus par le client sont proratisés sur la période de présence.',
  recapTravail: 'Pour chaque mois, sur les jours de semaine : C = congés posés dans le calendrier (tous types, une demi-journée compte 0,5 ; les jours fériés ne sont pas des congés) ; T = jours travaillés = jours de semaine − jours fériés − congés.',
  objectifClient: 'Nombre de jours de travail attendus par le client pour chaque personne de l’équipe sur l’année. Reste à prendre = total travaillé − ce nombre : vert = jours de congé encore disponibles, rouge = jours pris en trop. Modifiable par un administrateur ou le responsable de l’équipe.',
  ressourcesUnite: 'Nombre de fiches de l’unité et de ses équipes ; « dont N en direct » = personnes rattachées à la direction elle-même.',
  responsableRole: 'Unité : son responsable. Projet : son chef. Personne : son rôle sur le projet (Chef de projet et Membre peuvent le modifier, Lecteur le consulte).',
  sprintsProjet: 'Chaque projet a ses propres sprints, saisis ici (Administration › Sprints), affichés par année : pour chacun, le numéro (« Sprint 1 »), l’année, le nom de la version, sa date de début et sa date de fin. L’onglet Capacité calcule la capacité, la vélocité et la répartition sur ces sprints.',
  statutUnite: 'Projet : son statut (Planifié, En cours…). Personne : « Actif » ou « Inactif » ; elle devient inactive dès qu’une date de fin est saisie, ou en cliquant sur « Actif » (date de fin = aujourd’hui). Une personne inactive n’apparaît plus dans la liste (bouton « Afficher les ressources inactives » pour la revoir) ; cliquer sur « Inactif » la réactive.',
  valeursListe: 'Renommer une valeur met à jour toutes les fiches qui l’utilisent. Une valeur utilisée ne peut pas être supprimée : passez-la en Inactive.',
  completude: `Heures saisies ÷ heures attendues du mois. Attendu = jours de semaine hors fériés, absences et jours hors présence × ${CONFIG.HEURES_PAR_JOUR} h × capacité de la personne.`,
  aValider: 'Feuilles soumises par les membres : le responsable d’équipe (rôle owner ou admin) les valide ou les renvoie. Une feuille validée est figée.',
  dailyVisibilite: 'Un daily par projet. Il est lu (Général › Daily des équipes) par les personnes affectées au projet, par le responsable de l’unité du projet et des unités au-dessus, et par les administrateurs. Un jour de congé d’une journée, aucun daily n’est attendu.',
  referentielSysteme: 'Valeurs « système » : utilisées par les calculs et les droits. Renommables (les données suivent), désactivables, mais non supprimables.',
  joursFeries: 'Exclus des jours ouvrés (capacité, timesheet, heures attendues) et affichés « JF » dans les calendriers.',
  rolesEquipe: 'Chaque équipe est un espace de connexion : owner et admin invitent des membres et valident les feuilles de temps ; member travaille dans l’équipe.',
  syntheseProjets: 'Pour chaque projet de l’unité : nombre de membres absents ce jour / nombre de membres. Orange = au moins un absent ; rouge = plus de la moitié.',
  avancementProjet: 'Avancement (%) du projet.',
  envoiDaily: 'Chaque projet en cours choisit son mode. Power Automate : votre flux planifié lit le daily du projet (adresse + clé du projet) et l’envoie depuis votre boîte, pro ou perso. Envoi direct : l’application envoie l’e-mail à l’heure choisie. Réglable par le chef du projet, les responsables de son unité et les administrateurs.'
};

/* ============================================================
   Bouton « Aide » (en-tête) — guides affichés dans une fenêtre.
   GUIDE_ECRANS : à quoi sert chaque écran et comment l'utiliser (clé = id d'écran).
   GUIDES : pages générales du menu Aide. Chaque guide = liste de paragraphes.
   ============================================================ */
const GUIDE_ECRANS = {
  dashboard: ['Vue d’ensemble de toutes les équipes : indicateurs clés, objectifs (OKR) du trimestre, progression par trimestre et projets à surveiller.',
    'Choisissez le trimestre avec les boutons T1 à T4. Survolez les ⓘ pour le détail des calculs.'],
  projets: ['Tous les projets, groupés par équipe, en lecture seule.', 'Filtrez par équipe en haut à droite ; un clic sur une ligne ouvre le détail du projet.'],
  ressources: ['Calendrier mensuel des absences et annuaire de toutes les personnes, en lecture seule.', 'Pour poser un congé : Mon dashboard › Gestion des ressources › Congés & capacité.'],
  administration: ['Consultation des équipes et des référentiels.', 'Pour les modifier (administrateurs) : Mon dashboard › Administration.'],
  timesheet: ['Heures déclarées par personne sur un mois (saisie mensuelle), avec la complétude et le statut de chaque feuille.', 'Changez de mois avec les flèches.'],
  dailyEquipes: ['Le daily de vos projets pour un jour donné, et les blocages signalés. Le responsable d’une unité voit tous les projets de son unité et des équipes rattachées.', 'Filtrez par projet ; changez de jour avec les flèches. Les absents (congés) sont signalés.'],
  daily: ['Un daily par projet où vous êtes affecté(e) : Hier, Aujourd’hui, Blocages ; tapez, il s’enregistre automatiquement.', 'Un jour de congé (Congés & capacité), aucun daily n’est attendu. Le champ « Hier » rappelle ce que vous aviez prévu la veille.'],
  mesProjets: ['Planning (Gantt) des projets où vous êtes affecté(e), avec votre rôle.', '« + Nouveau projet » crée un projet dans votre équipe ; un clic sur une barre ouvre le projet (nom, description, chef, membres).'],
  conges: ['Trois onglets : la grille mensuelle (poser les absences), le récap annuel (jours travaillés, congés, reste à prendre) et la capacité (en construction ; bouton « Méthode de calcul Scrum »).',
    'Dans la grille : choisissez un type d’absence, puis cliquez sur les jours. Les jours fériés sont affichés automatiquement.'],
  listeRessources: ['L’organisation complète : directions → équipes → projets → membres.',
    '« + Ajouter une direction », puis sur chaque ligne « + Équipe », « + Projet », « + Membre ». Le crayon modifie ; la corbeille supprime une unité vide.',
    'Onglets Postes et Types de contrat : les listes utilisées dans les fiches des personnes.'],
  monTimesheet: ['Saisissez vos heures du mois, par projet et par jour (JF = férié, Abs = absence posée), puis soumettez le mois.', 'Le responsable d’équipe la valide ou la renvoie dans « Suivi de mes équipes » ; une feuille validée n’est plus modifiable.'],
  suiviEquipes: ['Les feuilles de temps du mois des personnes de vos équipes : projets, heures saisies sur attendues, complétude, statut.',
    'Responsable d’équipe : validez ou renvoyez les feuilles soumises. Changez de mois avec les flèches.'],
  previsionnel: ['Réservé aux chefs de projet : choisissez une personne (vous-même ou un membre de vos projets) pour prévoir la répartition de son temps entre ses projets.',
    'Onglet Prévisionnel : jours travaillés du mois (fériés et congés repris automatiquement) × % du temps sur le projet × % de chaque type de tâche. Saisissez les % du projet et des types de tâche des projets dont vous êtes chef.',
    'Onglet Temps réel par sprint : heures prévues et heures réellement saisies (Saisir mes heures) sur les dates d’un sprint, par projet.'],
  monAdmin: ['Onglet Comptes en attente (administrateurs) : les personnes inscrites qui n’ont pas encore accès ; choisissez leur équipe et leur fiche, puis « Donner l’accès ».',
    'Onglet Sprints : les sprints de chaque projet (version, début, fin), utilisés par l’onglet Capacité.',
    'Pour les administrateurs : équipes, référentiels (listes et libellés) et jours fériés.',
    'Les KPI Agile sont dans le menu Mon dashboard › Trucs et astuces.'],
  astuces: ['Les KPI Agile (Scrum et Kanban) : définition, formule, comment les lire.', 'Choisissez un projet en haut : chaque KPI est illustré par un exemple calculé sur ce projet (« réel » si les données existent, sinon « illustratif »).'],
  choixEquipe: ['Choisissez l’équipe dans laquelle vous travaillez ; vous pourrez en changer à tout moment (bas de la barre latérale).']
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
    'Administrateur : crée les directions et équipes, gère les listes (référentiels) et les jours fériés.',
    'Compte sans équipe : attend une invitation d’un administrateur (les demandes sont gérées dans Azure DevOps).'] }
};

/* ============================================================
   Mon dashboard › Trucs et astuces : KPI Agile.
   Chaque KPI = [clé, nom, définition / formule, lecture] ; l'exemple chiffré
   est calculé par l'écran (mon-admin.js) à partir du projet choisi.
   ============================================================ */
const KPI_AGILE = [
    { titre: 'Scrum', kpi: [
      ['velocite', 'Vélocité', 'Points (ou éléments du backlog) terminés par sprint ; moyenne glissante des 3 derniers sprints.', 'Sert à prévoir ; ne se compare pas entre équipes.'],
      ['capacite', 'Capacité', 'Jours-homme disponibles sur le sprint (absences, fériés, temps partiel déduits).', 'Onglet Congés & capacité › Capacité ; calcul type : (disponible − cérémonies) × focus.'],
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
      ['wip', 'Travail en cours (WIP)', 'Nombre d’éléments en cours, par colonne.', 'Loi de Little : cycle time moyen = WIP ÷ débit ; limiter le WIP raccourcit les délais.'],
      ['cfd', 'Diagramme de flux cumulé (CFD)', 'Nombre d’éléments par état, cumulé dans le temps.', 'Une bande qui s’élargit = goulet d’étranglement.'],
      ['age', 'Âge du travail en cours', 'Depuis combien de jours chaque élément est en cours.', 'Repère les éléments qui s’enlisent avant qu’ils ne dépassent le délai.'],
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
    actions: ['Dette, architecture, sécurité, performance, montées de version', 'Co-priorise avec le PO fonctionnel un backlog unique', 'Interlocuteur infra, sécurité et architecture'],
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
