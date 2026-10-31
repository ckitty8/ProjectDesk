/* ============================================================
   Congés › Récap annuel : jours travaillés / congés / reste à prendre, par unité et par personne
   (portage de Ecrans.conges.recap de app/js/ecrans/conges.js — phase 5, vague C ; maquette recap-jours-travailles)
   ------------------------------------------------------------
   Reprise de l'onglet « Jours de congés » du fichier du porteur. Calculs : recapJoursTravailles (calculs.ts). Objectif client par équipe
   et par année : table objectifs_jours_travail, valeur par défaut CONFIG.JOURS_TRAVAIL_CLIENT_DEFAUT. Fonctions pures.
   ============================================================ */
import { recapJoursTravailles } from './calculs';
import type { RecapJours } from './calculs';
import { formatCourt } from './dates';
import { aDroit, estResponsableDe } from './droits';
import type { ContexteDroits } from './droits';
import type { Absence, Equipe, Iso, ObjectifJoursTravail, Ressource } from './types';
import { ressourcesPresentes } from './vues';
import type { DonneesVues } from './vues';
import { objectifJoursTravail } from './saisies';

export type ElementRecap =
  | { genre: 'unite'; equipe: Equipe; niveau: number; objectif: number; modifiable: boolean }
  | { genre: 'personne'; ressource: Ressource; niveau: number; recap: RecapJours; objectifUnite: number; mentions: string[] }
  | { genre: 'total'; equipe: Equipe; niveau: number; mois: { travailles: number; conges: number }[]; travailles: number; conges: number };

/** Mention sous le nom d'une personne arrivée ou partie dans l'année ; ses mois hors présence sont affichés « — » */
const mentions = (r: Pick<Ressource, 'dateArrivee' | 'dateDepart'>, annee: number): string[] => {
  const dansAnnee = (d?: Iso | null): d is Iso => !!d && d.startsWith(String(annee));
  return [dansAnnee(r.dateArrivee) ? 'arrivée le ' + formatCourt(r.dateArrivee) : '', dansAnnee(r.dateDepart) ? 'départ le ' + formatCourt(r.dateDepart) : '']
    .filter(Boolean);
};

/** Lignes du récap pour une unité : titre avec son objectif, ses personnes, son total, puis ses sous-unités. Une unité vide n'apparaît pas. */
export function modeleRecap(ctx: ContexteDroits, d: DonneesVues & { absences: readonly Absence[]; objectifsTravail: readonly ObjectifJoursTravail[] },
  annee: number, feries: ReadonlySet<Iso>, equipe: Equipe, niveau = 0): ElementRecap[] {
  const objectif = objectifJoursTravail(d.objectifsTravail, equipe.id, annee);
  const modifiable = (ctx.estAdmin || estResponsableDe(ctx, equipe.id)) && aDroit(ctx, 'conges_equipe');
  const personnes = ressourcesPresentes(d, `${annee}-01-01`, `${annee}-12-31`).filter(r => r.equipeId === equipe.id).map(ressource => ({
    ressource, recap: recapJoursTravailles(ressource.id, annee, d.absences, feries, objectif, ressource)
  }));
  const sous = d.equipes.filter(x => x.parentId === equipe.id).flatMap(x => modeleRecap(ctx, d, annee, feries, x, niveau + 1));
  if (!personnes.length && !sous.length) return [];
  const somme = (f: (r: RecapJours) => number): number => personnes.reduce((s, p) => s + f(p.recap), 0);
  const total: ElementRecap[] = personnes.length ? [{
    genre: 'total', equipe, niveau,
    mois: Array.from({ length: 12 }, (_, m) => ({ travailles: somme(r => r.mois[m]?.travailles ?? 0), conges: somme(r => r.mois[m]?.conges ?? 0) })),
    travailles: somme(r => r.travailles), conges: somme(r => r.conges)
  }] : [];
  return [
    { genre: 'unite', equipe, niveau, objectif, modifiable },
    ...personnes.map(({ ressource, recap }): ElementRecap => ({ genre: 'personne', ressource, niveau: niveau + 1, recap, objectifUnite: objectif,
      mentions: mentions(ressource, annee) })),
    ...total,
    ...sous
  ];
}
