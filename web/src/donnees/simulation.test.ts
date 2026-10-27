import { describe, expect, it } from 'vitest';
import { RESSOURCES, contexte } from '../domaine/__fixtures__/donnees';
import { choixSimulation, decoderChoixSimulation, identiteSimulee, libelleRoleSimule, ROLE_SANS_EQUIPE } from './simulation';

describe('choix de simulation', () => {
  it('propose chaque rôle pour chaque fiche, puis le compte en attente', () => {
    const choix = choixSimulation(RESSOURCES);
    expect(choix).toHaveLength(6 * RESSOURCES.length + 1);
    expect(choix.at(-1)).toEqual({ valeur: 'sansEquipe|', libelle: 'Compte en attente' });
    expect(choix[0]?.valeur).toMatch(/^admin\|/);
  });

  it('décode les valeurs du bandeau', () => {
    expect(decoderChoixSimulation('projet|r-thomas')).toEqual({ cle: 'projet', ressourceId: 'r-thomas' });
    expect(decoderChoixSimulation('sansEquipe|')).toEqual({ cle: 'sansEquipe', ressourceId: null });
  });

  it('libelle les rôles', () => {
    expect(libelleRoleSimule(ROLE_SANS_EQUIPE)).toBe('Compte en attente');
    expect(libelleRoleSimule('projet')).toBe('Projet');
  });
});

describe('identité simulée', () => {
  const base = contexte();
  const thomas = RESSOURCES.find(r => r.id === 'r-thomas') ?? null;

  it('prend les équipes de la fiche, membre simple', () => {
    const i = identiteSimulee(base, { cle: 'utilisateur', ressourceId: 'r-thomas' }, thomas);
    expect(i).toMatchObject({ userId: 'u-thomas', estCreateur: false, estAdmin: false, rolesEquipe: { app: 'member' } });
  });

  it('une responsable d\'équipe est « owner » de son équipe', () => {
    const anne = RESSOURCES.find(r => r.id === 'r-anne') ?? null;
    const i = identiteSimulee(contexte({ responsablesEquipe: [{ equipeId: 'app', ressourceId: 'r-anne' }] }), { cle: 'responsable', ressourceId: 'r-anne' }, anne);
    expect(i.rolesEquipe).toEqual({ app: 'owner' });
  });

  it('sans équipe : aucune équipe ; administrateur seulement pour le rôle admin', () => {
    expect(identiteSimulee(base, { cle: ROLE_SANS_EQUIPE, ressourceId: null }, null).organisations).toEqual([]);
    expect(identiteSimulee(base, { cle: 'admin', ressourceId: 'r-thomas' }, thomas).estAdmin).toBe(true);
  });
});
