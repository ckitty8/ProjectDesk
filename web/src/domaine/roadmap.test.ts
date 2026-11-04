import { describe, expect, it } from 'vitest';
import { NB_DEMANDES_EXEMPLE, choixSprintVersion, libelleMep, detailScore, raisonDuRang, blocsDuTableau, colonnesOrdonnees, colonnesSaisissables, demandesClassees, demandesDuProjet, libelleSprint, valeursAEnregistrer, echangeOrdre, estListeRoadmap, nouvelIdListe, ordreEnFin, resumeValeurs, scoreAffiche, scoreDemande } from './roadmap';
import type { ColonneRoadmap, DemandeRoadmap, ValeurReferentiel } from './types';

const col = (id: string, bloc: ColonneRoadmap['bloc'], ordre: number, type: ColonneRoadmap['type'] = 'libre'): ColonneRoadmap =>
  ({ id, libelle: id, bloc, type, ordre, format: type === 'libre' ? 'texte' : null });
// Volontairement dans le désordre : le tri suit l'ordre des blocs puis « ordre »
const COLONNES = [col('score', 'priorisation', 12, 'calcul'), col('statut', 'developpement', 14, 'liste'), col('demande', 'identification', 2),
  col('rang', 'identification', 1, 'calcul'), col('priorite', 'priorisation', 9, 'liste')];
const valeur = (libelle: string): ValeurReferentiel => ({ referentielId: 'rdm_x', libelle, couleur: '#4A5363', actif: true });

describe('colonnes du tableau Roadmap', () => {
  it('regroupe par bloc, dans l’ordre des blocs puis des colonnes, sans bloc vide', () => {
    expect(blocsDuTableau(COLONNES).map(b => [b.titre, b.colonnes.map(c => c.id)])).toEqual([
      ['Identification de la demande', ['rang', 'demande']], ['Priorisation', ['priorite', 'score']], ['Développement & recette', ['statut']]]);
    expect(colonnesOrdonnees(COLONNES).map(c => c.id)).toEqual(['rang', 'demande', 'priorite', 'score', 'statut']);
    expect(blocsDuTableau([])).toEqual([]);
  });

  it('déplace une colonne dans son bloc seulement', () => {
    expect(echangeOrdre(COLONNES, 'demande', -1)).toEqual([{ id: 'demande', ordre: 1 }, { id: 'rang', ordre: 2 }]);
    expect(echangeOrdre(COLONNES, 'demande', 1)).toBeNull();   // dernière de son bloc : ne passe pas dans Priorisation
    expect(echangeOrdre(COLONNES, 'rang', -1)).toBeNull();
    expect(echangeOrdre(COLONNES, 'inconnue', 1)).toBeNull();
  });

  it('départage deux colonnes de même ordre', () => {
    const egales = [col('a', 'cadrage', 5), col('b', 'cadrage', 5)];
    expect(echangeOrdre(egales, 'a', 1)).toEqual([{ id: 'a', ordre: 6 }, { id: 'b', ordre: 5 }]);
  });

  it('range une colonne ajoutée après les autres', () => {
    expect(ordreEnFin(COLONNES)).toBe(15);
    expect(ordreEnFin([])).toBe(1);
  });

  it('reconnaît et fabrique les identifiants des listes de la Roadmap', () => {
    expect(nouvelIdListe('1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed')).toBe('rdm_1b9d6bcdbbfd');
    expect(estListeRoadmap('rdm_statut')).toBe(true);
    expect(estListeRoadmap('stp')).toBe(false);
  });

  it('résume les valeurs d’une liste déroulante', () => {
    expect(resumeValeurs([])).toBe('Aucune valeur');
    expect(resumeValeurs(['Oui', 'Non'].map(valeur))).toBe('Oui, Non');
    expect(resumeValeurs(['1', '2', '3', '4', '5'].map(valeur))).toBe('5 valeurs');
  });
});

describe('score et rang de traitement DSI des demandes', () => {
  // Colonnes repérées par leur clé technique ; l'id est volontairement différent de la clé
  const cles = ['strategique', 'priorite', 'impactClient', 'impactCollaborateur', 'complexite'];
  const colonnes = cles.map((cle, i) => ({ ...col('c' + i, 'priorisation', i), cle }));
  const demande = (id: string, v: Record<string, string>, creeLe = '2026-01-01'): DemandeRoadmap =>
    ({ id, creeLe, valeurs: Object.fromEntries(Object.entries(v).map(([cle, val]) => ['c' + cles.indexOf(cle), val])) });
  // Les 3 demandes de 2026 du fichier CDO-ROADMAP-NEW (migration 057)
  const mandat = demande('mandat', { strategique: 'Non', priorite: '1', impactClient: '1', impactCollaborateur: '3' }, '2026-07-24');
  const videos = demande('videos', { strategique: 'Non', priorite: '1', impactClient: '1', impactCollaborateur: '3', complexite: '2' }, '2026-07-01');
  const flux = demande('flux', { strategique: 'Oui', priorite: '1', impactClient: '3', impactCollaborateur: '2', complexite: '2' }, '2026-06-15');

  it('calcule le score comme l’Excel, et rien sans complexité', () => {
    expect(scoreDemande(videos, colonnes)).toBeCloseTo(3.5);
    expect(scoreDemande(flux, colonnes)).toBeCloseTo(5.25);
    expect(scoreDemande(mandat, colonnes)).toBeNull();
    expect(scoreAffiche(5.25)).toBe('5,25');
    expect(scoreAffiche(3.4999999999999996)).toBe('3,5');
  });

  it('classe : stratégique d’abord, puis priorité, puis score, sans score en dernier', () => {
    expect(demandesClassees([mandat, videos, flux], colonnes).map(x => [x.demande.id, x.rang])).toEqual([['flux', 1], ['videos', 2], ['mandat', 3]]);
    const prio2 = demande('p2', { strategique: 'Non', priorite: '2', impactClient: '3', impactCollaborateur: '3', complexite: '1' });
    expect(demandesClassees([prio2, mandat], colonnes).map(x => x.demande.id)).toEqual(['mandat', 'p2']);   // priorité avant score
  });

  it('détaille le calcul du score et la raison de chaque rang (exemple d’Administration › Roadmap › Calculs)', () => {
    expect(detailScore(flux, colonnes)).toBe('(0,5 × 3 + 0,3 × 2) ÷ (0,2 × 2) = 2,1 ÷ 0,4 = 5,25');
    expect(detailScore(videos, colonnes)).toBe('(0,5 × 1 + 0,3 × 3) ÷ (0,2 × 2) = 1,4 ÷ 0,4 = 3,5');
    expect(detailScore(mandat, colonnes)).toBeNull();
    const classees = demandesClassees([mandat, videos, flux], colonnes);
    expect(classees.map((_, i) => raisonDuRang(classees, i, colonnes))).toEqual([
      'Stratégique : passe en tête',
      'Non stratégique : après les demandes stratégiques (priorité 1, score 3,5)',
      'Même priorité, mais sans score : après celles qui en ont un']);
    const p2 = demande('p2', { strategique: 'Non', priorite: '2' });
    const autres = demandesClassees([videos, p2], colonnes);
    expect(raisonDuRang(autres, 0, colonnes)).toBe('En tête : priorité 1, score 3,5');
    expect(raisonDuRang(autres, 1, colonnes)).toBe('Priorité 2 : après les priorités plus hautes');
    expect(NB_DEMANDES_EXEMPLE).toBe(3);
  });

  it('à égalité, la plus ancienne d’abord', () => {
    const a = demande('a', { priorite: '3' }, '2026-02-01'), b = demande('b', { priorite: '3' }, '2026-01-01');
    expect(demandesClassees([a, b], colonnes).map(x => x.demande.id)).toEqual(['b', 'a']);
  });
});

describe('saisie des demandes', () => {
  it('ne propose pas les colonnes calculées', () => {
    expect(colonnesSaisissables(COLONNES).map(c => c.id)).toEqual(['demande', 'priorite', 'statut']);
  });

  it('enregistre les valeurs rognées, sans les vides ni les colonnes supprimées', () => {
    expect(valeursAEnregistrer({ demande: '  Ajouter un flux ', statut: '', priorite: null, ancienne: 'x' }, COLONNES)).toEqual({ demande: 'Ajouter un flux' });
  });

  it('nomme un sprint par son nom, sinon par son numéro', () => {
    expect(libelleSprint({ nom: 'V2.0', numeroSprint: 20, numero: 2 })).toBe('V2.0');
    expect(libelleSprint({ nom: ' ', numeroSprint: 19, numero: 1 })).toBe('Sprint 19');
    expect(libelleSprint({ nom: null, numeroSprint: null, numero: 3 })).toBe('Sprint n°3');
  });

  it('garde le rang global en filtrant par projet', () => {
    const d = (id: string, projetId: string | null) => ({ demande: { id, projetId, valeurs: {} }, rang: 0, score: null });
    const classees = [d('a', 'p1'), d('b', null), d('c', 'p1')].map((x, i) => ({ ...x, rang: i + 1 }));
    expect(demandesDuProjet(classees, 'p1').map(x => [x.demande.id, x.rang])).toEqual([['a', 1], ['c', 3]]);
    expect(demandesDuProjet(classees, null).map(x => x.demande.id)).toEqual(['b']);
  });
});

describe('liste Sprint / version : sprints et mises en production du projet', () => {
  const sprints = [{ projetId: 'p1', numero: 2, nom: 'V2.0', debut: '2026-09-28' }, { projetId: 'p1', numero: 1, nom: 'V1.9', debut: '2026-09-14' },
    { projetId: 'p2', numero: 1, nom: 'Autre', debut: '2026-09-01' }];
  const meps = [{ projetId: 'p1', jour: '2026-11-06', version: 'V2.1' }, { projetId: 'p1', jour: '2026-10-09', version: null }, { projetId: 'p2', jour: '2026-10-01', version: 'X' }];
  it('liste les sprints puis les MEP du projet, chacun dans l’ordre des dates', () => {
    expect(choixSprintVersion(sprints, meps, 'p1')).toEqual([
      { groupe: 'Sprints', libelle: 'V1.9' }, { groupe: 'Sprints', libelle: 'V2.0' },
      { groupe: 'Mises en production', libelle: 'MEP du 9 oct. 2026', jour: '2026-10-09' },
      { groupe: 'Mises en production', libelle: 'MEP V2.1 du 6 nov. 2026', jour: '2026-11-06' }]);
    expect(choixSprintVersion(sprints, meps, null)).toEqual([]);
    expect(libelleMep({ version: ' V3 ', jour: '2026-12-01' })).toBe('MEP V3 du 1 déc. 2026');
  });
});
