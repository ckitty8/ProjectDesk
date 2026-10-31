import { describe, expect, it } from 'vitest';
import { AFFECTATIONS, EQUIPES, PROJETS, RESSOURCES, contexte } from './__fixtures__/donnees';
import { CONFIG } from './config';
import { absentToutLeJour, actionAbsence, anneeSprint, COMPTEURS_MEP, erreurModificationSprint, historiqueJours, lireChampSprint, lireHeures, mesProjetsDaily,
  nombreEntier, numeroSprintSuivant, numeroTechniqueSuivant, objectifJoursTravail, objectifValide, sprintDejaPris } from './saisies';

const d = { equipes: EQUIPES, ressources: RESSOURCES, projets: PROJETS, affectations: AFFECTATIONS };

describe('daily', () => {
  it('mes projets : affecté hors Lecteur, projet en cours, triés par code', () => {
    const ctx = contexte({ userId: 'u-lena' });                         // Léna : chef de « Vie de Ville », membre de « Chatbot »
    expect(mesProjetsDaily(ctx, d).map(p => p.code)).toEqual(['IA-01', 'IA-02']);
    const lecteur = { ...d, affectations: [{ projetId: 'p-ia1', ressourceId: 'r-lena', role: 'Lecteur' }] };
    expect(mesProjetsDaily(ctx, lecteur)).toEqual([]);
    const fini = { ...d, projets: PROJETS.map(p => (p.id === 'p-ia1' ? { ...p, statut: 'Terminé' } : p)) };
    expect(mesProjetsDaily(ctx, fini).map(p => p.code)).toEqual(['IA-02']);
  });
  it('sans fiche liée au compte, aucun projet', () => {
    expect(mesProjetsDaily(contexte({ userId: 'inconnu' }), d)).toEqual([]);
  });
  it('historique : 12 jours ouvrés, en partant du vendredi le week-end', () => {
    const h = historiqueJours('2026-11-07');                             // samedi
    expect(h).toHaveLength(12);
    expect(h[0]).toBe('2026-11-06');
    expect(h.every(j => ![0, 6].includes(new Date(j).getUTCDay()))).toBe(true);
    expect(historiqueJours('2026-11-04')[1]).toBe('2026-11-03');
  });
  it('une journée d\'absence ferme le daily, pas une demi-journée', () => {
    expect(absentToutLeJour({ duree: 1 })).toBe(true);
    expect(absentToutLeJour({ duree: null })).toBe(true);
    expect(absentToutLeJour({ duree: 0.5 })).toBe(false);
    expect(absentToutLeJour(null)).toBe(false);
  });
});

describe('saisie des heures', () => {
  it('accepte la virgule, supprime le vide et le zéro, refuse hors 0-24', () => {
    expect(lireHeures('7,5')).toEqual({ action: 'enregistrer', heures: 7.5 });
    expect(lireHeures('')).toEqual({ action: 'supprimer' });
    expect(lireHeures(' 0 ')).toEqual({ action: 'supprimer' });
    expect(lireHeures('25')).toEqual({ action: 'invalide' });
    expect(lireHeures('-1')).toEqual({ action: 'invalide' });
    expect(lireHeures('abc')).toEqual({ action: 'invalide' });
  });
});

describe('congés', () => {
  const cp = { ressourceId: 'r', jour: '2026-11-03', type: 'Congés payés', duree: 1 };
  it('pose, retire ou change la durée selon le pinceau', () => {
    expect(actionAbsence(null, 'Congés payés', 1)).toBe('poser');
    expect(actionAbsence(cp, 'Congés payés', 1)).toBe('supprimer');
    expect(actionAbsence(cp, 'Congés payés', 0.5)).toBe('poser');
    expect(actionAbsence(cp, 'Autre type', 1)).toBe('poser');
    expect(actionAbsence(cp, 'effacer', 1)).toBe('supprimer');
    expect(actionAbsence(null, 'effacer', 1)).toBe('rien');
  });
  it('objectif client : valeur saisie, sinon valeur par défaut ; 1 à 366', () => {
    const objectifs = [{ equipeId: 'app', annee: 2026, jours: '210' }];
    expect(objectifJoursTravail(objectifs, 'app', 2026)).toBe(210);
    expect(objectifJoursTravail(objectifs, 'app', 2027)).toBe(CONFIG.JOURS_TRAVAIL_CLIENT_DEFAUT);
    expect([0, 1, 366, 367].map(objectifValide)).toEqual([false, true, true, false]);
  });
});

describe('sprints', () => {
  const sprints = [{ projetId: 'p', numero: 1, numeroSprint: 19, annee: 2026, debut: '2026-09-14', fin: '2026-09-25' },
    { projetId: 'p', numero: 2, numeroSprint: 20, debut: '2027-01-04', fin: '2027-01-15' }];
  it('l\'année vient de la saisie, sinon de la date de début', () => {
    expect(anneeSprint(sprints[0] ?? {})).toBe(2026);
    expect(anneeSprint(sprints[1] ?? {})).toBe(2027);
  });
  it('un « Sprint N » n\'existe qu\'une fois par année et par projet', () => {
    expect(sprintDejaPris(sprints, 'p', 2026, 19)).toBe(true);
    expect(sprintDejaPris(sprints, 'p', 2026, 19, 1)).toBe(false);
    expect(sprintDejaPris(sprints, 'p', 2027, 19)).toBe(false);
    expect(sprintDejaPris(sprints, 'autre', 2026, 19)).toBe(false);
  });
  it('numérote : clé technique après toutes les saisies existantes, « Sprint N » suivant', () => {
    expect(numeroTechniqueSuivant(sprints, [{ projetId: 'p', numero: 5 }], 'p')).toBe(6);
    expect(numeroTechniqueSuivant([], [], 'p')).toBe(1);
    expect(numeroSprintSuivant(sprints)).toBe(21);
  });
  it('lit les champs du formulaire', () => {
    expect(lireChampSprint('annee', ' 2026 ')).toBe(2026);
    expect(lireChampSprint('nom', ' V3 ')).toBe('V3');
    expect(lireChampSprint('nom', '  ')).toBeNull();
  });
  it('contrôle une modification : dates, ordre, unicité', () => {
    const s = sprints[0]!;
    expect(erreurModificationSprint(sprints, s, 'debut', null)).toContain('obligatoires');
    expect(erreurModificationSprint(sprints, s, 'fin', '2026-09-01')).toContain('précède');
    expect(erreurModificationSprint(sprints, sprints[0]!, 'numeroSprint', 20)).toBeNull();      // 20 existe en 2027, pas en 2026
    expect(erreurModificationSprint([...sprints, { projetId: 'p', numero: 3, numeroSprint: 21, annee: 2026, debut: '2026-10-01', fin: '2026-10-09' }], s, 'numeroSprint', 21))
      .toContain('existe déjà en 2026');
    expect(erreurModificationSprint(sprints, s, 'nom', 'V2')).toBeNull();
  });
});

describe('mises en production', () => {
  it('compteurs de tickets dans l\'ordre Bug, Incident, US', () => {
    expect(COMPTEURS_MEP.map(c => c.champ)).toEqual(['nbBugs', 'nbIncidents', 'nbUs']);
  });
  it('entier positif ou nul, sinon 0', () => {
    expect([nombreEntier('3'), nombreEntier('3,7'), nombreEntier('-2'), nombreEntier(''), nombreEntier('abc'), nombreEntier(4.9)]).toEqual([3, 0, 0, 0, 0, 4]);
  });
});
