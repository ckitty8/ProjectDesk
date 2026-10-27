import { describe, expect, it } from 'vitest';
import { contexte } from './__fixtures__/donnees';
import { ROLES_CHOISISSABLES } from './config';
import type { ContexteDroits } from './droits';
import { menusDuRole, resumeDuRole } from './menus';
import type { Menu } from './menus';

/** Libellés de tous les menus et sous-menus d'une liste */
const libelles = (menus: readonly Menu[]): string[] => menus.flatMap(m => [m.libelle, ...(m.enfants ?? []).map(e => e.libelle)]);

/** Ce que la matrice ouvre, relu directement dans les lignes de la table (sans passer par le code des menus) */
function attendu(ctx: ContexteDroits, role: string) {
  const ouvert = (droit: string) => ctx.droitsRoles.find(d => d.role === role && d.droit === droit)?.niveau !== 'non';
  const dashboard = role !== 'lecture';   // Mon dashboard est fermé en Lecture seule
  return {
    'Dashboard général': ouvert('suivi_dashboard'),
    'Daily des équipes': ouvert('daily_equipes') && (ouvert('onglet_daily_fil') || ouvert('onglet_daily_synthese')),
    'Timesheet': ouvert('suivi_timesheet'),
    'Mises en production': dashboard && ouvert('projets'),
    'Sprints': dashboard && ouvert('onglet_admin_sprints'),
    'Congés': dashboard && (ouvert('onglet_conges_grille') || ouvert('onglet_conges_recap')),
    'Liste des ressources': dashboard && (ouvert('fiches_ressources') || ouvert('affecter')),
    'Saisir mes heures': dashboard && ouvert('mon_dashboard'),
    'Daily': dashboard && ouvert('mon_dashboard'),
    'Trucs et astuces': dashboard && (ouvert('onglet_astuces_agile') || ouvert('onglet_astuces_roadmap') || ouvert('onglet_astuces_test_learn')),
    'Administration': dashboard && ['comptes', 'onglet_admin_equipes', 'onglet_admin_referentiels', 'onglet_admin_feries',
      'onglet_admin_envoi_daily', 'roles'].some(ouvert)
  };
}

describe('menus de la barre latérale = ce que la matrice ouvre', () => {
  ROLES_CHOISISSABLES.forEach(role => {
    it(`rôle ${role}`, () => {
      const ctx = contexte();
      const { suivi, moi } = menusDuRole(ctx, role);
      const affiches = new Set([...libelles(suivi), ...libelles(moi)]);
      Object.entries(attendu(ctx, role)).forEach(([menu, doitEtreLa]) => {
        expect(affiches.has(menu), `${role} : « ${menu} » ${doitEtreLa ? 'devrait être affiché' : 'ne devrait pas être affiché'}`).toBe(doitEtreLa);
      });
    });
  });

  it('le menu parent Projets et Roadmap n’existe que si l’un de ses sous-menus est ouvert', () => {
    const ctx = contexte();
    expect(menusDuRole(ctx, 'utilisateur').moi.some(m => m.id === 'mesProjets')).toBe(false);
    expect(menusDuRole(ctx, 'projet').moi.find(m => m.id === 'mesProjets')?.enfants?.map(e => e.libelle)).toEqual(['Mises en production', 'Sprints']);
  });

  it('Lecture seule : Mon dashboard fermé, Suivi consultable', () => {
    const { suivi, moi } = menusDuRole(contexte(), 'lecture');
    expect(moi).toEqual([]);
    expect(libelles(suivi)).toContain('Dashboard général');
  });
});

describe('le droit « Daily · Saisir mes heures » à Non ne ferme que Daily et Saisir mes heures (porteur 2026-10-26)', () => {
  it('Responsable garde Congés, Trucs et astuces et Administration', () => {
    const base = contexte();
    const sansDaily = contexte({ droitsRoles: base.droitsRoles.map(d => (d.role === 'responsable' && d.droit === 'mon_dashboard' ? { ...d, niveau: 'non' } : d)) });
    const affiches = libelles(menusDuRole(sansDaily, 'responsable').moi);
    expect(affiches).not.toContain('Daily');
    expect(affiches).not.toContain('Saisir mes heures');
    expect(affiches).toEqual(expect.arrayContaining(['Gestion des ressources', 'Congés', 'Trucs et astuces', 'Administration']));
  });
});

describe('mes menus (sans rôle précisé)', () => {
  it('suit mon rôle courant', () => {
    expect(libelles(menusDuRole(contexte()).moi)).toEqual(libelles(menusDuRole(contexte(), 'utilisateur').moi));
  });

  it('le menu Administration créateur n’apparaît que pour le créateur, jamais comme menu de rôle', () => {
    const createur = contexte({ estCreateur: true, userId: 'u-christelle' });
    expect(libelles(menusDuRole(createur).moi)).toContain('Administration créateur');
    expect(libelles(menusDuRole(createur, 'admin').moi)).not.toContain('Administration créateur');
    expect(libelles(menusDuRole(contexte()).moi)).not.toContain('Administration créateur');
  });
});

describe('description d’un rôle', () => {
  it('est calculée d’après la matrice : Utilisateur n’a ni Projets et Roadmap ni Liste des ressources', () => {
    const texte = resumeDuRole(contexte(), 'utilisateur');
    expect(texte).toContain('Mon dashboard : Daily');
    expect(texte).not.toContain('Projets et Roadmap (Mises');
    expect(texte).not.toContain('Liste des ressources');
    expect(texte).toContain('Congés');
  });

  it('indique « aucun menu » quand rien n’est ouvert', () => {
    expect(resumeDuRole(contexte(), 'lecture')).toContain('Mon dashboard : aucun menu');
  });
});
