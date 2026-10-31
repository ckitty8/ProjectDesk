/* ============================================================
   Règles des écrans de saisie de « Mon dashboard » : Daily, Saisir mes heures, Congés, Sprints, Mises en production
   (portage des règles de app/js/ecrans/{daily,mon-timesheet,conges,sprints,mes-projets}.js et de app/js/etat.js — phase 5, vague C)
   ------------------------------------------------------------
   Fonctions pures : l'écran lit la saisie, appelle ces fonctions pour décider (valide ? quelle écriture ?), puis écrit en base. La base
   reste le juge des droits (RLS) ; ces règles évitent seulement d'envoyer des saisies absurdes et de dessiner des cases inutiles.
   ============================================================ */
import { dureeAbsence } from './calculs';
import { CONFIG, ROLES_PROJET } from './config';
import { estWeekend } from './dates';
import { maRessource } from './droits';
import type { ContexteDroits } from './droits';
import type { Absence, Iso, ObjectifJoursTravail, Projet, SprintProjet } from './types';
import { decalerJourOuvre, projetEnCours } from './vues';
import type { DonneesVues } from './vues';

/* ---------- Daily ---------- */

const parCode = (a: Projet, b: Projet): number => a.code.localeCompare(b.code);

/** Projets où je saisis un daily : affecté(e) Chef de projet ou Membre (pas Lecteur), projet en cours, triés par code */
export function mesProjetsDaily(ctx: ContexteDroits, d: DonneesVues): Projet[] {
  const moi = maRessource(ctx);
  if (!moi) return [];
  return d.affectations.filter(a => a.ressourceId === moi.id && a.role !== ROLES_PROJET.LECTEUR)
    .flatMap(a => d.projets.filter(p => p.id === a.projetId)).filter(projetEnCours).sort(parCode);
}

/** Historique du daily : les « nb » derniers jours ouvrés jusqu'à aujourd'hui (le week-end, on part du vendredi) */
export function historiqueJours(aujourdhui: Iso, nb = 12): Iso[] {
  const jours: Iso[] = [];
  let j = estWeekend(aujourdhui) ? decalerJourOuvre(aujourdhui, -1) : aujourdhui;
  for (let i = 0; i < nb; i++) { jours.push(j); j = decalerJourOuvre(j, -1); }
  return jours;
}

/** Un jour d'absence d'une journée (Congés), aucun daily n'est attendu ; une demi-journée laisse la saisie ouverte */
export const absentToutLeJour = (absence: Pick<Absence, 'duree'> | null | undefined): boolean => !!absence && dureeAbsence(absence) >= 1;

/* ---------- Saisir mes heures ---------- */

/** Résultat de la lecture d'une case d'heures : « supprimer » (vide ou 0), « enregistrer » (0 à 24 h) ou « invalide » */
export type SaisieHeures = { action: 'supprimer' } | { action: 'enregistrer'; heures: number } | { action: 'invalide' };

/** Saisie d'une case : nombre (virgule acceptée) ; vide ou zéro = suppression de la saisie ; entre 0 et 24 h sinon invalide */
export function lireHeures(texte: string): SaisieHeures {
  const valeur = texte.trim().replace(',', '.');
  if (valeur === '' || Number(valeur) === 0) return { action: 'supprimer' };
  const n = Number(valeur);
  return Number.isNaN(n) || n < 0 || n > 24 ? { action: 'invalide' } : { action: 'enregistrer', heures: n };
}

/* ---------- Congés ---------- */

/** Ce qu'un clic sur un jour fait de l'absence existante (porteur 2026-10-26) : pose le type et la durée choisis ; retire l'absence si
 *  elle a déjà ce type et cette durée (ou avec « Effacer ») ; même type mais autre durée : la durée est changée (« poser » écrase). */
export function actionAbsence(existante: Absence | null, pinceau: string, duree: number): 'supprimer' | 'poser' | 'rien' {
  if (pinceau === 'effacer' || (existante && existante.type === pinceau && Number(existante.duree || 1) === duree)) return existante ? 'supprimer' : 'rien';
  return 'poser';
}

/** Jours de travail attendus par le client pour une équipe et une année (défaut : paramètre technique) */
export function objectifJoursTravail(objectifs: readonly ObjectifJoursTravail[], equipeId: string, annee: number): number {
  const o = objectifs.find(x => x.equipeId === equipeId && Number(x.annee) === annee);
  return o ? Number(o.jours) : CONFIG.JOURS_TRAVAIL_CLIENT_DEFAUT;
}

/** Objectif client saisi : entre 1 et 366 jours */
export const objectifValide = (jours: number): boolean => jours > 0 && jours <= 366;

/* ---------- Sprints ---------- */

/** Année d'un sprint : saisie (migration 015), sinon celle de sa date de début */
export const anneeSprint = (s: Pick<SprintProjet, 'annee' | 'debut'>): number => Number(s.annee) || Number((s.debut ?? '').slice(0, 4));

/** Un projet n'a qu'un « Sprint N » par année (règle aussi garantie en base, migration 015) */
export const sprintDejaPris = (
  sprints: readonly SprintProjet[], projetId: string, annee: number, numeroSprint: number, saufNumero: number | null = null
): boolean => sprints.some(s => s.projetId === projetId && s.numero !== saufNumero && Number(s.numeroSprint) === numeroSprint && anneeSprint(s) === annee);

/** Clé technique d'un nouveau sprint : après tous les numéros déjà utilisés pour ce projet (points et répartitions compris), pour qu'un
 *  nouveau sprint ne récupère jamais des saisies existantes */
export function numeroTechniqueSuivant(
  sprints: readonly SprintProjet[], repartitions: readonly { projetId: string; numero?: number }[], projetId: string
): number {
  const utilises = [...sprints, ...repartitions].filter(s => s.projetId === projetId).map(s => Number(s.numero) || 0);
  return Math.max(0, ...utilises) + 1;
}

/** « Sprint N » suivant pour l'année affichée */
export const numeroSprintSuivant = (sprints: readonly SprintProjet[]): number => Math.max(0, ...sprints.map(s => Number(s.numeroSprint) || 0)) + 1;

export type ChampSprint = 'numeroSprint' | 'annee' | 'nom' | 'debut' | 'fin';

/** Valeur d'un champ de sprint lu dans un formulaire : entiers pour le numéro et l'année, vide = null */
export function lireChampSprint(champ: ChampSprint, brut: string): string | number | null {
  const texte = brut.trim();
  if (texte === '') return null;
  return champ === 'numeroSprint' || champ === 'annee' ? Number(texte) : texte;
}

/** Contrôles de la modification d'un champ de sprint : dates obligatoires, fin après début, « Sprint N » unique par année.
 *  Renvoie le message d'erreur, ou null si la modification est valide. */
export function erreurModificationSprint(
  sprints: readonly SprintProjet[], s: SprintProjet, champ: ChampSprint, valeur: string | number | null
): string | null {
  if ((champ === 'debut' || champ === 'fin') && !valeur) return 'Les dates du sprint sont obligatoires';
  const debut = champ === 'debut' ? valeur : s.debut, fin = champ === 'fin' ? valeur : s.fin;
  if (debut && fin && fin < debut) return 'La date de fin précède la date de début';
  const numeroSprint = champ === 'numeroSprint' ? Number(valeur) : s.numeroSprint;
  const annee = champ === 'annee' ? Number(valeur) : anneeSprint(s);
  if (numeroSprint && sprintDejaPris(sprints, s.projetId, annee, Number(numeroSprint), s.numero)) {
    return `Le sprint ${numeroSprint} existe déjà en ${annee} pour ce projet`;
  }
  return null;
}

/* ---------- Mises en production ---------- */

/** Tickets livrés par une mise en production (porteur 2026-10-24, migration 044) : le nombre de Bug, Incident et US, dans cet ordre ;
 *  « champ » = colonne de mises_en_production, « cle » = nom du champ du formulaire d'ajout */
export const COMPTEURS_MEP = [
  { cle: 'bugs', champ: 'nbBugs', libelle: 'Bugs', titre: 'Nombre de bugs livrés' },
  { cle: 'incidents', champ: 'nbIncidents', libelle: 'Incidents', titre: 'Nombre d’incidents livrés' },
  { cle: 'us', champ: 'nbUs', libelle: 'US', titre: 'Nombre d’US livrées' }
] as const;

/** Entier positif ou nul saisi dans un champ (vide ou invalide = 0) */
export const nombreEntier = (texte: string | number): number => Math.max(0, Math.floor(Number(texte) || 0));
