import { describe, expect, it } from 'vitest';
import { ABSENCES, AFFECTATIONS, PROJETS, RESSOURCES } from './__fixtures__/donnees';
import { exemplesKpi } from './exemplesKpi';
import { KPI_AGILE } from './textes';

const jour = '2026-11-03';
const exemples = (idProjet: string) => exemplesKpi({ id: idProjet }, RESSOURCES, AFFECTATIONS, ABSENCES, new Set(), jour);

describe('exemples chiffrés des KPI Agile', () => {
  it('fournit un exemple pour chaque KPI du catalogue', () => {
    const ex = exemples(PROJETS[0]?.id ?? '');
    KPI_AGILE.flatMap(s => s.kpi).forEach(([cle]) => expect(ex[cle], cle).toBeDefined());
  });

  it('la capacité et le focus sont réels, les autres KPI illustratifs', () => {
    const ex = exemples(PROJETS[0]?.id ?? '');
    expect(ex.capacite?.[0]?.nature).toBe('reel');
    expect(ex.focus?.map(e => e.nature)).toEqual(['reel', 'illustratif']);
    expect(ex.velocite?.[0]?.nature).toBe('illustratif');
  });

  it('dimensionne les exemples sur l\'équipe du projet', () => {
    const projet = PROJETS.find(p => AFFECTATIONS.filter(a => a.projetId === p.id).length > 0) ?? PROJETS[0];
    const membres = AFFECTATIONS.filter(a => a.projetId === projet?.id).length;
    const texte = exemples(projet?.id ?? '').capacite?.[0]?.texte ?? '';
    expect(texte).toContain(`pour ${membres} personnes`);
    expect(texte).toMatch(/\*\*[\d,]+ j\*\*/);
  });

  it('un projet sans membre donne des exemples à zéro, sans erreur', () => {
    expect(exemples('inexistant').velocite?.[0]?.texte).toContain('0 personnes');
  });
});
