import { describe, expect, it } from 'vitest';
import { DONNEES, EQUIPES, contexte } from './__fixtures__/donnees';
import { equipesGerees } from './droits';
import { appliquerPerimetre, restreindreEquipe, restreindreMesProjets } from './perimetre';

const ids = <T extends { id: string }>(lignes: readonly T[]) => lignes.map(l => l.id).sort();

describe('périmètre de lecture en simulation (migrations 042 et 050)', () => {
  it('ne filtre rien hors simulation : c’est la base qui filtre', () => {
    expect(appliquerPerimetre(contexte(), DONNEES)).toBe(DONNEES);
  });

  it('Thomas en rôle Projet voit tous les projets, sprints et MEP (migration 050) mais seulement les personnes et daily de son projet', () => {
    const v = appliquerPerimetre(contexte({ simulation: { cle: 'chef', ressourceId: 'r-thomas' } }), DONNEES);
    expect(ids(v.projets)).toEqual(ids(DONNEES.projets));
    expect(v.sprintsProjet).toEqual(DONNEES.sprintsProjet);
    expect(v.misesEnProduction).toEqual(DONNEES.misesEnProduction);
    expect(ids(v.ressources)).toEqual(['r-thomas']);
    expect(v.affectations.every(a => a.projetId === 'p-app2')).toBe(true);
    expect(v.envoisDaily).toEqual([]);
    expect(v.absences.map(a => a.ressourceId)).toEqual(['r-thomas']);
    expect(v.temps.map(t => t.ressourceId)).toEqual(['r-thomas']);
    expect(v.objectifsTravail.map(o => o.equipeId)).toEqual(['app']);
  });

  it('un collègue de projet est visible (fiche et absences) mais pas ses heures', () => {
    const v = appliquerPerimetre(contexte({ simulation: { cle: 'chef', ressourceId: 'r-cerine' } }), DONNEES);
    expect(ids(v.projets)).toEqual(ids(DONNEES.projets));
    expect(ids(v.ressources)).toEqual(['r-cerine', 'r-lena']);
    expect(v.absences.map(a => a.ressourceId)).toEqual(['r-lena']);
    expect(v.temps).toEqual([]);
    expect(v.feuilles).toEqual([]);
  });

  it('un responsable voit tous les projets (migration 050) mais seulement les personnes de son équipe', () => {
    const v = appliquerPerimetre(contexte({ simulation: { cle: 'responsable', ressourceId: 'r-cerine' } }), DONNEES);
    expect(ids(v.projets)).toEqual(ids(DONNEES.projets));
    expect(v.projets.some(p => p.equipeId === 'amoa')).toBe(true);
    expect(ids(v.ressources)).toEqual(['r-anne', 'r-cerine', 'r-christelle', 'r-lena', 'r-thomas']);
    expect(v.temps.map(t => t.ressourceId)).toEqual(['r-thomas']);
  });

  it('une direction voit tous les projets mais seulement les personnes de ses équipes (Applications et IA), pas AMOA', () => {
    const v = appliquerPerimetre(contexte({ simulation: { cle: 'direction', ressourceId: 'r-thomas' } }), DONNEES);
    expect(ids(v.projets)).toEqual(ids(DONNEES.projets));
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

  it('un compte sans fiche ne voit aucune personne, mais les projets restent lisibles de tous (migration 050)', () => {
    const v = appliquerPerimetre(contexte({ simulation: { cle: 'utilisateur', ressourceId: null } }), DONNEES);
    expect(ids(v.projets)).toEqual(ids(DONNEES.projets));
    expect(v.affectations).toEqual([]);
    expect(v.ressources).toEqual([]);
  });
});

describe('équipe active (Mon dashboard)', () => {
  it('ne garde que les projets, personnes et lignes de l’équipe choisie', () => {
    const v = restreindreEquipe({ ...DONNEES, equipes: EQUIPES }, 'app');
    expect(v.projets.every(p => p.equipeId === 'app')).toBe(true);
    expect(v.ressources.every(r => r.equipeId === 'app')).toBe(true);
    expect(v.projets.length).toBeLessThan(DONNEES.projets.length);
    const projets = new Set(v.projets.map(p => p.id));
    expect(v.affectations.every(a => projets.has(a.projetId))).toBe(true);
    expect(v.equipes.map(e => e.id)).toContain('app');
  });
});

describe('mes projets hors administrateur (porteur, 2026-11-04)', () => {
  it('un chef de projet, même propriétaire de l’organisation de son équipe, ne voit que les projets où il est affecté ou chef', () => {
    const ctx = contexte({ rolesEquipe: { app: 'owner' }, rolesAcces: [{ ressourceId: 'r-thomas', role: 'chef' }] });
    expect(equipesGerees(ctx).has('app')).toBe(false);
    const v = restreindreMesProjets({ ...DONNEES, equipes: EQUIPES }, ctx);
    const mes = new Set(DONNEES.affectations.filter(a => a.ressourceId === 'r-thomas').map(a => a.projetId));
    expect(v.projets.every(p => mes.has(p.id) || p.chefId === 'r-thomas')).toBe(true);
    expect(v.projets.length).toBeLessThan(DONNEES.projets.filter(p => p.equipeId === 'app').length + 1);
  });

  it('sans aucune affectation, la liste des projets est vide', () => {
    const ctx = contexte({ userId: 'personne', rolesEquipe: {}, ressources: [] });
    expect(restreindreMesProjets({ ...DONNEES, equipes: EQUIPES }, ctx).projets).toEqual([]);
  });

  it('un responsable d’équipe garde tous les projets de son équipe', () => {
    const ctx = contexte({ rolesEquipe: { app: 'owner' } });
    const v = restreindreMesProjets({ ...DONNEES, equipes: EQUIPES }, ctx);
    expect(v.projets.filter(p => p.equipeId === 'app').length).toBe(DONNEES.projets.filter(p => p.equipeId === 'app').length);
  });
});
