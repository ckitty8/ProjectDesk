/* ============================================================
   Planning projet : période affichée (frise de 6 mois)
   (portage de PlanningProjet.debut / periode de app/js/ecrans/projets.js — phase 5, vague B ; maquette planning-projet/, porteur 2026-10-23)
   ------------------------------------------------------------
   Période : 6 mois à partir du mois précédent le mois en cours, décalable mois par mois. Fonctions pures.
   ============================================================ */
import { MOIS_COURTS, depuisIso, ecartJours, versIso } from './dates';
import type { Iso } from './types';

export const NB_MOIS = 6;

/** Premier jour de la période par défaut : le 1er du mois précédent */
export function debutParDefaut(aujourdhui: Iso): Iso {
  const d = depuisIso(aujourdhui);
  return versIso(new Date(d.getFullYear(), d.getMonth() - 1, 1));
}

/** Premier jour de la période décalée d'un mois (sens −1 ou +1) */
export function decalerDebut(debut: Iso, sens: number): Iso {
  const d = depuisIso(debut);
  return versIso(new Date(d.getFullYear(), d.getMonth() + sens, 1));
}

export interface PeriodePlanning {
  debut: Iso;
  /** Dernier jour du dernier mois affiché */
  fin: Iso;
  /** Nombre de jours de la période */
  total: number;
  /** En-têtes de mois : libellé et largeur en % de la frise */
  mois: { libelle: string; largeur: number }[];
  /** Position (0-100 %) d'une date sur la frise, bornée aux extrémités */
  position: (iso: Iso) => number;
}

export function periodePlanning(debut: Iso): PeriodePlanning {
  const d = depuisIso(debut);
  const fin = versIso(new Date(d.getFullYear(), d.getMonth() + NB_MOIS, 0));
  const total = ecartJours(debut, fin) + 1;
  const mois = Array.from({ length: NB_MOIS }, (_, i) => new Date(d.getFullYear(), d.getMonth() + i, 1)).map(m => ({
    libelle: `${MOIS_COURTS[m.getMonth()]} ${String(m.getFullYear()).slice(2)}`,
    largeur: new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate() / total * 100
  }));
  return { debut, fin, total, mois, position: iso => Math.max(0, Math.min(100, ecartJours(debut, iso) / total * 100)) };
}

/** La période [debut, fin] d'un sprint ou d'une mise en production touche-t-elle la période affichée ? */
export const dansPeriode = (p: Pick<PeriodePlanning, 'debut' | 'fin'>, debut: Iso, fin: Iso): boolean => debut <= p.fin && fin >= p.debut;
