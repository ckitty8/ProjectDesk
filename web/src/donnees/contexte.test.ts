import { describe, expect, it } from 'vitest';
import { ABSENCES, AFFECTATIONS, EQUIPES, PROJETS, RESSOURCES } from '../domaine/__fixtures__/donnees';
import { MATRICE_PRODUCTION } from '../domaine/__fixtures__/matrice';
import { mesEquipes, monRole } from '../domaine/droits';
import { construireVue, identiteReelle } from './contexte';
import type { Donnees, CleTable } from './tables';
import { CLES_TABLES } from './tables';

/** Données complètes de test (tables non utilisées : vides) */
function donnees(): Donnees {
  const d = {} as Record<CleTable, unknown[]>;
  CLES_TABLES.forEach(cle => { d[cle] = []; });
  Object.assign(d, { equipes: EQUIPES, ressources: RESSOURCES, projets: PROJETS, affectations: AFFECTATIONS, absences: ABSENCES,
    droitsRoles: MATRICE_PRODUCTION, createur: [{ userId: 'u-christelle' }], administrateurs: [{ userId: 'u-marc' }] });
  return d as unknown as Donnees;
}

describe('identité réelle', () => {
  it('reconnaît le créateur, qui est aussi administrateur', () => {
    const i = identiteReelle('u-christelle', donnees(), [], {});
    expect(i).toMatchObject({ estCreateur: true, estAdmin: true });
  });
  it('reconnaît un administrateur', () => {
    expect(identiteReelle('u-marc', donnees(), [], {})).toMatchObject({ estCreateur: false, estAdmin: true });
  });
  it('un compte quelconque n\'est ni l\'un ni l\'autre', () => {
    expect(identiteReelle('u-thomas', donnees(), [{ id: 'app' }], { app: 'member' })).toMatchObject({ estCreateur: false, estAdmin: false });
  });
});

describe('contexte et données visibles', () => {
  const base = identiteReelle('u-christelle', donnees(), [], {});

  it('sans simulation, les données sont renvoyées telles quelles et le créateur a toutes les équipes', () => {
    const d = donnees();
    const vue = construireVue(base, d, {}, null);
    expect(vue.donnees).toBe(d);
    expect(mesEquipes(vue.ctx)).toHaveLength(EQUIPES.length);
  });

  it('en simulation du rôle Projet, l\'identité est celle de la personne et les projets sont filtrés', () => {
    const vue = construireVue(base, donnees(), {}, { cle: 'projet', ressourceId: 'r-thomas' });
    expect(vue.ctx.estCreateur).toBe(false);
    expect(vue.ctx.userId).toBe('u-thomas');
    expect(monRole(vue.ctx)).toBe('projet');
    expect(mesEquipes(vue.ctx).map(e => e.id)).toEqual(['app']);
    expect(vue.donnees.projets.map(p => p.id)).toEqual(['p-app2']);
    expect(vue.donnees.droitsRoles).toHaveLength(MATRICE_PRODUCTION.length);
  });

  it('un compte sans équipe simulé n\'a aucune équipe', () => {
    const vue = construireVue(base, donnees(), {}, { cle: 'sansEquipe', ressourceId: null });
    expect(mesEquipes(vue.ctx)).toEqual([]);
    expect(vue.ctx.estAdmin).toBe(false);
  });

  it('la simulation du rôle Administrateur donne le périmètre « Tout »', () => {
    const vue = construireVue(base, donnees(), {}, { cle: 'admin', ressourceId: 'r-marc' });
    expect(vue.ctx.estAdmin).toBe(true);
  });
});
