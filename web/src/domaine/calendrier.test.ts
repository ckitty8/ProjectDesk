import { describe, expect, it } from 'vitest';
import { abregeAbsence, caseJour, contexteMois, totalAbsences } from './calendrier';
import type { TypeAbsence } from './calendrier';

const CP: TypeAbsence = { libelle: 'Congés payés', couleur: '#0F8A6B', abrege: 'CP', actif: true };
const FERIE: TypeAbsence = { libelle: 'Jours férié', couleur: '#8A93A3', abrege: 'JF', actif: true };
const thomas = { id: 'r-thomas', dateNaissance: '1990-11-05' };

// Novembre 2026 : le 1er est un dimanche ; férié le mercredi 11
const ctx = (editable = false, types: TypeAbsence[] = [CP, FERIE]) => contexteMois(2026, 10, [{ jour: '2026-11-11', libelle: 'Armistice' }], types, [
  { ressourceId: 'r-thomas', jour: '2026-11-03', type: 'Congés payés', duree: 1 },
  { ressourceId: 'r-thomas', jour: '2026-11-04', type: 'Congés payés', duree: 0.5 }
], editable);

describe('calendrier mensuel', () => {
  it('couvre tous les jours du mois', () => {
    expect(ctx().jours).toHaveLength(30);
  });

  it('grise les week-ends sans férié ni absence', () => {
    expect(caseJour(ctx(), thomas, '2026-11-01')).toMatchObject({ ferme: true, ferie: null, absence: null, jours: 0 });
  });

  it('marque un jour férié avec le type « Jours férié » s\'il est actif', () => {
    const c = caseJour(ctx(), thomas, '2026-11-11');
    expect(c.ferme).toBe(true);
    expect(c.ferie).toEqual({ libelle: 'Armistice', type: FERIE });
  });

  it('retombe sur « F » (sans type) si le type « Jours férié » est désactivé', () => {
    expect(caseJour(ctx(false, [CP, { ...FERIE, actif: false }]), thomas, '2026-11-11').ferie?.type).toBeNull();
  });

  it('décompte une journée entière et une demi-journée', () => {
    expect(caseJour(ctx(), thomas, '2026-11-03')).toMatchObject({ jours: 1, absence: { demi: false } });
    expect(caseJour(ctx(), thomas, '2026-11-04')).toMatchObject({ jours: 0.5, absence: { demi: true } });
    expect(totalAbsences(ctx(), thomas)).toBe(1.5);
    expect(totalAbsences(ctx(), { id: 'autre', dateNaissance: null })).toBe(0);
  });

  it('n\'affiche l\'anniversaire qu\'en lecture seule, un jour sans absence', () => {
    expect(caseJour(ctx(false), thomas, '2026-11-05').anniversaire).toBe(true);
    expect(caseJour(ctx(true), thomas, '2026-11-05').anniversaire).toBe(false);
  });

  it('abrège le type d\'absence, avec ½ pour une demi-journée', () => {
    expect(abregeAbsence(CP, true)).toBe('CP½');
    expect(abregeAbsence({ ...CP, abrege: null }, false)).toBe('Co');
  });
});
