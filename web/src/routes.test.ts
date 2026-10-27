import { describe, expect, it } from 'vitest';
import { ROUTES, titrePage } from './routes';

describe('table des écrans', () => {
  it('donne un titre à chaque écran connu', () => {
    ROUTES.forEach(route => expect(titrePage(route.chemin)).toBe(`${route.titre} · ProjectDesk`));
  });

  it("revient au nom de l'application pour une adresse inconnue", () => {
    expect(titrePage('/introuvable')).toBe('ProjectDesk');
  });

  it('ne déclare aucune adresse en double', () => {
    const chemins = ROUTES.map(r => r.chemin);
    expect(new Set(chemins).size).toBe(chemins.length);
  });
});
