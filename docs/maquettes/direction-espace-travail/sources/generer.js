/* Maquette « Direction = espace de travail », injectée dans la vraie
   application servie par le serveur simulé. Usage : node docs/maquettes/direction-espace-travail/sources/generer.js */
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); // Playwright global
const { spawn } = require('child_process'); const fs = require('fs'), path = require('path');
(async () => {
  const racine = path.resolve(__dirname, '../../../..');
  const s = spawn('node', [path.join(racine, 'tests/serveur-simule.js'), '8140'], { stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1440, height: 1180 } });
  await c.addInitScript(() => { window.CONFIG_SURCHARGE = { NEON_AUTH_URL: location.origin + '/auth', DATA_API_URL: location.origin + '/rest/v1' }; });
  await c.route('**/fonts.g*/**', r => r.abort());
  const p = await c.newPage(); await p.goto('http://localhost:8140/app/'); await p.waitForSelector('input[name=email]');
  await p.fill('input[name=email]', 'camille@test.fr'); await p.fill('input[name=motDePasse]', 'motdepasse'); await p.click('form button');
  await p.waitForSelector('.laterale'); await p.click('[data-action="aller"][data-ecran="listeRessources"]'); await p.waitForTimeout(300);
  await p.evaluate(html => { document.querySelector('.contenu').innerHTML = html; }, fs.readFileSync(path.join(__dirname, 'board.html'), 'utf8'));
  await p.screenshot({ path: path.resolve(__dirname, '../direction-espace-travail.png') });
  await b.close(); s.kill();
})();
