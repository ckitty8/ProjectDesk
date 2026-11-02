import { describe, expect, it } from 'vitest';
import { barreSprint, dansPeriode, debutParDefaut, decalerDebut, periodePlanning } from './planning';

describe('gantt : zoom mois (par défaut)', () => {
  it('commence le 1er du mois précédent', () => {
    expect(debutParDefaut('2026-10-27')).toBe('2026-09-01');
    expect(debutParDefaut('2026-01-15')).toBe('2025-12-01');
  });
  it('se décale d\'un mois', () => {
    expect(decalerDebut('2026-09-01', 1)).toBe('2026-10-01');
    expect(decalerDebut('2026-01-01', -1)).toBe('2025-12-01');
  });
  it('couvre six mois, du 1er septembre au 28 février', () => {
    const p = periodePlanning('2026-09-01');
    expect(p.fin).toBe('2027-02-28');
    expect(p.total).toBe(181);
    expect(p.graduations.map(m => m.libelle)).toEqual(['sept. 26', 'oct. 26', 'nov. 26', 'déc. 26', 'janv. 27', 'févr. 27']);
    expect(p.graduations.reduce((s, m) => s + m.largeur, 0)).toBeCloseTo(100);
    expect(p.graduations[1]?.gauche).toBeCloseTo(30 / 181 * 100);
  });
  it('place une date sur la frise, bornée aux extrémités', () => {
    const p = periodePlanning('2026-09-01');
    expect(p.position('2026-09-01')).toBe(0);
    expect(p.position('2020-01-01')).toBe(0);
    expect(p.position('2030-01-01')).toBe(100);
    expect(p.position('2026-12-01')).toBeCloseTo(91 / 181 * 100);
  });
  it('détecte ce qui touche la période', () => {
    const p = periodePlanning('2026-09-01');
    expect(dansPeriode(p, '2026-08-20', '2026-09-02')).toBe(true);
    expect(dansPeriode(p, '2026-03-01', '2026-08-31')).toBe(false);
    expect(dansPeriode(p, '2027-02-28', '2027-03-05')).toBe(true);
    expect(dansPeriode(p, '2027-03-01', '2027-03-05')).toBe(false);
  });
});

describe('gantt : zoom semaine', () => {
  it('commence le lundi de la semaine précédente', () => {
    expect(debutParDefaut('2026-11-02', 'semaine')).toBe('2026-10-26');   // lundi 2 nov. → lundi 26 oct.
    expect(debutParDefaut('2026-11-04', 'semaine')).toBe('2026-10-26');
  });
  it('se décale de quatre semaines', () => {
    expect(decalerDebut('2026-10-26', 1, 'semaine')).toBe('2026-11-23');
    expect(decalerDebut('2026-10-26', -1, 'semaine')).toBe('2026-09-28');
  });
  it('couvre douze semaines, une graduation par lundi', () => {
    const p = periodePlanning('2026-10-26', 'semaine');
    expect(p.total).toBe(84);
    expect(p.fin).toBe('2027-01-17');
    expect(p.graduations).toHaveLength(12);
    expect(p.graduations[0]?.libelle).toBe('26 oct.');
    expect(p.graduations[1]?.libelle).toBe('2 nov.');
    expect(p.graduations.reduce((s, g) => s + g.largeur, 0)).toBeCloseTo(100);
  });
});

describe('gantt : zoom trimestre', () => {
  it('commence le 1er jour du trimestre en cours', () => {
    expect(debutParDefaut('2026-11-02', 'trimestre')).toBe('2026-10-01');
    expect(debutParDefaut('2026-02-10', 'trimestre')).toBe('2026-01-01');
  });
  it('se décale d\'un trimestre', () => {
    expect(decalerDebut('2026-10-01', 1, 'trimestre')).toBe('2027-01-01');
    expect(decalerDebut('2026-01-01', -1, 'trimestre')).toBe('2025-10-01');
  });
  it('couvre quatre trimestres', () => {
    const p = periodePlanning('2026-10-01', 'trimestre');
    expect(p.graduations.map(g => g.libelle)).toEqual(['T4 26', 'T1 27', 'T2 27', 'T3 27']);
    expect(p.fin).toBe('2027-09-30');
    expect(p.graduations.reduce((s, g) => s + g.largeur, 0)).toBeCloseTo(100);
  });
});

describe('barre de sprint', () => {
  it('inclut le dernier jour du sprint', () => {
    const p = periodePlanning('2026-09-01');
    const b = barreSprint(p, '2026-09-14', '2026-09-25');
    expect(b.gauche).toBeCloseTo(13 / 181 * 100);
    expect(b.largeur).toBeCloseTo(12 / 181 * 100);
  });
  it('reste visible même hors de la période (largeur minimale)', () => {
    const p = periodePlanning('2026-09-01');
    expect(barreSprint(p, '2030-01-01', '2030-01-10').largeur).toBeGreaterThan(0);
  });
});
