#!/usr/bin/env node
/* ============================================================
   Audit du code de l'application (skill « revue-qualite », .claude/skills/)
   ------------------------------------------------------------
   À lancer à la main : `node scripts/audit-code.js`
   Objectif (porteur du projet, 2026-10-08) : une application propre, sans code
   mort, cohérente entre les pages, reprenable par une équipe de développeurs.

   ERREURS (code de sortie 1) — à corriger :
     1. fichiers JS : chacun chargé par app/index.html, chaque script chargé existe ;
     2. version ?v= identique pour tous les fichiers de index.html, égale à la
        dernière version du DAT ;
     3. actions : chaque data-action… pointe vers une action définie (lien cassé) ;
     4. code mort : action, fonction, constante globale, méthode d'un écran ou d'un
        objet, fonction de Calculs ou composant C.xxx défini mais jamais utilisé ;
     5. écrans : chaque menu a son écran, chaque écran est accessible (menu,
        allerA ou plein écran) et a son guide d'aide (GUIDE_ECRANS) ;
     6. tables et fonctions SQL : chaque table chargée par etat.js (TABLES) et chaque
        fonction appelée (Api.executer) existe dans les migrations (créée, non supprimée) ;
     7. classes CSS de theme.css jamais utilisées ;
     8. restes de mise au point : console.log, debugger.
   AVERTISSEMENTS (à juger) — lisibilité :
     9. fichier sans en-tête de commentaire ;
    10. fonction de plus de LONGUEUR_MAX_FONCTION lignes ;
    11. ligne de plus de LONGUEUR_MAX_LIGNE caractères.

   Aucune dépendance : Node.js seul. Le script n'écrit rien, il signale.
   Limite : l'analyse est textuelle (noms recherchés dans le code) ; un nom construit
   dynamiquement peut échapper au contrôle — c'est pourquoi on n'en construit pas.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const lire = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const LONGUEUR_MAX_FONCTION = 60;
const LONGUEUR_MAX_LIGNE = 260;

const erreurs = [], avertissements = [];

/* ---------- Fichiers de l'application ---------- */
const fichiersJs = ['app/js', 'app/js/ecrans'].flatMap(dossier =>
  fs.readdirSync(path.join(ROOT, dossier)).filter(f => f.endsWith('.js')).map(f => `${dossier}/${f}`));
const sources = Object.fromEntries(fichiersJs.map(f => [f, lire(f)]));
const index = lire('app/index.html');
const css = lire('app/css/theme.css');
const toutLeJs = Object.values(sources).join('\n');

/* Code sans ses commentaires : un nom cité seulement dans un commentaire ne compte pas comme utilisé.
   Lecture caractère par caractère (une simple expression régulière se tromperait sur « js/ecrans/*.js »
   écrit dans un commentaire, ou sur « // » dans une chaîne) : on suit les chaînes '…' "…", les
   gabarits `…${…}…` (imbriqués), les expressions régulières /…/ et les commentaires. */
function sansCommentaires(texte) {
  let sortie = '', i = 0;
  const pile = [];                                   // 'gabarit' (dans `…`) ou 'accolade' (dans ${…})
  const debutRegex = () => /[(,=:[!&|?;{}]|^$/.test(sortie.trimEnd().slice(-1));
  while (i < texte.length) {
    const c = texte[i], suivant = texte[i + 1], contexte = pile[pile.length - 1];
    if (contexte === 'gabarit') {                     // intérieur d'un gabarit : texte jusqu'à ` ou ${
      if (c === '\\') { sortie += c + suivant; i += 2; continue; }
      if (c === '`') pile.pop();
      if (c === '$' && suivant === '{') { pile.push('accolade'); sortie += '${'; i += 2; continue; }
      sortie += c; i++; continue;
    }
    if (c === '/' && suivant === '*') { const fin = texte.indexOf('*/', i + 2); i = fin < 0 ? texte.length : fin + 2; continue; }
    if (c === '/' && suivant === '/') { const fin = texte.indexOf('\n', i); i = fin < 0 ? texte.length : fin; continue; }
    if (c === "'" || c === '"' || (c === '/' && debutRegex())) {   // chaîne ou expression régulière
      let j = i + 1, classe = false;
      while (j < texte.length && (texte[j] !== c || classe) && texte[j] !== '\n') {
        if (texte[j] === '\\') j++;
        else if (c === '/' && texte[j] === '[') classe = true;
        else if (c === '/' && texte[j] === ']') classe = false;
        j++;
      }
      sortie += texte.slice(i, j + 1); i = j + 1; continue;
    }
    if (c === '`') pile.push('gabarit');
    if (c === '{' && pile.length) pile.push('accolade');
    if (c === '}' && pile.length) pile.pop();         // ferme une accolade, ou ${…} : retour au gabarit
    sortie += c; i++;
  }
  return sortie;
}
const codeJs = sansCommentaires(toutLeJs);
// Nombre d'apparitions d'un nom (mot entier) dans un texte
const occurrences = (texte, nom) => (texte.match(new RegExp(`(?<![\\w$])${nom.replace(/\$/g, '\\$')}(?![\\w$])`, 'g')) || []).length;

/* ---------- 1. Fichiers JS chargés par index.html ---------- */
const charges = [...index.matchAll(/<script src="([^"?]+)/g)].map(m => 'app/' + m[1]);
fichiersJs.forEach(f => { if (!charges.includes(f)) erreurs.push(`${f} n'est pas chargé par app/index.html (fichier inutile ?)`); });
charges.forEach(f => { if (!fs.existsSync(path.join(ROOT, f))) erreurs.push(`app/index.html charge ${f}, qui n'existe pas`); });

/* ---------- 2. Versions ?v= alignées sur le DAT ---------- */
const versions = new Set([...index.matchAll(/\?v=([\d.]+)/g)].map(m => m[1]));
// Dernière version de l'historique du DAT (lignes « | 1.81    | date | … ») : comparaison numérique
const versionsDat = [...lire('docs/DAT.md').matchAll(/^\| (\d+)\.(\d+)\s+\|/gm)].map(m => ({ texte: `${m[1]}.${m[2]}`, rang: Number(m[1]) * 1000 + Number(m[2]) }));
const derniereVersion = versionsDat.reduce((max, v) => v.rang > max.rang ? v : max, { rang: -1 }).texte;
const versionIndex = [...versions][0];
if (versions.size !== 1) erreurs.push(`app/index.html : plusieurs versions ?v= (${[...versions].join(', ')})`);
else if (versionIndex !== derniereVersion) erreurs.push(`app/index.html ?v=${versionIndex} ≠ dernière version du DAT (${derniereVersion})`);

/* ---------- 3 et 4. Actions : liens cassés et actions mortes ---------- */
// Actions définies : clés des blocs Object.assign(Actions, { … }) — « nom: », « nom(…) {», « async nom(…) {»
const actionsDefinies = new Set();
for (const texte of Object.values(sources)) {
  for (const bloc of sansCommentaires(texte).matchAll(/Object\.assign\(Actions, \{([\s\S]*?)\n\}\);/g)) {
    for (const m of bloc[1].matchAll(/^\s{2}(?:async\s+)?(\w+)\s*(?::|\()/gm)) actionsDefinies.add(m[1]);
  }
}
// Actions appelées : attributs data-action*, appels Actions.xxx et déclencher('xxx')
const actionsAppelees = new Set([
  ...[...codeJs.matchAll(/data-action(?:-change|-saisie|-envoi)?="(\w+)"/g)].map(m => m[1]),
  ...[...codeJs.matchAll(/Actions\.(\w+)/g)].map(m => m[1]),
  ...[...codeJs.matchAll(/declencher\('(\w+)'/g)].map(m => m[1]),
  // nom d'action passé en chaîne à un composant (C.onglets, C.boutonIcone…) : 'ongletConges'
  ...[...codeJs.matchAll(/'(\w+)'/g)].map(m => m[1]).filter(nom => actionsDefinies.has(nom))
]);
actionsAppelees.forEach(a => { if (!actionsDefinies.has(a)) erreurs.push(`Action « ${a} » appelée mais jamais définie (lien cassé)`); });
actionsDefinies.forEach(a => { if (!actionsAppelees.has(a)) erreurs.push(`Action « ${a} » définie mais jamais appelée (code mort)`); });

/* ---------- 4. Fonctions et constantes globales jamais utilisées ---------- */
for (const [fichier, texte] of Object.entries(sources)) {
  const globaux = [...texte.matchAll(/^(?:async\s+)?function\s+(\w+)|^const\s+(\w+)\s*=/gm)].map(m => m[1] || m[2]);
  globaux.forEach(nom => {
    if (occurrences(codeJs, nom) <= 1) erreurs.push(`${fichier} : « ${nom} » est défini mais jamais utilisé (code mort)`);
  });
}
// Fonctions exportées par Calculs et composants C.xxx : utilisées hors de leur définition ?
// Noms exportés par un module « const X = (() => { … return { a, b, c }; })(); » : le dernier « return { »
const exportes = fichier => {
  const texte = sansCommentaires(sources[fichier]);
  const debut = texte.lastIndexOf('return {'), fin = texte.indexOf('}', debut);
  return debut < 0 ? [] : texte.slice(debut + 8, fin).split(',').map(n => n.trim().split(':')[0].trim()).filter(Boolean);
};
const ailleurs = fichier => sansCommentaires(Object.entries(sources).filter(([f]) => f !== fichier).map(([, t]) => t).join('\n'));
// Les tests de bout en bout comptent comme utilisateurs (ils vérifient les calculs par l'API publique)
const tests = sansCommentaires(lire('tests/parcours.js'));
[['app/js/calculs.js', 'Calculs'], ['app/js/composants.js', 'C']].forEach(([fichier, objet]) => {
  const reste = ailleurs(fichier) + tests, interne = sansCommentaires(sources[fichier]);
  exportes(fichier).forEach(nom => {
    const utiliseAilleurs = reste.includes(`${objet}.${nom}`) || interne.includes(`${objet}.${nom}`);
    const utiliseDedans = occurrences(interne, nom) > 2;   // définition + export + au moins un appel
    if (!utiliseAilleurs && !utiliseDedans) erreurs.push(`${objet}.${nom} (${fichier}) exporté mais jamais utilisé (code mort)`);
    else if (!utiliseAilleurs) avertissements.push(`${objet}.${nom} n'est utilisé que dans ${fichier} : le retirer de l'export ?`);
  });
});

// Méthodes des objets sur plusieurs lignes (écrans Ecrans.xxx, Previsionnel, Capacite, Modale…)
// jamais appelées. Seules les méthodes sont contrôlées (« nom(…) { » ou « nom: (…) => »), pas les données.
// Clés lues par la coquille elle-même : titre, section, rendre, auChargement, sansEquipePermis.
const CLES_COQUILLE = ['titre', 'section', 'rendre', 'auChargement', 'sansEquipePermis'];
for (const [fichier, texte] of Object.entries(sources)) {
  for (const objet of sansCommentaires(texte).matchAll(/^(?:const (\w+)|Ecrans\.(\w+)) = \{\n([\s\S]*?)\n\};/gm)) {
    const nomObjet = objet[1] || 'Ecrans.' + objet[2];
    const methodes = [...objet[3].matchAll(/^ {2}(?:async\s+)?(\w+)(?:\s*\([^)]*\)\s*\{|:\s*(?:async\s+)?(?:\([^)]*\)|\w+)\s*=>)/gm)].map(m => m[1]);
    methodes.filter(cle => !CLES_COQUILLE.includes(cle) && !['if', 'for', 'while', 'switch', 'return'].includes(cle)).forEach(cle => {
      if (!new RegExp(`\\.${cle}(?![\\w$])`).test(codeJs)) erreurs.push(`${fichier} : ${nomObjet}.${cle}() défini mais jamais appelé (code mort)`);
    });
  }
}

/* ---------- 5. Écrans, menus et guides d'aide ---------- */
const ecrans = new Set([...codeJs.matchAll(/Ecrans\.(\w+)\s*=\s*\{/g)].map(m => m[1]));
const menus = new Set([...sources['app/js/coquille.js'].matchAll(/\{\s*id:\s*'(\w+)'/g)].map(m => m[1]));
const atteints = new Set([...menus,
  ...[...codeJs.matchAll(/allerA\('(\w+)'/g)].map(m => m[1]),
  ...[...codeJs.matchAll(/ecran:\s*'(\w+)'/g)].map(m => m[1]),
  ...[...(sources['app/js/coquille.js'].match(/PLEIN_ECRAN = \[([^\]]*)\]/) || ['', ''])[1].matchAll(/'(\w+)'/g)].map(m => m[1])]);
menus.forEach(m => { if (!ecrans.has(m)) erreurs.push(`Menu « ${m} » sans écran Ecrans.${m}`); });
ecrans.forEach(e => { if (!atteints.has(e)) erreurs.push(`Écran « ${e} » inaccessible (ni menu, ni allerA, ni plein écran)`); });
const guides = (sources['app/js/config.js'].match(/const GUIDE_ECRANS = \{([\s\S]*?)\n\};/) || ['', ''])[1];
menus.forEach(m => { if (!new RegExp(`^\\s{2}${m}:`, 'm').test(guides)) erreurs.push(`Écran « ${m} » sans guide d'aide (GUIDE_ECRANS, config.js)`); });

/* ---------- 6. Tables chargées par l'application : présentes en base ---------- */
const migrations = fs.readdirSync(path.join(ROOT, 'db/migrations')).filter(f => f.endsWith('.sql')).sort()
  .map(f => lire('db/migrations/' + f)).join('\n');
const tablesCreees = new Set([...migrations.matchAll(/create table (?:if not exists )?public\.(\w+)/gi)].map(m => m[1]));
[...migrations.matchAll(/drop table (?:if exists )?public\.(\w+)/gi)].forEach(m => tablesCreees.delete(m[1]));
const blocTables = (sources['app/js/etat.js'].match(/const TABLES = \{([\s\S]*?)\};/) || ['', ''])[1];
[...blocTables.matchAll(/'(\w+)'/g)].map(m => m[1]).forEach(t => {
  if (!tablesCreees.has(t)) erreurs.push(`etat.js charge la table « ${t} », absente des migrations (ou supprimée)`);
});

// Fonctions SQL appelées par l'application (Api.executer('nom')) : présentes dans les migrations
const fonctionsSql = new Set([...migrations.matchAll(/create or replace function public\.(\w+)/gi)].map(m => m[1]));
[...migrations.matchAll(/drop function (?:if exists )?public\.(\w+)/gi)].forEach(m => fonctionsSql.delete(m[1]));
[...codeJs.matchAll(/Api\.executer\('(\w+)'/g)].forEach(m => {
  if (!fonctionsSql.has(m[1])) erreurs.push(`L'application appelle la fonction SQL « ${m[1]} », absente des migrations`);
});

/* ---------- 7. Classes CSS jamais utilisées ---------- */
const textesClasses = codeJs + index;
new Set([...sansCommentaires(css).matchAll(/\.([a-z][\w-]*)/gi)].map(m => m[1])).forEach(classe => {
  if (/^\d/.test(classe)) return;
  if (!new RegExp(`[\\s"'\`]${classe}[\\s"'\`$]|class="${classe}|${classe}['"\`]`).test(textesClasses)) erreurs.push(`Classe CSS « .${classe} » (theme.css) jamais utilisée`);
});

/* ---------- 8. Restes de mise au point ---------- */
for (const [fichier, texte] of Object.entries(sources)) {
  if (/console\.log\(/.test(sansCommentaires(texte))) erreurs.push(`${fichier} : console.log oublié`);
  if (/\bdebugger\b/.test(sansCommentaires(texte))) erreurs.push(`${fichier} : debugger oublié`);
}

/* ---------- 9 à 11. Lisibilité (avertissements) ---------- */
for (const [fichier, texte] of Object.entries(sources)) {
  if (!texte.trimStart().startsWith('/*')) avertissements.push(`${fichier} : pas d'en-tête de commentaire`);
  const lignes = texte.split('\n');
  lignes.forEach((l, i) => { if (l.length > LONGUEUR_MAX_LIGNE) avertissements.push(`${fichier}:${i + 1} : ligne de ${l.length} caractères`); });
  // Longueur d'une fonction : de sa ligne de début à la ligne fermante au même retrait
  lignes.forEach((l, i) => {
    const m = l.match(/^(\s*)(?:async\s+)?(?:function\s+(\w+)|(\w+)\s*\([^)]*\)\s*\{$)/);
    if (!m || !(m[2] || m[3]) || ['if', 'for', 'while', 'switch', 'catch'].includes(m[3])) return;
    const fin = lignes.findIndex((x, j) => j > i && x.startsWith(m[1] + '}'));
    if (fin - i > LONGUEUR_MAX_FONCTION) avertissements.push(`${fichier}:${i + 1} : fonction « ${m[2] || m[3]} » de ${fin - i} lignes (> ${LONGUEUR_MAX_FONCTION})`);
  });
}

/* ---------- Bilan ---------- */
avertissements.forEach(a => console.log('⚠ ' + a));
erreurs.forEach(e => console.log('✘ ' + e));
console.log(erreurs.length ? `\n✘ ${erreurs.length} erreur(s), ${avertissements.length} avertissement(s)` : `\n✔ Code vérifié : aucune erreur, ${avertissements.length} avertissement(s) à juger`);
process.exit(erreurs.length ? 1 : 0);
