import { describe, expect, it } from 'vitest';
import { blocsDuTableau, colonnesOrdonnees, echangeOrdre, estListeRoadmap, nouvelIdListe, ordreEnFin, resumeValeurs } from './roadmap';
import type { ColonneRoadmap, ValeurReferentiel } from './types';

const col = (id: string, bloc: ColonneRoadmap['bloc'], ordre: number, type: ColonneRoadmap['type'] = 'libre'): ColonneRoadmap =>
  ({ id, libelle: id, bloc, type, ordre, format: type === 'libre' ? 'texte' : null });
// Volontairement dans le désordre : le tri suit l'ordre des blocs puis « ordre »
const COLONNES = [col('score', 'priorisation', 12, 'calcul'), col('statut', 'developpement', 14, 'liste'), col('demande', 'identification', 2),
  col('rang', 'identification', 1, 'calcul'), col('priorite', 'priorisation', 9, 'liste')];
const valeur = (libelle: string): ValeurReferentiel => ({ referentielId: 'rdm_x', libelle, couleur: '#4A5363', actif: true });

describe('colonnes du tableau Roadmap', () => {
  it('regroupe par bloc, dans l’ordre des blocs puis des colonnes, sans bloc vide', () => {
    expect(blocsDuTableau(COLONNES).map(b => [b.titre, b.colonnes.map(c => c.id)])).toEqual([
      ['Identification de la demande', ['rang', 'demande']], ['Priorisation', ['priorite', 'score']], ['Développement & recette', ['statut']]]);
    expect(colonnesOrdonnees(COLONNES).map(c => c.id)).toEqual(['rang', 'demande', 'priorite', 'score', 'statut']);
    expect(blocsDuTableau([])).toEqual([]);
  });

  it('déplace une colonne dans son bloc seulement', () => {
    expect(echangeOrdre(COLONNES, 'demande', -1)).toEqual([{ id: 'demande', ordre: 1 }, { id: 'rang', ordre: 2 }]);
    expect(echangeOrdre(COLONNES, 'demande', 1)).toBeNull();   // dernière de son bloc : ne passe pas dans Priorisation
    expect(echangeOrdre(COLONNES, 'rang', -1)).toBeNull();
    expect(echangeOrdre(COLONNES, 'inconnue', 1)).toBeNull();
  });

  it('départage deux colonnes de même ordre', () => {
    const egales = [col('a', 'cadrage', 5), col('b', 'cadrage', 5)];
    expect(echangeOrdre(egales, 'a', 1)).toEqual([{ id: 'a', ordre: 6 }, { id: 'b', ordre: 5 }]);
  });

  it('range une colonne ajoutée après les autres', () => {
    expect(ordreEnFin(COLONNES)).toBe(15);
    expect(ordreEnFin([])).toBe(1);
  });

  it('reconnaît et fabrique les identifiants des listes de la Roadmap', () => {
    expect(nouvelIdListe('1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed')).toBe('rdm_1b9d6bcdbbfd');
    expect(estListeRoadmap('rdm_statut')).toBe(true);
    expect(estListeRoadmap('stp')).toBe(false);
  });

  it('résume les valeurs d’une liste déroulante', () => {
    expect(resumeValeurs([])).toBe('Aucune valeur');
    expect(resumeValeurs(['Oui', 'Non'].map(valeur))).toBe('Oui, Non');
    expect(resumeValeurs(['1', '2', '3', '4', '5'].map(valeur))).toBe('5 valeurs');
  });
});
