/* ============================================================
   Administration : onglets, comptes en attente, rôles, matrice, envoi du daily
   (portage des règles de app/js/ecrans/mon-admin.js, roles.js et simulation.js — phase 5, vague D)
   ------------------------------------------------------------
   Fonctions pures : l'écran lit la saisie, décide avec ces fonctions, puis écrit en base (la base reste juge des droits, RLS).
   ============================================================ */
import { COULEURS, DROITS, ENVOI_DAILY_DEFAUT, ROLES_ACCES, ROLES_CHOISISSABLES, SECTIONS_DROITS, MENUS_SANS_DROIT } from './config';
import type { Droit } from './config';
import { ressourcesPresentes } from './vues';
import { estResponsableDe, mesEquipes, ongletPermis, peutPiloterProjet } from './droits';
import { resumeDuRole as resumeRoleDe } from './menus';
import { roleChoisi } from './annuaire';
import type { ContexteDroits } from './droits';
import type { EnvoiDaily, Iso, Ressource } from './types';
import type { JourFerie as JourFerieLigne } from './calendrier';
import { projetEnCours } from './vues';

/** Compte inscrit sans équipe (fonction comptes_en_attente, migration 024) */
export interface CompteEnAttente { userId: string; nom: string; email: string; inscritLe: string; invite: boolean }

/* ---------- Onglets d'Administration ---------- */

export interface OngletAdmin { id: string; libelle: string; compte?: number }

/** Onglets : d'abord le périmètre (comptes et rôles : administrateurs ; équipes : administrateurs et responsables ; envoi du daily : projets que
 *  je pilote), puis le droit de chaque onglet (matrice, migration 038). Les compteurs sont ceux de l'ancien écran. */
export function ongletsAdministration(ctx: ContexteDroits, enAttente: number, nbFeries: number, nbEnvoisActifs: number): OngletAdmin[] {
  const gereEquipes = ctx.estAdmin || mesEquipes(ctx).some(e => estResponsableDe(ctx, e.id));
  const regleEnvois = ctx.projets.some(p => projetEnCours(p) && peutPiloterProjet(ctx, p));
  const liste: OngletAdmin[] = [
    ...(ctx.estAdmin ? [{ id: 'comptes', libelle: 'Comptes en attente', compte: enAttente }] : []),
    ...(gereEquipes ? [{ id: 'equipes', libelle: 'Équipes', compte: ctx.equipes.length }] : []),
    { id: 'referentiels', libelle: 'Référentiels' },
    { id: 'feries', libelle: 'Jours fériés', compte: nbFeries },
    ...(regleEnvois ? [{ id: 'envoiDaily', libelle: 'Envoi du daily', compte: nbEnvoisActifs }] : []),
    ...(ctx.estAdmin ? [{ id: 'roles', libelle: 'Rôles', compte: ressourcesPresentes(ctx, aujourdhuiPourListe()).length }] : [])
  ];
  return liste.filter(o => ongletPermis(ctx, 'monAdmin', o.id));
}
// Les compteurs d'onglet comptent les personnes présentes aujourd'hui
const aujourdhuiPourListe = (): Iso => new Date().toISOString().slice(0, 10);

/* ---------- Comptes en attente ---------- */

/** Choix en cours pour un compte : équipe, fiche ressource et rôle dans l'équipe */
export interface ChoixCompte { equipe: string; fiche: string; role: string }

/** Fiche proposée pour un compte : même email, sinon même prénom, parmi les fiches présentes sans compte */
export function ficheProposee(libres: readonly Ressource[], compte: Pick<CompteEnAttente, 'nom' | 'email'>): Ressource | null {
  const prenom = (compte.nom || '').trim().split(/\s+/)[0]?.toLowerCase();
  return libres.find(r => (r.email ?? '').toLowerCase() === (compte.email || '').toLowerCase())
    ?? (prenom ? libres.find(r => r.nom.toLowerCase().split(/\s+/)[0] === prenom) : undefined) ?? null;
}

/** Choix par défaut d'un compte : la fiche proposée et son équipe, rôle « member » */
export function choixParDefaut(libres: readonly Ressource[], compte: Pick<CompteEnAttente, 'nom' | 'email'>): ChoixCompte {
  const proposee = ficheProposee(libres, compte);
  return { equipe: proposee?.equipeId ?? '', fiche: proposee?.id ?? '', role: 'member' };
}

/* ---------- Rôles : qui a quel rôle ---------- */

/** Rôle simulable ou affiché dans « Qui a quel rôle » : les 6 rôles d'accès puis « Compte en attente » (sans le Créateur) */
export interface RoleAffiche { cle: string; libelle: string; description: string; couleur: string }

export function rolesAffiches(ctx: ContexteDroits): RoleAffiche[] {
  return [
    ...ROLES_CHOISISSABLES.map(cle => ({ cle, libelle: ROLES_ACCES[cle].libelle, description: resumeRoleDe(ctx, cle), couleur: ROLES_ACCES[cle].texte })),
    { cle: 'sansEquipe', libelle: 'Compte en attente', description: 'Inscrit, sans accès tant qu’un administrateur ne l’a pas donné.', couleur: COULEURS.orange }
  ];
}

/** Chaque fiche active est rangée sous le rôle choisi dans « Utilisateurs et rôles » (prévu s'il y en a un, sinon actuel), avec son équipe et l'état de
 *  son compte (lié, prévu, sans compte) ; les comptes en attente forment le dernier groupe. Présenté en tableau (porteur 2026-10-27). */
export function parRole(ctx: ContexteDroits, aujourdhui: Iso, enAttente: readonly CompteEnAttente[]): Record<string, { nom: string; equipe: string; compte: string }[]> {
  const groupes: Record<string, { nom: string; equipe: string; compte: string }[]> = Object.fromEntries([...ROLES_CHOISISSABLES, 'sansEquipe'].map(c => [c, []]));
  ressourcesPresentes(ctx, aujourdhui).forEach(r => {
    const compte = !r.userId ? 'sans compte' : ctx.rolesPrevus.some(x => x.ressourceId === r.id) ? 'rôle prévu' : 'compte lié';
    groupes[roleChoisi(ctx, r)]?.push({ nom: r.nom, equipe: ctx.equipes.find(e => e.id === r.equipeId)?.nom ?? '—', compte });
  });
  enAttente.filter(c => !c.invite).forEach(c => groupes.sansEquipe?.push({ nom: c.nom || c.email, equipe: '—', compte: c.email }));
  Object.values(groupes).forEach(liste => liste.sort((x, y) => x.nom.localeCompare(y.nom)));
  return groupes;
}

/* ---------- Matrice des droits ---------- */

/** Lignes d'une section de la matrice, dans l'ordre de DROITS ; un menu ouvert à tous (MENUS_SANS_DROIT, sans clé) est placé juste avant les droits de
 *  ses onglets (Trucs et astuces), ou à la fin de la section s'il n'en a pas */
export type LigneMatrice = Droit | { menu: string; libelle: string; section: string; cle?: undefined; onglet?: undefined };

export function lignesSection(section: string): LigneMatrice[] {
  const lignes: LigneMatrice[] = DROITS.filter(d => d.section === section);
  MENUS_SANS_DROIT.filter(m => m.section === section).forEach(m => {
    const position = lignes.findIndex(d => d.menu === m.menu);
    lignes.splice(position < 0 ? lignes.length : position, 0, m);
  });
  return lignes;
}

export const sectionsMatrice = SECTIONS_DROITS;

/* ---------- Envoi du daily ---------- */

export type ReglageEnvoi = Required<Pick<EnvoiDaily, 'mode' | 'heure' | 'jours' | 'sansFeries' | 'destinataires'>>;

/** Réglage d'envoi d'un projet : sa ligne de envois_daily_projet complétée par les valeurs par défaut */
export function reglageEnvoi(envois: readonly EnvoiDaily[], projetId: string): ReglageEnvoi {
  const ligne = envois.find(x => x.projetId === projetId);
  return { ...ENVOI_DAILY_DEFAUT, ...(ligne ?? {}) } as ReglageEnvoi;
}

/** Jours d'envoi (numéros, 1 = lundi) après avoir coché ou décoché « jour » ; chaîne triée « 1,2,4 » */
export function basculerJourEnvoi(jours: string, jour: number): string {
  const s = new Set(jours.split(',').filter(Boolean));
  const cle = String(jour);
  if (s.has(cle)) s.delete(cle); else s.add(cle);
  return [...s].sort().join(',');
}

/** Jour férié d'une date (null si aucun) */
export const feriePar = (feries: readonly JourFerieLigne[], jour: Iso): JourFerieLigne | null => feries.find(f => f.jour === jour) ?? null;
