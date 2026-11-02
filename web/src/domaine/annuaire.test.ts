import { describe, expect, it } from 'vitest';
import { EQUIPES, PROJETS, contexte } from './__fixtures__/donnees';
import { equipeVide, nomComplet, prenomEtNom, rattachesA, roleChoisi, rolesDuProjet, selectionAnnuaire, unitesNavigation } from './annuaire';

describe('navigation de l\'annuaire', () => {
  it('liste les équipes avant les directions, et cache une direction qui ne porte rien', () => {
    const ctx = contexte({ equipes: [...EQUIPES.map(e => (e.id === 'pole' ? { ...e, type: 'direction' } : { ...e, type: 'equipe' }))] });
    expect(unitesNavigation(ctx).map(e => e.id)).toEqual(['app', 'ia', 'amoa']);          // « pole » vide de contenu mais a des sous-équipes : masquée
  });
  it('garde une direction qui porte des projets', () => {
    const equipes = EQUIPES.map(e => ({ ...e, type: e.id === 'pole' ? 'direction' : 'equipe' }));
    const ctx = contexte({ equipes, projets: [...PROJETS, { id: 'px', code: 'P-1', nom: 'X', equipeId: 'pole', statut: 'En cours' }] });
    expect(unitesNavigation(ctx).map(e => e.id)).toEqual(['app', 'ia', 'amoa', 'pole']);
  });
  it('sélection : le choix mémorisé s\'il existe, sinon l\'équipe ouverte, sinon la première', () => {
    const ctx = contexte();
    expect(selectionAnnuaire(ctx, { type: 'projet', id: 'p-ia1' }, null)).toEqual({ type: 'projet', id: 'p-ia1' });
    expect(selectionAnnuaire(ctx, { type: 'projet', id: 'disparu' }, 'ia')).toEqual({ type: 'equipe', id: 'ia' });
    expect(selectionAnnuaire(ctx, null, null).type).toBe('equipe');
    expect(selectionAnnuaire(ctx, { type: 'postes' }, null)).toEqual({ type: 'postes' });
    expect(selectionAnnuaire(contexte({ equipes: [] }), null, null)).toEqual({ type: 'aucun' });
  });
});

describe('rôles sur un projet', () => {
  it('Product Owners = rôle Chef de projet des personnes affectées, y compris le chef inscrit sur la fiche projet sans affectation', () => {
    const ctx = contexte({ rolesAcces: [{ ressourceId: 'r-lena', role: 'chef' }, { ressourceId: 'r-cerine', role: 'membre' }] });
    const { productOwners, membres } = rolesDuProjet(ctx, PROJETS.find(p => p.id === 'p-ia2')!);
    expect(productOwners.map(r => r.id)).toEqual(['r-lena']);
    expect(membres.map(r => r.id)).toEqual(['r-cerine']);
    const vista = rolesDuProjet(contexte({ affectations: [] }), PROJETS.find(p => p.id === 'p-app2')!);
    expect(vista.productOwners.map(r => r.id)).toEqual(['r-thomas']);                   // chef inscrit sur la fiche
  });
  it('rattachements triés par nom, équipe vide', () => {
    const ctx = contexte({ rattachements: [{ equipeId: 'ia', ressourceId: 'r-thomas' }, { equipeId: 'ia', ressourceId: 'r-anne' }] });
    expect(rattachesA(ctx, 'ia').map(x => x.r.id)).toEqual(['r-anne', 'r-thomas']);
    expect(equipeVide(contexte(), 'amoa')).toBe(false);
    expect(equipeVide(contexte({ ressources: [], projets: [], equipes: [{ id: 'z', nom: 'Z', parentId: null }] }), 'z')).toBe(true);
  });
});

describe('rôle affiché', () => {
  it('rôle choisi : le prévu avant l\'actuel ; sans rôle enregistré, responsable ou utilisateur', () => {
    const ctx = contexte({ rolesPrevus: [{ ressourceId: 'r-cerine', role: 'lecture' }], rolesAcces: [{ ressourceId: 'r-thomas', role: 'chef' }] });
    const r = (id: string) => ctx.ressources.find(x => x.id === id)!;
    expect(roleChoisi(ctx, r('r-cerine'))).toBe('lecture');
    expect(roleChoisi(ctx, r('r-thomas'))).toBe('chef');
    expect(roleChoisi(ctx, r('r-anne'))).toBe('responsable');
    expect(roleChoisi(ctx, r('r-marc'))).toBe('utilisateur');
  });
});

describe('prénom et nom (migration 048)', () => {
  it('découpe le nom complet d\'une fiche sans prénom ni nom saisis : premier mot = prénom', () => {
    expect(prenomEtNom({ nom: 'Cerine KERARMA' })).toEqual({ prenom: 'Cerine', nomFamille: 'KERARMA' });
    expect(prenomEtNom({ nom: 'Jean Pierre Dupont' })).toEqual({ prenom: 'Jean', nomFamille: 'Pierre Dupont' });
    expect(prenomEtNom({ nom: 'Christelle' })).toEqual({ prenom: 'Christelle', nomFamille: '' });
    expect(prenomEtNom({ nom: '  Léa   Moreau ' })).toEqual({ prenom: 'Léa', nomFamille: 'Moreau' });
  });
  it('préfère les colonnes saisies au découpage', () => {
    expect(prenomEtNom({ nom: 'Jean Pierre Dupont', prenom: 'Jean Pierre', nomFamille: 'Dupont' })).toEqual({ prenom: 'Jean Pierre', nomFamille: 'Dupont' });
    expect(prenomEtNom({ nom: 'Marc', prenom: 'Marc', nomFamille: null })).toEqual({ prenom: 'Marc', nomFamille: '' });
  });
  it('recompose le nom complet', () => {
    expect(nomComplet(' Léa ', 'Moreau-Durand')).toBe('Léa Moreau-Durand');
    expect(nomComplet('Christelle', '')).toBe('Christelle');
    expect(nomComplet('', '')).toBe('');
  });
});
