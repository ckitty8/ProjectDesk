import { describe, expect, it } from 'vitest';
import { PROJETS, contexte } from './__fixtures__/donnees';
import {
  ecranAccueil, ecranOuvert, equipesGerees, estAdministrateurPrevu, estLectureSeule, maRessource, mesEquipes, monRole, monRoleSansAdmin, niveauDroit,
  niveauDuRole, ongletPermis, peutAffecterSur, peutGererEquipe, peutGererProjet, peutLireDailyProjet, peutModifierFiche, peutPiloterProjet,
  peutSaisirProjet, peutValiderEquipe, responsablesDe, roleDeLaFiche, suisChefDuProjet
} from './droits';
import type { ContexteDroits } from './droits';
import type { Ressource } from './types';

const projet = (code: string) => {
  const p = PROJETS.find(x => x.code === code);
  if (!p) throw new Error('projet inconnu : ' + code);
  return p;
};

// Thomas avec le rôle « Chef de projet » : la matrice lui donne « Oui » sur Projets, le périmètre décide du reste
const thomasChef = (): ContexteDroits => contexte({ rolesAcces: [{ ressourceId: 'r-thomas', role: 'chef' }] });

describe('rôle d’accès', () => {
  it('lit le rôle déclaré, sinon déduit utilisateur', () => {
    expect(monRole(contexte())).toBe('utilisateur');
    expect(monRole(thomasChef())).toBe('chef');
    expect(estLectureSeule(contexte({ rolesAcces: [{ ressourceId: 'r-thomas', role: 'lecture' }] }))).toBe(true);
  });

  it('déduit administrateur, puis responsable (owner / admin de l’équipe)', () => {
    expect(monRole(contexte({ estAdmin: true }))).toBe('admin');
    expect(monRole(contexte({ rolesEquipe: { app: 'owner' } }))).toBe('responsable');
    expect(roleDeLaFiche(contexte(), { id: 'r-anne', nom: 'Anne', equipeId: 'app' })).toBe('responsable');
  });

  it('prend le rôle de la carte pendant une simulation', () => {
    expect(monRole(contexte({ simulation: { cle: 'direction', ressourceId: 'r-thomas' } }))).toBe('direction');
    expect(maRessource(contexte({ simulation: { cle: 'chef', ressourceId: 'r-lena' } }))?.id).toBe('r-lena');
  });

  it('ne laisse jamais le créateur en lecture seule', () => {
    expect(estLectureSeule(contexte({ estCreateur: true, userId: 'u-christelle', rolesAcces: [{ ressourceId: 'r-christelle', role: 'lecture' }] }))).toBe(false);
  });
});

describe('matrice des droits', () => {
  it('lit le niveau d’un droit pour un rôle', () => {
    const ctx = contexte();
    expect(niveauDuRole(ctx, 'chef', 'projets')).toBe('oui');
    expect(niveauDuRole(ctx, 'utilisateur', 'projets')).toBe('non');
    expect(niveauDuRole(ctx, 'lecture', 'projets')).toBe('lecture');
  });

  it('donne « Oui » au créateur quoi que dise la matrice', () => {
    expect(niveauDroit(contexte({ estCreateur: true, userId: 'u-christelle' }), 'roles')).toBe('oui');
  });

  it('reprend le droit de repli quand le droit manque en base (migrations 037 et 038)', () => {
    const sansDroitProjets = contexte({ droitsRoles: contexte().droitsRoles.filter(d => d.droit !== 'suivi_ressources') });
    // suivi_ressources est absent : il reprend « general » (utilisateur : Oui)
    expect(niveauDuRole(sansDroitProjets, 'utilisateur', 'suivi_ressources')).toBe('oui');
    expect(niveauDuRole(sansDroitProjets, 'lecture', 'suivi_ressources')).toBe('lecture');
    // un droit inconnu de la configuration reste « Non »
    expect(niveauDuRole(contexte(), 'admin', 'droit_inexistant')).toBe('non');
  });

  it('masque un onglet dont le droit est « Non » et un écran dont tous les onglets sont « Non »', () => {
    const ctx = contexte();   // utilisateur
    expect(ongletPermis(ctx, 'dailyEquipes', 'fil')).toBe(true);
    expect(ongletPermis(ctx, 'dailyEquipes', 'synthese')).toBe(false);
    expect(ongletPermis(ctx, 'ecran_sans_droit', 'x')).toBe(true);
    expect(ecranOuvert(ctx, 'monAdmin')).toBe(false);
    expect(ecranOuvert(contexte({ estAdmin: true }), 'monAdmin')).toBe(true);
  });

  it('arrive sur le daily si le dashboard est fermé', () => {
    expect(ecranAccueil(contexte())).toBe('dashboard');
    const ferme = contexte({ droitsRoles: contexte().droitsRoles.map(d => (d.droit === 'suivi_dashboard' && d.role === 'utilisateur' ? { ...d, niveau: 'non' } : d)) });
    expect(ecranAccueil(ferme)).toBe('daily');
  });
});

describe('équipes et périmètre (migration 042)', () => {
  it('donne toutes les équipes au créateur, les siennes aux autres', () => {
    expect(mesEquipes(contexte({ estCreateur: true })).map(e => e.id)).toEqual(['pole', 'app', 'ia', 'amoa']);
    expect(mesEquipes(contexte()).map(e => e.id)).toEqual(['app']);
  });

  it('un simple membre ne gère aucune unité', () => {
    expect([...equipesGerees(contexte())]).toEqual([]);
  });

  it('un owner / admin gère son unité et ses sous-unités', () => {
    const direction = contexte({ rolesEquipe: { pole: 'admin' }, organisations: [{ id: 'pole' }] });
    expect([...equipesGerees(direction)].sort()).toEqual(['app', 'ia', 'pole']);
  });

  it('une personne désignée responsable (responsables_equipe) gère cette unité', () => {
    const anne = contexte({ userId: null, simulation: { cle: 'utilisateur', ressourceId: 'r-anne' } });
    expect([...equipesGerees(anne)]).toEqual(['ia']);
    expect(responsablesDe(anne, 'ia').map(r => r.id)).toEqual(['r-anne']);
  });

  it('en simulation, Responsable gère l’unité de la fiche, Direction son unité parente et ses sous-unités', () => {
    expect([...equipesGerees(contexte({ simulation: { cle: 'responsable', ressourceId: 'r-thomas' } }))]).toEqual(['app']);
    expect([...equipesGerees(contexte({ simulation: { cle: 'direction', ressourceId: 'r-thomas' } }))].sort()).toEqual(['app', 'ia', 'pole']);
  });

  it('l’administrateur et le créateur gèrent tout', () => {
    expect(equipesGerees(contexte({ estAdmin: true })).size).toBe(4);
    expect(equipesGerees(contexte({ estCreateur: true })).size).toBe(4);
  });
});

describe('gérer un projet et saisir ses sprints : le rôle unique de la personne (migration 054)', () => {
  it('Chef de projet : gère VISTA (affecté et chef désigné) mais pas CDO de sa propre équipe', () => {
    const ctx = thomasChef();
    expect(peutGererProjet(ctx, projet('APP-02'))).toBe(true);
    expect(peutSaisirProjet(ctx, projet('APP-02'))).toBe(true);
    expect(peutGererProjet(ctx, projet('APP-01'))).toBe(false);
    expect(peutSaisirProjet(ctx, projet('APP-01'))).toBe(false);
    expect(peutGererProjet(ctx, projet('IA-01'))).toBe(false);
    expect(peutAffecterSur(ctx, projet('APP-02'))).toBe(true);
  });

  it('Chef de projet désigné sur la fiche du projet sans affectation : il gère et saisit', () => {
    const ctx = contexte({ rolesAcces: [{ ressourceId: 'r-thomas', role: 'chef' }], affectations: [] });
    expect(peutGererProjet(ctx, projet('APP-02'))).toBe(true);
    expect(peutSaisirProjet(ctx, projet('APP-02'))).toBe(true);
  });

  it('Membre affecté sur un projet d’une autre équipe : il saisit sprints et MEP, il ne modifie ni n’affecte', () => {
    const cerine = contexte({ userId: 'u-cerine', rolesAcces: [{ ressourceId: 'r-cerine', role: 'membre' }] });
    expect(peutSaisirProjet(cerine, projet('IA-02'))).toBe(true);
    expect(peutGererProjet(cerine, projet('IA-02'))).toBe(false);
    expect(peutAffecterSur(cerine, projet('IA-02'))).toBe(false);
    expect(peutSaisirProjet(cerine, projet('IA-01'))).toBe(false);
  });

  it('un Chef de projet et un Membre non affectés ne font rien sur le projet', () => {
    const membre = contexte({ rolesAcces: [{ ressourceId: 'r-thomas', role: 'membre' }] });
    expect(peutSaisirProjet(membre, projet('APP-01'))).toBe(false);
  });

  it('la Lecture seule ne modifie rien, même affectée', () => {
    const lecture = contexte({ rolesAcces: [{ ressourceId: 'r-thomas', role: 'lecture' }] });
    expect(peutGererProjet(lecture, projet('APP-02'))).toBe(false);
    expect(peutSaisirProjet(lecture, projet('APP-02'))).toBe(false);
  });

  it('un responsable gère les projets de son unité et de ses sous-unités, pas ceux d’une autre équipe', () => {
    const responsable = contexte({ rolesEquipe: { app: 'owner' }, rolesAcces: [{ ressourceId: 'r-thomas', role: 'responsable' }] });
    expect(peutGererProjet(responsable, projet('APP-01'))).toBe(true);
    expect(peutGererProjet(responsable, projet('IA-01'))).toBe(false);
    expect(peutGererProjet(responsable, projet('AM-01'))).toBe(false);
  });

  it('l’utilisateur n’a aucun droit de modification (la matrice dit « Non »)', () => {
    expect(peutGererProjet(contexte(), projet('APP-02'))).toBe(false);
    expect(peutSaisirProjet(contexte(), projet('APP-02'))).toBe(false);
    expect(peutAffecterSur(contexte(), projet('APP-02'))).toBe(false);
  });

  it('l’administrateur gère, saisit et affecte partout', () => {
    const admin = contexte({ estAdmin: true, rolesAcces: [{ ressourceId: 'r-thomas', role: 'admin' }] });
    PROJETS.forEach(p => { expect(peutGererProjet(admin, p)).toBe(true); expect(peutSaisirProjet(admin, p)).toBe(true); });
    expect(peutAffecterSur(admin, projet('AM-01'))).toBe(true);
  });
});

describe('autres droits d’écriture', () => {
  it('modifier une fiche : membre de l’équipe (ou administrateur) avec le droit « Fiches »', () => {
    const anne = { id: 'r-anne', nom: 'Anne', equipeId: 'app' };
    const responsable = contexte({ rolesEquipe: { app: 'owner' }, rolesAcces: [{ ressourceId: 'r-thomas', role: 'responsable' }] });
    expect(peutModifierFiche(responsable, anne)).toBe(true);
    expect(peutModifierFiche(contexte(), anne)).toBe(false);
    expect(peutModifierFiche(responsable, { id: 'x', nom: 'X', equipeId: 'ia' })).toBe(false);
  });

  it('gérer une équipe et valider ses feuilles de temps : responsable de l’équipe et droit de la matrice', () => {
    const responsable = contexte({ rolesEquipe: { app: 'owner' }, rolesAcces: [{ ressourceId: 'r-thomas', role: 'responsable' }] });
    expect(peutGererEquipe(responsable, 'app')).toBe(true);
    expect(peutValiderEquipe(responsable, 'app')).toBe(true);
    expect(peutValiderEquipe(responsable, 'ia')).toBe(false);
    expect(peutValiderEquipe(contexte(), 'app')).toBe(false);
  });
});

describe('daily et pilotage d’un projet', () => {
  it('lit le daily des projets où l’on est affecté ou dont on est responsable', () => {
    expect(peutLireDailyProjet(contexte(), projet('APP-02'))).toBe(true);
    expect(peutLireDailyProjet(contexte(), projet('APP-01'))).toBe(false);
    const anne = contexte({ userId: null, simulation: { cle: 'utilisateur', ressourceId: 'r-anne' } });
    expect(peutLireDailyProjet(anne, projet('IA-01'))).toBe(true);
    expect(peutLireDailyProjet(anne, projet('AM-01'))).toBe(false);
  });

  it('responsable d’une unité parente : lit le daily des projets de ses sous-unités', () => {
    const pole = contexte({ rolesEquipe: { pole: 'owner' }, organisations: [{ id: 'pole' }] });
    expect(peutLireDailyProjet(pole, projet('APP-01'))).toBe(true);
    expect(peutLireDailyProjet(pole, projet('AM-01'))).toBe(false);
  });

  it('pilote un projet : chef du projet ou responsable, avec le droit « piloter »', () => {
    const projetRole = thomasChef();
    expect(suisChefDuProjet(projetRole, projet('APP-02'))).toBe(true);
    expect(peutPiloterProjet(projetRole, projet('APP-02'))).toBe(true);
    expect(peutPiloterProjet(projetRole, projet('APP-01'))).toBe(false);
    expect(peutPiloterProjet(contexte(), projet('APP-02'))).toBe(false);   // utilisateur : « piloter » = Non
  });

  it('la lecture seule ne pilote rien', () => {
    const lecture = contexte({ rolesAcces: [{ ressourceId: 'r-thomas', role: 'lecture' }] });
    expect(suisChefDuProjet(lecture, projet('APP-02'))).toBe(false);
  });
});

describe('administrateur cumulable (porteur, 2026-11-01)', () => {
  it('un administrateur hors mode administrateur garde le rôle de sa fiche', () => {
    const ctx = contexte({ peutAdministrer: true, estAdmin: false, rolesAcces: [{ ressourceId: 'r-thomas', role: 'chef' }] });
    expect(monRole(ctx)).toBe('chef');
    expect(monRoleSansAdmin(ctx)).toBe('chef');
  });

  it('en mode administrateur, le rôle est administrateur et « revenir à mon rôle » ramène au rôle de la fiche', () => {
    const ctx = contexte({ peutAdministrer: true, estAdmin: true, rolesAcces: [{ ressourceId: 'r-thomas', role: 'chef' }] });
    expect(monRole(ctx)).toBe('admin');
    expect(monRoleSansAdmin(ctx)).toBe('chef');
  });

  it('« revenir à mon rôle » tient compte du rôle prévu (choisi, pas encore appliqué) avant le rôle déduit', () => {
    const ctx = contexte({ peutAdministrer: true, estAdmin: true, rolesPrevus: [{ ressourceId: 'r-thomas', role: 'chef' }] });
    expect(monRoleSansAdmin(ctx)).toBe('chef');
  });

  it('le rôle d\'une fiche n\'est plus déduit « administrateur » : le statut est à part', () => {
    const ctx = contexte({ administrateurs: [{ userId: 'u-thomas' }] });
    expect(roleDeLaFiche(ctx, maRessource(ctx) as Ressource)).not.toBe('admin');
  });
});

describe('administrateur prévu (migration 047)', () => {
  const sansCompte: Ressource = { id: 'r-nouveau', nom: 'Nouveau', equipeId: 'app', userId: null };
  it('une fiche sans compte est prévue administrateur si elle figure dans administrateurs_prevus', () => {
    expect(estAdministrateurPrevu(contexte({ administrateursPrevus: [{ ressourceId: 'r-nouveau' }] }), sansCompte)).toBe(true);
    expect(estAdministrateurPrevu(contexte(), sansCompte)).toBe(false);
  });
  it('une fiche avec compte n\'est jamais « prévue » : son statut est immédiat', () => {
    const avecCompte = maRessource(contexte()) as Ressource;
    expect(estAdministrateurPrevu(contexte({ administrateursPrevus: [{ ressourceId: avecCompte.id }] }), avecCompte)).toBe(false);
  });
});

describe('un rôle par équipe (porteur, 2026-11-13)', () => {
  it('dans une équipe où je suis rattaché avec un rôle, c\'est ce rôle ; ailleurs, celui de ma fiche', () => {
    const base = { rolesAcces: [{ ressourceId: 'r-thomas', role: 'chef' }], rattachements: [{ equipeId: 'e-autre', ressourceId: 'r-thomas', role: 'responsable' }] };
    expect(monRoleSansAdmin(contexte({ ...base, equipeActive: 'e-autre' }))).toBe('responsable');
    expect(monRoleSansAdmin(contexte({ ...base, equipeActive: 'app' }))).toBe('chef');
  });
});
