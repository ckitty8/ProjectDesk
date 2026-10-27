import { describe, expect, it } from 'vitest';
import { CLES_TABLES, TABLES, couleurSure, filtresDe, ordreDe } from './tables';

describe('tables chargées', () => {
  it('associe chaque clé à un nom de table distinct', () => {
    expect(new Set(Object.values(TABLES)).size).toBe(CLES_TABLES.length);
    expect(TABLES.valeurs).toBe('valeurs_referentiel');
    expect(TABLES.rattachements).toBe('membres_equipe');
  });

  it('ordonne par tri métier puis clé unique (pagination stable)', () => {
    expect(ordreDe('projets')).toBe('code,id');
    expect(ordreDe('absences')).toBe('ressource_id,jour');
    expect(ordreDe('joursFeries')).toBe('jour,jour');
    expect(ordreDe('droitsRoles')).toBe('role,droit');
  });

  it('limite les notes de daily aux 90 derniers jours', () => {
    expect(filtresDe('notesProjet', '2026-10-27').jour).toBe('gte.2026-07-29');
    expect(filtresDe('projets', '2026-10-27').jour).toBeUndefined();
  });

  it('ne laisse passer que des couleurs hexadécimales', () => {
    expect(couleurSure('#003CC8')).toBe('#003CC8');
    expect(couleurSure('red;background:url(x)')).toBe('#E5E7EB');
    expect(couleurSure(undefined, '#fff')).toBe('#fff');
  });
});
