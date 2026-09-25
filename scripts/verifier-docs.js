#!/usr/bin/env node
/* ============================================================
   Vérification des documents (règle n°7 de CLAUDE.md)
   ------------------------------------------------------------
   À lancer après chaque commit (automatique via .githooks/post-commit,
   ou à la main : `node scripts/verifier-docs.js`).

   Contrôle que la documentation reste alignée avec le code :
     1. chaque document attendu existe (README racine et app, CLAUDE.md, DAT) ;
     2. chaque écran (fichier app/js/ecrans/*.js) est décrit dans le DAT (§ 3) ;
     3. chaque menu de la coquille (app/js/coquille.js) est décrit dans le DAT (§ 3) ;
     4. chaque fonction « Calculs.xxx » citée dans le DAT existe dans app/js/calculs.js ;
     5. chaque capture PNG citée dans le DAT existe dans docs/maquettes/ (tous sous-dossiers) ;
     6. le DAT a été modifié dans le dernier commit si le code ou le SQL l'a été ;
     7. chaque table créée dans db/migrations/*.sql est décrite dans le DAT.

   Aucune dépendance : Node.js seul. Le script n'écrit rien, il signale.
   Code de sortie : 0 = tout est cohérent, 1 = au moins un écart.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(ROOT, rel));
const cite = (texte, nom) => texte.includes('`' + nom + '`');   // nom cité entre accents graves

// Liste des écarts trouvés : chaque contrôle y ajoute un message lisible.
const ecarts = [];

/* ---------- 1. Présence des documents attendus ---------- */
const DOCUMENTS = ['README.md', 'CLAUDE.md', 'docs/DAT.md', 'app/README.md'];
DOCUMENTS.forEach(doc => {
  if (!exists(doc)) ecarts.push(`Document manquant : ${doc}`);
});
if (ecarts.length) terminer(); // inutile d'aller plus loin sans les documents

const dat = read('docs/DAT.md');

/* ---------- 2. Écrans : chaque fichier de app/js/ecrans/ est cité dans le DAT ---------- */
fs.readdirSync(path.join(ROOT, 'app/js/ecrans')).filter(f => f.endsWith('.js')).forEach(fichier => {
  if (!cite(dat, fichier)) ecarts.push(`Écran "${fichier}" (app/js/ecrans/) absent du DAT § 3`);
});

/* ---------- 3. Menus : chaque identifiant de menu de la coquille est cité dans le DAT ---------- */
const coquille = read('app/js/coquille.js');
const menus = new Set([...coquille.matchAll(/\{\s*id:\s*'(\w+)'/g)].map(m => m[1]));
menus.forEach(id => {
  if (!cite(dat, id)) ecarts.push(`Menu "${id}" (app/js/coquille.js) absent du DAT § 3`);
});

/* ---------- 4. Fonctions de calcul citées dans le DAT : elles existent ---------- */
const calculs = read('app/js/calculs.js');
new Set([...dat.matchAll(/`Calculs\.(\w+)`/g)].map(m => m[1])).forEach(fn => {
  if (!new RegExp(`function ${fn}\\(|const ${fn} =`).test(calculs)) ecarts.push(`Fonction "Calculs.${fn}" citée dans le DAT mais absente de app/js/calculs.js`);
});

/* ---------- 5. Captures PNG citées dans le DAT : elles existent (docs/maquettes/**) ---------- */
function listerPng(dossier) {
  return fs.readdirSync(dossier, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? listerPng(path.join(dossier, e.name)) : (e.name.endsWith('.png') ? [e.name] : []));
}
const pngExistants = new Set(listerPng(path.join(ROOT, 'docs/maquettes')));
new Set([...dat.matchAll(/`([\w-]+\.png)`/g)].map(m => m[1])).forEach(png => {
  if (!pngExistants.has(png)) ecarts.push(`Capture "${png}" citée dans le DAT mais absente de docs/maquettes/`);
});

/* ---------- 7. Tables SQL : chaque table créée par une migration est citée dans le DAT ---------- */
const dossierMigrations = path.join(ROOT, 'db/migrations');
fs.readdirSync(dossierMigrations).filter(f => f.endsWith('.sql')).forEach(fichier => {
  const sql = fs.readFileSync(path.join(dossierMigrations, fichier), 'utf8');
  [...sql.matchAll(/create table (?:if not exists )?public\.(\w+)/gi)].forEach(m => {
    if (!cite(dat, m[1])) ecarts.push(`Table "${m[1]}" (${fichier}) absente du DAT § 4`);
  });
});

/* ---------- 6. Dernier commit : code ou SQL modifié => DAT modifié ---------- */
try {
  const fichiers = execSync('git diff-tree --no-commit-id --name-only -r HEAD', { cwd: ROOT })
    .toString().split('\n').filter(Boolean);
  const codeTouche = fichiers.some(f => /^(app\/.*\.(js|html|css)|db\/.*\.sql)$/.test(f));
  const datTouche = fichiers.includes('docs/DAT.md');
  if (codeTouche && !datTouche) ecarts.push('Le dernier commit modifie le code mais pas docs/DAT.md (règle n°5)');
} catch (e) {
  // Hors dépôt git (ou premier commit) : contrôle ignoré, pas bloquant.
}

terminer();

/* Affiche le bilan et sort avec le bon code. */
function terminer() {
  if (ecarts.length === 0) {
    console.log('✔ Documents vérifiés : CLAUDE.md, DAT, README et captures sont cohérents avec le code.');
    process.exit(0);
  }
  console.log(`✘ ${ecarts.length} écart(s) entre la documentation et le code :`);
  ecarts.forEach(e => console.log('  - ' + e));
  process.exit(1);
}
