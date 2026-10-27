/* ============================================================
   Simulation des rôles — réservée au créateur (portage de app/js/simulation.js, phase 3 de la migration)
   ------------------------------------------------------------
   Besoin (porteur du projet, 2026-10-08) : voir l'application exactement comme une personne d'un rôle donné.
   Principe : le temps de la simulation, l'identité utilisée par les droits (compte, administrateur, équipes et rôle dans
   l'équipe, fiche ressource) est remplacée par celle de la personne choisie, calculée d'après sa fiche. LECTURE SEULE :
   le client API refuse toute écriture (api.ts, definirSimulationActive), car la base appliquerait les droits réels du créateur.
   ============================================================ */
import { LIBELLES_ROLES, ROLES_CHOISISSABLES } from '../domaine/config';
import type { RoleAcces } from '../domaine/config';
import { responsablesDe } from '../domaine/droits';
import type { ContexteDroits, Simulation } from '../domaine/droits';
import type { Ressource } from '../domaine/types';

/** Rôle simulé pour un compte inscrit sans équipe (ni droit) */
export const ROLE_SANS_EQUIPE = 'sansEquipe';

/** Identité du compte connecté, séparée des données (ce que la simulation remplace) */
export interface Identite {
  userId: string | null;
  estCreateur: boolean;
  estAdmin: boolean;
  organisations: readonly { id: string }[];
  rolesEquipe: Readonly<Record<string, string>>;
}

/* Identité simulée : équipes de la personne = l'unité de sa fiche ; rôle dans l'équipe = « owner » si elle en est la
   responsable, sinon « member » ; « compte sans équipe » : aucune équipe. Le créateur perd sa qualité (sinon il verrait tout). */
export function identiteSimulee(base: ContexteDroits, simulation: Simulation, fiche: Ressource | null): Identite {
  const equipe = fiche && simulation.cle !== ROLE_SANS_EQUIPE ? base.equipes.find(e => e.id === fiche.equipeId) : undefined;
  const estResponsable = !!fiche && !!equipe && responsablesDe(base, equipe.id).some(r => r.id === fiche.id);
  return {
    userId: fiche?.userId || 'simulation',
    estCreateur: false,
    estAdmin: simulation.cle === 'admin',
    organisations: equipe ? [{ id: equipe.id }] : [],
    rolesEquipe: equipe ? { [equipe.id]: estResponsable ? 'owner' : 'member' } : {}
  };
}

/* ---------- Choix du rôle et de la personne (bandeau et page de simulation) ---------- */

/** Libellé d'un rôle simulé (« Compte en attente » pour un compte sans équipe) */
export const libelleRoleSimule = (cle: string): string =>
  cle === ROLE_SANS_EQUIPE ? 'Compte en attente' : LIBELLES_ROLES[cle as RoleAcces] ?? cle;

/** Liste « rôle — personne » du bandeau : un choix par rôle et par fiche (valeur « rôle|fiche »), puis le compte en attente.
 *  Toutes les fiches sont proposées, par ordre alphabétique : le rôle de la carte leur est appliqué le temps de la simulation. */
export function choixSimulation(ressources: readonly Pick<Ressource, 'id' | 'nom'>[]): { valeur: string; libelle: string }[] {
  const triees = [...ressources].sort((a, b) => a.nom.localeCompare(b.nom));
  return [
    ...ROLES_CHOISISSABLES.flatMap(role => triees.map(r => ({ valeur: `${role}|${r.id}`, libelle: `${libelleRoleSimule(role)} — ${r.nom}` }))),
    { valeur: `${ROLE_SANS_EQUIPE}|`, libelle: libelleRoleSimule(ROLE_SANS_EQUIPE) }
  ];
}

/** Décode une valeur « rôle|fiche » du bandeau */
export function decoderChoixSimulation(valeur: string): Simulation {
  const [cle = '', ressourceId = ''] = valeur.split('|');
  return { cle, ressourceId: ressourceId || null };
}
