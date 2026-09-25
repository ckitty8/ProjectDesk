/* Génère docs/maquettes/daily-equipes/daily-equipes.png : écran « Général › Daily des équipes »,
   injecté dans la coquille de la maquette de référence. Usage : node docs/maquettes/daily-equipes/sources/generer.js */
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); // Playwright global
const fs = require('fs'), path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.route('**/fonts.g*/**', r => r.abort());
  await p.goto('file://' + path.resolve(__dirname, '../../pilotage-projet/source/Pilotage_Projet.dc.html')); await p.waitForTimeout(300);
  await p.addStyleTag({ path: path.resolve(__dirname, '../../pilotage-projet/complements/sources/style.css') });
  await p.evaluate(html => {
    const liens = [...document.querySelectorAll('aside nav div[style*="height:32px"]')];
    const dash = liens.find(l => l.textContent.trim() === 'Dashboard général');
    const tim = liens.find(l => l.textContent.trim() === 'Timesheet');
    const nouveau = tim.cloneNode(true); nouveau.querySelector('span').textContent = 'Daily des équipes';
    nouveau.querySelector('path').setAttribute('d', 'M6 3h9l4 4v14H6zM9 10h7M9 14h7M9 18h4');
    nouveau.style.background = '#17295A'; nouveau.style.color = '#fff';
    dash.style.background = 'transparent'; dash.style.color = '#AEB9D3';
    tim.parentNode.appendChild(nouveau);
    // Nom actuel de l'application (ProjectDesk, sans sous-titre)
    const marque = [...document.querySelectorAll('aside div')].find(d => d.textContent.trim() === 'Pilotage Projet');
    marque.textContent = 'ProjectDesk'; marque.style.fontSize = '15px'; marque.nextElementSibling.remove();
    document.querySelector('header span[style*="font-weight:600"]').textContent = 'Daily des équipes';
    document.querySelector('main > div:last-child').innerHTML = html;
  }, fs.readFileSync(path.join(__dirname, 'daily-equipes.html'), 'utf8'));
  await p.screenshot({ path: path.resolve(__dirname, '../daily-equipes.png') }); await b.close();
})();
