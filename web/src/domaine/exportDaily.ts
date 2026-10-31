/* ============================================================
   Export du daily en Excel : période, lignes et onglets du fichier
   (portage de ExportDaily de app/js/ecrans/daily-equipes.js — phase 5, vague B ; maquette docs/maquettes/export-daily-excel/)
   ------------------------------------------------------------
   Fonctions pures ; le fichier est fabriqué par excel.ts et téléchargé par l'écran.
   ============================================================ */
import { debutMois } from './calculs';
import { decouperDaily, blocagesDaily } from './daily';
import type { ChampsDaily } from './daily';
import { ajouterJours, depuisIso, joursOuvresEntre, lundi } from './dates';
import type { FeuilleExcel, Cellule } from './excel';
import type { Iso, NoteDaily, Projet } from './types';
import { absenceDe, auteurDaily, membresDuDaily } from './vues';
import type { DonneesVues } from './vues';
import type { Absence } from './types';

export type RaccourciPeriode = 'jour' | 'semaine' | 'mois' | 'moisPrecedent';

/** Période d'un raccourci de la fenêtre d'export : { debut, fin } (dates ISO, fin = aujourd'hui au plus tard) */
export function periodeExport(cle: RaccourciPeriode, jour: Iso): { debut: Iso; fin: Iso } {
  const d = depuisIso(jour);
  const debutDuMois = debutMois(d.getFullYear(), d.getMonth());
  if (cle === 'semaine') return { debut: lundi(jour), fin: jour };
  if (cle === 'mois') return { debut: debutDuMois, fin: jour };
  if (cle === 'moisPrecedent') {
    const finPrecedent = ajouterJours(debutDuMois, -1), p = depuisIso(finPrecedent);
    return { debut: debutMois(p.getFullYear(), p.getMonth()), fin: finPrecedent };
  }
  return { debut: jour, fin: jour };
}

export type StatutExport = 'Renseigné' | 'Absent(e)' | 'Sans compte' | 'Manquant';

export interface LigneExport {
  jour: Iso;
  projet: Projet;
  personne: string;
  statut: StatutExport;
  absence: string;
  champs: ChampsDaily;
  blocages: string[];
}

/* Lignes du fichier, du jour le plus récent au plus ancien, puis par projet et par nom. Pour chaque jour ouvré (hors week-ends et fériés) et
   chaque projet : les membres attendus au daily ce jour-là (mêmes règles qu'à l'écran : affectés hors Lecteur, présents) avec un statut :
   Renseigné, Absent(e) (Congés), Sans compte (fiche non reliée) ou Manquant. « notes » = notes_daily_projet de la période. */
export function lignesExport(d: DonneesVues & { absences: readonly Absence[] }, debut: Iso, fin: Iso, projets: readonly Projet[],
  notes: readonly NoteDaily[], avecManquants: boolean, feries: ReadonlySet<Iso>): LigneExport[] {
  const lignes: LigneExport[] = [];
  const jours = joursOuvresEntre(debut, fin, feries).reverse();
  jours.forEach(jour => projets.forEach(projet => membresDuDaily(d, projet.id, jour).forEach(r => {
    const note = notes.find(n => n.userId === auteurDaily(r) && n.projetId === projet.id && n.jour === jour);
    const absence = absenceDe(d.absences, r.id, jour);
    const remplie = !!note && !!note.texte.trim();
    if (!remplie && !avecManquants) return;
    const statut: StatutExport = remplie ? 'Renseigné' : absence ? 'Absent(e)' : r.userId ? 'Manquant' : 'Sans compte';
    lignes.push({ jour, projet, personne: r.nom, statut, absence: absence?.type ?? '', champs: decouperDaily(remplie ? note.texte : ''),
      blocages: remplie ? blocagesDaily(note.texte) : [] });
  })));
  return lignes;
}

const STYLE_STATUT: Record<StatutExport, 'vert' | 'gris' | 'orange'> = { 'Renseigné': 'vert', 'Absent(e)': 'gris', 'Sans compte': 'gris', 'Manquant': 'orange' };
const date = (jour: Iso): string => jour.split('-').reverse().join('/');

/** Onglets du classeur : « Daily » (une ligne par membre, projet et jour) et, en option, « Blocages » */
export function feuillesExport(lignes: readonly LigneExport[], avecBlocages: boolean): FeuilleExcel[] {
  // Trois premières colonnes communes aux deux onglets : quand, sur quel projet, qui
  const communes = [{ titre: 'Date', largeur: 12 }, { titre: 'Projet', largeur: 28 }, { titre: 'Personne', largeur: 22 }];
  const daily: FeuilleExcel = {
    nom: 'Daily',
    colonnes: [...communes, { titre: 'Statut', largeur: 13 }, { titre: 'Hier', largeur: 45 }, { titre: 'Aujourd’hui', largeur: 45 },
      { titre: 'Blocages', largeur: 40 }, { titre: 'Absence', largeur: 18 }],
    lignes: lignes.map((l): Cellule[] => [date(l.jour), l.projet.nom, l.personne, { texte: l.statut, style: STYLE_STATUT[l.statut] }, l.champs.hier,
      l.champs.aujourdhui, { texte: l.blocages.join('\n'), style: 'rouge' }, l.absence])
  };
  if (!avecBlocages) return [daily];
  const blocages: FeuilleExcel = {
    nom: 'Blocages',
    colonnes: [...communes, { titre: 'Blocage', largeur: 70 }],
    lignes: lignes.flatMap(l => l.blocages.map((b): Cellule[] => [date(l.jour), l.projet.nom, l.personne, { texte: b, style: 'rouge' }]))
  };
  return [daily, blocages];
}
