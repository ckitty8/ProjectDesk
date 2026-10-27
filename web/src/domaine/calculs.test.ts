import { describe, expect, it } from 'vitest';
import { absentsDuJour, anniversairesDuMois, avancementMoyen, capacitePeriode, capaciteScrum, estAnniversaire, estPresent, estPresentSur,
  heuresAttendues, heuresAttenduesMois, heuresJours, initiales, joursTravaillesMois, libellePresence, prochainCodeProjet, projetsActifs,
  projetsASurveiller, recapJoursTravailles, sprintDe, tauxOccupation } from './calculs';
import type { Absence, Projet, Ressource } from './types';

const AUCUN_FERIE = new Set<string>();
const personne = (surcharge: Partial<Ressource> = {}): Ressource => ({ id: 'x', nom: 'X', equipeId: 'e', ...surcharge });

describe('jours travaillés et congés', () => {
  it('compte 261 jours travaillés en 2026 sans absence, et 43 jours de reste pour un objectif de 218', () => {
    const recap = recapJoursTravailles('x', 2026, [], AUCUN_FERIE, 218);
    expect(recap.travailles).toBe(261);
    expect(recap.reste).toBe(43);
  });

  it('ne compte pas les fériés comme des congés (novembre 2026, demi-journée le 13)', () => {
    const absences: Absence[] = [{ ressourceId: 'x', jour: '2026-11-13', type: 'Congés validé', duree: 0.5 }];
    const m = joursTravaillesMois('x', 2026, 10, absences, new Set(['2026-11-01', '2026-11-11']));
    expect(m.conges).toBe(0.5);
    expect(m.feries).toBe(1);
    expect(m.travailles).toBe(19.5);
  });

  it('exclut les mois avant l’arrivée et proratise l’objectif (arrivée le 1er avril : 164,5 j)', () => {
    const recap = recapJoursTravailles('x', 2026, [], AUCUN_FERIE, 218, { dateArrivee: '2026-04-01' });
    expect(recap.mois[2]?.ouvres).toBe(0);
    expect(recap.mois[3]?.ouvres).toBe(22);
    expect(recap.objectif).toBe(164.5);
  });

  it('compte une demi-journée pour 0,5', () => {
    const absences: Absence[] = [{ ressourceId: 'x', jour: '2026-11-13', duree: 0.5 }, { ressourceId: 'x', jour: '2026-11-16' }];
    const m = joursTravaillesMois('x', 2026, 10, absences, AUCUN_FERIE);
    expect(m.conges).toBe(1.5);
  });
});

describe('présence', () => {
  it('respecte les dates d’arrivée et de départ (incluses)', () => {
    const r = personne({ dateArrivee: '2026-04-01', dateDepart: '2026-09-30' });
    expect(estPresent(r, '2026-03-31')).toBe(false);
    expect(estPresent(r, '2026-04-01')).toBe(true);
    expect(estPresent(r, '2026-09-30')).toBe(true);
    expect(estPresent(r, '2026-10-01')).toBe(false);
    expect(estPresentSur(r, '2026-09-30', '2026-10-31')).toBe(true);
    expect(estPresentSur(r, '2026-10-01', '2026-10-31')).toBe(false);
  });

  it('écrit la présence en clair, la date de fin primant', () => {
    expect(libellePresence({ dateDepart: '2026-09-30' }, '2026-10-26')).toBe('partie le 30 sept. 2026');
    expect(libellePresence({ dateDepart: '2026-12-31' }, '2026-10-26')).toBe('jusqu’au 31 déc. 2026');
    expect(libellePresence({ dateArrivee: '2026-12-01' }, '2026-10-26')).toBe('arrive le 1 déc. 2026');
    expect(libellePresence({ dateArrivee: '2026-03-23' }, '2026-10-26')).toBe('depuis le 23 mars 2026');
    expect(libellePresence({}, '2026-10-26')).toBe('');
  });
});

describe('capacité et heures', () => {
  it('ne compte pas les jours hors présence dans la capacité', () => {
    const r = personne({ capacite: 100, dateDepart: '2026-03-31' });
    expect(capacitePeriode([r], '2026-04-01', '2026-04-30', [], AUCUN_FERIE).theorique).toBe(0);
  });

  it('retire les absences de la capacité disponible et applique la capacité de la personne', () => {
    const r = personne({ id: 'a', capacite: 50 });
    const absences: Absence[] = [{ ressourceId: 'a', jour: '2026-11-03', duree: 1 }];
    const c = capacitePeriode([r], '2026-11-02', '2026-11-06', absences, AUCUN_FERIE);
    expect(c.theorique).toBe(2.5);
    expect(c.disponible).toBe(2);
  });

  it('calcule la capacité engageable Scrum', () => {
    const c = capaciteScrum([{ capacite: 100 }, { capacite: 100 }], 20);
    expect(c.ceremonies).toBe(3);
    expect(c.engageable).toBeCloseTo(13.6);
    expect(c.heures).toBeCloseTo(13.6 * 7.5);
  });

  it('calcule les heures attendues (fériés et demi-journée retirés, capacité appliquée)', () => {
    const lea = personne({ id: 'lea', capacite: 100 });
    const absences: Absence[] = [{ ressourceId: 'lea', jour: '2026-11-13', duree: 0.5 }];
    expect(heuresAttendues(lea, '2026-11-09', absences, new Set(['2026-11-11']))).toBe(3.5 * 7.5);
    expect(heuresAttenduesMois(personne({ capacite: 80 }), 2026, 10, [], AUCUN_FERIE)).toBeCloseTo(21 * 7.5 * 0.8);
  });

  it('additionne les heures saisies et calcule le taux d’occupation', () => {
    const r = personne({ id: 'a' });
    const temps = [{ ressourceId: 'a', projetId: 'p', jour: '2026-11-02', heures: 7.5 }, { ressourceId: 'a', projetId: 'p', jour: '2026-11-03', heures: '7.5' }];
    expect(heuresJours('a', ['2026-11-02', '2026-11-03'], temps).total).toBe(15);
    expect(tauxOccupation([r], '2026-11-02', temps, [], AUCUN_FERIE)).toBeCloseTo((15 / 37.5) * 100);
    expect(tauxOccupation([], '2026-11-02', temps, [], AUCUN_FERIE)).toBe(0);
  });

  it('compte les absents d’un groupe et son niveau', () => {
    const absences: Absence[] = [{ ressourceId: 'a', jour: '2026-11-02', duree: 1 }, { ressourceId: 'b', jour: '2026-11-02', duree: 0.5 }];
    expect(absentsDuJour(['a', 'b', 'c', 'd'], '2026-11-02', absences)).toEqual({ absents: 1.5, total: 4, niveau: 'partiel' });
    expect(absentsDuJour(['a', 'b'], '2026-11-02', absences).niveau).toBe('critique');
    expect(absentsDuJour(['c'], '2026-11-02', absences).niveau).toBe('aucun');
  });
});

describe('projets et sprints', () => {
  const projet = (surcharge: Partial<Projet>): Projet => ({ id: 'p', code: 'P-01', nom: 'P', equipeId: 'e', statut: 'En cours', ...surcharge });

  it('numérote les sprints de 2 semaines depuis le sprint de référence (S19 : 14 sept. 2026)', () => {
    expect(sprintDe('2026-09-14')).toEqual({ numero: 19, debut: '2026-09-14', fin: '2026-09-25' });
    expect(sprintDe('2026-10-01')).toEqual({ numero: 20, debut: '2026-09-28', fin: '2026-10-09' });
    expect(sprintDe('2026-09-13').numero).toBe(18);
  });

  it('retire les projets terminés des projets actifs et moyenne l’avancement', () => {
    const projets = [projet({ avancement: 40 }), projet({ statut: 'Terminé', avancement: 100 }), projet({ avancement: 60 })];
    expect(projetsActifs(projets)).toHaveLength(2);
    expect(avancementMoyen(projetsActifs(projets))).toBe(50);
  });

  it('repère les projets à surveiller : à risque, en retard, ou échéance dans les 30 jours', () => {
    const projets = [
      projet({ id: 'a', statut: 'À risque' }), projet({ id: 'b', statut: 'En retard' }), projet({ id: 'c', fin: '2026-11-10' }),
      projet({ id: 'd', fin: '2027-03-01' }), projet({ id: 'e', statut: 'Terminé', fin: '2026-11-10' }), projet({ id: 'f', fin: '2026-10-01' })
    ];
    expect(projetsASurveiller(projets, '2026-10-26').map(p => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('propose le code projet suivant d’une équipe', () => {
    expect(prochainCodeProjet('APP', [{ code: 'APP-01' }, { code: 'APP-07' }, { code: 'IA-12' }])).toBe('APP-08');
    expect(prochainCodeProjet('NEW', [])).toBe('NEW-01');
  });
});

describe('divers', () => {
  it('reconnaît les anniversaires sans tenir compte de l’année', () => {
    expect(estAnniversaire('1988-06-04', '2026-06-04')).toBe(true);
    expect(estAnniversaire('1988-06-04', '2026-06-05')).toBe(false);
    expect(estAnniversaire(null, '2026-06-04')).toBe(false);
  });

  it('liste les anniversaires d’un mois, triés par jour', () => {
    const gens = [personne({ id: 'a', dateNaissance: '1990-10-31' }), personne({ id: 'b', dateNaissance: '1985-10-03' }), personne({ id: 'c', dateNaissance: '1992-11-01' })];
    expect(anniversairesDuMois(gens, 9).map(r => r.id)).toEqual(['b', 'a']);
  });

  it('forme les initiales', () => {
    expect(initiales('Anne Caselli')).toBe('AC');
    expect(initiales('Nouha')).toBe('N');
    expect(initiales(null)).toBe('?');
  });
});
