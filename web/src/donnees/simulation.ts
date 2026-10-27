/* ============================================================
   Simulation des rôles — réservée au créateur (portage de app/js/simulation.js, phase 3 de la migration)
   ------------------------------------------------------------
   Besoin (porteur du projet, 2026-10-08) : voir l'application exactement comme une personne d'un rôle donné.
   Principe : le temps de la simulation, l'identité utilisée par les droits (compte, administrateur, équipes et rôle dans
   l'équipe, fiche ressource) est remplacée par celle de la personne choisie, calculée d'après sa fiche. LECTURE SEULE :
   le client API refuse toute écriture (api.ts, definirSimulationActive), car la base appliquerait les droits réels du créateur.
   ============================================================ */
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
