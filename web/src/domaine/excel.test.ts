import { describe, expect, it } from 'vitest';
import { crc32, echapper, fichiersClasseur, lettreColonne, zip } from './excel';
import type { FeuilleExcel } from './excel';

const feuille: FeuilleExcel = {
  nom: 'Daily',
  colonnes: [{ titre: 'Date', largeur: 12 }, { titre: 'Statut' }],
  lignes: [['07/10/2026', { texte: 'Renseigné', style: 'vert' }], ['08/10/2026', '=SOMME(A1)']]
};

describe('export Excel', () => {
  it('calcule le CRC-32 standard', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xCBF43926);
  });
  it('nomme les colonnes comme Excel', () => {
    expect([0, 25, 26, 27, 701, 702].map(lettreColonne)).toEqual(['A', 'Z', 'AA', 'AB', 'ZZ', 'AAA']);
  });
  it('échappe le XML et retire les caractères de contrôle', () => {
    expect(echapper('a<b>&"c"\u0001')).toBe('a&lt;b&gt;&amp;&quot;c&quot;');
  });
  it('écrit les textes en ligne (jamais de formule) avec leur style', () => {
    const xml = fichiersClasseur([feuille])['xl/worksheets/sheet1.xml'] ?? '';
    expect(xml).toContain('t="inlineStr"');
    expect(xml).toContain('<c r="B2" s="2"');
    expect(xml).toContain('>=SOMME(A1)</t>');
    expect(xml).toContain('<autoFilter ref="A1:B3"/>');
  });
  it('déclare un onglet par feuille dans le classeur', () => {
    const f = fichiersClasseur([feuille, { ...feuille, nom: 'Blocages' }]);
    expect(f['xl/workbook.xml']).toContain('name="Blocages" sheetId="2"');
    expect(Object.keys(f)).toContain('xl/worksheets/sheet2.xml');
  });
  it('assemble une archive ZIP valide : en-têtes, noms, fin d\'archive', () => {
    const octets = zip({ 'a.txt': 'bonjour', 'dossier/b.xml': '<x/>' });
    const vue = new DataView(octets.buffer);
    expect(vue.getUint32(0, true)).toBe(0x04034B50);                              // premier en-tête local
    expect(new TextDecoder().decode(octets.slice(30, 35))).toBe('a.txt');
    expect(vue.getUint32(octets.length - 22, true)).toBe(0x06054B50);             // fin d'archive
    expect(vue.getUint16(octets.length - 22 + 10, true)).toBe(2);                 // deux fichiers
    expect(vue.getUint32(14, true)).toBe(crc32(new TextEncoder().encode('bonjour')));
  });
});
