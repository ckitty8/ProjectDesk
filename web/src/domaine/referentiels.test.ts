import { describe, expect, it } from 'vitest';
import { couleurDe, valeurParCle, valeursDe } from './referentiels';
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

describe('valeurs système retrouvées par leur clé', () => {
  const absences: ValeurReferentiel[] = [
    { referentielId: 'abs', libelle: 'Congés validé', cle: 'cp', couleur: '#0F8A6B', actif: true, systeme: true },
    { referentielId: 'abs', libelle: 'Jours férié', cle: 'ferie', couleur: '#8A93A3', actif: true, systeme: true },
    { referentielId: 'stp', libelle: 'Congés payés', cle: 'cp', couleur: '#999999', actif: true }
  ];
  it('retrouve le type « congés » même renommé : la clé fait foi, pas le libellé', () => {
    expect(valeurParCle(absences, 'abs', 'cp')?.libelle).toBe('Congés validé');
    expect(valeurParCle(absences, 'abs', 'ferie')?.libelle).toBe('Jours férié');
  });
  it('ne confond pas deux listes ni une clé inconnue', () => {
    expect(valeurParCle(absences, 'stp', 'cp')?.couleur).toBe('#999999');
    expect(valeurParCle(absences, 'abs', 'inconnue')).toBeUndefined();
  });
});
