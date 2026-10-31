import { describe, expect, it } from 'vitest';
import { dansPeriode, debutParDefaut, decalerDebut, periodePlanning } from './planning';

describe('planning projet', () => {
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
    expect(p.mois.map(m => m.libelle)).toEqual(['sept. 26', 'oct. 26', 'nov. 26', 'déc. 26', 'janv. 27', 'févr. 27']);
    expect(p.mois.reduce((s, m) => s + m.largeur, 0)).toBeCloseTo(100);
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
    expect(dansPeriode(p, '2027-03-01', '2027-03-02')).toBe(false);
  });
});
