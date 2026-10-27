/* ============================================================
   Parité avec l'application actuelle (temporaire, jusqu'à la bascule — phase 6 du plan de migration)
   ------------------------------------------------------------
   Charge app/js/calculs.js tel quel et compare ses résultats à ceux du portage TypeScript sur de nombreux cas : tant que les deux
   coexistent, ils doivent donner exactement les mêmes chiffres. Ce fichier est supprimé avec l'ancienne application.
   ============================================================ */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import * as calculs from './calculs';
import { CONFIG, STATUTS_PROJET } from './config';
import * as daily from './daily';
import * as dates from './dates';
import type { Absence, Ressource } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any -- les fonctions de l'ancienne application ne sont pas typées */
function chargerAncien(): Record<string, any> {
  const source = readFileSync(resolve(__dirname, '../../../app/js/calculs.js'), 'utf8').replace("'use strict';", '').replace('const Calculs =', 'Calculs =');
  const bac: Record<string, any> = { CONFIG, STATUTS_PROJET };
  vm.runInNewContext(source, bac);
  return bac.Calculs;
}
const ancien = chargerAncien();

const FERIES = new Set(['2026-01-01', '2026-04-06', '2026-05-01', '2026-05-08', '2026-07-14', '2026-11-11', '2026-12-25']);
const ABSENCES: Absence[] = [
  { ressourceId: 'a', jour: '2026-03-02', duree: 1 }, { ressourceId: 'a', jour: '2026-03-03', duree: 0.5 }, { ressourceId: 'a', jour: '2026-07-15' },
  { ressourceId: 'a', jour: '2026-11-13', duree: 0.5 }, { ressourceId: 'b', jour: '2026-11-13', duree: 1 }, { ressourceId: 'b', jour: '2026-12-24', duree: 1 }
];
const PERSONNES: Ressource[] = [
  { id: 'a', nom: 'Anne Caselli', equipeId: 'e' },
  { id: 'b', nom: 'Bernard', equipeId: 'e', capacite: 60, dateArrivee: '2026-04-01' },
  { id: 'c', nom: 'Claire', equipeId: 'e', capacite: 80, dateDepart: '2026-09-30' },
  { id: 'd', nom: 'Dan', equipeId: 'e', dateArrivee: '2026-02-16', dateDepart: '2026-11-20' }
];
const JOURS_ECHANTILLON = ['2025-12-31', '2026-01-01', '2026-02-28', '2026-03-29', '2026-09-13', '2026-09-14', '2026-10-25', '2026-10-26', '2027-01-03'];

describe('parité des dates et des formats avec calculs.js', () => {
  it('donne les mêmes dates, formats et semaines', () => {
    JOURS_ECHANTILLON.forEach(j => {
      expect(dates.lundi(j)).toBe(ancien.lundi(j));
      expect(dates.estWeekend(j)).toBe(ancien.estWeekend(j));
      expect(dates.ajouterJours(j, 45)).toBe(ancien.ajouterJours(j, 45));
      expect(dates.formatCourt(j)).toBe(ancien.formatCourt(j));
      expect(dates.formatAvecAnnee(j)).toBe(ancien.formatAvecAnnee(j));
      expect(dates.formatLong(j)).toBe(ancien.formatLong(j));
      expect(calculs.sprintDe(j)).toEqual(ancien.sprintDe(j));
    });
    for (let mois = 0; mois < 12; mois++) {
      expect(dates.joursDuMois(2026, mois)).toEqual(ancien.joursDuMois(2026, mois));
      expect(dates.libelleMois(2026, mois)).toBe(ancien.libelleMois(2026, mois));
      expect(calculs.debutMois(2026, mois)).toBe(ancien.debutMois(2026, mois));
    }
    [0, 1.25, 7.5, 12.04, 99.95, 1234.5678].forEach(n => {
      expect(dates.nombre(n)).toBe(ancien.nombre(n));
      expect(dates.pourcent(n)).toBe(ancien.pourcent(n));
    });
    expect(dates.joursOuvresEntre('2026-11-01', '2026-12-31', FERIES)).toEqual(ancien.joursOuvresEntre('2026-11-01', '2026-12-31', FERIES));
  });
});

describe('parité des calculs de congés, de capacité et de temps avec calculs.js', () => {
  it('donne les mêmes jours travaillés, récaps annuels et présences', () => {
    PERSONNES.forEach(p => {
      for (let mois = 0; mois < 12; mois++) {
        expect(calculs.joursTravaillesMois(p.id, 2026, mois, ABSENCES, FERIES, p)).toEqual(ancien.joursTravaillesMois(p.id, 2026, mois, ABSENCES, FERIES, p));
      }
      expect(calculs.recapJoursTravailles(p.id, 2026, ABSENCES, FERIES, 218, p)).toEqual(ancien.recapJoursTravailles(p.id, 2026, ABSENCES, FERIES, 218, p));
      JOURS_ECHANTILLON.forEach(j => expect(calculs.estPresent(p, j)).toBe(ancien.estPresent(p, j)));
      expect(calculs.estPresentSur(p, '2026-10-01', '2026-10-31')).toBe(ancien.estPresentSur(p, '2026-10-01', '2026-10-31'));
      expect(calculs.libellePresence(p, '2026-10-26')).toBe(ancien.libellePresence(p, '2026-10-26'));
    });
  });

  it('donne les mêmes capacités, heures attendues et taux d’occupation', () => {
    expect(calculs.capacitePeriode(PERSONNES, '2026-09-14', '2026-09-25', ABSENCES, FERIES)).toEqual(ancien.capacitePeriode(PERSONNES, '2026-09-14', '2026-09-25', ABSENCES, FERIES));
    expect(calculs.capacitePeriode(PERSONNES, '2026-11-02', '2026-12-31', ABSENCES, FERIES)).toEqual(ancien.capacitePeriode(PERSONNES, '2026-11-02', '2026-12-31', ABSENCES, FERIES));
    expect(calculs.capaciteScrum(PERSONNES, 17.5)).toEqual(ancien.capaciteScrum(PERSONNES, 17.5));
    const temps = [{ ressourceId: 'a', projetId: 'p', jour: '2026-11-02', heures: 7.5 }, { ressourceId: 'b', projetId: 'p', jour: '2026-11-03', heures: '4' }];
    PERSONNES.forEach(p => {
      expect(calculs.heuresAttendues(p, '2026-11-09', ABSENCES, FERIES)).toBe(ancien.heuresAttendues(p, '2026-11-09', ABSENCES, FERIES));
      for (let mois = 0; mois < 12; mois++) {
        expect(calculs.heuresAttenduesMois(p, 2026, mois, ABSENCES, FERIES)).toBe(ancien.heuresAttenduesMois(p, 2026, mois, ABSENCES, FERIES));
        expect(calculs.heuresMois(p.id, 2026, mois, temps)).toEqual(ancien.heuresMois(p.id, 2026, mois, temps));
      }
    });
    expect(calculs.tauxOccupation(PERSONNES, '2026-11-02', temps, ABSENCES, FERIES)).toBe(ancien.tauxOccupation(PERSONNES, '2026-11-02', temps, ABSENCES, FERIES));
    expect(calculs.absentsDuJour(['a', 'b'], '2026-11-13', ABSENCES)).toEqual(ancien.absentsDuJour(['a', 'b'], '2026-11-13', ABSENCES));
  });

  it('donne les mêmes résultats sur les projets, anniversaires et codes', () => {
    const projets = [{ id: '1', code: 'APP-01', nom: 'A', equipeId: 'e', statut: 'À risque', avancement: 30, fin: '2026-12-01' },
      { id: '2', code: 'APP-09', nom: 'B', equipeId: 'e', statut: 'En cours', avancement: 80, fin: '2026-11-10' },
      { id: '3', code: 'IA-02', nom: 'C', equipeId: 'e', statut: 'Terminé', avancement: 100, fin: '2026-10-30' }];
    expect(calculs.projetsASurveiller(projets, '2026-10-26')).toEqual(ancien.projetsASurveiller(projets, '2026-10-26'));
    expect(calculs.projetsActifs(projets)).toEqual(ancien.projetsActifs(projets));
    expect(calculs.avancementMoyen(projets)).toBe(ancien.avancementMoyen(projets));
    expect(calculs.prochainCodeProjet('APP', projets)).toBe(ancien.prochainCodeProjet('APP', projets));
    const nes = PERSONNES.map((p, i) => ({ ...p, dateNaissance: ['1988-06-04', '1991-10-28', '1994-10-14', '1990-05-03'][i] }));
    for (let mois = 0; mois < 12; mois++) expect(calculs.anniversairesDuMois(nes, mois)).toEqual(ancien.anniversairesDuMois(nes, mois));
    expect(calculs.initiales('Anne Caselli')).toBe(ancien.initiales('Anne Caselli'));
  });
});

describe('parité des notes de daily avec calculs.js', () => {
  const NOTES = ['', 'Hier\n- a\n- b\n\nAujourd’hui\n- c\n\nBlocages\n- Aucun\n- Serveur HS', '- ancienne note\n- deux', 'Blocage:\n- x\nAutre\n- y',
    'hier :\n- 1\naujourdhui\n2\nBlocages\nRAS'];
  it('découpe et recompose comme l’ancienne application', () => {
    NOTES.forEach(n => {
      expect(daily.rubriquesDaily(n)).toEqual(ancien.rubriquesDaily(n));
      expect(daily.blocagesDaily(n)).toEqual(ancien.blocagesDaily(n));
      expect(daily.decouperDaily(n)).toEqual(ancien.decouperDaily(n));
      expect(daily.composerDaily(daily.decouperDaily(n))).toBe(ancien.composerDaily(ancien.decouperDaily(n)));
    });
  });
});
