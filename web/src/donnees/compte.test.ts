import { describe, expect, it } from 'vitest';
import { contexte } from '../domaine/__fixtures__/donnees';
import { ecranDArrivee, equipeAOuvrir } from './compte';
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

describe('écran d\'arrivée', () => {
  it('compte sans équipe : attente d\'accès, sauf administrateur', () => {
    expect(ecranDArrivee(contexte({ organisations: [] }), null)).toBe('choixEquipe');
    expect(ecranDArrivee(contexte({ organisations: [], estAdmin: true }), null)).toBe('dashboard');
    expect(ecranDArrivee(contexte({ organisations: [], estAdmin: true, equipes: [] }), null)).toBe('monAdmin');
  });
  it('équipe ouverte : dashboard ; sinon choix d\'équipe', () => {
    expect(ecranDArrivee(contexte(), 'app')).toBe('dashboard');
    expect(ecranDArrivee(contexte(), null)).toBe('choixEquipe');
  });
});
