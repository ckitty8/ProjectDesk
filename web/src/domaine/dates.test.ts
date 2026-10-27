import { describe, expect, it } from 'vitest';
import { ajouterJours, depuisIso, ecartJours, estJourOuvre, estWeekend, formatAvecAnnee, formatCourt, formatLong, joursDuMois, joursOuvresEntre,
  libelleMois, lundi, nombre, pourcent, versIso } from './dates';

describe('dates ISO', () => {
  it('convertit dans les deux sens sans décalage de fuseau', () => {
    expect(versIso(depuisIso('2026-03-29'))).toBe('2026-03-29');
    expect(versIso(depuisIso('2026-10-25'))).toBe('2026-10-25');
  });

  it('ajoute des jours en passant les fins de mois et d’année', () => {
    expect(ajouterJours('2026-12-30', 3)).toBe('2027-01-02');
    expect(ajouterJours('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('compte l’écart en jours', () => {
    expect(ecartJours('2026-09-14', '2026-09-28')).toBe(14);
    expect(ecartJours('2026-09-28', '2026-09-14')).toBe(-14);
  });

  it('reconnaît week-ends, fériés et jours ouvrés', () => {
    expect(estWeekend('2026-11-07')).toBe(true);
    expect(estWeekend('2026-11-09')).toBe(false);
    const feries = new Set(['2026-11-11']);
    expect(estJourOuvre('2026-11-11', feries)).toBe(false);
    expect(estJourOuvre('2026-11-12', feries)).toBe(true);
  });

  it('trouve le lundi de la semaine', () => {
    expect(lundi('2026-11-08')).toBe('2026-11-02');
    expect(lundi('2026-11-02')).toBe('2026-11-02');
  });

  it('liste les jours ouvrés entre deux dates', () => {
    expect(joursOuvresEntre('2026-11-06', '2026-11-10', new Set())).toEqual(['2026-11-06', '2026-11-09', '2026-11-10']);
    expect(joursOuvresEntre('2026-11-06', '2026-11-10', new Set(['2026-11-09']))).toEqual(['2026-11-06', '2026-11-10']);
  });

  it('donne tous les jours d’un mois, bissextile compris', () => {
    expect(joursDuMois(2026, 10)).toHaveLength(30);
    expect(joursDuMois(2028, 1)).toHaveLength(29);
  });

  it('affiche les dates à la française', () => {
    expect(formatCourt('2026-11-13')).toBe('13 nov.');
    expect(formatCourt(null)).toBe('—');
    expect(formatAvecAnnee('2026-03-02')).toBe('2 mars 2026');
    expect(formatLong('2026-11-13')).toBe('Vendredi 13 novembre 2026');
    expect(libelleMois(2026, 9)).toBe('octobre 2026');
  });

  it('affiche les nombres à la française', () => {
    expect(nombre(7.25)).toBe('7,3');
    expect(nombre(12)).toBe('12');
    expect(pourcent(84.6)).toBe('85%');
  });
});
