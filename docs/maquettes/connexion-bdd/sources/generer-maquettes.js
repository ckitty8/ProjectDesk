/* Génère les PNG de docs/maquettes/connexion-bdd/ à partir des sources HTML de ce dossier
   et de la vraie page roadmap-app/index.html (modifiée à la volée).
   Usage : node docs/maquettes/connexion-bdd/sources/generer-maquettes.js */
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright') // Playwright installé globalement;
const fs = require('fs');
const D = require('path').resolve(__dirname, '../../../..') + '/docs/maquettes/connexion-bdd/';
const S = D + 'sources/';
const blocSession = `<div class="bloc-session"><div class="etiquette">Organisation</div>
  <div class="ligne"><span class="orga-courante">DSI — Pôle Applications</span><button class="lien">Changer</button></div>
  <div class="utilisateur ligne"><span>👤 Camille Durand</span><button class="lien">Déconnexion</button></div></div>`;
async function pageConnectee(p) {
  await p.goto('file://' + require('path').resolve(__dirname, '../../../../roadmap-app/index.html'));
  await p.addStyleTag({ path: S + 'maquette.css' });
  await p.evaluate(bloc => {
    document.querySelector('.brand').insertAdjacentHTML('afterend', bloc);
    document.querySelector('.nav').insertAdjacentHTML('beforeend', '<button class="nav-btn" data-view="membres"><span>👥</span> Membres</button>');
    const r = document.getElementById('btn-reset'); r.textContent = '✚ Charger la démo'; r.classList.remove('danger');
    document.getElementById('btn-import').textContent = '⬆ Importer (ajout CSV/JSON)';
  }, blocSession);
}
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  for (const n of ['01-connexion', '02-choix-organisation']) {
    await p.goto('file://' + S + n + '.html'); await p.screenshot({ path: D + n + '.png' });
  }
  await pageConnectee(p);
  await p.screenshot({ path: D + '03-backlog-connecte.png' });
  await pageConnectee(p);
  const membres = fs.readFileSync(S + '04-membres.html', 'utf8');
  await p.evaluate(html => {
    document.querySelectorAll('.nav-btn').forEach(x => { x.classList.remove('active'); if (x.dataset.view === 'membres') x.classList.add('active'); }); document.querySelector('.topbar').classList.add('sans-filtres');
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelector('.main').insertAdjacentHTML('beforeend', '<section class="view active">' + html + '</section>');
  }, membres);

  await p.mouse.move(900, 800); await p.waitForTimeout(300);
  await p.screenshot({ path: D + '04-membres.png' });
  await b.close();
})();
