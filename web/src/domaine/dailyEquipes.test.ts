import { describe, expect, it } from 'vitest';
import { ABSENCES, AFFECTATIONS, EQUIPES, PROJETS, RESSOURCES } from './__fixtures__/donnees';
import { composerDaily } from './daily';
import { blocagesOuverts, entreesDaily, etatCase, jourDuResume, joursSemaine, personnesDaily, syntheseSemaine } from './dailyEquipes';

// Projet « Vie de Ville » : Cerine (membre) et Léna (chef). Semaine du lundi 2 novembre 2026, nous sommes le mercredi 4.
const projet = PROJETS.find(p => p.id === 'p-ia2') ?? PROJETS[0]!;
const AUJOURDHUI = '2026-11-04';
const note = (userId: string, jour: string, champs: { hier?: string; aujourdhui?: string; blocages?: string }, modifieLe = '') =>
  ({ userId, projetId: projet.id, jour, texte: composerDaily(champs), modifieLe });
const notes = [
  note('u-cerine', '2026-11-02', { aujourdhui: 'Recette', blocages: 'Accès recette' }),
  note('u-lena', '2026-11-02', { aujourdhui: 'Revue' }, '2026-11-02T09:00:00Z'),
  note('u-cerine', '2026-11-03', { aujourdhui: 'Suite', blocages: 'Accès recette' }),
  note('u-lena', '2026-11-03', { aujourdhui: '  ' })
];
const d = { equipes: EQUIPES, ressources: RESSOURCES, projets: PROJETS, affectations: AFFECTATIONS, notesProjet: notes, absences: ABSENCES };
const jours = joursSemaine('2026-11-04', new Set());
const lena = RESSOURCES.find(r => r.id === 'r-lena') ?? RESSOURCES[0]!;
const cerine = RESSOURCES.find(r => r.id === 'r-cerine') ?? RESSOURCES[0]!;

describe('semaine du daily', () => {
  it('va du lundi au vendredi, sans les jours fériés', () => {
    expect(jours).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']);
    expect(joursSemaine('2026-11-04', new Set(['2026-11-03']))).not.toContain('2026-11-03');
  });
  it('liste les personnes du projet par nom', () => {
    expect(personnesDaily(d, [projet], jours).map(r => r.nom)).toEqual(['Cerine', 'Léna']);
  });
  it('résume sur aujourd\'hui s\'il est dans la semaine, sinon sur le dernier jour', () => {
    expect(jourDuResume(jours, AUJOURDHUI)).toBe(AUJOURDHUI);
    expect(jourDuResume(jours, '2026-12-01')).toBe('2026-11-06');
  });
});

describe('fil des dailys', () => {
  it('trie du plus récent au plus ancien et ignore les notes vides', () => {
    const e = entreesDaily(d, [projet], jours);
    expect(e.map(x => `${x.jour} ${x.ressource.nom}`)).toEqual(['2026-11-03 Cerine', '2026-11-02 Léna', '2026-11-02 Cerine']);
  });
  it('filtre sur une personne', () => {
    expect(entreesDaily(d, [projet], jours, 'r-lena')).toHaveLength(1);
  });
});

describe('synthèse de la semaine', () => {
  it('donne l\'état de chaque case', () => {
    const etat = (r: typeof lena, j: string) => etatCase(d, r, [projet], j, AUJOURDHUI);
    expect(etat(cerine, '2026-11-02')).toBe('bloc');
    expect(etat(lena, '2026-11-02')).toBe('ok');
    expect(etat(lena, '2026-11-03')).toBe('abs');          // note vide mais absente (demi-journée posée)
    expect(etat(cerine, '2026-11-04')).toBe('manque');
    expect(etat(lena, '2026-11-05')).toBe('avenir');
  });
  it('calcule les chiffres clés', () => {
    const s = syntheseSemaine(d, [projet], jours, AUJOURDHUI);
    expect(s.compte).toMatchObject({ bloc: 2, ok: 1, abs: 1, manque: 2 });
    expect(s.renseignes).toBe(3);
    expect(s.attendus).toBe(5);
    expect(s.taux).toBe(60);
  });
});

describe('blocages ouverts', () => {
  it('reprend le blocage du dernier daily et son ancienneté depuis le premier jour où il apparaît', () => {
    const b = blocagesOuverts(d, [projet], jours, AUJOURDHUI);
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ texte: 'Accès recette', age: 2 });
    expect(b[0]?.ressource.nom).toBe('Cerine');
  });
});
