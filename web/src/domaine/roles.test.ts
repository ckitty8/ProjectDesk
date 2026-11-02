/* ============================================================
   Cohérence des rôles, des profils et des droits (revue qualité 2026-11-02)
   Ce ne sont pas des tests d'une fonction mais des garde-fous : un rôle ajouté à moitié, un droit retiré du code mais encore demandé quelque part,
   une ligne de matrice oubliée ou un référentiel perdu entre deux onglets feraient apparaître un bug (menu absent, droit « Non » par défaut…).
   ============================================================ */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MATRICE_PRODUCTION } from './__fixtures__/matrice';
import { DROITS, LIBELLES_ROLES, MENUS_SANS_DROIT, PERIMETRES, REFERENTIELS_ABANDONNES, REFERENTIELS_RESSOURCES, ROLES_ACCES, ROLES_ATTRIBUABLES, ROLES_CHOISISSABLES } from './config';
import { MENU_GENERAL, MENU_MOI } from './menus';
import { referentielsAffiches } from './referentiels';
import type { Referentiel } from './types';

/** Tous les fichiers source (hors tests) du dossier web/src */
function fichiersSource(dossier: string): string[] {
  return readdirSync(dossier).flatMap(nom => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return nom === '__fixtures__' ? [] : fichiersSource(chemin);
    return /\.tsx?$/.test(nom) && !/\.test\.tsx?$/.test(nom) ? [chemin] : [];
  });
}

describe('rôles d\'accès', () => {
  it('chaque rôle choisissable a un libellé, une couleur et un périmètre', () => {
    ROLES_CHOISISSABLES.forEach(r => {
      expect(LIBELLES_ROLES[r], r).toBeTruthy();
      expect(ROLES_ACCES[r].libelle, r).toBe(LIBELLES_ROLES[r]);
      expect(PERIMETRES[r], r).toBeTruthy();
    });
  });
  it('l\'Administrateur se donne par une case, pas dans la liste des rôles attribuables', () => {
    expect(ROLES_ATTRIBUABLES).not.toContain('admin');
    expect(ROLES_ATTRIBUABLES).toHaveLength(ROLES_CHOISISSABLES.length - 1);
  });
});

describe('droits de la matrice', () => {
  const cles = DROITS.map(d => d.cle);
  it('les clés sont uniques et chaque onglet (écran + identifiant) n\'a qu\'un droit', () => {
    expect(new Set(cles).size).toBe(cles.length);
    const onglets = DROITS.filter(d => d.ecran).map(d => `${d.ecran}/${d.id}`);
    expect(new Set(onglets).size).toBe(onglets.length);
  });
  it('un droit de repli renvoie à un droit qui existe (ou à l\'ancien droit commun « general »)', () => {
    DROITS.filter(d => d.repli).forEach(d => expect([...cles, 'general'], `${d.cle} → ${d.repli}`).toContain(d.repli));
  });
  it('la matrice de production a une ligne pour chaque droit et chaque rôle : jamais de « Non » par oubli', () => {
    DROITS.forEach(d => ROLES_CHOISISSABLES.forEach(r => {
      expect(MATRICE_PRODUCTION.some(l => l.droit === d.cle && l.role === r), `${d.cle} × ${r}`).toBe(true);
    }));
  });
  it('tout droit demandé par le code (aDroit, droit d\'un menu) est défini dans la matrice', () => {
    const demandes = new Set<string>();
    fichiersSource(join(__dirname, '..')).forEach(f => {
      const texte = readFileSync(f, 'utf-8');
      [...texte.matchAll(/aDroit\(ctx, '([a-z_]+)'\)/g)].forEach(m => demandes.add(m[1] ?? ''));
      [...texte.matchAll(/niveauDroit\(ctx, '([a-z_]+)'\)/g)].forEach(m => demandes.add(m[1] ?? ''));
    });
    [...MENU_GENERAL, ...MENU_MOI].forEach(m => {
      [m.droit, ...(m.enfants ?? []).map(e => e.droit)].flat().forEach(d => { if (d) demandes.add(d); });
    });
    demandes.delete('');
    expect(demandes.size).toBeGreaterThan(5);
    demandes.forEach(d => expect([...cles, 'general'], `droit demandé « ${d} » absent de la matrice`).toContain(d));
  });
  it('un menu ouvert à tous (MENUS_SANS_DROIT) n\'a pas de droit de menu dans la matrice', () => {
    MENUS_SANS_DROIT.forEach(m => {
      const lignes = DROITS.filter(d => d.section === m.section && d.menu === m.menu && !d.onglet);
      expect(lignes, `${m.section} › ${m.menu}`).toEqual([]);
    });
  });
});

describe('référentiels rangés entre Référentiels et Ressources (Administration)', () => {
  const ref = (id: string): Referentiel => ({ id, nom: id });
  const tous = ['stp', 'role', 'abs', 'poste', 'contrat', 'methode'].map(ref);
  it('Ressources ne montre que les profils', () => {
    expect(referentielsAffiches(tous, REFERENTIELS_RESSOURCES).map(r => r.id)).toEqual(['poste']);
  });
  it('Référentiels montre tous les autres', () => {
    expect(referentielsAffiches(tous, undefined, REFERENTIELS_RESSOURCES).map(r => r.id)).toEqual(['stp', 'abs', 'contrat', 'methode']);
  });
  it('le référentiel abandonné « role » (rôles par projet) ne s’affiche nulle part', () => {
    expect(REFERENTIELS_ABANDONNES).toEqual(['role']);
    expect(referentielsAffiches(tous).map(r => r.id)).not.toContain('role');
  });
  it('chaque référentiel (hors abandonné) apparaît dans un onglet et un seul', () => {
    const ici = referentielsAffiches(tous, undefined, REFERENTIELS_RESSOURCES), la = referentielsAffiches(tous, REFERENTIELS_RESSOURCES);
    expect([...ici, ...la].map(r => r.id).sort()).toEqual(tous.filter(r => !REFERENTIELS_ABANDONNES.includes(r.id)).map(r => r.id).sort());
  });
});
