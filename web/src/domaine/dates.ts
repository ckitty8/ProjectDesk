/* ============================================================
   Dates : format ISO « AAAA-MM-JJ » sans fuseau, calendrier et affichage à la française
   (portage de la première partie de app/js/calculs.js — phase 2 de la migration)
   ============================================================ */
import type { Iso } from './types';

export const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'] as const;
const MOIS_LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'] as const;
const JOURS_LONGS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'] as const;
export const JOURS_INITIALES = ['D', 'L', 'M', 'M', 'J', 'V', 'S'] as const;

/** Nombre sur deux chiffres (« 07 ») */
export const deux = (n: number): string => String(n).padStart(2, '0');

export const versIso = (d: Date): Iso => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;

export function depuisIso(iso: Iso): Date {
  const [annee = 0, mois = 1, jour = 1] = iso.split('-').map(Number);
  return new Date(annee, mois - 1, jour);
}

export const aujourdhui = (): Iso => versIso(new Date());

export function ajouterJours(iso: Iso, n: number): Iso {
  const d = depuisIso(iso);
  d.setDate(d.getDate() + n);
  return versIso(d);
}

/** Nombre de jours entre deux dates (positif si isoB est après isoA) */
export const ecartJours = (isoA: Iso, isoB: Iso): number => Math.round((depuisIso(isoB).getTime() - depuisIso(isoA).getTime()) / 86400000);

export const estWeekend = (iso: Iso): boolean => [0, 6].includes(depuisIso(iso).getDay());

/** Jour ouvré = ni week-end ni férié (feries : ensemble de dates ISO, table jours_feries) */
export const estJourOuvre = (iso: Iso, feries: ReadonlySet<Iso>): boolean => !estWeekend(iso) && !feries.has(iso);

/** Lundi de la semaine contenant la date */
export function lundi(iso: Iso): Iso {
  const d = depuisIso(iso);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return versIso(d);
}

/** Lundi → vendredi de la semaine qui commence au lundi donné */
export const joursOuvresSemaine = (lundiIso: Iso): Iso[] => [0, 1, 2, 3, 4].map(i => ajouterJours(lundiIso, i));

/** Jours ouvrés (hors week-ends et fériés) entre deux dates ISO incluses — export du daily */
export function joursOuvresEntre(debut: Iso, fin: Iso, feries: ReadonlySet<Iso>): Iso[] {
  const jours: Iso[] = [];
  for (let j = debut; j <= fin; j = ajouterJours(j, 1)) if (estJourOuvre(j, feries)) jours.push(j);
  return jours;
}

/** Tous les jours d'un mois (mois de 0 à 11) */
export function joursDuMois(annee: number, mois: number): Iso[] {
  const nb = new Date(annee, mois + 1, 0).getDate();
  return Array.from({ length: nb }, (_, i) => versIso(new Date(annee, mois, i + 1)));
}

export const formatCourt = (iso?: Iso | null): string => {
  if (!iso) return '—';
  const d = depuisIso(iso);
  return `${d.getDate()} ${MOIS_COURTS[d.getMonth()]}`;
};

export const formatAvecAnnee = (iso?: Iso | null): string => {
  if (!iso) return '—';
  const d = depuisIso(iso);
  return `${d.getDate()} ${MOIS_COURTS[d.getMonth()]} ${d.getFullYear()}`;
};

export function formatLong(iso: Iso): string {
  const d = depuisIso(iso);
  const jour = JOURS_LONGS[d.getDay()] ?? '';
  return `${jour.charAt(0).toUpperCase()}${jour.slice(1)} ${d.getDate()} ${MOIS_LONGS[d.getMonth()]} ${d.getFullYear()}`;
}

export const libelleMois = (annee: number, mois: number): string => `${MOIS_LONGS[mois]} ${annee}`;
export const nomMois = (mois: number): string => MOIS_LONGS[mois] ?? '';

/** Nombre affiché à la française (virgule, 1 décimale au plus) */
export const nombre = (n: number): string => String(Math.round(n * 10) / 10).replace('.', ',');
export const pourcent = (n: number): string => Math.round(n) + '%';
