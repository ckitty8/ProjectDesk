import { describe, expect, it } from 'vitest';
import { MENU_GENERAL, MENU_MOI } from './domaine/menus';
import { ROUTES, cheminDe, routePour, titrePage } from './routes';

describe('table des écrans', () => {
  it('donne un titre à chaque écran connu', () => {
    ROUTES.forEach(route => expect(titrePage(route.chemin)).toBe(`${route.titre} · ProjectDesk`));
  });

  it("revient au nom de l'application pour une adresse inconnue", () => {
    expect(titrePage('/introuvable')).toBe('ProjectDesk');
  });

  it('ne déclare aucune adresse ni aucun identifiant en double', () => {
    const chemins = ROUTES.map(r => r.chemin), ids = ROUTES.map(r => r.id);
    expect(new Set(chemins).size).toBe(chemins.length);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('a une adresse pour chaque menu et sous-menu de la barre latérale', () => {
    const ids = [...MENU_GENERAL, ...MENU_MOI].flatMap(m => [m.id, ...(m.enfants ?? []).map(e => e.id)]);
    ids.forEach(id => expect(ROUTES.some(r => r.id === id), id).toBe(true));
  });

  it('a un écran dans le registre pour chaque route avec coquille', async () => {
    const { ECRANS } = await import('./ecrans');
    ROUTES.filter(r => r.section !== 'plein').forEach(r => expect(ECRANS[r.id], r.id).toBeDefined());
  });

  it('retrouve la route d\'une adresse, sous-adresses comprises', () => {
    expect(routePour('/sprints/2')?.id).toBe('mesSprints');
    expect(cheminDe('astuces')).toBe('/trucs-et-astuces');
    expect(cheminDe('inconnu')).toBe('/');
  });
});
