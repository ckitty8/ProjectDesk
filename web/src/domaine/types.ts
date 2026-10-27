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
  nom: string;
  equipeId: string;
  userId?: string | null;
  email?: string | null;
  poste?: string | null;
  /** Capacité de la personne en % (100 par défaut) */
  capacite?: number | null;
  dateArrivee?: Iso | null;
  dateDepart?: Iso | null;
  dateNaissance?: Iso | null;
}

export interface Projet {
  id: string;
  code: string;
  nom: string;
  equipeId: string;
  chefId?: string | null;
  statut: string;
  avancement?: number | null;
  fin?: Iso | null;
}

export interface Affectation {
  id?: string;
  projetId: string;
  ressourceId: string;
  /** Libellé du rôle sur le projet (Chef de projet, Membre, Lecteur) */
  role: string;
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

export interface FeuilleTemps {
  ressourceId: string;
  semaine: Iso;
  statut?: string;
}

export interface SprintProjet {
  projetId: string;
  numero: number;
}

export interface MiseEnProduction {
  id?: string;
  projetId: string;
}

export interface EnvoiDaily {
  projetId: string;
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
}

/** Rôle d'accès déclaré d'une fiche (table roles_acces, migration 030) */
export interface RoleDeclare {
  ressourceId: string;
  role: string;
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
  referentielId: string;
  libelle: string;
  couleur: string;
  actif: boolean;
  /** Clé technique d'une valeur « système » (utilisée par les calculs et les droits) */
  cle?: string | null;
  abrege?: string | null;
  ordre?: number | null;
}
