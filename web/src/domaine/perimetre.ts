/* ============================================================
   Périmètre de lecture par rôle (miroir des règles RLS de la migration 042)
   (portage TypeScript de appliquerPerimetre de app/js/etat.js — phase 2 de la migration)
   ------------------------------------------------------------
   En fonctionnement normal, la base ne renvoie déjà que ce que le compte a le droit de lire (RLS). Pendant une simulation de
   rôle, les données sont lues avec le compte du créateur : on applique ici les mêmes règles que peut_voir_projet,
   peut_voir_ressource, peut_voir_temps et peut_voir_equipe, pour que la simulation montre exactement ce que verrait la personne.
   Le contexte reçu doit porter les données COMPLÈTES (non filtrées).
   ============================================================ */
import { equipesGerees, maRessource } from './droits';
import type { ContexteDroits } from './droits';
import type { Absence, Affectation, FeuilleTemps, EnvoiDaily, MiseEnProduction, ObjectifJoursTravail, Projet, Rattachement, Ressource,
  SprintProjet, TempsSaisi } from './types';

/** Les tables que la simulation filtre (clés comme dans l'application actuelle) */
export interface DonneesPerimetre {
  ressources: readonly Ressource[];
  projets: readonly Projet[];
  affectations: readonly Affectation[];
  absences: readonly Absence[];
  temps: readonly TempsSaisi[];
  feuilles: readonly FeuilleTemps[];
  sprintsProjet: readonly SprintProjet[];
  repartitionsSprint: readonly { projetId: string }[];
  misesEnProduction: readonly MiseEnProduction[];
  envoisDaily: readonly EnvoiDaily[];
  objectifsTravail: readonly ObjectifJoursTravail[];
  rattachements: readonly Rattachement[];
}

/** Filtre les données selon ce que verrait la personne simulée ; sans simulation, renvoie les données telles quelles
 *  (c'est alors la base qui filtre). */
export function appliquerPerimetre(ctx: ContexteDroits, brut: DonneesPerimetre): DonneesPerimetre {
  if (!ctx.simulation) return brut;
  const gerees = equipesGerees(ctx);
  const moi = maRessource(ctx);
  const moiId = moi ? moi.id : null;
  const monEquipe = moi ? moi.equipeId : null;
  const mesProjets = new Set(brut.affectations.filter(a => a.ressourceId === moiId).map(a => a.projetId));
  // Projet visible : d'une unité que je gère, où je suis chef, ou où je suis affecté
  const projetsVus = new Set(brut.projets.filter(p => gerees.has(p.equipeId) || p.chefId === moiId || mesProjets.has(p.id)).map(p => p.id));
  const collegues = new Set(brut.affectations.filter(a => mesProjets.has(a.projetId)).map(a => a.ressourceId));
  const rattaches = new Set(brut.rattachements.filter(x => gerees.has(x.equipeId)).map(x => x.ressourceId));
  const equipeDe = (id: string) => brut.ressources.find(r => r.id === id)?.equipeId;
  const gereLEquipeDe = (id: string) => { const e = equipeDe(id); return !!e && gerees.has(e); };
  // Personne visible : moi, une personne d'une unité que je gère, un collègue de projet, un rattaché à une unité que je gère
  const voitPersonne = (id: string) => id === moiId || gereLEquipeDe(id) || collegues.has(id) || rattaches.has(id);
  // Heures et feuilles de temps : moi ou une personne d'une unité que je gère (pas les collègues de projet)
  const voitTemps = (id: string) => id === moiId || gereLEquipeDe(id);
  // Objectifs de jours du client : unité que je gère ou ma propre unité
  const voitEquipe = (id: string) => gerees.has(id) || (!!monEquipe && id === monEquipe);
  const parProjet = <T extends { projetId: string }>(lignes: readonly T[]): T[] => lignes.filter(x => projetsVus.has(x.projetId));

  return {
    ...brut,
    projets: brut.projets.filter(p => projetsVus.has(p.id)),
    affectations: parProjet(brut.affectations),
    ressources: brut.ressources.filter(r => voitPersonne(r.id)),
    absences: brut.absences.filter(a => voitPersonne(a.ressourceId)),
    temps: brut.temps.filter(t => voitTemps(t.ressourceId)),
    feuilles: brut.feuilles.filter(f => voitTemps(f.ressourceId)),
    sprintsProjet: parProjet(brut.sprintsProjet),
    repartitionsSprint: parProjet(brut.repartitionsSprint),
    misesEnProduction: parProjet(brut.misesEnProduction),
    envoisDaily: parProjet(brut.envoisDaily),
    objectifsTravail: brut.objectifsTravail.filter(o => voitEquipe(o.equipeId))
  };
}
