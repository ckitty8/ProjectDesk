/* ============================================================
   Suivi des feuilles de temps (Suivi de mes équipes › Timesheet)
   (portage de tableauFeuilles et MoisTemps de app/js/ecrans/timesheet.js — phase 5, vague B)
   ------------------------------------------------------------
   Par personne et par mois : heures saisies / attendues, complétude, statut de la feuille, et si JE peux la valider (responsable de
   l'équipe avec le droit de la matrice). La saisie et la validation sont MENSUELLES (porteur, 2026-10-05) : une feuille par personne
   et par mois, clé = 1er jour du mois. Fonctions pures, calculs dans calculs.ts.
   ============================================================ */

import { debutMois, heuresAttenduesMois, heuresMois } from './calculs';
import { joursDuMois } from './dates';
import { peutValiderEquipe } from './droits';
import type { ContexteDroits } from './droits';
import type { Equipe, FeuilleTemps, Iso, Projet, Ressource, TempsSaisi, Absence } from './types';
import { projetsDe, ressourcesPresentes } from './vues';
import type { DonneesVues } from './vues';

export type StatutFeuilleTemps = 'en_saisie' | 'soumise' | 'validee' | 'a_completer';

/** Statut de la feuille d'une personne pour un mois (« en_saisie » si aucune ligne) */
export function statutFeuille(feuilles: readonly FeuilleTemps[], ressourceId: string, cle: Iso): string {
  return feuilles.find(f => f.ressourceId === ressourceId && f.semaine === cle)?.statut ?? 'en_saisie';
}

export interface LigneFeuille {
  ressource: Ressource;
  projets: Projet[];
  saisi: number;
  attendu: number;
  /** Heures saisies ÷ attendues, en % (0 si rien n'est attendu) */
  completude: number;
  statut: string;
  /** Feuille soumise d'une équipe dont je suis responsable : je peux la valider ou la renvoyer */
  validable: boolean;
}

export interface GroupeFeuilles { equipe: Equipe; lignes: LigneFeuille[] }

export interface SuiviFeuilles {
  groupes: GroupeFeuilles[];
  saisi: number;
  attendu: number;
  aCompleter: number;
  aValider: number;
}

export function suiviFeuilles(ctx: ContexteDroits, d: DonneesVues & { temps: readonly TempsSaisi[]; absences: readonly Absence[];
  feuilles: readonly FeuilleTemps[] }, equipes: readonly Equipe[], annee: number, mois: number, feries: ReadonlySet<Iso>): SuiviFeuilles {
  const cle = debutMois(annee, mois);
  const jours = joursDuMois(annee, mois);
  const resultat: SuiviFeuilles = { groupes: [], saisi: 0, attendu: 0, aCompleter: 0, aValider: 0 };
  equipes.forEach(equipe => {
    // Par équipe : les personnes présentes au moins un jour du mois (arrivée / date de fin)
    const personnes = ressourcesPresentes(d, jours[0] ?? cle, jours[jours.length - 1] ?? cle).filter(r => r.equipeId === equipe.id);
    if (!personnes.length) return;
    const lignes = personnes.map((ressource): LigneFeuille => {
      const saisi = heuresMois(ressource.id, annee, mois, d.temps).total;
      const attendu = heuresAttenduesMois(ressource, annee, mois, d.absences, feries);
      const statut = statutFeuille(d.feuilles, ressource.id, cle);
      const validable = statut === 'soumise' && peutValiderEquipe(ctx, equipe.id);
      resultat.saisi += saisi;
      resultat.attendu += attendu;
      if (statut !== 'validee' && saisi < attendu) resultat.aCompleter++;
      if (validable) resultat.aValider++;
      return { ressource, projets: projetsDe(d, ressource.id), saisi, attendu, completude: attendu ? saisi / attendu * 100 : 0, statut, validable };
    });
    resultat.groupes.push({ equipe, lignes });
  });
  return resultat;
}

/** Mois suivant ou précédent (sens −1 ou +1), passage d'année compris */
export function decalerMois(annee: number, mois: number, sens: number): { annee: number; mois: number } {
  const d = new Date(annee, mois + sens, 1);
  return { annee: d.getFullYear(), mois: d.getMonth() };
}
