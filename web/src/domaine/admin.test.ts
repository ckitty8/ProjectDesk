import { describe, expect, it } from 'vitest';
import { RESSOURCES, contexte } from './__fixtures__/donnees';
import { basculerJourEnvoi, choixParDefaut, feriePar, ficheProposee, lignesSection, ongletsAdministration, parRole, reglageEnvoi, rolesAffiches } from './admin';

const libres = [{ id: 'a', nom: 'Sophie Martin', equipeId: 'app', email: 'sophie@x.fr' }, { id: 'b', nom: 'Jean Dupont', equipeId: 'ia' }];

describe('comptes en attente', () => {
  it('propose la fiche du même email, sinon du même prénom', () => {
    expect(ficheProposee(libres, { nom: 'Autre', email: 'SOPHIE@x.fr' })?.id).toBe('a');
    expect(ficheProposee(libres, { nom: 'Jean Durand', email: 'j@x.fr' })?.id).toBe('b');
    expect(ficheProposee(libres, { nom: 'Inconnu', email: 'i@x.fr' })).toBeNull();
  });
  it('choix par défaut : fiche proposée et son équipe, rôle « member »', () => {
    expect(choixParDefaut(libres, { nom: 'Jean D', email: 'z@x.fr' })).toEqual({ equipe: 'ia', fiche: 'b', role: 'member' });
    expect(choixParDefaut(libres, { nom: 'Zoé', email: 'z@x.fr' })).toEqual({ equipe: '', fiche: '', role: 'member' });
  });
});

describe('onglets d\'Administration', () => {
  const compteurs = { enAttente: 2, referentiels: 4, ressources: 4, feries: 11, envoisActifs: 1, colonnesRoadmap: 19 };
  const ids = (ctx: ReturnType<typeof contexte>) => ongletsAdministration(ctx, compteurs).map(o => o.id);
  it('un administrateur voit comptes, équipes, référentiels, ressources et jours fériés ; plus d\'onglet Rôles (dans Ressources depuis 2.98)', () => {
    const liste = ids(contexte({ estAdmin: true, estCreateur: true }));
    expect(liste).toEqual(expect.arrayContaining(['comptes', 'equipes', 'referentiels', 'ressources', 'feries']));
    expect(liste).not.toContain('roles');
    expect(liste.indexOf('ressources')).toBe(liste.indexOf('referentiels') + 1);   // juste après Référentiels
  });
  it('un simple membre ne gère ni comptes, ni équipes, ni ressources', () => {
    const liste = ids(contexte());
    expect(liste).not.toEqual(expect.arrayContaining(['comptes']));
    expect(liste).not.toContain('equipes');
    expect(liste).not.toContain('ressources');
    expect(liste).not.toContain('roadmap');
  });
  it('un administrateur règle les colonnes de la Roadmap (onglet Roadmap, avec leur nombre)', () => {
    const o = ongletsAdministration(contexte({ estAdmin: true }), compteurs);
    expect(o.find(x => x.id === 'roadmap')).toEqual({ id: 'roadmap', libelle: 'Roadmap', compte: 19 });
  });
  it('reprend les compteurs', () => {
    const o = ongletsAdministration(contexte({ estAdmin: true, estCreateur: true }), compteurs);
    expect(o.find(x => x.id === 'comptes')?.compte).toBe(2);
    expect(o.find(x => x.id === 'feries')?.compte).toBe(11);
    expect(o.find(x => x.id === 'ressources')?.compte).toBe(4);
  });
});

describe('rôles', () => {
  it('affiche l’administrateur et les six rôles puis le compte en attente, avec la description tirée de la matrice', () => {
    const r = rolesAffiches(contexte());
    expect(r.map(x => x.cle)).toEqual(['admin', 'direction', 'responsable', 'chef', 'membre', 'utilisateur', 'lecture', 'sansEquipe']);
    expect(r[0]?.description).toContain('Vue d’ensemble :');
  });
  it('range chaque fiche sous son rôle choisi (prévu avant actuel) et les comptes en attente à part', () => {
    const ctx = contexte({ rolesPrevus: [{ ressourceId: 'r-cerine', role: 'lecture' }] });
    const g = parRole(ctx, '2026-11-04', [{ userId: 'u9', nom: '', email: 'nouveau@x.fr', inscritLe: '2026-11-01', invite: false }]);
    expect(g.lecture?.map(x => x.nom)).toEqual(['Cerine']);
    expect(g.lecture?.[0]?.compte).toBe('rôle prévu');
    expect(g.sansEquipe?.[0]).toEqual({ nom: 'nouveau@x.fr', equipe: '—', compte: 'nouveau@x.fr' });
    const total = Object.values(g).reduce((s, l) => s + l.length, 0);
    expect(total).toBe(RESSOURCES.length + 1);
  });
});

describe('matrice', () => {
  it('place le menu ouvert à tous juste avant les droits de ses onglets', () => {
    const noms = lignesSection('dashboard').map(l => `${l.menu}|${l.cle ?? 'tous'}`);
    const i = noms.findIndex(n => n === 'Trucs et astuces|tous');
    expect(i).toBeGreaterThan(0);
    expect(noms[i + 1]).toMatch(/^Trucs et astuces\|onglet_astuces/);
  });
});

describe('envoi du daily', () => {
  it('complète le réglage d\'un projet par les valeurs par défaut', () => {
    expect(reglageEnvoi([], 'p')).toMatchObject({ mode: 'aucun', heure: '09:30', jours: '1,2,3,4,5', sansFeries: true });
    expect(reglageEnvoi([{ projetId: 'p', mode: 'power_automate', heure: '08:00' }], 'p')).toMatchObject({ mode: 'power_automate', heure: '08:00', jours: '1,2,3,4,5' });
  });
  it('coche et décoche un jour', () => {
    expect(basculerJourEnvoi('1,2,3', 2)).toBe('1,3');
    expect(basculerJourEnvoi('1,3', 2)).toBe('1,2,3');
    expect(basculerJourEnvoi('', 5)).toBe('5');
  });
  it('trouve un jour férié', () => {
    expect(feriePar([{ jour: '2026-11-11', libelle: 'Armistice' }], '2026-11-11')?.libelle).toBe('Armistice');
    expect(feriePar([], '2026-11-11')).toBeNull();
  });
});
