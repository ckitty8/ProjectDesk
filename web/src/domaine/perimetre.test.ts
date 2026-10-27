import { describe, expect, it } from 'vitest';
import { DONNEES, contexte } from './__fixtures__/donnees';
import { appliquerPerimetre } from './perimetre';

const ids = <T extends { id: string }>(lignes: readonly T[]) => lignes.map(l => l.id).sort();

describe('périmètre de lecture en simulation (migration 042)', () => {
  it('ne filtre rien hors simulation : c’est la base qui filtre', () => {
    expect(appliquerPerimetre(contexte(), DONNEES)).toBe(DONNEES);
  });

  it('Thomas en rôle Projet ne voit que VISTA et les personnes de ce projet, pas CDO de sa propre équipe', () => {
    const v = appliquerPerimetre(contexte({ simulation: { cle: 'projet', ressourceId: 'r-thomas' } }), DONNEES);
    expect(ids(v.projets)).toEqual(['p-app2']);
    expect(ids(v.ressources)).toEqual(['r-thomas']);
    expect(v.sprintsProjet.map(s => s.projetId)).toEqual(['p-app2']);
    expect(v.misesEnProduction.map(m => m.projetId)).toEqual(['p-app2']);
    expect(v.envoisDaily).toEqual([]);
    expect(v.absences.map(a => a.ressourceId)).toEqual(['r-thomas']);
    expect(v.temps.map(t => t.ressourceId)).toEqual(['r-thomas']);
    expect(v.objectifsTravail.map(o => o.equipeId)).toEqual(['app']);
  });

  it('un collègue de projet est visible (fiche et absences) mais pas ses heures', () => {
    const v = appliquerPerimetre(contexte({ simulation: { cle: 'projet', ressourceId: 'r-cerine' } }), DONNEES);
    expect(ids(v.projets)).toEqual(['p-ia2']);
    expect(ids(v.ressources)).toEqual(['r-cerine', 'r-lena']);
    expect(v.absences.map(a => a.ressourceId)).toEqual(['r-lena']);
    expect(v.temps).toEqual([]);
    expect(v.feuilles).toEqual([]);
  });

  it('un responsable ne voit que son équipe, plus les projets où il est affecté', () => {
    const v = appliquerPerimetre(contexte({ simulation: { cle: 'responsable', ressourceId: 'r-cerine' } }), DONNEES);
    expect(ids(v.projets)).toEqual(['p-app1', 'p-app2', 'p-ia2']);
    expect(v.projets.some(p => p.equipeId === 'amoa')).toBe(false);
    expect(ids(v.ressources)).toEqual(['r-anne', 'r-cerine', 'r-christelle', 'r-lena', 'r-thomas']);
    expect(v.temps.map(t => t.ressourceId)).toEqual(['r-thomas']);
  });

  it('une direction voit ses équipes (Applications et IA) mais pas AMOA', () => {
    const v = appliquerPerimetre(contexte({ simulation: { cle: 'direction', ressourceId: 'r-thomas' } }), DONNEES);
    expect(ids(v.projets)).toEqual(['p-app1', 'p-app2', 'p-ia1', 'p-ia2']);
    expect(ids(v.ressources)).not.toContain('r-marc');
    expect(v.temps).toHaveLength(2);
  });

  it('l’administrateur simulé voit tout', () => {
    const v = appliquerPerimetre(contexte({ estAdmin: true, simulation: { cle: 'admin', ressourceId: 'r-thomas' } }), DONNEES);
    expect(v.projets).toHaveLength(5);
    expect(v.ressources).toHaveLength(6);
  });

  it('une personne rattachée à une unité gérée est visible de son responsable (fiche et absences), sans ses heures', () => {
    const rattache = { ...DONNEES, rattachements: [{ equipeId: 'app', ressourceId: 'r-marc' }] };
    const v = appliquerPerimetre(contexte({ simulation: { cle: 'responsable', ressourceId: 'r-thomas' } }), rattache);
    expect(ids(v.ressources)).toContain('r-marc');
    expect(v.absences.some(a => a.ressourceId === 'r-marc')).toBe(true);
    expect(v.temps.some(t => t.ressourceId === 'r-marc')).toBe(false);
  });

  it('un compte sans fiche ne voit rien', () => {
    const v = appliquerPerimetre(contexte({ simulation: { cle: 'utilisateur', ressourceId: null } }), DONNEES);
    expect(v.projets).toEqual([]);
    expect(v.ressources).toEqual([]);
  });
});
