import { describe, expect, it } from 'vitest';
import { EQUIPES, PROJETS, AFFECTATIONS, RESSOURCES, contexte } from './__fixtures__/donnees';
import { decalerMois, statutFeuille, suiviFeuilles } from './feuilles';

type Feuille = { ressourceId: string; semaine: string; statut: string };
type Temps = { ressourceId: string; projetId: string; jour: string; heures: number };
const donnees = (feuilles: Feuille[], temps: Temps[] = []) =>
  ({ equipes: EQUIPES, ressources: RESSOURCES, projets: PROJETS, affectations: AFFECTATIONS, absences: [], temps, feuilles });

describe('feuilles de temps', () => {
  it('une personne sans ligne est « en saisie »', () => {
    expect(statutFeuille([], 'r1', '2026-11-01')).toBe('en_saisie');
    expect(statutFeuille([{ ressourceId: 'r1', semaine: '2026-11-01', statut: 'soumise' }], 'r1', '2026-11-01')).toBe('soumise');
  });

  it('totalise heures saisies et attendues, et compte les feuilles à compléter', () => {
    const d = donnees([], [{ ressourceId: 'r-thomas', projetId: 'p-app2', jour: '2026-11-03', heures: 7.5 }]);
    const s = suiviFeuilles(contexte(), d, EQUIPES, 2026, 10, new Set());
    expect(s.saisi).toBe(7.5);
    expect(s.attendu).toBeGreaterThan(7.5);
    expect(s.aCompleter).toBe(RESSOURCES.length);
    expect(s.groupes.length).toBeGreaterThan(0);
  });

  it('une feuille validée n\'est plus « à compléter »', () => {
    const d = donnees(RESSOURCES.map(r => ({ ressourceId: r.id, semaine: '2026-11-01', statut: 'validee' })));
    expect(suiviFeuilles(contexte(), d, EQUIPES, 2026, 10, new Set()).aCompleter).toBe(0);
  });

  it('seul un responsable peut valider une feuille soumise de son équipe', () => {
    const d = donnees([{ ressourceId: 'r-thomas', semaine: '2026-11-01', statut: 'soumise' }]);
    expect(suiviFeuilles(contexte(), d, EQUIPES, 2026, 10, new Set()).aValider).toBe(0);
    const s = suiviFeuilles(contexte({ estCreateur: true, estAdmin: true }), d, EQUIPES, 2026, 10, new Set());
    expect(s.aValider).toBe(1);
    expect(s.groupes.flatMap(g => g.lignes).find(l => l.ressource.id === 'r-thomas')?.validable).toBe(true);
  });

  it('passe d\'une année à l\'autre', () => {
    expect(decalerMois(2026, 11, 1)).toEqual({ annee: 2027, mois: 0 });
    expect(decalerMois(2026, 0, -1)).toEqual({ annee: 2025, mois: 11 });
  });
});
