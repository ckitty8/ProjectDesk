/* ============================================================
   Types des données de ProjectDesk (lignes lues dans la base, noms en camelCase comme dans l'application actuelle)
   ------------------------------------------------------------
   Ils décrivent les colonnes utilisées par la logique métier (calculs, droits, périmètre) ; ils s'enrichissent avec les
   écrans. Les tables sont celles de db/migrations/ (voir DAT § 4).
   ============================================================ */

/** Date au format ISO « AAAA-MM-JJ », sans fuseau */
export type Iso = string;

export interface Equipe {
  id: string;
  nom: string;
  parentId: string | null;
  responsableId?: string | null;
  prefixe?: string;
  type?: string;
  couleur?: string;
  /** Unité désactivée (false) : affichée « Inactive » */
  actif?: boolean;
}

export interface Ressource {
  id: string;
  /** Nom complet « Prénom Nom » : affiché partout, recomposé à chaque modification du prénom ou du nom (migration 048) */
  nom: string;
  /** Prénom et nom de famille saisis (migration 048) ; vides tant que la fiche n'a pas été modifiée : voir prenomEtNom */
  prenom?: string | null;
  nomFamille?: string | null;
  equipeId: string;
  userId?: string | null;
  email?: string | null;
  poste?: string | null;
  /** Capacité de la personne en % (100 par défaut) */
  capacite?: number | null;
  dateArrivee?: Iso | null;
  dateDepart?: Iso | null;
  dateNaissance?: Iso | null;
  typeContrat?: string | null;
}

export interface Projet {
  id: string;
  code: string;
  nom: string;
  equipeId: string;
  chefId?: string | null;
  statut: string;
  avancement?: number | null;
  debut?: Iso | null;
  fin?: Iso | null;
  description?: string | null;
  /** Méthode de gestion : Agile Scrum, Agile Kanban, Cascade, Cycle en V, Test & Learn */
  methode?: string | null;
}

export interface Affectation {
  id?: string;
  projetId: string;
  ressourceId: string;
}

/** Absence posée : 1 journée entière ou 0,5 demi-journée (migration 009) */
export interface Absence {
  ressourceId: string;
  jour: Iso;
  type?: string;
  duree?: number | null;
}

export interface TempsSaisi {
  ressourceId: string;
  projetId: string;
  jour: Iso;
  heures: number | string | null;
}

/** Feuille de temps d'une personne pour un mois (« semaine » = 1er jour du mois) : en_saisie, soumise, validee ou a_completer */
export interface FeuilleTemps {
  ressourceId: string;
  semaine: Iso;
  statut?: string;
  commentaire?: string | null;
}

/** Sprint saisi pour un projet (Mon dashboard › Projet › Sprints) ; « numero » = clé technique, « numeroSprint » = le « Sprint N » affiché */
export interface SprintProjet {
  projetId: string;
  numero: number;
  numeroSprint?: number | null;
  annee?: number | null;
  nom?: string | null;
  debut?: Iso | null;
  fin?: Iso | null;
}

/** Mise en production d'un projet (migrations 039 et 044) : date, version, statut (voir STATUTS_MEP) et tickets livrés */
export interface MiseEnProduction {
  id?: string;
  projetId: string;
  jour?: Iso;
  version?: string | null;
  statut?: string;
  nbUs?: number | null;
  nbBugs?: number | null;
  nbIncidents?: number | null;
}

/** Note de daily d'une personne pour un projet et un jour (table notes_daily_projet) */
export interface NoteDaily {
  userId: string;
  projetId: string;
  jour: Iso;
  texte: string;
  modifieLe?: string | null;
}

/** Réglage d'envoi du daily d'un projet (table envois_daily_projet, migration 019) */
export interface EnvoiDaily {
  projetId: string;
  mode?: string;
  heure?: string;
  /** Numéros de jours (1 = lundi) séparés par des virgules */
  jours?: string;
  sansFeries?: boolean;
  destinataires?: string;
}

export interface ObjectifJoursTravail {
  equipeId: string;
  annee: number;
  jours: number | string;
}

export interface ResponsableEquipe {
  equipeId: string;
  ressourceId: string;
}

/** Rattachement d'une personne à une autre équipe que la sienne (migration 033) */
export interface Rattachement {
  equipeId: string;
  ressourceId: string;
  /** Horodatage du rattachement */
  creeLe?: string | null;
}

/** Administrateur prévu : fiche sans compte dont le statut s'appliquera à la première connexion (table administrateurs_prevus, migration 047) */
export interface AdminPrevu {
  ressourceId: string;
}

/** Rôle d'accès déclaré d'une fiche (table roles_acces, migration 030) */
export interface RoleDeclare {
  ressourceId: string;
  role: string;
}

/** Écran autorisé ou écarté pour une équipe (table droits_equipes, migration 059) ; sans ligne, l'écran est accessible */
export interface LigneEcranEquipe {
  equipeId: string;
  ecran: string;
  acces: boolean;
}

/** Ligne de la matrice des droits (table droits_roles) */
export interface LigneDroit {
  role: string;
  droit: string;
  niveau: string;
}

/** Compte d'un administrateur ou du créateur (tables administrateurs et createur) */
export interface CompteAdmin {
  userId: string;
}

/** Valeur d'une liste métier (table valeurs_referentiel) : type, priorité, statut, rôle, absence… ; la liste est désignée par « referentielId » */
export interface ValeurReferentiel {
  id?: string;
  referentielId: string;
  libelle: string;
  couleur: string;
  actif: boolean;
  /** Clé technique d'une valeur « système » (utilisée par les calculs et les droits) */
  cle?: string | null;
  abrege?: string | null;
  ordre?: number | null;
  /** Valeur « système » : utilisée par les calculs, renommable mais non supprimable */
  systeme?: boolean;
}

/** Liste métier (table referentiels) : stp, role, abs, methode, poste, contrat… */
export interface Referentiel {
  id: string;
  nom: string;
}

/** Colonne du tableau Roadmap (table colonnes_roadmap, migration 056) : liste déroulante, saisie libre ou colonne calculée (Rang, Score) */
export interface ColonneRoadmap {
  id: string;
  /** Clé technique des colonnes de départ (« rang », « score »…) ; absente pour une colonne ajoutée */
  cle?: string | null;
  libelle: string;
  bloc: 'identification' | 'priorisation' | 'cadrage' | 'developpement';
  type: 'liste' | 'libre' | 'calcul';
  /** Format d'une saisie libre */
  format?: 'texte' | 'nombre' | 'date' | null;
  /** Liste déroulante des sprints et mises en production du projet (Sprint DSI, 3.09) au lieu d'un référentiel */
  listeSprints?: boolean;
  /** Référentiel des valeurs d'une liste déroulante (id préfixé « rdm_ ») */
  referentielId?: string | null;
  ordre: number;
}

/** Demande de la Roadmap (table demandes_roadmap, migration 057) : une valeur par colonne, rangée sous l'id de la colonne */
export interface DemandeRoadmap {
  id: string;
  projetId?: string | null;
  /** { id de colonne : valeur } ; une liste déroulante stocke le libellé choisi */
  valeurs: Record<string, string | null | undefined>;
  creeLe?: string;
}
