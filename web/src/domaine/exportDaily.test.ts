import { describe, expect, it } from 'vitest';
import { ABSENCES, AFFECTATIONS, EQUIPES, PROJETS, RESSOURCES } from './__fixtures__/donnees';
import { composerDaily } from './daily';
import { feuillesExport, lignesExport, periodeExport } from './exportDaily';

const projet = PROJETS.find(p => p.id === 'p-ia2') ?? PROJETS[0]!;
const d = { equipes: EQUIPES, ressources: RESSOURCES, projets: PROJETS, affectations: AFFECTATIONS, absences: ABSENCES };
const notes = [{ userId: 'u-cerine', projetId: projet.id, jour: '2026-11-02', texte: composerDaily({ aujourdhui: 'Recette', blocages: 'Accès recette' }) }];

describe('période d\'export', () => {
  it('propose les raccourcis de la fenêtre', () => {
    expect(periodeExport('jour', '2026-11-04')).toEqual({ debut: '2026-11-04', fin: '2026-11-04' });
    expect(periodeExport('semaine', '2026-11-04')).toEqual({ debut: '2026-11-02', fin: '2026-11-04' });
    expect(periodeExport('mois', '2026-11-04')).toEqual({ debut: '2026-11-01', fin: '2026-11-04' });
    expect(periodeExport('moisPrecedent', '2026-11-04')).toEqual({ debut: '2026-10-01', fin: '2026-10-31' });
  });
});

describe('lignes du fichier', () => {
  const lignes = (avecManquants: boolean) => lignesExport(d, '2026-11-02', '2026-11-03', [projet], notes, avecManquants, new Set());
  it('ne garde que les dailys renseignés sans l\'option « manquants »', () => {
    expect(lignes(false).map(l => `${l.jour} ${l.personne} ${l.statut}`)).toEqual(['2026-11-02 Cerine Renseigné']);
  });
  it('ajoute absents et manquants, du plus récent au plus ancien', () => {
    expect(lignes(true).map(l => `${l.jour} ${l.personne} ${l.statut}`)).toEqual([
      '2026-11-03 Cerine Manquant', '2026-11-03 Léna Absent(e)', '2026-11-02 Cerine Renseigné', '2026-11-02 Léna Manquant'
    ]);
  });
  it('une personne sans compte est signalée', () => {
    const sansCompte = { ...d, ressources: RESSOURCES.map(r => (r.id === 'r-cerine' ? { ...r, userId: null } : r)) };
    const l = lignesExport(sansCompte, '2026-11-04', '2026-11-04', [projet], [], true, new Set());
    expect(l.find(x => x.personne === 'Cerine')?.statut).toBe('Sans compte');
  });
});

describe('onglets du classeur', () => {
  it('un onglet Daily, et Blocages seulement sur demande', () => {
    const l = lignesExport(d, '2026-11-02', '2026-11-02', [projet], notes, false, new Set());
    expect(feuillesExport(l, false).map(f => f.nom)).toEqual(['Daily']);
    const f = feuillesExport(l, true);
    expect(f.map(x => x.nom)).toEqual(['Daily', 'Blocages']);
    expect(f[1]?.lignes).toEqual([['02/11/2026', 'Vie de Ville', 'Cerine', { texte: 'Accès recette', style: 'rouge' }]]);
    expect(f[0]?.lignes[0]?.[3]).toEqual({ texte: 'Renseigné', style: 'vert' });
  });
});
