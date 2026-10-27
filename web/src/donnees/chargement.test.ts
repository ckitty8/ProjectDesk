import { describe, expect, it } from 'vitest';
import { fusionnerLectures } from './chargement';
import type { LectureTable } from './chargement';
import { CLES_TABLES } from './tables';
import type { CleTable, Donnees } from './tables';

/** Lectures où chaque table renvoie les lignes données (vide par défaut) */
const lectures = (lignes: Partial<Record<CleTable, Record<string, unknown>[]>>, echecs: CleTable[] = []): LectureTable[] =>
  CLES_TABLES.map((cle): LectureTable => echecs.includes(cle) ? { cle, erreur: new Error('boum ' + cle) } : { cle, lignes: lignes[cle] ?? [] });

const precedent = (): Donnees => {
  const d = {} as Record<CleTable, unknown[]>;
  CLES_TABLES.forEach(cle => { d[cle] = []; });
  d.equipes = [{ id: 'e0', nom: 'Ancienne', parentId: null }];
  d.absences = [{ ressourceId: 'r', jour: '2026-10-01' }];
  return d as unknown as Donnees;
};

describe('chargement tolérant des tables', () => {
  it('applique toutes les tables lues', () => {
    const { donnees, echecs } = fusionnerLectures(lectures({ equipes: [{ id: 'e1' }] }));
    expect(donnees.equipes).toEqual([{ id: 'e1' }]);
    expect(donnees.absences).toEqual([]);
    expect(echecs).toEqual([]);
  });

  it('une table en échec garde ses données précédentes et est signalée', () => {
    const { donnees, echecs } = fusionnerLectures(lectures({ equipes: [{ id: 'e1' }] }, ['absences']), precedent());
    expect(donnees.equipes).toEqual([{ id: 'e1' }]);
    expect(donnees.absences).toHaveLength(1);
    expect(echecs).toEqual(['absences']);
  });

  it('au premier chargement, une table en échec est une liste vide', () => {
    const { donnees } = fusionnerLectures(lectures({ equipes: [{ id: 'e1' }] }, ['absences']));
    expect(donnees.absences).toEqual([]);
  });

  it('une lecture entièrement vide alors que des équipes étaient chargées ne vide pas l\'écran', () => {
    const avant = precedent();
    expect(fusionnerLectures(lectures({}), avant).donnees).toBe(avant);
  });

  it('lève l\'erreur si aucune table n\'est lisible (réseau ou session perdus)', () => {
    expect(() => fusionnerLectures(lectures({}, [...CLES_TABLES]))).toThrow('boum equipes');
  });
});
