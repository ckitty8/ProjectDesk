/* Génère les PNG des maquettes complémentaires (docs/maquettes/pilotage-projet/complements/).
   Principe : on ouvre la maquette d'origine (même coquille, mêmes styles) puis on injecte
   les fragments HTML de ce dossier. Usage : node docs/maquettes/pilotage-projet/complements/sources/generer-complements.js */
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); // Playwright global
const fs = require('fs'), path = require('path');
const ICI = __dirname, SORTIE = path.resolve(ICI, '..');
const MAQUETTE = 'file://' + path.resolve(ICI, '../../source/Pilotage_Projet.dc.html');
const lire = f => fs.readFileSync(path.join(ICI, f), 'utf8');

(async () => {
  const navigateur = await chromium.launch();
  const page = await navigateur.newPage({ viewport: { width: 1440, height: 900 } });
  await page.route('**/fonts.g*/**', r => r.abort()); // pas d'accès réseau aux polices dans le conteneur

  // Ouvre la maquette sur un écran donné et ajoute la feuille de style des compléments
  async function ouvrir(ecran) {
    await page.goto(MAQUETTE); await page.waitForTimeout(300);
    await page.evaluate(e => window.__dc.setState({ screen: e }), ecran); await page.waitForTimeout(150);
    await page.addStyleTag({ content: lire('style.css') });
  }
  // Écrans plein écran (hors coquille) : connexion, choix d'équipe, espace demandeur
  for (const nom of ['connexion', 'choix-equipe', 'espace-demandeur']) {
    await ouvrir('gDash');
    await page.evaluate(html => { document.body.lastElementChild.innerHTML = html; }, lire(nom + '.html'));
    await page.screenshot({ path: path.join(SORTIE, nom + '.png') });
  }
  // Mon timesheet : nouvel élément de menu dans « Mon dashboard » + contenu de l'écran
  await ouvrir('mDaily');
  await page.evaluate(html => {
    const liens = [...document.querySelectorAll('aside nav div[style*="height:32px"]')];
    const daily = liens.find(l => l.textContent.trim() === 'Daily');
    const nouveau = daily.cloneNode(true); nouveau.querySelector('span').textContent = 'Mon timesheet';
    daily.style.background = 'transparent'; daily.style.color = '#AEB9D3';
    const admin = liens.filter(l => l.textContent.trim() === 'Administration').pop();
    admin.parentNode.insertBefore(nouveau, admin);
    document.querySelector('header span[style*="font-weight:600"]').textContent = 'Mon timesheet';
    document.querySelector('main > div:last-child').innerHTML = html;
  }, lire('mon-timesheet.html'));
  await page.screenshot({ path: path.join(SORTIE, 'mon-timesheet.png') });
  // Bloc utilisateur en pied de barre latérale (sur le dashboard général)
  await ouvrir('gDash');
  await page.evaluate(html => { document.querySelector('aside').lastElementChild.outerHTML = html; }, lire('bloc-utilisateur.html'));
  await page.screenshot({ path: path.join(SORTIE, 'bloc-utilisateur.png') });
  await navigateur.close();
})();
