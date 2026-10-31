/* ============================================================
   Vues sur les données chargées : listes et regroupements que partagent plusieurs écrans
   (portage des accès pratiques de app/js/etat.js — phase 5, vague B de la migration)
   ------------------------------------------------------------
   Fonctions pures : elles reçoivent les données (et le contexte de droits quand une règle de visibilité s'applique) et ne
   lisent aucune variable globale. Un seul endroit pour ces listes : les écrans consomment, ils ne les recalculent pas (règle n°4).
   ============================================================ */
import { estPresentSur, estTermine } from './calculs';
import { ROLES_PROJET } from './config';
import { estResponsableEquipe, peutLireDailyProjet, responsablesDe } from './droits';
import type { ContexteDroits } from './droits';
import type { Absence, Affectation, Equipe, Iso, MiseEnProduction, NoteDaily, Projet, Ressource, SprintProjet } from './types';
import { ajouterJours, estWeekend } from './dates';

/** Données utilisées par ces vues (sous-ensemble de Donnees, pour rester testable avec peu de lignes) */
export interface DonneesVues {
  equipes: readonly Equipe[];
  ressources: readonly Ressource[];
  projets: readonly Projet[];
  affectations: readonly Affectation[];
}

/* ---------- Personnes ---------- */

/* Listes de personnes de tous les écrans (règle du porteur 2026-10-06) : une personne apparaît sur une période si elle y est
   PRÉSENTE (entre sa date d'arrivée et sa date de fin). Une personne partie le 30/09 reste donc visible en septembre et disparaît à
   partir d'octobre ; ses données restent en base. */
export const ressourcesPresentes = (d: Pick<DonneesVues, 'ressources'>, debut: Iso, fin: Iso = debut): Ressource[] =>
  d.ressources.filter(r => estPresentSur(r, debut, fin));

export const estPresenteSur = (d: Pick<DonneesVues, 'ressources'>, id: string, debut: Iso, fin: Iso = debut): boolean => {
  const r = d.ressources.find(x => x.id === id);
  return !!r && estPresentSur(r, debut, fin);
};

/** Ressource inactive : une date de fin (date_depart) est saisie (règle du porteur, 2026-10-05) */
export const estInactive = (r: Pick<Ressource, 'dateDepart'>): boolean => !!r.dateDepart;

/* ---------- Projets ---------- */

/** Projet en cours (non terminé) : seul un projet en cours attend un daily */
export const projetEnCours = (p: Pick<Projet, 'statut'>): boolean => !estTermine(p);

const parCode = (a: Projet, b: Projet): number => a.code.localeCompare(b.code);

/** Projets en cours dont je peux lire le daily (même règle qu'en base : peut_lire_daily_projet), triés par code */
export const projetsDailyVisibles = (ctx: ContexteDroits, projets: readonly Projet[]): Projet[] =>
  projets.filter(p => projetEnCours(p) && peutLireDailyProjet(ctx, p)).sort(parCode);

/** Projets d'une personne avec son rôle : ses affectations, plus les projets dont elle est le chef inscrit sur la fiche projet
 *  (projets.chef_id, lu tant qu'un chef n'y figure que là — migration 028) → rôle « Chef de projet ». */
export function projetsAvecRoleDe(d: DonneesVues, ressourceId: string): { projet: Projet; role: string }[] {
  const liste = d.affectations.filter(a => a.ressourceId === ressourceId)
    .flatMap(a => { const projet = d.projets.find(p => p.id === a.projetId); return projet ? [{ projet, role: a.role }] : []; });
  d.projets.filter(p => p.chefId === ressourceId && !liste.some(x => x.projet.id === p.id))
    .forEach(projet => liste.push({ projet, role: ROLES_PROJET.CHEF }));
  return liste;
}

/** Projets où la personne est affectée (étiquettes « VISTA Digital »), dans l'ordre de ses affectations */
export const projetsDe = (d: DonneesVues, ressourceId: string): Projet[] => d.affectations.filter(a => a.ressourceId === ressourceId)
  .flatMap(a => d.projets.filter(p => p.id === a.projetId));

/** Unités du haut de l'arborescence (sans parent, ou parent introuvable) : directions d'abord, puis équipes isolées */
export function unitesRacines(equipes: readonly Equipe[]): Equipe[] {
  const racines = equipes.filter(e => !e.parentId || !equipes.some(x => x.id === e.parentId));
  return [...racines.filter(e => e.type === 'direction'), ...racines.filter(e => e.type !== 'direction')];
}

/* ---------- Sprints et mises en production ---------- */

/** Sprint d'un projet avec ses deux dates (« debut » et « fin » connus) */
export type SprintDatee = SprintProjet & { debut: Iso; fin: Iso };

/** Sprints d'un projet saisis par le porteur (version, début, fin), du plus ancien au plus récent */
export const sprintsDuProjet = (sprints: readonly SprintProjet[], projetId: string): SprintDatee[] => sprints
  .filter((s): s is SprintDatee => s.projetId === projetId && !!s.debut && !!s.fin)
  .sort((a, b) => a.debut.localeCompare(b.debut));

/** Mise en production datée */
export type MepDatee = MiseEnProduction & { jour: Iso };

/** Mises en production des projets donnés (migration 039), de la plus proche à la plus lointaine */
export const misesEnProductionDe = (meps: readonly MiseEnProduction[], projets: readonly Pick<Projet, 'id'>[]): MepDatee[] => meps
  .filter((m): m is MepDatee => !!m.jour && projets.some(p => p.id === m.projetId))
  .sort((a, b) => a.jour.localeCompare(b.jour));

/* ---------- Daily ---------- */

/** Auteur des dailys d'une personne : son compte, ou « fiche:<id> » pour un daily importé d'une personne sans compte
 *  (CR Daily Excel, migration 034 ; ils passent sur son compte quand elle relie sa fiche) */
export const auteurDaily = (r: Pick<Ressource, 'id' | 'userId'>): string => r.userId || 'fiche:' + r.id;

/** Note d'une personne (compte) pour un projet et un jour */
export const noteProjet = (notes: readonly NoteDaily[], userId: string, projetId: string, jour: Iso): NoteDaily | null =>
  notes.find(n => n.userId === userId && n.projetId === projetId && n.jour === jour) ?? null;

/** Note non vide d'une personne sur un projet un jour donné, sinon null */
export function noteNonVide(notes: readonly NoteDaily[], r: Pick<Ressource, 'id' | 'userId'>, projetId: string, jour: Iso): NoteDaily | null {
  const n = noteProjet(notes, auteurDaily(r), projetId, jour);
  return n && n.texte.trim() ? n : null;
}

/** Absence d'une personne un jour donné */
export const absenceDe = (absences: readonly Absence[], ressourceId: string, jour: Iso): Absence | null =>
  absences.find(a => a.ressourceId === ressourceId && a.jour === jour) ?? null;

/** Membres d'un projet attendus au daily ce jour-là : affectés hors Lecteur et présents (arrivée / fin), triés par nom */
export function membresDuDaily(d: DonneesVues, projetId: string, jour: Iso): Ressource[] {
  return d.affectations.filter(a => a.projetId === projetId && a.role !== ROLES_PROJET.LECTEUR && estPresenteSur(d, a.ressourceId, jour))
    .flatMap(a => d.ressources.filter(r => r.id === a.ressourceId)).sort((x, y) => x.nom.localeCompare(y.nom));
}

/** Jour ouvré précédent (sens −1) ou suivant (sens +1) : on saute les week-ends */
export function decalerJourOuvre(jour: Iso, sens: number): Iso {
  let j = ajouterJours(jour, sens);
  while (estWeekend(j)) j = ajouterJours(j, sens);
  return j;
}

/* ---------- Libellé « projets de la personne » (annuaire) ---------- */

/** Ce que l'annuaire affiche pour les projets d'une personne : ses projets avec rôle (« VISTA · PO »), sinon « Responsable d'équipe »
 *  pour un responsable (pas de projet attitré, c'est normal — porteur 2026-10-22), sinon « hors projet » */
export type ProjetsAnnuaire = { genre: 'projets'; lignes: string[] } | { genre: 'responsable' } | { genre: 'aucun' };

export function projetsPourAnnuaire(ctx: ContexteDroits, d: DonneesVues, r: Ressource): ProjetsAnnuaire {
  const lignes = projetsAvecRoleDe(d, r.id).map(x => `${x.projet.nom} · ${x.role === ROLES_PROJET.CHEF ? 'PO' : x.role}`);
  if (lignes.length) return { genre: 'projets', lignes };
  return estResponsableEquipe(ctx, r) ? { genre: 'responsable' } : { genre: 'aucun' };
}

/* ============================================================
   Modèle du calendrier des absences (Gestion des ressources) : quelles lignes, dans quel ordre
   (portage de Calendrier.unite et Calendrier.lignesProjet de app/js/ecrans/ressources.js)
   ============================================================ */

export type ElementCalendrier =
  | { genre: 'unite'; equipe: Equipe; niveau: number }
  | { genre: 'personne'; ressource: Ressource; niveau: number; responsable: boolean; projets: string[] }
  | { genre: 'intertitre'; niveau: number }
  | { genre: 'synthese'; projet: Projet; niveau: number; ids: string[] }
  | { genre: 'projet'; projet: Projet; niveau: number; nbMembres: number };

/** Membres d'un projet présents sur la période affichée */
const membresPresents = (d: DonneesVues, projetId: string, debut: Iso, fin: Iso): string[] => d.affectations.filter(a => a.projetId === projetId)
  .map(a => a.ressourceId).filter(id => estPresenteSur(d, id, debut, fin));

const nomsProjets = (d: DonneesVues, ressourceId: string): string[] => projetsDe(d, ressourceId).map(p => p.nom);

/* Vue « Par équipe » : chaque personne une seule fois sous son unité (responsable en tête), puis la synthèse des absences par projet
   de l'unité (maquette conges-sans-doublon, pistes 2 et 3). Une unité sans personne ni projet n'apparaît pas. */
export function modeleParEquipe(ctx: ContexteDroits, d: DonneesVues, debut: Iso, fin: Iso, equipe: Equipe, niveau = 0): ElementCalendrier[] {
  const idsResponsables = responsablesDe(ctx, equipe.id).map(r => r.id);
  const estResponsable = (r: Ressource) => idsResponsables.includes(r.id);
  const projets = d.projets.filter(p => p.equipeId === equipe.id && membresPresents(d, p.id, debut, fin).length);
  const personnes = ressourcesPresentes(d, debut, fin).filter(r => r.equipeId === equipe.id)
    .sort((a, b) => Number(estResponsable(b)) - Number(estResponsable(a)));
  const contenu: ElementCalendrier[] = [
    ...personnes.map((ressource): ElementCalendrier => ({ genre: 'personne', ressource, niveau: niveau + 1, responsable: estResponsable(ressource),
      projets: nomsProjets(d, ressource.id) })),
    ...d.equipes.filter(x => x.parentId === equipe.id).flatMap(x => modeleParEquipe(ctx, d, debut, fin, x, niveau + 1)),
    ...(projets.length
      ? [{ genre: 'intertitre', niveau: niveau + 1 } as const, ...projets.map((projet): ElementCalendrier => ({ genre: 'synthese', projet, niveau: niveau + 1,
        ids: membresPresents(d, projet.id, debut, fin) }))]
      : [])
  ];
  return contenu.length ? [{ genre: 'unite', equipe, niveau }, ...contenu] : [];
}

/** Vue « Par projet » : les membres du projet choisi, une fois chacun, puis sa synthèse */
export function modeleParProjet(d: DonneesVues, debut: Iso, fin: Iso, projet: Projet): ElementCalendrier[] {
  const ids = membresPresents(d, projet.id, debut, fin);
  return [
    { genre: 'projet', projet, niveau: 0, nbMembres: ids.length },
    ...ids.flatMap(id => d.ressources.filter(r => r.id === id)).map((ressource): ElementCalendrier => ({ genre: 'personne', ressource, niveau: 1,
      responsable: false, projets: nomsProjets(d, ressource.id) })),
    { genre: 'synthese', projet, niveau: 1, ids }
  ];
}

/** Projets proposés en vue « Par projet » : ceux qui ont des membres */
export const projetsAvecMembres = (d: DonneesVues): Projet[] => d.projets.filter(p => d.affectations.some(a => a.projetId === p.id));

/* ---------- Personnes proposées pour un projet ---------- */

/** Personnes proposées pour un projet de l'équipe « equipeId » (chef de projet, membre, lecteur) : TOUTES les personnes présentes — une
 *  personne travaille sur des projets de plusieurs équipes (porteur, 2026-10-13 : « les chefs de projet ne sont pas dans la liste »). Les
 *  personnes de l'équipe d'abord ; libellé « Nom — Équipe · Poste » pour retrouver un chef de projet par son poste. */
export function personnesProposees(d: Pick<DonneesVues, 'equipes' | 'ressources'>, equipeId: string, aujourdhui: Iso): { valeur: string; libelle: string }[] {
  const deLEquipe = (r: Ressource) => (r.equipeId === equipeId ? 0 : 1);
  return ressourcesPresentes(d, aujourdhui).sort((a, b) => deLEquipe(a) - deLEquipe(b) || a.nom.localeCompare(b.nom))
    .map(r => ({ valeur: r.id, libelle: `${r.nom} — ${d.equipes.find(e => e.id === r.equipeId)?.nom ?? '—'}${r.poste ? ' · ' + r.poste : ''}` }));
}
