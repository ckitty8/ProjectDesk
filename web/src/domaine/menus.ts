/* ============================================================
   Menus de la barre latérale et ce que chaque rôle en voit
   (portage TypeScript de MENU_GENERAL, MENU_MOI, menusDuRole et resumeDuRole de app/js/coquille.js — phase 2)
   ------------------------------------------------------------
   Un seul calcul sert à la barre latérale (mon rôle) et aux cartes des rôles (Simulation, Qui a quel rôle) : il n'y a donc
   jamais d'écart entre ce qui est décrit et ce qui est affiché. Chaque menu suit ses propres lignes de la matrice.
   ============================================================ */
import { ecranOuvert, monRole, niveauPour } from './droits';
import type { ContexteDroits } from './droits';

export interface MenuEnfant {
  id: string;
  libelle: string;
  /** Droit(s) du sous-menu : un seul suffit pour l'ouvrir */
  droit?: string | readonly string[];
}

export interface Menu {
  id: string;
  libelle: string;
  /** Nom de l'icône (dessinée par les composants, phase 4) */
  icone: string;
  droit?: string | readonly string[];
  enfants?: readonly MenuEnfant[];
  /** Menu réservé au créateur (Administration créateur) : jamais un menu de rôle */
  reserveCreateur?: boolean;
}

/** Suivi de mes équipes : chaque menu est affiché si le droit de son menu n'est pas « Non » (matrice, migration 037) et si au
 *  moins un de ses onglets est permis (migration 038). Pas d'Administration dans cette section (porteur, 2026-10-22). */
export const MENU_GENERAL: readonly Menu[] = [
  { id: 'dashboard', libelle: 'Dashboard général', icone: 'dash', droit: 'suivi_dashboard' },
  { id: 'dailyEquipes', libelle: 'Daily des équipes', icone: 'daily', droit: 'daily_equipes' },
  { id: 'projets', libelle: 'Projets et Roadmap', icone: 'proj', droit: 'suivi_projets' },
  { id: 'ressources', libelle: 'Gestion des ressources', icone: 'ress', droit: 'suivi_ressources' },
  { id: 'timesheet', libelle: 'Timesheet', icone: 'time', droit: 'suivi_timesheet' }
];

/** Mon dashboard : Daily et Saisir mes heures suivent le droit « mon_dashboard » ; chaque autre menu suit ses propres lignes */
export const MENU_MOI: readonly Menu[] = [
  { id: 'daily', libelle: 'Daily', icone: 'daily', droit: 'mon_dashboard' },
  { id: 'mesProjets', libelle: 'Projets et Roadmap', icone: 'road',
    enfants: [{ id: 'mesProjets', libelle: 'Mises en production', droit: 'projets' }, { id: 'mesSprints', libelle: 'Sprints' }] },
  { id: 'conges', libelle: 'Gestion des ressources', icone: 'ress',
    enfants: [{ id: 'conges', libelle: 'Congés' },
      // Liste des ressources : ouverte si le rôle a l'un de ses deux droits (fiches, affectations)
      { id: 'listeRessources', libelle: 'Liste des ressources', droit: ['fiches_ressources', 'affecter'] }] },
  { id: 'monTimesheet', libelle: 'Saisir mes heures', icone: 'time', droit: 'mon_dashboard' },
  { id: 'astuces', libelle: 'Trucs et astuces', icone: 'idee' },
  { id: 'monAdmin', libelle: 'Administration', icone: 'admin' },
  { id: 'adminCreateur', libelle: 'Administration créateur', icone: 'admin', reserveCreateur: true }
];

/** Un droit, ou une liste de droits dont un seul suffit : au moins un n'est pas « Non » */
const droitOuvert = (ctx: ContexteDroits, droit: string | readonly string[], role?: string): boolean =>
  ([] as string[]).concat(droit).some(d => niveauPour(ctx, d, role) !== 'non');

const enfantOuvert = (ctx: ContexteDroits, e: MenuEnfant, role?: string): boolean =>
  (!e.droit || droitOuvert(ctx, e.droit, role)) && ecranOuvert(ctx, e.id, role);

/** Menu ouvert à un rôle (le mien si aucun rôle n'est précisé) : son écran (ou, pour un menu à sous-menus, l'un de ses
 *  sous-menus) a un onglet permis, et le droit propre du menu n'est pas « Non » */
const menuOuvert = (ctx: ContexteDroits, item: Menu, role?: string): boolean => (item.enfants
  ? item.enfants.some(e => enfantOuvert(ctx, e, role))
  : (!item.droit || droitOuvert(ctx, item.droit, role)) && ecranOuvert(ctx, item.id, role));

/** Menus que voit un rôle, d'après la matrice : ceux de Suivi de mes équipes, puis ceux de Mon dashboard avec leurs sous-menus
 *  ouverts. Mon dashboard est fermé en Lecture seule (migration 030). */
export function menusDuRole(ctx: ContexteDroits, role?: string): { suivi: Menu[]; moi: Menu[] } {
  const suivi = MENU_GENERAL.filter(item => !!item.droit && droitOuvert(ctx, item.droit, role) && ecranOuvert(ctx, item.id, role));
  const lectureSeule = (role ?? monRole(ctx)) === 'lecture';
  const moi = lectureSeule ? [] : MENU_MOI
    .filter(item => (item.reserveCreateur ? !role && ctx.estCreateur : true) && menuOuvert(ctx, item, role))
    .map(item => ({ ...item, enfants: item.enfants?.filter(e => enfantOuvert(ctx, e, role)) }));
  return { suivi, moi };
}

/** « Suivi : Dashboard général, Timesheet · Mon dashboard : Daily, Gestion des ressources (Congés, …) » pour un rôle */
export function resumeDuRole(ctx: ContexteDroits, role: string): string {
  const { suivi, moi } = menusDuRole(ctx, role);
  const nom = (m: Menu): string => m.libelle + (m.enfants ? ` (${m.enfants.map(e => e.libelle).join(', ')})` : '');
  return `Suivi : ${suivi.map(nom).join(', ') || 'aucun menu'} · Mon dashboard : ${moi.map(nom).join(', ') || 'aucun menu'}`;
}
