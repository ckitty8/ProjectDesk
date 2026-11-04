import { describe, expect, it } from 'vitest';
import { EQUIPES, PROJETS, contexte } from './__fixtures__/donnees';
import { equipeVide, nomComplet, prenomEtNom, rattachesA, roleChoisi, responsablesAffiches, rolesDuProjet, selectionAnnuaire, unitesNavigation } from './annuaire';

describe('navigation de l\'annuaire', () => {
  it('liste la direction en tête (niveau 0), ses équipes en retrait (niveau 1), puis les équipes isolées', () => {
    const ctx = contexte({ equipes: [...EQUIPES.map(e => (e.id === 'pole' ? { ...e, type: 'direction' } : { ...e, type: 'equipe' }))] });
    // Direction › équipe : la direction « pole » en tête (niveau 0), ses équipes en retrait (niveau 1), puis l'équipe isolée
    expect(unitesNavigation(ctx).map(u => `${u.niveau}:${u.equipe.id}`)).toEqual(['0:pole', '1:app', '1:ia', '0:amoa']);
  });
  it('une équipe dont la direction est hors du périmètre devient une racine', () => {
    const equipes = EQUIPES.filter(e => e.id !== 'pole').map(e => ({ ...e, type: 'equipe' }));
    expect(unitesNavigation(contexte({ equipes })).map(u => `${u.niveau}:${u.equipe.id}`)).toEqual(['0:app', '0:ia', '0:amoa']);
  });
  it('sélection : le choix mémorisé s\'il existe, sinon l\'équipe ouverte, sinon la première', () => {
    const ctx = contexte({ equipes: EQUIPES.map(e => ({ ...e, type: e.id === 'pole' ? 'direction' : 'equipe' })) });
    expect(selectionAnnuaire(ctx, { type: 'projet', id: 'p-ia1' }, null)).toEqual({ type: 'projet', id: 'p-ia1' });
    expect(selectionAnnuaire(ctx, { type: 'projet', id: 'disparu' }, 'ia')).toEqual({ type: 'equipe', id: 'ia' });
    expect(selectionAnnuaire(ctx, null, null)).toEqual({ type: 'equipe', id: 'app' });   // la direction « pole » est en tête, mais on s'ouvre sur une équipe
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

describe('responsables affichés d’une unité (porteur, 2026-11-04)', () => {
  it('une personne dont le rôle Responsable est seulement prévu (pas encore connectée) est affichée comme responsable', () => {
    const ctx = contexte({ rolesPrevus: [{ ressourceId: 'r-thomas', role: 'responsable' }], responsablesEquipe: [] });
    expect(responsablesAffiches(ctx, 'app').map(r => r.id)).toContain('r-thomas');
  });

  it('les responsables inscrits en base restent affichés, sans doublon', () => {
    const ctx = contexte({ responsablesEquipe: [{ equipeId: 'app', ressourceId: 'r-thomas' }], rolesPrevus: [{ ressourceId: 'r-thomas', role: 'responsable' }] });
    expect(responsablesAffiches(ctx, 'app').filter(r => r.id === 'r-thomas')).toHaveLength(1);
  });
});
