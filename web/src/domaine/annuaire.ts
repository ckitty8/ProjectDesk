/* ============================================================
   Annuaire : navigation équipes / projets et rôles sur un projet (Mon dashboard › Liste des ressources)
   (portage de Ecrans.listeRessources et des accès pratiques de app/js/etat.js — phase 5, vague D)
   ------------------------------------------------------------
   Maquette docs/maquettes/liste-ressources-ux/3-navigation-detail.png (piste 3, porteur 2026-10-09). Le niveau « direction » n'est plus affiché
   dans la navigation (« on oublie la direction DSI »). Fonctions pures : l'écran dessine ce qu'elles décident.
   ============================================================ */
import { ROLES_PROJET } from './config';
import { roleDeLaFiche, rolePrevu } from './droits';
import type { ContexteDroits } from './droits';
import type { Equipe, Projet, Ressource } from './types';

/** Élément choisi dans la navigation de gauche */
export type Choix = { type: 'equipe' | 'projet'; id: string } | { type: 'postes' | 'contrats' | 'aucun'; id?: undefined };

/* Unités de la navigation. Le niveau « direction » n'est plus montré (consigne du porteur, 2026-10-09) : les équipes d'une direction sont listées
   directement. Une direction reste listée si elle porte elle-même des projets ou des personnes (rien n'est caché) ou si elle est vide (pour
   pouvoir la supprimer). Équipes d'abord, puis directions. */
export function unitesNavigation(ctx: ContexteDroits): Equipe[] {
  const { equipes, projets, ressources } = ctx;
  const porteDuContenu = (e: Equipe) => projets.some(p => p.equipeId === e.id) || ressources.some(r => r.equipeId === e.id);
  const affichee = (e: Equipe) => e.type !== 'direction' || porteDuContenu(e) || !equipes.some(x => x.parentId === e.id);
  return [...equipes.filter(e => affichee(e) && e.type !== 'direction'), ...equipes.filter(e => affichee(e) && e.type === 'direction')];
}

/** Élément choisi : celui mémorisé s'il existe encore, sinon l'équipe ouverte, sinon la première unité de la navigation */
export function selectionAnnuaire(ctx: ContexteDroits, choix: Choix | null, equipeCourante: string | null): Choix {
  const unites = unitesNavigation(ctx);
  const existe = (c: Choix | null): c is Choix => !!c && (c.type === 'postes' || c.type === 'contrats'
    || (c.type === 'projet' && ctx.projets.some(p => p.id === c.id)) || (c.type === 'equipe' && unites.some(e => e.id === c.id)));
  if (existe(choix)) return choix;
  const parDefaut = unites.find(e => e.id === equipeCourante) ?? unites[0];
  return parDefaut ? { type: 'equipe', id: parDefaut.id } : { type: 'aucun' };
}

/** Rôles sur un projet. Product Owner = rôle « Chef de projet » (libellé du référentiel, inchangé en base) ; le chef inscrit sur la fiche du projet
 *  compte aussi, même sans affectation. */
export function rolesDuProjet(ctx: ContexteDroits, p: Projet): { productOwners: Ressource[]; membres: { r: Ressource; role: string }[] } {
  const affectations = ctx.affectations.filter(a => a.projetId === p.id);
  const fiche = (id: string) => ctx.ressources.find(r => r.id === id);
  const productOwners = affectations.filter(a => a.role === ROLES_PROJET.CHEF).map(a => fiche(a.ressourceId)).filter((r): r is Ressource => !!r);
  const chef = fiche(p.chefId ?? '');
  if (chef && !productOwners.includes(chef) && !affectations.some(a => a.ressourceId === chef.id)) productOwners.unshift(chef);
  const membres = affectations.filter(a => a.role !== ROLES_PROJET.CHEF)
    .flatMap(a => { const r = fiche(a.ressourceId); return r ? [{ r, role: a.role }] : []; });
  return { productOwners, membres };
}

/** Personnes rattachées à une équipe depuis une autre (membres_equipe, migration 033) : affichées dans ses membres, sans changer leur équipe
 *  d'origine ni leurs droits ; triées par nom */
export function rattachesA(ctx: ContexteDroits, equipeId: string): { r: Ressource; depuis: string | null }[] {
  return ctx.rattachements.filter(x => x.equipeId === equipeId)
    .flatMap(x => { const r = ctx.ressources.find(y => y.id === x.ressourceId); return r ? [{ r, depuis: x.creeLe ?? null }] : []; })
    .sort((a, b) => a.r.nom.localeCompare(b.r.nom));
}

/** Équipe vide : ni personne, ni projet, ni sous-unité (elle peut alors être supprimée) */
export const equipeVide = (ctx: ContexteDroits, equipeId: string): boolean => !ctx.ressources.some(r => r.equipeId === equipeId)
  && !ctx.projets.some(p => p.equipeId === equipeId) && !ctx.equipes.some(x => x.parentId === equipeId);

/* ---------- Rôle d'accès affiché ---------- */

/** Clé de ROLES_ACCES d'une fiche : « sansCompte » sans compte de connexion ; « chef » pour un utilisateur simple qui est chef de projet ;
 *  sinon son rôle d'accès (déclaré ou déduit) */
export function roleAcces(ctx: ContexteDroits, r: Ressource): string {
  if (!r.userId) return 'sansCompte';
  const role = roleDeLaFiche(ctx, r);
  if (role !== 'utilisateur') return role;
  const chef = ctx.projets.some(p => p.chefId === r.id) || ctx.affectations.some(a => a.ressourceId === r.id && a.role === ROLES_PROJET.CHEF);
  return chef ? 'chef' : 'utilisateur';
}

/** Rôle d'accès choisi dans « Utilisateurs et rôles » : le rôle prévu s'il y en a un, sinon le rôle actuel, compte relié ou non */
export const roleChoisi = (ctx: ContexteDroits, r: Ressource): string => rolePrevu(ctx, r) ?? roleDeLaFiche(ctx, r);
