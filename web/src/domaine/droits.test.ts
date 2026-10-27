import { describe, expect, it } from 'vitest';
import { PROJETS, contexte } from './__fixtures__/donnees';
import { ecranAccueil, ecranOuvert, equipesGerees, estLectureSeule, maRessource, mesEquipes, monRole, niveauDroit, niveauDuRole, ongletPermis,
  peutAffecterSur, peutEditerProjet, peutGererEquipe, peutLireDailyProjet, peutModifierFiche, peutPiloterProjet, peutValiderEquipe, responsablesDe,
  roleDeLaFiche, suisChefDuProjet, travailleSurLeProjet } from './droits';
import type { ContexteDroits } from './droits';

const projet = (code: string) => {
  const p = PROJETS.find(x => x.code === code);
  if (!p) throw new Error('projet inconnu : ' + code);
  return p;
};

// Thomas avec le rôle « Projet » : la matrice lui donne « Oui » sur Projets, le périmètre décide du reste
const thomasProjet = (): ContexteDroits => contexte({ rolesAcces: [{ ressourceId: 'r-thomas', role: 'projet' }] });

describe('rôle d’accès', () => {
  it('lit le rôle déclaré, sinon déduit utilisateur', () => {
    expect(monRole(contexte())).toBe('utilisateur');
    expect(monRole(thomasProjet())).toBe('projet');
    expect(estLectureSeule(contexte({ rolesAcces: [{ ressourceId: 'r-thomas', role: 'lecture' }] }))).toBe(true);
  });

  it('déduit administrateur, puis responsable (owner / admin de l’équipe)', () => {
    expect(monRole(contexte({ estAdmin: true }))).toBe('admin');
    expect(monRole(contexte({ rolesEquipe: { app: 'owner' } }))).toBe('responsable');
    expect(roleDeLaFiche(contexte(), { id: 'r-anne', nom: 'Anne', equipeId: 'app' })).toBe('responsable');
  });

  it('prend le rôle de la carte pendant une simulation', () => {
    expect(monRole(contexte({ simulation: { cle: 'direction', ressourceId: 'r-thomas' } }))).toBe('direction');
    expect(maRessource(contexte({ simulation: { cle: 'projet', ressourceId: 'r-lena' } }))?.id).toBe('r-lena');
  });

  it('ne laisse jamais le créateur en lecture seule', () => {
    expect(estLectureSeule(contexte({ estCreateur: true, userId: 'u-christelle', rolesAcces: [{ ressourceId: 'r-christelle', role: 'lecture' }] }))).toBe(false);
  });
});

describe('matrice des droits', () => {
  it('lit le niveau d’un droit pour un rôle', () => {
    const ctx = contexte();
    expect(niveauDuRole(ctx, 'projet', 'projets')).toBe('oui');
    expect(niveauDuRole(ctx, 'utilisateur', 'projets')).toBe('non');
    expect(niveauDuRole(ctx, 'lecture', 'projets')).toBe('lecture');
  });

  it('donne « Oui » au créateur quoi que dise la matrice', () => {
    expect(niveauDroit(contexte({ estCreateur: true, userId: 'u-christelle' }), 'roles')).toBe('oui');
  });

  it('reprend le droit de repli quand le droit manque en base (migrations 037 et 038)', () => {
    const sansDroitProjets = contexte({ droitsRoles: contexte().droitsRoles.filter(d => d.droit !== 'suivi_projets') });
    // suivi_projets est absent : il reprend « general » (utilisateur : Oui)
    expect(niveauDuRole(sansDroitProjets, 'utilisateur', 'suivi_projets')).toBe('oui');
    expect(niveauDuRole(sansDroitProjets, 'lecture', 'suivi_projets')).toBe('lecture');
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

describe('modifier un projet : seulement ceux où l’on est affecté ou que l’on gère', () => {
  it('Thomas (rôle Projet) modifie VISTA, dont il est chef, mais pas CDO de sa propre équipe', () => {
    const ctx = thomasProjet();
    expect(peutEditerProjet(ctx, projet('APP-02'))).toBe(true);
    expect(peutEditerProjet(ctx, projet('APP-01'))).toBe(false);
    expect(peutEditerProjet(ctx, projet('IA-01'))).toBe(false);
    expect(travailleSurLeProjet(ctx, projet('APP-01'))).toBe(false);
  });

  it('une personne affectée Membre sur un projet d’une autre équipe peut le modifier', () => {
    const cerine = contexte({ userId: 'u-cerine', rolesAcces: [{ ressourceId: 'r-cerine', role: 'projet' }] });
    expect(peutEditerProjet(cerine, projet('IA-02'))).toBe(true);
    expect(peutEditerProjet(cerine, projet('IA-01'))).toBe(false);
  });

  it('un Lecteur ne modifie pas', () => {
    const lecteur = contexte({ rolesAcces: [{ ressourceId: 'r-thomas', role: 'projet' }],
      affectations: [{ projetId: 'p-app1', ressourceId: 'r-thomas', role: 'Lecteur' }] });
    expect(peutEditerProjet(lecteur, projet('APP-01'))).toBe(false);
  });

  it('un responsable modifie les projets de son unité et de ses sous-unités, pas ceux d’une autre équipe', () => {
    const responsable = contexte({ rolesEquipe: { app: 'owner' }, rolesAcces: [{ ressourceId: 'r-thomas', role: 'responsable' }] });
    expect(peutEditerProjet(responsable, projet('APP-01'))).toBe(true);
    expect(peutEditerProjet(responsable, projet('IA-01'))).toBe(false);
    expect(peutEditerProjet(responsable, projet('AM-01'))).toBe(false);
  });

  it('l’utilisateur n’a aucun droit de modification (la matrice dit « Non »)', () => {
    expect(peutEditerProjet(contexte(), projet('APP-02'))).toBe(false);
    expect(peutAffecterSur(contexte(), projet('APP-02'))).toBe(false);
  });

  it('l’administrateur modifie et affecte partout', () => {
    const admin = contexte({ estAdmin: true, rolesAcces: [{ ressourceId: 'r-thomas', role: 'admin' }] });
    PROJETS.forEach(p => expect(peutEditerProjet(admin, p)).toBe(true));
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
    const projetRole = thomasProjet();
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
