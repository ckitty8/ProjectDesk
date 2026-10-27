import { describe, expect, it } from 'vitest';
import { equipeAOuvrir } from './compte';
import type { Equipe } from '../domaine/types';

const direction: Equipe = { id: 'd', nom: 'Direction', parentId: null, type: 'direction' };
const equipeA: Equipe = { id: 'a', nom: 'A', parentId: null, type: 'equipe' };
const equipeB: Equipe = { id: 'b', nom: 'B', parentId: null, type: 'equipe' };

describe('équipe ouverte au démarrage', () => {
  it('prend l\'équipe mémorisée si le compte y a accès', () => {
    expect(equipeAOuvrir([equipeA, equipeB], 'b', false)?.id).toBe('b');
  });
  it('prend la seule équipe du compte', () => {
    expect(equipeAOuvrir([equipeA], null, false)?.id).toBe('a');
  });
  it('laisse choisir un compte qui a plusieurs équipes sans mémoire', () => {
    expect(equipeAOuvrir([equipeA, equipeB], null, false)).toBeNull();
  });
  it('ouvre pour un administrateur la première équipe, de préférence une équipe plutôt qu\'une direction', () => {
    expect(equipeAOuvrir([direction, equipeA], null, true)?.id).toBe('a');
    expect(equipeAOuvrir([direction], null, true)?.id).toBe('d');
  });
  it('n\'ouvre rien sans équipe', () => {
    expect(equipeAOuvrir([], null, true)).toBeNull();
  });
});
