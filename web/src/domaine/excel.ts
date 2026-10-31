/* ============================================================
   Excel — fabrication d'un fichier .xlsx dans le navigateur, sans bibliothèque
   (portage TypeScript de app/js/excel.js — phase 5, vague B ; règle n°1 : pas de dépendance ajoutée)
   ------------------------------------------------------------
   Utilisé par l'export du daily (maquette docs/maquettes/export-daily-excel/).
   Un .xlsx est une archive ZIP de quelques fichiers XML (format Office Open XML). On écrit ici le strict nécessaire :
   - un onglet par feuille, textes « en ligne » (inlineStr : jamais interprétés comme des formules, donc pas d'injection de formule possible) ;
   - ligne d'en-tête figée, filtre automatique, largeur des colonnes ;
   - quelques styles fixes (STYLES ci-dessous) : en-tête, fonds de statut, texte rouge.
   L'archive est « stockée » (sans compression) : plus simple, et un export de daily reste petit.
   Une cellule est un texte, ou { texte, style } avec un style de STYLES.
   ============================================================ */

export type StyleCellule = 'normal' | 'entete' | 'vert' | 'gris' | 'orange' | 'rouge';
export type Cellule = string | { texte: string; style?: StyleCellule };
export interface FeuilleExcel {
  nom: string;
  colonnes: { titre: string; largeur?: number }[];
  lignes: Cellule[][];
}

/* ---------- Styles disponibles (index dans styles.xml) ---------- */
// 0 normal · 1 en-tête (blanc sur bleu ProjectDesk) · 2-4 fonds de statut · 5 texte rouge
const STYLES: Record<StyleCellule, number> = { normal: 0, entete: 1, vert: 2, gris: 3, orange: 4, rouge: 5 };

// Espace de noms des fichiers de relations du classeur (_rels/.rels et workbook.xml.rels)
const XMLNS_RELATIONS = 'http://schemas.openxmlformats.org/package/2006/relationships';

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><sz val="11"/><color rgb="FFC62828"/><name val="Calibri"/></font>
  </fonts>
  <fills count="6">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF003CC8"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE3F5EC"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF1F3F7"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF3E0"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFD4D4D4"/></left><right style="thin"><color rgb="FFD4D4D4"/></right>
      <top style="thin"><color rgb="FFD4D4D4"/></top><bottom style="thin"><color rgb="FFD4D4D4"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="6">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/* ---------- XML des feuilles ---------- */
// Échappement XML ; les caractères de contrôle (interdits en XML) sont retirés
export function echapper(texte: unknown): string {
  return String(texte ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Lettre(s) de colonne : 0 → A, 25 → Z, 26 → AA
export function lettreColonne(index: number): string {
  let lettres = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) lettres = String.fromCharCode(65 + (n - 1) % 26) + lettres;
  return lettres;
}

function celluleXml(valeur: Cellule, ligne: number, colonne: number, styleParDefaut: StyleCellule): string {
  const cellule = typeof valeur === 'object' ? valeur : { texte: valeur };
  const style = STYLES[cellule.style ?? styleParDefaut] ?? 0;
  return `<c r="${lettreColonne(colonne)}${ligne}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${echapper(cellule.texte)}</t></is></c>`;
}

// Une feuille : colonnes (largeurs), ligne 1 = en-têtes (figée, avec filtre), puis les lignes
function feuilleXml(feuille: FeuilleExcel): string {
  const derniere = lettreColonne(feuille.colonnes.length - 1) + (feuille.lignes.length + 1);
  const colonnes = feuille.colonnes.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.largeur || 15}" customWidth="1"/>`).join('');
  const entete = `<row r="1">${feuille.colonnes.map((c, i) => celluleXml(c.titre, 1, i, 'entete')).join('')}</row>`;
  const lignes = feuille.lignes.map((l, n) => `<row r="${n + 2}">${l.map((v, i) => celluleXml(v, n + 2, i, 'normal')).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>${colonnes}</cols>
  <sheetData>${entete}${lignes}</sheetData>
  <autoFilter ref="A1:${derniere}"/>
</worksheet>`;
}

// Fichiers de l'archive .xlsx : structure du classeur + une feuille par onglet
export function fichiersClasseur(feuilles: readonly FeuilleExcel[]): Record<string, string> {
  const fichiers: Record<string, string> = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${feuilles.map((_f, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml"
    ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}
</Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${XMLNS_RELATIONS}">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${feuilles.map((f, i) => `<sheet name="${echapper(f.nom)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
  <definedNames>${feuilles.map((f, i) => `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">`
    + `'${echapper(f.nom)}'!$A$1:$${lettreColonne(f.colonnes.length - 1)}$${f.lignes.length + 1}</definedName>`).join('')}</definedNames>
</workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${XMLNS_RELATIONS}">
  ${feuilles.map((_f, i) => `<Relationship Id="rId${i + 1}"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}
  <Relationship Id="rId${feuilles.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    'xl/styles.xml': STYLES_XML
  };
  feuilles.forEach((f, i) => { fichiers[`xl/worksheets/sheet${i + 1}.xml`] = feuilleXml(f); });
  return fichiers;
}

/* ---------- Archive ZIP (méthode « stockée », sans compression) ---------- */
// Table du CRC-32 (somme de contrôle exigée par le format ZIP, polynôme standard 0xEDB88320)
const TABLE_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
export function crc32(octets: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (const octet of octets) crc = (TABLE_CRC[(crc ^ octet) & 0xFF] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Écrit des entiers « petit-boutistes » de 2 ou 4 octets (ordre imposé par le format ZIP)
const entier16 = (n: number): number[] => [n & 0xFF, (n >>> 8) & 0xFF];
const entier32 = (n: number): number[] => [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF];

/* Assemble l'archive : pour chaque fichier un en-tête local suivi du contenu, puis le répertoire central (un en-tête par fichier)
   et l'enregistrement de fin. Drapeau 0x0800 : noms de fichiers en UTF-8. Date fixe 01/01/1980 (sans importance ici). */
export function zip(fichiers: Record<string, string>): Uint8Array<ArrayBuffer> {
  const encodeur = new TextEncoder(), parties: Uint8Array[] = [], central: Uint8Array[] = [];
  const DATE_DOS = 33, HEURE_DOS = 0, UTF8 = 0x0800;
  let position = 0;
  Object.entries(fichiers).forEach(([nom, texte]) => {
    const nomOctets = encodeur.encode(nom), contenu = encodeur.encode(texte);
    const crc = crc32(contenu), taille = contenu.length;
    const commun = [...entier16(20), ...entier16(UTF8), ...entier16(0), ...entier16(HEURE_DOS), ...entier16(DATE_DOS),
      ...entier32(crc), ...entier32(taille), ...entier32(taille), ...entier16(nomOctets.length)];
    const enteteLocal = new Uint8Array([...entier32(0x04034B50), ...commun, ...entier16(0), ...nomOctets]);
    central.push(new Uint8Array([...entier32(0x02014B50), ...entier16(20), ...commun,
      ...entier16(0), ...entier16(0), ...entier16(0), ...entier16(0), ...entier32(0), ...entier32(position), ...nomOctets]));
    parties.push(enteteLocal, contenu);
    position += enteteLocal.length + taille;
  });
  const tailleCentral = central.reduce((s, c) => s + c.length, 0);
  const fin = new Uint8Array([...entier32(0x06054B50), ...entier16(0), ...entier16(0),
    ...entier16(central.length), ...entier16(central.length), ...entier32(tailleCentral), ...entier32(position), ...entier16(0)]);
  const tout = [...parties, ...central, fin];
  const resultat = new Uint8Array(tout.reduce((s, p) => s + p.length, 0));
  let decalage = 0;
  tout.forEach(p => { resultat.set(p, decalage); decalage += p.length; });
  return resultat;
}

/* ---------- Téléchargement ---------- */
export function telecharger(nomFichier: string, feuilles: readonly FeuilleExcel[]): void {
  const blob = new Blob([zip(fichiersClasseur(feuilles))], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const lien = document.createElement('a');
  lien.href = URL.createObjectURL(blob);
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(lien.href), 1000);
}
