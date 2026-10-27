import { describe, expect, it } from 'vitest';
import { positionBulle } from './bulle';

const fenetre = { largeur: 1000, hauteur: 800 };
const icone = (left: number, top: number) => ({ left, top, width: 12, height: 12, bottom: top + 12 });

describe('position de la bulle ⓘ', () => {
  it('se place sous l\'icône, centrée', () => {
    expect(positionBulle(icone(500, 100), 60, fenetre)).toEqual({ left: 366, top: 118 });
  });
  it('ne sort pas de la fenêtre à gauche ni à droite', () => {
    expect(positionBulle(icone(0, 100), 60, fenetre).left).toBe(8);
    expect(positionBulle(icone(990, 100), 60, fenetre).left).toBe(1000 - 280 - 8);
  });
  it('passe au-dessus s\'il n\'y a pas la place en dessous', () => {
    expect(positionBulle(icone(500, 760), 60, fenetre).top).toBe(760 - 6 - 60);
  });
  it('se repère sur la modale qui la contient', () => {
    expect(positionBulle(icone(500, 100), 60, fenetre, { left: 100, top: 50 })).toEqual({ left: 266, top: 68 });
  });
});
