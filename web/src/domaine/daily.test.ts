import { describe, expect, it } from 'vitest';
import { blocagesDaily, composerDaily, decouperDaily, rubriquesDaily } from './daily';

const NOTE = 'Hier\n- Revue de code\n- Migration SSO\n\nAujourd’hui\n- Recette\n\nBlocages\n- Identifiants de recette expirés';

describe('notes de daily', () => {
  it('découpe une note en trois champs', () => {
    expect(decouperDaily(NOTE)).toEqual({ hier: 'Revue de code\nMigration SSO', aujourdhui: 'Recette', blocages: 'Identifiants de recette expirés' });
  });

  it('range un texte hors rubrique dans « Aujourd’hui » : rien n’est perdu', () => {
    expect(decouperDaily('- une ancienne note')).toEqual({ hier: '', aujourdhui: 'une ancienne note', blocages: '' });
  });

  it('recompose la note identique à partir des champs (aller-retour)', () => {
    expect(composerDaily(decouperDaily(NOTE))).toBe(NOTE);
  });

  it('ne produit rien pour des champs vides', () => {
    expect(composerDaily({ hier: '', aujourdhui: '  ' })).toBe('');
  });

  it('extrait les blocages réels, hors « Aucun », « RAS » et « néant »', () => {
    expect(blocagesDaily('Blocages\n- Aucun\n- Serveur HS\n- RAS.')).toEqual(['Serveur HS']);
    expect(blocagesDaily(null)).toEqual([]);
  });

  it('découpe en rubriques avec leurs lignes', () => {
    expect(rubriquesDaily('Hier\n- a\n- b\nBlocage\n- c')).toEqual([{ titre: 'Hier', lignes: ['a', 'b'] }, { titre: 'Blocage', lignes: ['c'] }]);
  });
});
