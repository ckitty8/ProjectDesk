import { describe, expect, it } from 'vitest';
import { ABSENCES, AFFECTATIONS, EQUIPES, PROJETS, RESSOURCES, contexte } from './__fixtures__/donnees';
import { modeleRecap } from './recap';

const d = { equipes: EQUIPES, ressources: RESSOURCES, projets: PROJETS, affectations: AFFECTATIONS, absences: ABSENCES,
  objectifsTravail: [{ equipeId: 'app', annee: 2026, jours: 210 }] };
const app = EQUIPES.find(e => e.id === 'app')!;
const pole = EQUIPES.find(e => e.id === 'pole')!;

describe('récap annuel', () => {
  it('une unité : titre avec objectif, ses personnes, puis son total', () => {
    const m = modeleRecap(contexte(), d, 2026, new Set(), app);
    expect(m[0]).toMatchObject({ genre: 'unite', objectif: 210, niveau: 0 });
    expect(m.filter(e => e.genre === 'personne')).toHaveLength(4);
    expect(m.at(-1)).toMatchObject({ genre: 'total' });
  });
  it('le total est la somme des personnes', () => {
    const m = modeleRecap(contexte(), d, 2026, new Set(), app);
    const total = m.find(e => e.genre === 'total');
    const somme = m.flatMap(e => (e.genre === 'personne' ? [e.recap.conges] : [])).reduce((a, b) => a + b, 0);
    expect(total?.genre === 'total' && total.conges).toBe(somme);
    expect(somme).toBeGreaterThan(0);                              // Thomas a un congé le 2 novembre
  });
  it('l\'objectif par défaut s\'applique sans saisie ; les sous-unités suivent avec un niveau de plus', () => {
    const m = modeleRecap(contexte(), d, 2026, new Set(), pole);
    expect(m.find(e => e.genre === 'unite' && e.equipe.id === 'ia')).toMatchObject({ objectif: 218, niveau: 1 });
  });
  it('l\'objectif est modifiable par un administrateur avec le droit de la matrice, pas par un simple membre', () => {
    const unite = (ctx: ReturnType<typeof contexte>) => modeleRecap(ctx, d, 2026, new Set(), app)[0];
    expect(unite(contexte({ estAdmin: true, estCreateur: true }))).toMatchObject({ modifiable: true });
    expect(unite(contexte())).toMatchObject({ modifiable: false });
  });
  it('mentionne l\'arrivée en cours d\'année', () => {
    const arrivee = { ...d, ressources: RESSOURCES.map(r => (r.id === 'r-thomas' ? { ...r, dateArrivee: '2026-04-01' } : r)) };
    const p = modeleRecap(contexte(), arrivee, 2026, new Set(), app).find(e => e.genre === 'personne' && e.ressource.id === 'r-thomas');
    expect(p?.genre === 'personne' && p.mentions).toEqual(['arrivée le 1 avr.']);
  });
  it('une unité sans personne n\'apparaît pas', () => {
    const vide = { id: 'vide', nom: 'Vide', parentId: null };
    expect(modeleRecap(contexte(), { ...d, equipes: [...EQUIPES, vide] }, 2026, new Set(), vide)).toEqual([]);
  });
});
