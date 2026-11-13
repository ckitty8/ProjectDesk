/* ============================================================
   Droits et rôles (miroir des règles RLS de la base, pour l'affichage uniquement)
   (portage TypeScript des fonctions de droits de app/js/etat.js — phase 2 de la migration)
   ------------------------------------------------------------
   La base reste le seul juge (règles RLS, migrations 030, 031, 042) : ces fonctions servent à masquer les menus et
   les boutons inutiles. Elles sont pures : tout ce dont elles ont besoin est dans le « contexte » reçu en premier
   paramètre (compte connecté, simulation éventuelle, données chargées), jamais dans une variable globale.
   ============================================================ */
import { DROITS, ROLES_CHOISISSABLES } from './config';
import type { Niveau } from './config';
import type { AdminPrevu, Affectation, CompteAdmin, Equipe, EtapeConfiguration, LigneDroit, LigneEcranEquipe, Projet, Rattachement, Ressource,
  ResponsableEquipe, RoleDeclare } from './types';

/** Simulation de rôle (créateur seul) : le rôle de la carte s'applique à la fiche choisie */
export interface Simulation {
  cle: string;
  ressourceId: string | null;
}

/** Tout ce qu'il faut savoir du compte connecté et des données chargées pour décider des droits */
export interface ContexteDroits {
  estCreateur: boolean;
  /** Administrateur (ou créateur) EN MODE ADMINISTRATEUR : périmètre « Tout ».
   *  Hors de ce mode (vue par défaut, porteur 2026-11-01), faux même pour un administrateur */
  estAdmin: boolean;
  /** Le compte est administrateur ou créateur (qu'il soit ou non en mode administrateur) : il peut basculer depuis « Mon profil » */
  peutAdministrer: boolean;
  /** Identifiant du compte connecté (null si non connecté) */
  userId: string | null;
  simulation: Simulation | null;
  /** Équipes (organisations Neon Auth) dont le compte est membre */
  organisations: readonly { id: string }[];
  /** Rôle du compte dans chacune de ses équipes : owner, admin ou member */
  rolesEquipe: Readonly<Record<string, string>>;
  /** Comptes de chaque équipe (Neon Auth) : sert à retrouver le rôle d'organisation d'une fiche */
  membresEquipe: Readonly<Record<string, readonly { userId: string; role: string }[]>>;
  equipes: readonly Equipe[];
  ressources: readonly Ressource[];
  projets: readonly Projet[];
  affectations: readonly Affectation[];
  /** Personnes rattachées à une autre équipe que la leur (migration 033) */
  rattachements: readonly Rattachement[];
  responsablesEquipe: readonly ResponsableEquipe[];
  rolesAcces: readonly RoleDeclare[];
  rolesPrevus: readonly RoleDeclare[];
  administrateursPrevus: readonly AdminPrevu[];
  administrateurs: readonly CompteAdmin[];
  createur: readonly CompteAdmin[];
  droitsRoles: readonly LigneDroit[];
  /** Écrans autorisés ou écartés par équipe (migration 059) */
  droitsEquipes: readonly LigneEcranEquipe[];
  /** Étapes de la configuration initiale confirmées ou passées (migration 060) */
  etapesConfiguration: readonly EtapeConfiguration[];
  /** Équipe ouverte (équipe active) : celle dont les écrans autorisés s'appliquent ; null = aucun filtre d'équipe */
  equipeActive?: string | null;
}

const ROLES_RESPONSABLE = ['owner', 'admin'];

/* ---------- Recherches dans les données ---------- */

export const trouverEquipe = (ctx: ContexteDroits, id: string | null | undefined): Equipe | undefined =>
  id ? ctx.equipes.find(e => e.id === id) : undefined;

export const trouverRessource = (ctx: ContexteDroits, id: string | null | undefined): Ressource | undefined =>
  id ? ctx.ressources.find(r => r.id === id) : undefined;

/** Ma fiche ressource : celle de mon compte, ou celle de la personne simulée */
export function maRessource(ctx: ContexteDroits): Ressource | null {
  if (ctx.simulation) return trouverRessource(ctx, ctx.simulation.ressourceId) ?? null;
  return ctx.ressources.find(r => !!ctx.userId && r.userId === ctx.userId) ?? null;
}

/* ---------- Équipes de l'utilisateur ---------- */

/** Équipes de l'utilisateur : celles dont il est membre ; le créateur les a toutes (comme mes_equipes en base) */
export function mesEquipes(ctx: ContexteDroits): readonly Equipe[] {
  if (ctx.estCreateur) return ctx.equipes;
  const ids = new Set(ctx.organisations.map(o => o.id));
  return ctx.equipes.filter(e => ids.has(e.id));
}

export const estMembreDe = (ctx: ContexteDroits, equipeId: string): boolean => mesEquipes(ctx).some(e => e.id === equipeId);

export const estResponsableDe = (ctx: ContexteDroits, equipeId: string): boolean =>
  ctx.estCreateur || ROLES_RESPONSABLE.includes(ctx.rolesEquipe[equipeId] ?? '');

/* ---------- Rôle d'accès d'une personne ---------- */

/** Son compte dans l'organisation Neon Auth de son équipe, connu pour mes équipes */
const membreOrganisation = (ctx: ContexteDroits, r: Ressource) =>
  (ctx.membresEquipe[r.equipeId] ?? []).find(m => !!r.userId && m.userId === r.userId) ?? null;

export const estAdministrateur = (ctx: ContexteDroits, r: Ressource): boolean =>
  !!r.userId && [...ctx.administrateurs, ...ctx.createur].some(a => a.userId === r.userId);

/** Statut d'administrateur prévu pour une fiche sans compte (migration 047) : il s'applique à sa première connexion, email vérifié */
export const estAdministrateurPrevu = (ctx: ContexteDroits, r: Ressource): boolean =>
  !r.userId && ctx.administrateursPrevus.some(a => a.ressourceId === r.id);

/** Responsables d'une équipe (fiches) : ceux de responsables_equipe, puis l'ancien responsable désigné s'il n'y est pas */
export function responsablesDe(ctx: ContexteDroits, equipeId: string): Ressource[] {
  const ids = ctx.responsablesEquipe.filter(x => x.equipeId === equipeId).map(x => x.ressourceId);
  const designe = trouverEquipe(ctx, equipeId)?.responsableId;
  if (designe && !ids.includes(designe)) ids.push(designe);
  return ids.map(id => trouverRessource(ctx, id)).filter((r): r is Ressource => !!r);
}

/** Responsable d'une équipe : inscrit dans responsables_equipe (migration 027), ancien responsable désigné de la fiche
 *  équipe (responsable_id), ou owner / admin de l'organisation de son équipe */
export const estResponsableDesigne = (ctx: ContexteDroits, r: Ressource): boolean =>
  ctx.equipes.some(e => e.responsableId === r.id) || ctx.responsablesEquipe.some(x => x.ressourceId === r.id);

export const estResponsableEquipe = (ctx: ContexteDroits, r: Ressource): boolean =>
  estResponsableDesigne(ctx, r) || ROLES_RESPONSABLE.includes(membreOrganisation(ctx, r)?.role ?? '');

/** Rôle prévu d'une fiche (Administration › Ressources › Paramétrage des rôles), en attente de la connexion de la personne, ou null */
export const rolePrevu = (ctx: ContexteDroits, r: Ressource): string | null => ctx.rolesPrevus.find(x => x.ressourceId === r.id)?.role ?? null;

/** Rôle d'accès déclaré et appliqué d'une fiche (roles_acces, migration 030), ou null s'il est déduit */
export const roleDeclare = (ctx: ContexteDroits, r: Ressource): string | null => ctx.rolesAcces.find(x => x.ressourceId === r.id)?.role ?? null;

/** Rôle d'accès d'une fiche, compte relié ou non : déclaré, sinon déduit (responsable, utilisateur). L'administrateur n'est plus un rôle de la
 *  fiche : il se cumule avec un autre rôle (case « Administrateur » d'Administration › Ressources › Paramétrage des rôles, porteur 2026-11-01) */
export function roleDeLaFiche(ctx: ContexteDroits, r: Ressource): string {
  const declare = roleDeclare(ctx, r);
  if (declare) return declare;
  return estResponsableEquipe(ctx, r) ? 'responsable' : 'utilisateur';
}

/** Suis-je en « Lecture seule » ? (comme est_lecture_seule en base : Mon dashboard masqué, aucune écriture) */
export function estLectureSeule(ctx: ContexteDroits): boolean {
  const moi = maRessource(ctx);
  return !ctx.estCreateur && !!moi && roleDeclare(ctx, moi) === 'lecture';
}

/** Mon rôle d'accès : celui de la simulation en cours ; « administrateur » en mode administrateur ; sinon le rôle déclaré sur ma fiche, sinon
 *  responsable, utilisateur (déduits) */
export function monRole(ctx: ContexteDroits): string {
  if (ctx.simulation && (ROLES_CHOISISSABLES as readonly string[]).includes(ctx.simulation.cle)) return ctx.simulation.cle;
  return ctx.estAdmin ? 'admin' : monRoleSansAdmin(ctx);
}

/** Mon rôle hors mode administrateur : déclaré sur ma fiche, sinon prévu (choisi dans Personnes et rôles, pas encore appliqué), sinon responsable ou
 *  utilisateur (déduits) — le rôle auquel « Revenir à mon rôle » ramène (porteur, 2026-11-13 : « je suis chef de projet, pas responsable d'équipe ») */
export function monRoleSansAdmin(ctx: ContexteDroits): string {
  const moi = maRessource(ctx);
  const declare = moi ? roleDeclare(ctx, moi) ?? rolePrevu(ctx, moi) : null;
  if (declare) return declare;
  const responsable = (!!moi && estResponsableEquipe(ctx, moi)) || Object.values(ctx.rolesEquipe).some(r => ROLES_RESPONSABLE.includes(r));
  return responsable ? 'responsable' : 'utilisateur';
}

/* ---------- Matrice des droits ---------- */

/** L'équipe active autorise-t-elle cet écran ? (étape 1 du choix des écrans, Administration › Menus par équipe, porteur 2026-11-04 ; l'étape 2 est la
 *  matrice des droits par rôle). Sans ligne pour l'équipe et l'écran, il est accessible ; l'administrateur en mode administrateur voit tout. */
export function ecranAutoriseEquipe(ctx: ContexteDroits, ecran: string): boolean {
  if (ctx.estAdmin || !ctx.equipeActive) return true;
  const ligne = ctx.droitsEquipes.find(l => l.equipeId === ctx.equipeActive && l.ecran === ecran);
  return ligne ? ligne.acces : true;
}

/** Le droit existe-t-il dans la table droits_roles ? (droits par menu : migration 037) */
export const droitEnBase = (ctx: ContexteDroits, droit: string): boolean => ctx.droitsRoles.some(d => d.droit === droit);

/** Niveau d'un droit pour un rôle, d'après la matrice (« non » s'il manque). Filet de sécurité : un droit absent de la
 *  table (base sans la migration 037) reprend le niveau de son droit de repli, pour que les menus ne disparaissent pas. */
export function niveauDuRole(ctx: ContexteDroits, role: string, droit: string): Niveau {
  const ligne = ctx.droitsRoles.find(d => d.role === role && d.droit === droit);
  if (ligne) return ligne.niveau as Niveau;
  const def = DROITS.find(d => d.cle === droit);
  return def?.repli && !droitEnBase(ctx, droit) ? niveauDuRole(ctx, role, def.repli) : 'non';
}

/** Niveau d'un droit pour moi : « oui » pour le créateur, sinon celui de mon rôle dans la matrice */
export const niveauDroit = (ctx: ContexteDroits, droit: string): Niveau => (ctx.estCreateur ? 'oui' : niveauDuRole(ctx, monRole(ctx), droit));

export const aDroit = (ctx: ContexteDroits, droit: string): boolean => niveauDroit(ctx, droit) === 'oui';

/** Niveau d'un droit pour un rôle donné, ou pour moi si aucun rôle n'est précisé (barre latérale et cartes des rôles : mêmes règles) */
export const niveauPour = (ctx: ContexteDroits, droit: string, role?: string): Niveau =>
  role ? niveauDuRole(ctx, role, droit) : niveauDroit(ctx, droit);

/** Droits par onglet (migration 038) : un onglet est affiché si son droit n'est pas « Non » ; un onglet sans droit est toujours affiché */
export function ongletPermis(ctx: ContexteDroits, ecran: string, id: string): boolean {
  const def = DROITS.find(d => d.ecran === ecran && d.id === id);
  return !def || niveauDroit(ctx, def.cle) !== 'non';
}

/** Écran ouvert à un rôle : il n'a pas de droit d'onglet, ou au moins un de ses onglets est permis (menu masqué sinon) */
export function ecranOuvert(ctx: ContexteDroits, ecran: string, role?: string): boolean {
  const onglets = DROITS.filter(d => d.ecran === ecran);
  return !onglets.length || onglets.some(d => niveauPour(ctx, d.cle, role) !== 'non');
}

/** Écran d'arrivée : le dashboard général, ou le daily si le rôle n'a pas accès au dashboard (matrice) */
export const ecranAccueil = (ctx: ContexteDroits): 'dashboard' | 'daily' => (niveauDroit(ctx, 'suivi_dashboard') === 'non' ? 'daily' : 'dashboard');

/* ---------- Périmètre : unités gérées, projets, fiches ---------- */

/** Unités que je gère : celles dont je suis responsable (responsables_equipe ou owner / admin de l'organisation) avec leurs
 *  sous-unités ; administrateur et créateur : toutes (comme mes_unites_gerees en base, migration 042) */
export function equipesGerees(ctx: ContexteDroits): Set<string> {
  if (ctx.estAdmin || ctx.estCreateur) return new Set(ctx.equipes.map(e => e.id));
  const moi = maRessource(ctx);
  /* Propriétaire ou administrateur de l'organisation Neon Auth d'une équipe = responsable, SAUF si la personne a un rôle déclaré plus modeste
     (Chef de projet, Membre, Utilisateur, Lecture seule) : avec le rôle unique, c'est le rôle qui compte (porteur, 2026-11-04 : « en tant que chef
     de projet je ne dois voir que mes projets »). La base garde ses propres règles ; ceci ne règle que ce que l'écran montre. */
  const declare = moi ? roleDeclare(ctx, moi) : null;
  const roleOrganisationCompte = !declare || ['responsable', 'direction'].includes(declare);
  const gerees = new Set(ctx.equipes
    .filter(e => (!!moi && responsablesDe(ctx, e.id).some(r => r.id === moi.id))
      || (roleOrganisationCompte && ROLES_RESPONSABLE.includes(ctx.rolesEquipe[e.id] ?? '')))
    .map(e => e.id));
  // Simulation : le rôle de la carte s'applique à la fiche choisie (Direction : son unité parente, comme appliquer_role)
  if (ctx.simulation && moi && ['responsable', 'direction'].includes(ctx.simulation.cle)) {
    const sienne = trouverEquipe(ctx, moi.equipeId);
    if (sienne) gerees.add(ctx.simulation.cle === 'direction' && sienne.parentId ? sienne.parentId : sienne.id);
  }
  // Sous-unités : on ajoute les unités dont le parent est déjà géré, jusqu'à ce qu'il n'y en ait plus
  let ajout = true;
  while (ajout) {
    ajout = false;
    ctx.equipes.forEach(e => {
      if (e.parentId && gerees.has(e.parentId) && !gerees.has(e.id)) {
        gerees.add(e.id);
        ajout = true;
      }
    });
  }
  return gerees;
}

/** Suis-je affecté(e) au projet ? (affectation de ma fiche, ou de la fiche simulée) */
const suisAffecteAu = (ctx: ContexteDroits, projet: Projet): boolean => {
  const moi = maRessource(ctx);
  return !!moi && ctx.affectations.some(a => a.projetId === projet.id && a.ressourceId === moi.id);
};

/** Gestionnaire du projet par son unité : administrateur (périmètre « Tout », migration 032), responsable ou direction de l'unité
 *  du projet (migration 042 : un simple membre de l'équipe n'agit plus sur ses projets) */
const gereLUniteDuProjet = (ctx: ContexteDroits, projet: Projet): boolean =>
  ctx.estAdmin || equipesGerees(ctx).has(projet.equipeId);

/** Gérer un projet (modifier sa fiche, le supprimer) : gestionnaire de l'unité, ou Chef de projet affecté ou chef désigné du projet
 *  (comme peut_gerer_projet en base), et droit « projets » de la matrice */
export function peutGererProjet(ctx: ContexteDroits, projet: Projet | null | undefined): boolean {
  if (!projet || !aDroit(ctx, 'projets')) return false;
  if (gereLUniteDuProjet(ctx, projet)) return true;
  const moi = maRessource(ctx);
  return monRole(ctx) === 'chef' && (suisAffecteAu(ctx, projet) || (!!moi && projet.chefId === moi.id));
}

/** Saisir les sprints et les mises en production d'un projet : tout ce qui permet de le gérer, plus le Chef de projet ou le Membre affecté (rôle unique
 *  de la personne, migration 054 ; comme peut_saisir_projet en base), et droit « projets » de la matrice */
export function peutSaisirProjet(ctx: ContexteDroits, projet: Projet | null | undefined): boolean {
  if (!projet || !aDroit(ctx, 'projets')) return false;
  return peutGererProjet(ctx, projet) || (['chef', 'membre'].includes(monRole(ctx)) && suisAffecteAu(ctx, projet));
}

/** Affecter des personnes à un projet : gérer le projet, et droit « affecter » de la matrice */
export const peutAffecterSur = (ctx: ContexteDroits, projet: Projet | null | undefined): boolean =>
  peutGererProjet(ctx, projet) && aDroit(ctx, 'affecter');

/** Modifier la fiche d'une personne (Liste des ressources) : son équipe ou administrateur, et droit de la matrice */
export const peutModifierFiche = (ctx: ContexteDroits, r: Ressource): boolean =>
  (estMembreDe(ctx, r.equipeId) || ctx.estAdmin) && aDroit(ctx, 'fiches_ressources');

/** Gérer une équipe (membres, invitations, rôle d'accès) : administrateur ou responsable de l'équipe */
export const peutGererEquipe = (ctx: ContexteDroits, equipeId: string): boolean =>
  (ctx.estAdmin || estResponsableDe(ctx, equipeId)) && aDroit(ctx, 'fiches_ressources');

/** Valider / renvoyer les feuilles de temps d'une équipe : responsable de l'équipe et droit de la matrice */
export const peutValiderEquipe = (ctx: ContexteDroits, equipeId: string): boolean =>
  estResponsableDe(ctx, equipeId) && aDroit(ctx, 'valider_timesheet');

/** Rattacher ou retirer quelqu'un d'une équipe : administrateur ou responsable de l'équipe, avec le droit « affecter » */
export const peutRattacherA = (ctx: ContexteDroits, equipeId: string): boolean =>
  (ctx.estAdmin || estResponsableDe(ctx, equipeId)) && aDroit(ctx, 'affecter');

/* ---------- Daily et pilotage d'un projet ---------- */

/** Suis-je responsable de l'unité du projet ou d'une unité au-dessus ? On remonte les unités parentes (10 niveaux au plus,
 *  garde-fou contre une boucle). */
export function suisResponsableDuProjet(ctx: ContexteDroits, p: Projet): boolean {
  const moi = maRessource(ctx);
  let e = trouverEquipe(ctx, p.equipeId);
  for (let niveau = 0; e && niveau < 10; niveau++) {
    if ((!!moi && responsablesDe(ctx, e.id).some(r => r.id === moi.id)) || estResponsableDe(ctx, e.id)) return true;
    e = trouverEquipe(ctx, e.parentId);
  }
  return false;
}

/** Mon affectation sur un projet (ou null) */
export function monAffectation(ctx: ContexteDroits, p: Projet): Affectation | null {
  const moi = maRessource(ctx);
  return moi ? ctx.affectations.find(a => a.projetId === p.id && a.ressourceId === moi.id) ?? null : null;
}

/** Projets dont je peux lire le daily (même règle que peut_lire_daily_projet en base) : administrateur, affecté(e) au projet,
 *  ou responsable de son unité ou d'une unité parente */
export const peutLireDailyProjet = (ctx: ContexteDroits, p: Projet): boolean =>
  ctx.estAdmin || !!monAffectation(ctx, p) || suisResponsableDuProjet(ctx, p);

/** Chef du projet : chef désigné sur la fiche projet, ou Chef de projet (rôle unique) affecté au projet — comme peut_gerer_envoi_projet en base */
export function suisChefDuProjet(ctx: ContexteDroits, p: Projet): boolean {
  const moi = maRessource(ctx);
  if (estLectureSeule(ctx) || !moi) return false;
  return p.chefId === moi.id || (monRole(ctx) === 'chef' && suisAffecteAu(ctx, p));
}

/** Qui pilote un projet — règle l'envoi de son daily (même règle que peut_gerer_envoi_projet en base, migrations 019 et 021) :
 *  administrateur, chef du projet, ou responsable de son unité ou d'une unité parente */
export const peutPiloterProjet = (ctx: ContexteDroits, p: Projet): boolean =>
  (ctx.estAdmin || suisChefDuProjet(ctx, p) || suisResponsableDuProjet(ctx, p)) && aDroit(ctx, 'piloter');

