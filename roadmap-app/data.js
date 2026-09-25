/* ============================================================
   Référentiels métier (repris de la logique du fichier Excel
   "CDO ROADMAP" : listes de valeurs, pipeline de statuts, etc.)
   ============================================================ */

const CATEGORIES = ['DIGITAL', 'PGM', 'COM', 'ADV', 'TECH'];

const ETATS = ['Ouvert', 'Fermé', 'Annulé'];

const OUI_NON = ['Oui', 'Non'];

const CADRAGE_STATUTS = ['Non démarré', 'En cours', 'En attente de validation', 'Réalisé'];

// Pipeline de traitement DSI, dans l'ordre d'avancement (utilisé pour le Kanban)
const STATUT_PIPELINE = [
  'Nouveau',
  'Specs en cours',
  'Prêt pour dév',
  'Dév en cours',
  'Dév terminé',
  'Recette PO',
  'Recette DSI',
  'Recette validée',
  'A déployer en PROD',
  'Terminé'
];
// Statuts "hors flux" affichés à part (colonne repliable côté Kanban)
const STATUT_HORS_FLUX = ['En attente', 'Annulée'];
const ALL_STATUTS = [...STATUT_PIPELINE, ...STATUT_HORS_FLUX];

const ITERATIONS = Array.from({ length: 9 }, (_, i) => `Itération ${i + 1}`);

const TRIMESTRES = [
  'T1 2026', 'T2 2026', 'T3 2026', 'T4 2026',
  'T1 2027', 'T2 2027', 'T3 2027', 'T4 2027',
  'T1 2028', 'T2 2028', 'T3 2028', 'T4 2028'
];

const PRIORITE_LABELS = { 1: 'Haute', 2: 'Moyenne', 3: 'Basse' };

// Couleurs associées à chaque statut (pastilles / colonnes Kanban / roadmap)
const STATUT_COLORS = {
  'Nouveau': '#94a3b8',
  'Specs en cours': '#a78bfa',
  'Prêt pour dév': '#818cf8',
  'Dév en cours': '#60a5fa',
  'Dév terminé': '#2dd4bf',
  'Recette PO': '#fbbf24',
  'Recette DSI': '#fb923c',
  'Recette validée': '#a3e635',
  'A déployer en PROD': '#22d3ee',
  'Terminé': '#4ade80',
  'En attente': '#facc15',
  'Annulée': '#f87171'
};

const ETAT_COLORS = { 'Ouvert': '#22c55e', 'Fermé': '#94a3b8', 'Annulé': '#ef4444' };

const CATEGORIE_COLORS = {
  'DIGITAL': '#6366f1',
  'PGM': '#0ea5e9',
  'COM': '#ec4899',
  'ADV': '#f59e0b',
  'TECH': '#14b8a6'
};

const FIELD_LABELS = {
  demandeur: 'Demandeur',
  parcours: 'Parcours',
  categorie: 'Catégorie métier',
  moisDemande: 'Mois de la demande',
  us: 'US',
  thematique: 'Thématique',
  demande: 'Demande',
  commentaires: 'Commentaires',
  etat: 'Etat',
  prioriteDemandeur: 'Priorité demandeur',
  strategique: 'Stratégique',
  impactClient: 'Impact client',
  impactCollaborateur: 'Impact collaborateur',
  planification: 'Planification',
  score: 'Score',
  cadrageAmoa: 'Cadrage AMOA',
  rang: 'Rang traitement DSI',
  statut: 'Statut',
  complexite: 'Complexité',
  priseEnChargeDSI: 'Pris en charge par la DSI',
  chiffrageDSI: 'Chiffrage DSI (JH)',
  atterrissageChiffrage: 'Atterrissage chiffrage',
  sprintDSI: 'Sprint DSI',
  avancementDev: 'Avancement dév (%)',
  estimeMEP: 'Estimé MEP',
  statutRecette: 'Statut Recette',
  dateMEP: 'Date de MEP',
  statutMEP: 'Statut MEP'
};

/* ------------------------------------------------------------
   Jeu de données de démonstration (générique / anonymisé).
   Remplacez-le par vos propres demandes via "Importer" ou en
   ajoutant des lignes depuis l'application.
   ------------------------------------------------------------ */
const SEED_ITEMS = [
  {
    demandeur: 'Direction Commerciale', parcours: 'Publication', categorie: 'DIGITAL',
    moisDemande: '2026-01-15', us: '30001', thematique: 'PUBLICATION',
    demande: 'Permettre la mise en forme du texte (WYSIWYG) sur la description longue',
    commentaires: '', etat: 'Fermé', prioriteDemandeur: 1, strategique: 'Oui',
    impactClient: 3, impactCollaborateur: 2, planification: 'T1 2026',
    cadrageAmoa: 'Réalisé', statut: 'Terminé', complexite: 2, priseEnChargeDSI: 'Oui',
    chiffrageDSI: 2, atterrissageChiffrage: 'Sprint 42', sprintDSI: '1',
    avancementDev: 100, estimeMEP: '2026-02-10', statutRecette: 'Itération 1',
    dateMEP: '2026-02-10', statutMEP: 'Itération 1'
  },
  {
    demandeur: 'Service Marketing', parcours: 'Promotions', categorie: 'DIGITAL',
    moisDemande: '2026-02-01', us: '30045', thematique: 'PROMOTIONS',
    demande: 'Refonte des écrans de gestion des promotions commerciales',
    commentaires: 'Dépend de la refonte du module Publication', etat: 'Ouvert', prioriteDemandeur: 1,
    strategique: 'Oui', impactClient: 3, impactCollaborateur: 2, planification: 'T2 2026',
    cadrageAmoa: 'En cours', statut: 'Specs en cours', complexite: 4, priseEnChargeDSI: 'Oui',
    chiffrageDSI: 12, atterrissageChiffrage: '', sprintDSI: '', avancementDev: 0,
    estimeMEP: '', statutRecette: '', dateMEP: '', statutMEP: ''
  },
  {
    demandeur: 'Direction Technique', parcours: 'Autre', categorie: 'TECH',
    moisDemande: '2026-01-20', us: '30012 / 30013', thematique: 'IA',
    demande: 'Etude de faisabilité + intégration d\'un chatbot IA de support',
    commentaires: '', etat: 'Ouvert', prioriteDemandeur: 1, strategique: 'Oui',
    impactClient: 3, impactCollaborateur: 3, planification: 'T2 2026',
    cadrageAmoa: 'En cours', statut: 'Dév en cours', complexite: 5, priseEnChargeDSI: 'Oui',
    chiffrageDSI: 25, atterrissageChiffrage: 'Sprint 44', sprintDSI: '3', avancementDev: 40,
    estimeMEP: '', statutRecette: '', dateMEP: '', statutMEP: ''
  },
  {
    demandeur: 'Service Client', parcours: 'Distribution', categorie: 'COM',
    moisDemande: '2026-01-05', us: '29988', thematique: 'MANDAT DE COM INTERNE',
    demande: 'Ajouter un bouton de pré-visualisation du mandat',
    commentaires: '', etat: 'Fermé', prioriteDemandeur: 2, strategique: 'Non',
    impactClient: 1, impactCollaborateur: 2, planification: 'T1 2026',
    cadrageAmoa: 'Réalisé', statut: 'Terminé', complexite: 1, priseEnChargeDSI: 'Oui',
    chiffrageDSI: 1, atterrissageChiffrage: 'Sprint 40', sprintDSI: '1', avancementDev: 100,
    estimeMEP: '2026-01-25', statutRecette: 'Itération 1', dateMEP: '2026-01-25', statutMEP: 'Itération 1'
  },
  {
    demandeur: 'Direction des Programmes', parcours: 'Distribution', categorie: 'PGM',
    moisDemande: '2026-02-10', us: '30102', thematique: 'GRILLE DE PRIX',
    demande: 'Distinguer visuellement la grille de prix en production des autres grilles',
    commentaires: '', etat: 'Ouvert', prioriteDemandeur: 2, strategique: 'Non',
    impactClient: 2, impactCollaborateur: 2, planification: 'T2 2026',
    cadrageAmoa: 'Non démarré', statut: 'Nouveau', complexite: 2, priseEnChargeDSI: 'Oui',
    chiffrageDSI: 3, atterrissageChiffrage: '', sprintDSI: '', avancementDev: 0,
    estimeMEP: '', statutRecette: '', dateMEP: '', statutMEP: ''
  },
  {
    demandeur: 'Service Juridique', parcours: 'Droits et accès', categorie: 'TECH',
    moisDemande: '2026-02-15', us: '30115', thematique: 'RÔLES & HABILITATIONS',
    demande: 'Ajouter un rôle "lecture seule" dans la gestion des habilitations',
    commentaires: '', etat: 'Ouvert', prioriteDemandeur: 3, strategique: 'Non',
    impactClient: 1, impactCollaborateur: 3, planification: 'T3 2026',
    cadrageAmoa: 'Non démarré', statut: 'En attente', complexite: 3, priseEnChargeDSI: 'Non',
    chiffrageDSI: 0, atterrissageChiffrage: '', sprintDSI: '', avancementDev: 0,
    estimeMEP: '', statutRecette: '', dateMEP: '', statutMEP: ''
  },
  {
    demandeur: 'Direction Commerciale', parcours: 'Flux', categorie: 'DIGITAL',
    moisDemande: '2026-01-28', us: '30060', thematique: 'FLUX',
    demande: 'Ajouter une priorité d\'affichage au niveau du flux tranche commerciale',
    commentaires: 'Demande annulée suite à changement de périmètre', etat: 'Annulé',
    prioriteDemandeur: 1, strategique: 'Non', impactClient: 3, impactCollaborateur: 2,
    planification: '', cadrageAmoa: 'Non démarré', statut: 'Annulée', complexite: 2,
    priseEnChargeDSI: 'Non', chiffrageDSI: 0, atterrissageChiffrage: '', sprintDSI: '',
    avancementDev: 0, estimeMEP: '', statutRecette: '', dateMEP: '', statutMEP: ''
  },
  {
    demandeur: 'Service Marketing', parcours: 'Documents & Plans', categorie: 'COM',
    moisDemande: '2026-02-20', us: '30140', thematique: 'DOCUMENTS',
    demande: 'Ajouter de nouvelles natures de documents côté front',
    commentaires: '', etat: 'Ouvert', prioriteDemandeur: 2, strategique: 'Oui',
    impactClient: 2, impactCollaborateur: 2, planification: 'T3 2026',
    cadrageAmoa: 'Réalisé', statut: 'Prêt pour dév', complexite: 2, priseEnChargeDSI: 'Oui',
    chiffrageDSI: 4, atterrissageChiffrage: '', sprintDSI: '', avancementDev: 0,
    estimeMEP: '', statutRecette: '', dateMEP: '', statutMEP: ''
  },
  {
    demandeur: 'Direction Technique', parcours: 'Technique', categorie: 'TECH',
    moisDemande: '2026-01-10', us: '29950', thematique: 'TECHNIQUE',
    demande: 'Job de détection des messages bloqués et redémarrage automatique',
    commentaires: '', etat: 'Fermé', prioriteDemandeur: 2, strategique: 'Non',
    impactClient: 1, impactCollaborateur: 2, planification: 'T1 2026',
    cadrageAmoa: 'Réalisé', statut: 'Terminé', complexite: 2, priseEnChargeDSI: 'Oui',
    chiffrageDSI: 1.5, atterrissageChiffrage: 'Sprint 41', sprintDSI: '1', avancementDev: 100,
    estimeMEP: '2026-01-20', statutRecette: 'Itération 1', dateMEP: '2026-01-20', statutMEP: 'Itération 1'
  },
  {
    demandeur: 'Direction Commerciale', parcours: 'Barème vendeurs', categorie: 'COM',
    moisDemande: '2026-03-01', us: '30201', thematique: 'BAREME VENDEURS',
    demande: 'Création d\'une filière "directeur commercial" dans le barème',
    commentaires: '', etat: 'Ouvert', prioriteDemandeur: 1, strategique: 'Oui',
    impactClient: 1, impactCollaborateur: 3, planification: 'T3 2026',
    cadrageAmoa: 'En attente de validation', statut: 'Recette PO', complexite: 1,
    priseEnChargeDSI: 'Oui', chiffrageDSI: 1, atterrissageChiffrage: 'Sprint 45', sprintDSI: '4',
    avancementDev: 90, estimeMEP: '', statutRecette: '', dateMEP: '', statutMEP: ''
  }
];

// Paramètres par défaut du simulateur de capacité (onglet "Equipe 1" de l'Excel)
const DEFAULT_CAPACITY = {
  nbDev: 3,
  nbPO: 1,
  tjmDev: 800,
  tjmPO: 800,
  joursOuvresParTrimestre: 60
};
