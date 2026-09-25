/* Génère les PNG de docs/maquettes/pilotage-projet/ à partir de la maquette source.
   support.js = mini moteur de rendu écrit pour ce dépôt (le support.js d'origine n'est pas fourni).
   Usage : node docs/maquettes/pilotage-projet/source/generer-captures.js */
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.route('**/fonts.googleapis.com/**', r => r.abort()); await p.route('**/fonts.gstatic.com/**', r => r.abort());
  await p.goto('file://' + __dirname + '/Pilotage_Projet.dc.html'); await p.waitForTimeout(500);
  const screens = ['gDash','gProjets','gRess','gAdmin','gTime','mDaily','mProjets','mCong','mListe','mAdmin'];
  for (const [i, s] of screens.entries()) { await p.evaluate(s => window.__dc.setState({ screen: s, panel: null, modal: null }), s); await p.waitForTimeout(200);
    await p.screenshot({ path: __dirname + '/../' + String(i + 1).padStart(2, '0') + '-' + s + '.png' }); }
  await p.evaluate(() => window.__dc.setState({ screen: 'mProjets', panel: 'PF-14' })); await p.waitForTimeout(200); await p.screenshot({ path: __dirname + '/../11-panneau-projet.png' });
  await b.close();
})();
