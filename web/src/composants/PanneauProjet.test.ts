import { describe, expect, it } from 'vitest';
import { statutsProposes } from './PanneauProjet';

describe('statuts proposés pour un projet', () => {
  const actifs = ['Planifié', 'En cours', 'Terminé'];
  it('les valeurs actives du référentiel', () => {
    expect(statutsProposes(actifs, { statut: 'En cours' })).toEqual(actifs);
  });
  it('garde le statut actuel s\'il a été désactivé depuis', () => {
    expect(statutsProposes(actifs, { statut: 'Ancien' })).toEqual(['Ancien', ...actifs]);
  });
  it('ignore un statut absent', () => {
    expect(statutsProposes(actifs, { statut: '' })).toEqual(actifs);
  });
});
