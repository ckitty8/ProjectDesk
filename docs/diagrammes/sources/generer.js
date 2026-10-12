// Rendu PNG du diagramme (Playwright global) : node docs/diagrammes/sources/generer.js
const path = require('path');
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
(async () => {
  const navigateur = await chromium.launch();
  const page = await navigateur.newPage({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(__dirname, 'hierarchie-roles.html'));
  await page.locator('.page').screenshot({ path: path.join(__dirname, '..', 'hierarchie-roles.png') });
  await navigateur.close();
})();
