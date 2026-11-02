/* ============================================================
   Annuaire : navigation équipes / projets et rôles sur un projet (Mon dashboard › Liste des ressources)
   (portage de Ecrans.listeRessources et des accès pratiques de app/js/etat.js — phase 5, vague D)
   ------------------------------------------------------------
   Maquette docs/maquettes/liste-ressources-ux/3-navigation-detail.png (piste 3, porteur 2026-10-09). Le niveau « direction » n'est plus affiché
   dans la navigation (« on oublie la direction DSI »). Fonctions pures : l'écran dessine ce qu'elles décident.
   ============================================================ */
import { roleDeLaFiche, rolePrevu } from './droits';
import type { ContexteDroits } from './droits';
import type { Equipe, Projet, Ressource } from './types';

/* ---------- Prénom et nom d'une personne (migration 048) ---------- */

/** Prénom et nom d'une fiche. Colonnes prenom / nom_famille si l'une d'elles est renseignée ; sinon découpage du nom complet : le premier mot est
 *  le prénom, le reste le nom (« Cerine KERARMA » → Cerine | KERARMA). Un nom d'un seul mot est un prénom. Lecture seule : rien n'est écrit en base. */
export function prenomEtNom(r: Pick<Ressource, 'nom' | 'prenom' | 'nomFamille'>): { prenom: string; nomFamille: string } {
  if (r.prenom != null || r.nomFamille != null) return { prenom: r.prenom ?? '', nomFamille: r.nomFamille ?? '' };
  const [prenom = '', ...reste] = r.nom.trim().split(/\s+/);
  return { prenom, nomFamille: reste.join(' ') };
}

/** Nom complet recomposé à partir du prénom et du nom (espaces superflus retirés) : valeur de la colonne nom, affichée sur tous les écrans */
export const nomComplet = (prenom: string, nomFamille: string): string => [prenom, nomFamille].map(x => x.trim()).filter(Boolean).join(' ');

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

/** Équipe d'un projet : les chefs (Product Owners : chef désigné sur la fiche du projet, ou personne affectée dont le rôle est Chef de projet) puis les
 *  autres personnes affectées (rôle unique de la personne, migration 054 : plus de rôle par affectation) */
export function rolesDuProjet(ctx: ContexteDroits, p: Projet): { productOwners: Ressource[]; membres: Ressource[] } {
  const fiche = (id: string) => ctx.ressources.find(r => r.id === id);
  const affectes = ctx.affectations.filter(a => a.projetId === p.id)
    .flatMap(a => { const r = fiche(a.ressourceId); return r ? [r] : []; });
  const productOwners = affectes.filter(r => roleChoisi(ctx, r) === 'chef');
  const chef = fiche(p.chefId ?? '');
  if (chef && !productOwners.includes(chef)) productOwners.unshift(chef);
  const membres = affectes.filter(r => !productOwners.includes(r));
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

/* ---------- Rôle affiché ---------- */

/** Rôle choisi dans Administration › Rôles : le rôle prévu s'il y en a un, sinon le rôle actuel, compte relié ou non */
export const roleChoisi = (ctx: ContexteDroits, r: Ressource): string => rolePrevu(ctx, r) ?? roleDeLaFiche(ctx, r);
