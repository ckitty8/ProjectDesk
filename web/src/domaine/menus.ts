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
  /** Menu visible de tous les profils et rôles, sans droit de la matrice (porteur, 2026-11-02 : le menu Projet de Vue d’ensemble) */
  pourTous?: boolean;
  /** Menu réservé au créateur (Administration créateur) : jamais un menu de rôle */
  reserveCreateur?: boolean;
  /** Menu réservé aux administrateurs (porteur, 2026-11-01 : « le menu Administration est uniquement pour les administrateurs »),
   *  quels que soient les droits d'onglets */
  reserveAdmin?: boolean;
  /** Écran ouvert au rôle mais absent de la barre latérale (porteur, 2026-11-01) : on y accède par un lien de « Mon profil » */
  horsBarre?: boolean;
}

/** Vue d’ensemble : chaque menu est affiché si le droit de son menu n'est pas « Non » (matrice, migration 037) — sauf Projet, ouvert à tous — et si au
 *  moins un de ses onglets est permis (migration 038). Pas d'Administration dans cette section (porteur, 2026-10-22). */
export const MENU_GENERAL: readonly Menu[] = [
  { id: 'dashboard', libelle: 'Dashboard général', icone: 'dash', droit: 'suivi_dashboard' },
  { id: 'dailyEquipes', libelle: 'Daily des équipes', icone: 'daily', droit: 'daily_equipes' },
  // Projet (porteur, 2026-11-02) : le Gantt et la liste des projets, visibles de tous les profils et rôles ; chacun y voit ce que son périmètre
  // lui permet de lire (règles de lecture de la base : ses projets, ceux de ses unités…), sans droit de la matrice
  { id: 'projets', libelle: 'Projet', icone: 'proj', pourTous: true },
  { id: 'ressources', libelle: 'Gestion des ressources', icone: 'ress', droit: 'suivi_ressources' },
  { id: 'timesheet', libelle: 'Feuilles de temps', icone: 'time', droit: 'suivi_timesheet' }
];

/** Mon dashboard : Daily et Saisir mes heures suivent le droit « mon_dashboard » ; chaque autre menu suit ses propres lignes */
export const MENU_MOI: readonly Menu[] = [
  { id: 'daily', libelle: 'Daily', icone: 'daily', droit: 'mon_dashboard' },
  // Projet (porteur, 2026-11-02) : Sprints (droit d'onglet « onglet_admin_sprints ») et Mises en production (droit « projets »)
  { id: 'mesSprints', libelle: 'Projet', icone: 'proj',
    enfants: [{ id: 'mesSprints', libelle: 'Sprints' }, { id: 'mesProjets', libelle: 'Mises en production', droit: 'projets' }] },
  { id: 'conges', libelle: 'Gestion des ressources', icone: 'ress',
    enfants: [{ id: 'conges', libelle: 'Congés' },
      // Liste des ressources : ouverte si le rôle a l'un de ses deux droits (fiches, affectations)
      { id: 'listeRessources', libelle: 'Liste des ressources', droit: ['fiches_ressources', 'affecter'] }] },
  { id: 'monTimesheet', libelle: 'Saisir mes heures', icone: 'time', droit: 'mon_dashboard' },
  { id: 'astuces', libelle: 'Trucs et astuces', icone: 'idee' },
  { id: 'monAdmin', libelle: 'Administration', icone: 'admin', reserveAdmin: true },
  { id: 'adminCreateur', libelle: 'Administration créateur', icone: 'admin', reserveCreateur: true, horsBarre: true }
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

/** Menus que voit un rôle, d'après la matrice : ceux de Vue d’ensemble, puis ceux de Mon dashboard avec leurs sous-menus
 *  ouverts. Mon dashboard est fermé en Lecture seule (migration 030). */
export function menusDuRole(ctx: ContexteDroits, role?: string): { suivi: Menu[]; moi: Menu[] } {
  const suivi = MENU_GENERAL.filter(item => (item.pourTous || (!!item.droit && droitOuvert(ctx, item.droit, role))) && ecranOuvert(ctx, item.id, role));
  const lectureSeule = (role ?? monRole(ctx)) === 'lecture';
  const moi = lectureSeule ? [] : MENU_MOI
    .filter(item => (item.reserveCreateur ? !role && ctx.estCreateur : true) && (item.reserveAdmin ? (role ? role === 'admin' : ctx.estAdmin) : true)
      && menuOuvert(ctx, item, role))
    .map(item => ({ ...item, enfants: item.enfants?.filter(e => enfantOuvert(ctx, e, role)) }));
  return { suivi, moi };
}

/** « Vue d’ensemble : Dashboard général, Feuilles de temps · Mon dashboard : Daily, Gestion des ressources (Congés, …) » pour un rôle */
export function resumeDuRole(ctx: ContexteDroits, role: string): string {
  const { suivi, moi } = menusDuRole(ctx, role);
  const nom = (m: Menu): string => m.libelle + (m.enfants ? ` (${m.enfants.map(e => e.libelle).join(', ')})` : '');
  return `Vue d’ensemble : ${suivi.map(nom).join(', ') || 'aucun menu'} · Mon dashboard : ${moi.map(nom).join(', ') || 'aucun menu'}`;
}
