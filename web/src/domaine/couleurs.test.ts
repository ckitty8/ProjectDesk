import { describe, expect, it } from 'vitest';
import { couleurStatutProjet, teinte } from './couleurs';
import { COULEURS, STATUTS_PROJET } from './config';

describe('couleurs d\'affichage', () => {
  it('teinte mélange la couleur avec du blanc', () => {
    expect(teinte('#000000', 0.5)).toBe('rgb(128,128,128)');
    expect(teinte('#FFFFFF')).toBe('rgb(255,255,255)');
    expect(teinte('#003CC8', 0.12)).toBe('rgb(224,232,248)');
  });

  it('la couleur de barre suit le statut du projet', () => {
    expect(couleurStatutProjet(STATUTS_PROJET.A_RISQUE)).toBe(COULEURS.alerte);
    expect(couleurStatutProjet(STATUTS_PROJET.EN_RETARD)).toBe(COULEURS.danger);
    expect(couleurStatutProjet(STATUTS_PROJET.TERMINE)).toBe(COULEURS.succes);
    expect(couleurStatutProjet(STATUTS_PROJET.EN_COURS)).toBe(COULEURS.primaire);
  });
});
