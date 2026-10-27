/* ============================================================
   Contexte des droits : assemble compte, données et simulation en un ContexteDroits
   (phase 3 de la migration) — fonctions pures, testées.
   ------------------------------------------------------------
   Sans simulation, ce sont les données lues (la base a déjà appliqué les règles RLS). Pendant une simulation, l'identité est
   remplacée (simulation.ts) et les données sont filtrées par appliquerPerimetre (domaine/perimetre.ts).
   ============================================================ */
import { maRessource } from '../domaine/droits';
import type { ContexteDroits, Simulation } from '../domaine/droits';
import { appliquerPerimetre } from '../domaine/perimetre';
import type { Donnees } from './tables';
import { identiteSimulee } from './simulation';
import type { Identite } from './simulation';

/** Identité réelle du compte connecté, d'après la session et les tables administrateurs / créateur */
export function identiteReelle(userId: string | null, donnees: Donnees, organisations: readonly { id: string }[],
  rolesEquipe: Readonly<Record<string, string>>): Identite {
  const estCreateur = !!userId && donnees.createur.some(c => c.userId === userId);
  const estAdmin = estCreateur || (!!userId && donnees.administrateurs.some(a => a.userId === userId));
  return { userId, estCreateur, estAdmin, organisations, rolesEquipe };
}

/** Contexte de droits à partir de l'identité et des données COMPLÈTES */
function assembler(identite: Identite, simulation: Simulation | null, donnees: Donnees,
  membresEquipe: ContexteDroits['membresEquipe']): ContexteDroits {
  return { ...identite, simulation, membresEquipe, ...donnees };
}

export interface VueDroits {
  /** Contexte de droits (identité simulée pendant une simulation) */
  ctx: ContexteDroits;
  /** Données à afficher : filtrées par le périmètre pendant une simulation, telles quelles sinon */
  donnees: Donnees;
}

/* Contexte et données visibles. Pendant une simulation, le périmètre est calculé avec le contexte SIMULÉ sur les données
   complètes ; les autres tables (droits, référentiels…) restent entières. */
export function construireVue(identiteReelleDuCompte: Identite, donneesBrutes: Donnees, membresEquipe: ContexteDroits['membresEquipe'],
  simulation: Simulation | null): VueDroits {
  if (!simulation) return { ctx: assembler(identiteReelleDuCompte, null, donneesBrutes, membresEquipe), donnees: donneesBrutes };
  const base = assembler(identiteReelleDuCompte, simulation, donneesBrutes, membresEquipe);
  const fiche = maRessource(base);
  const ctxSimule = assembler(identiteSimulee(base, simulation, fiche), simulation, donneesBrutes, membresEquipe);
  const donnees: Donnees = { ...donneesBrutes, ...appliquerPerimetre(ctxSimule, donneesBrutes) };
  return { ctx: { ...ctxSimule, ...donnees }, donnees };
}
