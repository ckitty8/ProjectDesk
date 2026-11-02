/* ============================================================
   Gantt (Suivi de mes équipes › Projet) : période affichée et zoom
   (portage de PlanningProjet.debut / periode de app/js/ecrans/projets.js — phase 5, vague B ; maquette planning-projet/, porteur 2026-10-23 ;
   zoom semaine / mois / trimestre ajouté le 2026-11-02, maquette menu-projet-gantt/)
   ------------------------------------------------------------
   Trois zooms : semaine (12 semaines), mois (6 mois, par défaut), trimestre (4 trimestres). La période se décale d'un pas du zoom
   (4 semaines, 1 mois, 1 trimestre). Fonctions pures : l'écran dessine ce qu'elles calculent.
   ============================================================ */
import { MOIS_COURTS, ajouterJours, depuisIso, ecartJours, lundi, versIso } from './dates';
import type { Iso } from './types';

export type ZoomGantt = 'semaine' | 'mois' | 'trimestre';

/** Zooms proposés, dans l'ordre d'affichage */
export const ZOOMS: readonly { valeur: ZoomGantt; libelle: string }[] = [
  { valeur: 'semaine', libelle: 'Semaine' },
  { valeur: 'mois', libelle: 'Mois' },
  { valeur: 'trimestre', libelle: 'Trimestre' }
];

const NB_SEMAINES = 12;
const NB_MOIS = 6;
const NB_TRIMESTRES = 4;

/** Premier jour de la période par défaut : le lundi de la semaine précédente (semaine), le 1er du mois précédent (mois), le 1er du trimestre en cours */
export function debutParDefaut(aujourdhui: Iso, zoom: ZoomGantt = 'mois'): Iso {
  const d = depuisIso(aujourdhui);
  if (zoom === 'semaine') return lundi(ajouterJours(aujourdhui, -7));
  if (zoom === 'trimestre') return versIso(new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1));
  return versIso(new Date(d.getFullYear(), d.getMonth() - 1, 1));
}

/** Premier jour de la période décalée d'un pas du zoom (sens −1 ou +1) : 4 semaines, 1 mois ou 1 trimestre */
export function decalerDebut(debut: Iso, sens: number, zoom: ZoomGantt = 'mois'): Iso {
  if (zoom === 'semaine') return ajouterJours(debut, 28 * sens);
  const d = depuisIso(debut);
  return versIso(new Date(d.getFullYear(), d.getMonth() + sens * (zoom === 'trimestre' ? 3 : 1), 1));
}

/** Graduation de l'échelle : libellé, position de départ et largeur en % de la frise */
export interface Graduation {
  libelle: string;
  gauche: number;
  largeur: number;
}

export interface PeriodePlanning {
  debut: Iso;
  /** Dernier jour de la période affichée */
  fin: Iso;
  /** Nombre de jours de la période */
  total: number;
  /** Graduations de l'échelle (semaines, mois ou trimestres selon le zoom) */
  graduations: Graduation[];
  /** Position (0-100 %) d'une date sur la frise, bornée aux extrémités */
  position: (iso: Iso) => number;
}

/** Segments [libellé, premier jour, dernier jour] de l'échelle d'un zoom, à partir du premier jour de la période */
function segments(debut: Iso, zoom: ZoomGantt): { libelle: string; debut: Iso; fin: Iso }[] {
  const d = depuisIso(debut);
  if (zoom === 'semaine') {
    return Array.from({ length: NB_SEMAINES }, (_, i) => {
      const jour = ajouterJours(debut, 7 * i), j = depuisIso(jour);
      return { libelle: `${j.getDate()} ${MOIS_COURTS[j.getMonth()]}`, debut: jour, fin: ajouterJours(jour, 6) };
    });
  }
  const pas = zoom === 'trimestre' ? 3 : 1;
  return Array.from({ length: zoom === 'trimestre' ? NB_TRIMESTRES : NB_MOIS }, (_, i) => {
    const premier = new Date(d.getFullYear(), d.getMonth() + pas * i, 1);
    const dernier = new Date(premier.getFullYear(), premier.getMonth() + pas, 0);
    const annee = String(premier.getFullYear()).slice(2);
    const libelle = zoom === 'trimestre' ? `T${Math.floor(premier.getMonth() / 3) + 1} ${annee}` : `${MOIS_COURTS[premier.getMonth()]} ${annee}`;
    return { libelle, debut: versIso(premier), fin: versIso(dernier) };
  });
}

export function periodePlanning(debut: Iso, zoom: ZoomGantt = 'mois'): PeriodePlanning {
  const parts = segments(debut, zoom);
  const fin = parts[parts.length - 1]?.fin ?? debut;
  const total = ecartJours(debut, fin) + 1;
  const graduations = parts.map(s => ({
    libelle: s.libelle,
    gauche: ecartJours(debut, s.debut) / total * 100,
    largeur: (ecartJours(s.debut, s.fin) + 1) / total * 100
  }));
  return { debut, fin, total, graduations, position: iso => Math.max(0, Math.min(100, ecartJours(debut, iso) / total * 100)) };
}

/** La période [debut, fin] d'un sprint ou d'une mise en production touche-t-elle la période affichée ? */
export const dansPeriode = (p: Pick<PeriodePlanning, 'debut' | 'fin'>, debut: Iso, fin: Iso): boolean => debut <= p.fin && fin >= p.debut;

/** Position (0-100 %) et largeur (%) d'une barre de sprint : la date de fin est incluse (le sprint couvre son dernier jour) */
export function barreSprint(p: PeriodePlanning, debut: Iso, fin: Iso): { gauche: number; largeur: number } {
  const gauche = p.position(debut);
  return { gauche, largeur: Math.max(p.position(ajouterJours(fin, 1)) - gauche, 0.4) };
}
