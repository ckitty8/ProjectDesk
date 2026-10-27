import { describe, expect, it } from 'vitest';
import { couleurDe, valeursDe } from './referentiels';
import type { ValeurReferentiel } from './types';

const valeurs: ValeurReferentiel[] = [
  { referentielId: 'stp', libelle: 'En cours', couleur: '#003CC8', actif: true },
  { referentielId: 'stp', libelle: 'Ancien', couleur: '#999999', actif: false },
  { referentielId: 'role', libelle: 'Membre', couleur: '#0F8A6B', actif: true }
];

describe('référentiels', () => {
  it('ne renvoie que les valeurs actives de la liste demandée', () => {
    expect(valeursDe(valeurs, 'stp').map(v => v.libelle)).toEqual(['En cours']);
  });
  it('peut inclure les valeurs inactives', () => {
    expect(valeursDe(valeurs, 'stp', true)).toHaveLength(2);
  });
  it('donne la couleur d\'un libellé, y compris inactif, sinon le gris neutre', () => {
    expect(couleurDe(valeurs, 'stp', 'Ancien')).toBe('#999999');
    expect(couleurDe(valeurs, 'stp', 'Inconnu')).toBe('#4A5363');
  });
});
