/* ============================================================
   Suivi de mes équipes › Daily des équipes : fil, blocages et synthèse de la semaine
   (portage de Ecrans.dailyEquipes et Synthese de app/js/ecrans/daily-equipes.js — phase 5, vague B ; maquettes daily-equipes-design/retenu/)
   ------------------------------------------------------------
   Semaine choisie (lundi → vendredi ouvrés), projets dont je peux lire le daily (voir projetsDailyVisibles). Fonctions pures : l'écran
   dessine ce que elles calculent. Les rubriques d'une note viennent de daily.ts.
   ============================================================ */
import { blocagesDaily } from './daily';
import { ajouterJours, ecartJours, joursOuvresEntre, lundi } from './dates';
import type { Absence, Iso, NoteDaily, Projet, Ressource } from './types';
import { absenceDe, estPresenteSur, membresDuDaily, noteNonVide } from './vues';
import type { DonneesVues } from './vues';

export interface DonneesDaily extends DonneesVues {
  notesProjet: readonly NoteDaily[];
  absences: readonly Absence[];
}

/** Jours ouvrés (hors week-end et fériés) de la semaine du jour choisi, du lundi au vendredi */
export function joursSemaine(jour: Iso, feries: ReadonlySet<Iso>): Iso[] {
  const debut = lundi(jour);
  return joursOuvresEntre(debut, ajouterJours(debut, 4), feries);
}

/** Personnes des projets donnés, présentes au moins un jour de la semaine, triées par nom */
export function personnesDaily(d: DonneesDaily, projets: readonly Projet[], jours: readonly Iso[]): Ressource[] {
  const vus = new Map<string, Ressource>();
  projets.forEach(p => jours.forEach(j => membresDuDaily(d, p.id, j).forEach(r => vus.set(r.id, r))));
  return [...vus.values()].sort((x, y) => x.nom.localeCompare(y.nom));
}

/** Un daily du fil : qui, quel projet, quel jour, et sa note */
export interface EntreeDaily { jour: Iso; projet: Projet; ressource: Ressource; note: NoteDaily }

/* Dailys de la semaine, du jour le plus récent au plus ancien, puis par heure d'enregistrement (la plus récente d'abord) ;
   « personne » = filtre sur une personne ('tous' : aucune) */
export function entreesDaily(d: DonneesDaily, projets: readonly Projet[], jours: readonly Iso[], personne = 'tous'): EntreeDaily[] {
  const liste: EntreeDaily[] = [];
  jours.forEach(jour => projets.forEach(projet => membresDuDaily(d, projet.id, jour).forEach(ressource => {
    const note = noteNonVide(d.notesProjet, ressource, projet.id, jour);
    if (note && (personne === 'tous' || personne === ressource.id)) liste.push({ jour, projet, ressource, note });
  })));
  return liste.sort((a, b) => b.jour.localeCompare(a.jour) || String(b.note.modifieLe ?? '').localeCompare(String(a.note.modifieLe ?? '')));
}

/* ---------- Synthèse de l'équipe ---------- */

/** État d'une personne un jour donné : à venir, hors présence, daily (avec ou sans blocage), absent(e) ou manquant */
export type EtatCase = 'ok' | 'bloc' | 'manque' | 'abs' | 'avenir' | 'hors';

/** État d'une personne un jour donné, tous projets affichés. « Sans compte » compte comme manquant. */
export function etatCase(d: DonneesDaily, r: Ressource, projets: readonly Projet[], jour: Iso, aujourdhui: Iso): EtatCase {
  if (jour > aujourdhui) return 'avenir';
  if (!estPresenteSur(d, r.id, jour)) return 'hors';
  const notes = projets.map(p => noteNonVide(d.notesProjet, r, p.id, jour)).filter((n): n is NoteDaily => !!n);
  if (notes.length) return notes.some(n => blocagesDaily(n.texte).length) ? 'bloc' : 'ok';
  return absenceDe(d.absences, r.id, jour) ? 'abs' : 'manque';
}

export interface SyntheseSemaine {
  grille: { ressource: Ressource; etats: EtatCase[] }[];
  /** Nombre de cases de chaque état */
  compte: Record<EtatCase, number>;
  renseignes: number;
  attendus: number;
  /** Dailys renseignés ÷ attendus, en % entier */
  taux: number;
}

export function syntheseSemaine(
  d: DonneesDaily, projets: readonly Projet[], jours: readonly Iso[], aujourdhui: Iso
): SyntheseSemaine {
  const grille = personnesDaily(d, projets, jours)
    .map(ressource => ({ ressource, etats: jours.map(j => etatCase(d, ressource, projets, j, aujourdhui)) }));
  const compte: Record<EtatCase, number> = { ok: 0, bloc: 0, manque: 0, abs: 0, avenir: 0, hors: 0 };
  grille.forEach(l => l.etats.forEach(e => { compte[e]++; }));
  const renseignes = compte.ok + compte.bloc, attendus = renseignes + compte.manque;
  return { grille, compte, renseignes, attendus, taux: attendus ? Math.round(100 * renseignes / attendus) : 0 };
}

/* ---------- Blocages ouverts ---------- */

export interface BlocageOuvert {
  ressource: Ressource;
  texte: string;
  /** Jours écoulés depuis le premier daily de la semaine portant ce blocage */
  age: number;
}

/* Blocages ouverts : ceux du dernier daily de la semaine de chaque membre × projet ; « age » = jours écoulés depuis le premier daily de
   la semaine qui porte ce même blocage */
export function blocagesOuverts(d: DonneesDaily, projets: readonly Projet[], jours: readonly Iso[], aujourdhui: Iso): BlocageOuvert[] {
  const ouverts: BlocageOuvert[] = [], vus = new Set<string>();
  entreesDaily(d, projets, jours).forEach(e => {
    const cle = e.ressource.id + e.projet.id;
    if (vus.has(cle)) return;
    vus.add(cle);
    blocagesDaily(e.note.texte).forEach(texte => {
      const premier = jours.find(j => {
        const n = noteNonVide(d.notesProjet, e.ressource, e.projet.id, j);
        return !!n && blocagesDaily(n.texte).includes(texte);
      });
      ouverts.push({ ressource: e.ressource, texte, age: ecartJours(premier ?? aujourdhui, aujourdhui) });
    });
  });
  return ouverts;
}

/** Jour du résumé : aujourd'hui s'il est dans la semaine, sinon le dernier jour ouvré affiché */
export const jourDuResume = (jours: readonly Iso[], aujourdhui: Iso): Iso | undefined => (jours.includes(aujourdhui) ? aujourdhui : jours[jours.length - 1]);
