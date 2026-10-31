import { describe, expect, it } from 'vitest';
import { ABSENCES, AFFECTATIONS, EQUIPES, PROJETS, RESSOURCES, contexte } from './__fixtures__/donnees';
import { absenceDe, auteurDaily, decalerJourOuvre, estInactive, membresDuDaily, misesEnProductionDe, modeleParEquipe, modeleParProjet,
  noteNonVide, personnesProposees, projetsAvecMembres, projetsAvecRoleDe, projetsDailyVisibles, projetsPourAnnuaire, ressourcesPresentes, sprintsDuProjet,
  unitesRacines } from './vues';

const d = { equipes: EQUIPES, ressources: RESSOURCES, projets: PROJETS, affectations: AFFECTATIONS };

describe('personnes présentes', () => {
  const partie = [{ id: 'x', nom: 'X', equipeId: 'app', dateDepart: '2026-09-30' }];
  it('une personne partie le 30/09 reste visible en septembre, pas en octobre', () => {
    expect(ressourcesPresentes({ ressources: partie }, '2026-09-01', '2026-09-30')).toHaveLength(1);
    expect(ressourcesPresentes({ ressources: partie }, '2026-10-01', '2026-10-31')).toHaveLength(0);
    expect(estInactive(partie[0] ?? {})).toBe(true);
  });
});

describe('projets d\'une personne', () => {
  it('liste ses affectations avec le rôle, puis les projets dont elle est chef inscrit sur la fiche', () => {
    const avecChef = { ...d, projets: [...PROJETS, { id: 'p-chef', code: 'X-1', nom: 'Chef seul', equipeId: 'app', statut: 'En cours', chefId: 'r-lena' }] };
    const noms = projetsAvecRoleDe(avecChef, 'r-lena').map(x => x.projet.id);
    expect(noms).toContain('p-chef');
    expect(projetsAvecRoleDe(avecChef, 'r-lena').find(x => x.projet.id === 'p-chef')?.role).toBe('Chef de projet');
  });
  it('annuaire : projets avec « PO » pour un chef, sinon responsable ou hors projet', () => {
    const anne = RESSOURCES.find(r => r.id === 'r-anne');      // responsable de l'équipe IA, sans projet attitré
    expect(projetsPourAnnuaire(contexte(), d, anne ?? RESSOURCES[0]!)).toEqual({ genre: 'responsable' });
    const thomas = RESSOURCES.find(r => r.id === 'r-thomas');
    expect(projetsPourAnnuaire(contexte(), d, thomas ?? RESSOURCES[0]!)).toEqual({ genre: 'projets', lignes: ['VISTA · PO'] });
    const christelle = RESSOURCES.find(r => r.id === 'r-christelle');
    expect(projetsPourAnnuaire(contexte(), { ...d, affectations: [], projets: [] }, christelle ?? RESSOURCES[0]!)).toEqual({ genre: 'aucun' });
  });
});

describe('unités', () => {
  it('directions d\'abord, puis équipes isolées', () => {
    const ids = unitesRacines([{ id: 'e', nom: 'E', parentId: null, type: 'equipe' }, { id: 'd', nom: 'D', parentId: null, type: 'direction' },
      { id: 'f', nom: 'F', parentId: 'd', type: 'equipe' }]).map(e => e.id);
    expect(ids).toEqual(['d', 'e']);
  });
});

describe('sprints et mises en production', () => {
  it('trie les sprints datés d\'un projet et ignore ceux sans dates', () => {
    const s = sprintsDuProjet([{ projetId: 'p', numero: 2, debut: '2026-10-12', fin: '2026-10-23' }, { projetId: 'p', numero: 1, debut: '2026-09-28', fin: '2026-10-09' },
      { projetId: 'p', numero: 3 }, { projetId: 'q', numero: 1, debut: '2026-01-01', fin: '2026-01-02' }], 'p');
    expect(s.map(x => x.numero)).toEqual([1, 2]);
  });
  it('trie les mises en production des projets demandés', () => {
    const m = misesEnProductionDe([{ projetId: 'p', jour: '2026-11-10' }, { projetId: 'p', jour: '2026-10-01' }, { projetId: 'q', jour: '2026-10-05' }], [{ id: 'p' }]);
    expect(m.map(x => x.jour)).toEqual(['2026-10-01', '2026-11-10']);
  });
});

describe('daily', () => {
  it('l\'auteur d\'une personne sans compte est « fiche:<id> »', () => {
    expect(auteurDaily({ id: 'r1', userId: null })).toBe('fiche:r1');
    expect(auteurDaily({ id: 'r1', userId: 'u1' })).toBe('u1');
  });
  it('ignore une note vide', () => {
    const notes = [{ userId: 'u1', projetId: 'p', jour: '2026-11-02', texte: '  ' }, { userId: 'u1', projetId: 'p', jour: '2026-11-03', texte: 'Hier : x' }];
    expect(noteNonVide(notes, { id: 'r', userId: 'u1' }, 'p', '2026-11-02')).toBeNull();
    expect(noteNonVide(notes, { id: 'r', userId: 'u1' }, 'p', '2026-11-03')?.texte).toBe('Hier : x');
  });
  it('trouve l\'absence d\'un jour', () => {
    const a = ABSENCES[0];
    expect(absenceDe(ABSENCES, a?.ressourceId ?? '', a?.jour ?? '')).toBe(a);
    expect(absenceDe(ABSENCES, 'inconnu', '2026-01-01')).toBeNull();
  });
  it('les membres attendus au daily excluent les lecteurs et les absents de la présence', () => {
    const projet = AFFECTATIONS.find(a => a.role !== 'Lecteur')?.projetId ?? '';
    const noms = membresDuDaily(d, projet, '2026-11-03').map(r => r.nom);
    const lecteurs = AFFECTATIONS.filter(a => a.projetId === projet && a.role === 'Lecteur').map(a => RESSOURCES.find(r => r.id === a.ressourceId)?.nom);
    lecteurs.forEach(n => expect(noms).not.toContain(n));
    expect(noms).toEqual([...noms].sort((x, y) => x.localeCompare(y)));
  });
  it('saute les week-ends d\'un jour ouvré à l\'autre', () => {
    expect(decalerJourOuvre('2026-11-06', 1)).toBe('2026-11-09');   // vendredi → lundi
    expect(decalerJourOuvre('2026-11-09', -1)).toBe('2026-11-06');
  });
  it('un projet terminé n\'attend pas de daily ; un administrateur voit les autres', () => {
    const ctx = contexte({ estAdmin: true });
    const projets = [...PROJETS, { id: 'p-fini', code: 'Z-9', nom: 'Fini', equipeId: 'app', statut: 'Terminé' }];
    const ids = projetsDailyVisibles(ctx, projets).map(p => p.id);
    expect(ids).not.toContain('p-fini');
    expect(ids.length).toBe(PROJETS.length);
  });
});

describe('modèle du calendrier', () => {
  const racine = EQUIPES.find(e => e.id === 'pole');
  const ia = EQUIPES.find(e => e.id === 'ia');
  it('par équipe : unité, responsable en tête, puis synthèse des projets', () => {
    const ctx = contexte({ responsablesEquipe: [{ equipeId: 'ia', ressourceId: 'r-lena' }] });
    const m = modeleParEquipe(ctx, d, '2026-11-01', '2026-11-30', ia ?? EQUIPES[0]!);
    expect(m[0]).toMatchObject({ genre: 'unite', niveau: 0 });
    const personnes = m.filter(e => e.genre === 'personne');
    expect(personnes[0]).toMatchObject({ responsable: true, niveau: 1 });
    expect(m.some(e => e.genre === 'intertitre')).toBe(true);
    expect(m.filter(e => e.genre === 'synthese').length).toBeGreaterThan(0);
  });
  it('descend dans les sous-unités avec un niveau de plus', () => {
    const m = modeleParEquipe(contexte(), d, '2026-11-01', '2026-11-30', racine ?? EQUIPES[0]!);
    expect(m.filter(e => e.genre === 'unite').map(e => e.niveau)).toEqual(expect.arrayContaining([0, 1]));
  });
  it('une unité vide n\'apparaît pas', () => {
    const vide = { id: 'vide', nom: 'Vide', parentId: null };
    expect(modeleParEquipe(contexte(), { ...d, equipes: [...EQUIPES, vide] }, '2026-11-01', '2026-11-30', vide)).toEqual([]);
  });
  it('par projet : titre, membres puis synthèse', () => {
    const projet = PROJETS.find(p => p.id === 'p-ia2');
    const m = modeleParProjet(d, '2026-11-01', '2026-11-30', projet ?? PROJETS[0]!);
    expect(m.map(e => e.genre)).toEqual(['projet', 'personne', 'personne', 'synthese']);
    expect(projetsAvecMembres(d).map(p => p.id)).toEqual(expect.arrayContaining(['p-ia2', 'p-app2']));
  });
});

describe('personnes proposées', () => {
  it('toutes les personnes présentes, celles de l\'équipe d\'abord, avec équipe et poste', () => {
    const p = personnesProposees({ equipes: EQUIPES, ressources: [
      { id: 'a', nom: 'Zoé', equipeId: 'ia', poste: 'Dév' }, { id: 'b', nom: 'Alain', equipeId: 'app' }, { id: 'c', nom: 'Parti', equipeId: 'ia', dateDepart: '2026-01-01' }] }, 'ia', '2026-11-04');
    expect(p).toEqual([{ valeur: 'a', libelle: 'Zoé — IA · Dév' }, { valeur: 'b', libelle: 'Alain — Applications' }]);
  });
});
