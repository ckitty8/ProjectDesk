/* ============================================================
   Calendrier mensuel des absences : modèle d'affichage (personnes × jours)
   (portage de la logique du composant Calendrier de app/js/ecrans/ressources.js — phase 4 de la migration)
   ------------------------------------------------------------
   Fonctions pures : le composant React (composants/Calendrier.tsx) ne fait que dessiner ce que celles-ci décident.
   Règles reprises de l'application actuelle :
   - week-end et jours fériés sont « fermés » : non cliquables, non décomptés ;
   - un jour férié s'affiche avec le type d'absence « Jours férié » s'il est actif (couleur et abrégé administrables), sinon « F » ;
   - une demi-journée (durée 0,5) est marquée « ½ » et compte pour 0,5 ;
   - en lecture seule, un jour sans absence qui est l'anniversaire de la personne porte 🎂.
   ============================================================ */
import { ABSENCES } from './config';
import { dureeAbsence, estAnniversaire } from './calculs';
import { estJourOuvre, joursDuMois } from './dates';
import type { Absence, Iso, Ressource } from './types';

/** Type d'absence (valeur du référentiel « abs ») */
export interface TypeAbsence {
  libelle: string;
  couleur: string;
  abrege?: string | null;
  actif: boolean;
}

/** Jour férié (table jours_feries) */
export interface JourFerie {
  jour: Iso;
  libelle?: string | null;
}

/** Tout ce qu'il faut pour dessiner un mois */
export interface ContexteMois {
  jours: Iso[];
  feries: ReadonlyMap<Iso, string>;
  types: readonly TypeAbsence[];
  /** Absences indexées par « ressourceId|jour » */
  absences: ReadonlyMap<string, Absence>;
  /** Les mêmes absences en liste (synthèse des absents par projet) */
  liste: readonly Absence[];
  editable: boolean;
}

export function contexteMois(annee: number, mois: number, feries: readonly JourFerie[], types: readonly TypeAbsence[],
  absences: readonly Absence[], editable: boolean): ContexteMois {
  return {
    jours: joursDuMois(annee, mois),
    feries: new Map(feries.map(f => [f.jour, f.libelle || 'Jour férié'])),
    types,
    absences: new Map(absences.map(a => [`${a.ressourceId}|${a.jour}`, a])),
    liste: absences,
    editable
  };
}

/** Ce qui est affiché dans la case d'une personne pour un jour */
export interface CaseJour {
  /** Week-end ou jour férié : grisé, non cliquable */
  ferme: boolean;
  ferie: { libelle: string; type: TypeAbsence | null } | null;
  absence: { type: TypeAbsence; demi: boolean } | null;
  anniversaire: boolean;
  /** Jours d'absence décomptés (0, 0,5 ou 1) */
  jours: number;
}

export function caseJour(ctx: ContexteMois, ressource: Pick<Ressource, 'id' | 'dateNaissance'>, jour: Iso): CaseJour {
  const libelleFerie = ctx.feries.get(jour);
  const ferme = !estJourOuvre(jour, new Set(ctx.feries.keys()));
  const typeFerie = ctx.types.find(t => t.libelle === ABSENCES.FERIE && t.actif) ?? null;
  const ferie = libelleFerie === undefined ? null : { libelle: libelleFerie, type: typeFerie };
  if (ferme) return { ferme, ferie, absence: null, anniversaire: false, jours: 0 };
  const saisie = ctx.absences.get(`${ressource.id}|${jour}`);
  const type = saisie ? ctx.types.find(t => t.libelle === saisie.type) : undefined;
  const demi = !!saisie && dureeAbsence(saisie) === 0.5;
  return {
    ferme,
    ferie,
    absence: type ? { type, demi } : null,
    anniversaire: !ctx.editable && !type && estAnniversaire(ressource.dateNaissance, jour),
    jours: type ? (demi ? 0.5 : 1) : 0
  };
}

/** Texte de la case d'absence : abrégé du type (ou 2 premières lettres), suivi de « ½ » pour une demi-journée */
export const abregeAbsence = (type: TypeAbsence, demi: boolean): string => (type.abrege || type.libelle.slice(0, 2)) + (demi ? '½' : '');

/** Total des jours d'absence d'une personne sur le mois */
export const totalAbsences = (ctx: ContexteMois, ressource: Pick<Ressource, 'id' | 'dateNaissance'>): number =>
  ctx.jours.reduce((somme, j) => somme + caseJour(ctx, ressource, j).jours, 0);
