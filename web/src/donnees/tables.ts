/* ============================================================
   Tables chargées à l'ouverture d'une équipe
   (portage de TABLES, TRIS, CLES_UNIQUES et FILTRES de app/js/etat.js — phase 3 de la migration)
   ------------------------------------------------------------
   Toutes les tables sont chargées d'un coup (volumétrie d'équipes projet : quelques milliers de lignes au plus).
   Les tables « typées » sont celles que la logique métier (src/domaine) consomme ; les autres restent des lignes brutes
   jusqu'à la migration de leur écran.
   ============================================================ */
import { ajouterJours } from '../domaine/dates';
import type { Absence, Affectation, CompteAdmin, Equipe, EnvoiDaily, FeuilleTemps, Iso, LigneDroit, MiseEnProduction, ObjectifJoursTravail, Projet,
  Rattachement, NoteDaily, Referentiel, Ressource, ResponsableEquipe, RoleDeclare, SprintProjet, TempsSaisi, ValeurReferentiel } from '../domaine/types';
import type { JourFerie } from '../domaine/calendrier';

/** Données chargées, par clé applicative (mêmes clés que etat.d dans l'application actuelle) */
export interface Donnees {
  equipes: readonly Equipe[];
  ressources: readonly Ressource[];
  projets: readonly Projet[];
  affectations: readonly Affectation[];
  absences: readonly Absence[];
  temps: readonly TempsSaisi[];
  feuilles: readonly FeuilleTemps[];
  sprintsProjet: readonly SprintProjet[];
  repartitionsSprint: readonly { projetId: string }[];
  misesEnProduction: readonly MiseEnProduction[];
  envoisDaily: readonly EnvoiDaily[];
  objectifsTravail: readonly ObjectifJoursTravail[];
  rattachements: readonly Rattachement[];
  responsablesEquipe: readonly ResponsableEquipe[];
  rolesPrevus: readonly RoleDeclare[];
  rolesAcces: readonly RoleDeclare[];
  droitsRoles: readonly LigneDroit[];
  administrateurs: readonly CompteAdmin[];
  createur: readonly CompteAdmin[];
  referentiels: readonly Referentiel[];
  valeurs: readonly ValeurReferentiel[];
  joursFeries: readonly JourFerie[];
  notesProjet: readonly NoteDaily[];
}
export type CleTable = keyof Donnees;

/** Nom SQL de chaque table */
export const TABLES: Record<CleTable, string> = {
  equipes: 'equipes', ressources: 'ressources', projets: 'projets', affectations: 'affectations',
  referentiels: 'referentiels', valeurs: 'valeurs_referentiel', joursFeries: 'jours_feries',
  absences: 'absences', objectifsTravail: 'objectifs_jours_travail', sprintsProjet: 'sprints_projet', repartitionsSprint: 'repartitions_sprint',
  temps: 'temps_saisis', feuilles: 'feuilles_temps',
  notesProjet: 'notes_daily_projet', administrateurs: 'administrateurs', envoisDaily: 'envois_daily_projet',
  createur: 'createur',
  responsablesEquipe: 'responsables_equipe', rolesPrevus: 'roles_prevus', rolesAcces: 'roles_acces', droitsRoles: 'droits_roles',
  rattachements: 'membres_equipe', misesEnProduction: 'mises_en_production'
};
export const CLES_TABLES = Object.keys(TABLES) as CleTable[];

const TRIS: Partial<Record<CleTable, string>> = { joursFeries: 'jour', equipes: 'nom', valeurs: 'ordre', referentiels: 'ordre', projets: 'code' };

// Clé unique de chaque table (défaut : id), ajoutée à l'ordre de tri pour une pagination stable
const CLES_UNIQUES: Partial<Record<CleTable, string>> = {
  envoisDaily: 'projet_id', absences: 'ressource_id,jour', objectifsTravail: 'equipe_id,annee', sprintsProjet: 'projet_id,numero',
  repartitionsSprint: 'projet_id,numero,categorie', joursFeries: 'jour', feuilles: 'ressource_id,semaine',
  notesProjet: 'user_id,jour,projet_id', administrateurs: 'user_id', createur: 'user_id',
  responsablesEquipe: 'equipe_id,ressource_id', rolesPrevus: 'ressource_id', rolesAcces: 'ressource_id', droitsRoles: 'role,droit',
  rattachements: 'equipe_id,ressource_id'
};

/** Ordre de lecture d'une table : tri métier puis clé unique (voir CLES_UNIQUES) */
export const ordreDe = (cle: CleTable): string => [TRIS[cle], CLES_UNIQUES[cle] || 'id'].filter(Boolean).join(',');

// Les notes de daily (celles que je peux lire, voir peut_lire_daily_projet) sont limitées aux JOURS_DAILY derniers jours
export const JOURS_DAILY = 90;

/** Filtres de lecture d'une table (aujourd'hui en paramètre pour rester testable) */
export function filtresDe(cle: CleTable, aujourdhuiIso: Iso): Record<string, string> {
  return { order: ordreDe(cle), ...(cle === 'notesProjet' ? { jour: 'gte.' + ajouterJours(aujourdhuiIso, -JOURS_DAILY) } : {}) };
}

/** Couleur sûre : les couleurs viennent de la base et sont insérées dans des attributs style ; toute valeur autre qu'un
 *  code hexadécimal #RRGGBB est remplacée (protection contre l'injection). */
export const couleurSure = (couleur: unknown, repli = '#E5E7EB'): string =>
  typeof couleur === 'string' && /^#[0-9a-fA-F]{6}$/.test(couleur) ? couleur : repli;
