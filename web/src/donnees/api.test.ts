import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appeler, definirSimulationActive, depuisBdd, ErreurApi, lire, versBdd, versCamel, versSnake } from './api';

/** Fabrique une réponse HTTP simulée */
const reponse = (corps: unknown, statut = 200, entetes: Record<string, string> = {}) =>
  new Response(corps === null ? '' : JSON.stringify(corps), { status: statut, headers: entetes });

/** Jeton JWT non signé valable 15 minutes */
const jeton = () => {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'none' })}.${b64({ sub: 'u1', exp: Math.floor(Date.now() / 1000) + 900 })}.sim`;
};

beforeEach(() => { definirSimulationActive(false); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('conversion camelCase / snake_case', () => {
  it('convertit les noms de colonnes dans les deux sens', () => {
    expect(versSnake('equipeId')).toBe('equipe_id');
    expect(versCamel('responsable_id')).toBe('responsableId');
  });

  it('versBdd transforme les chaînes vides en null, sauf celles à conserver', () => {
    expect(versBdd({ dateFin: '', destinataires: '', nom: 'A' }, ['destinataires'])).toEqual({ date_fin: null, destinataires: '', nom: 'A' });
  });

  it('depuisBdd convertit les nombres reçus en texte', () => {
    expect(depuisBdd({ projet_id: 'p', heures: '7.5', budget: '12', duree: '0.5', nom: '3' })).toEqual({ projetId: 'p', heures: 7.5, budget: 12, duree: 0.5, nom: '3' });
  });
});

describe('appeler', () => {
  it('renvoie le corps JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reponse({ ok: 1 })));
    expect(await appeler('http://x/a')).toEqual({ ok: 1 });
  });

  it('lève une erreur lisible avec le code technique de Neon Auth', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reponse({ message: 'Email non vérifié', code: 'EMAIL_NOT_VERIFIED' }, 403)));
    const erreur = (await appeler('http://x/a').catch(e => e)) as ErreurApi;
    expect(erreur).toBeInstanceOf(ErreurApi);
    expect(erreur.message).toBe('Email non vérifié');
    expect(erreur.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('refuse toute écriture pendant une simulation, sauf les lectures par POST', async () => {
    const appel = vi.fn(async () => reponse([]));
    vi.stubGlobal('fetch', appel);
    definirSimulationActive(true);
    await expect(appeler('http://x/rest/v1/projets', { method: 'PATCH' })).rejects.toThrow('lecture seule');
    await expect(appeler('http://x/rest/v1/rpc/lier_ma_ressource', { method: 'POST' })).rejects.toThrow('lecture seule');
    expect(appel).not.toHaveBeenCalled();
    await appeler('http://x/rest/v1/rpc/comptes_en_attente', { method: 'POST' });
    await appeler('http://x/rest/v1/projets');
    expect(appel).toHaveBeenCalledTimes(2);
  });
});

describe('lire (Data API)', () => {
  it('lit page après page, avec le jeton de la session, jusqu\'à une page vide', async () => {
    const pages = [[{ equipe_id: 'a' }], []];
    let autorisation = '';
    const appel = vi.fn(async (url: string, options?: RequestInit) => {
      if (url.includes('/rest/')) autorisation = (options?.headers as Record<string, string>).Authorization ?? '';
      if (url.includes('/get-session')) return reponse({ user: { id: 'u1' } }, 200, { 'set-auth-jwt': jeton() });
      return reponse(pages.shift() ?? []);
    });
    vi.stubGlobal('fetch', appel);
    vi.stubGlobal('window', { CONFIG_SURCHARGE: { NEON_AUTH_URL: 'http://x/auth', DATA_API_URL: 'http://x/rest' } });
    const { lireSession } = await import('./api');
    await lireSession();
    const lignes = await lire('ressources', { order: 'id' });
    expect(lignes).toEqual([{ equipeId: 'a' }]);
    const demandes = appel.mock.calls.map(c => String(c[0])).filter(u => u.includes('/rest/'));
    expect(demandes).toHaveLength(2);
    expect(demandes[0]).toContain('limit=1000&offset=0');
    expect(demandes[1]).toContain('offset=1');
    expect(autorisation).toMatch(/^Bearer /);
    vi.unstubAllGlobals();
  });
});
