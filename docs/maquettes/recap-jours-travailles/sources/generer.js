/* Maquette « Récap annuel = jours travaillés / congés / reste à prendre » (onglet « Jours de congés »
   du fichier du porteur, affiché dans le style de l'application). Chiffres réels du fichier (donnees.json).
   Usage : node docs/maquettes/recap-jours-travailles/sources/generer.js */
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const { spawn } = require('child_process'); const path = require('path');
const D = require('./donnees.json'), OBJECTIF = 218;
const MOIS = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
const n = v => String(Math.round(v * 10) / 10).replace('.', ',');
const reste = v => `<b style="color:${v < 0 ? '#B42318' : '#0B6B4F'}">${v > 0 ? '+' : ''}${n(v)}</b>`;
const nomsCourts = { 'LABBE Christelle': 'Christelle', 'BOUJELBEN Nouha': 'Nouha', 'HOUSSOU Lenaic': 'Lenaic Houssou' };
const ligne = p => `<tr><td class="nom"><span class="ligne-flex" style="padding-left:32px"><span class="avatar">${nomsCourts[p.nom].slice(0, 2).toUpperCase()}</span>${nomsCourts[p.nom]}</span></td>
  ${p.mois.map(([t, c]) => `<td>${n(t)}</td><td class="conge">${c ? n(c) : '·'}</td>`).join('')}
  <td class="tot">${n(p.tt)}</td><td class="tot conge">${n(p.tc)}</td><td class="tot">${reste(p.tt - OBJECTIF)}</td></tr>`;
const tot = i => D.personnes.reduce((s, p) => s + p.mois[i][0], 0), totc = i => D.personnes.reduce((s, p) => s + p.mois[i][1], 0);
const html = `<style>
 .recap th, .recap td { border-bottom: 1px solid #EEF1F5; border-left: 1px solid #EEF1F5; text-align: center; font-size: 11.5px; height: 34px; padding: 0 4px; }
 .recap td.nom, .recap th.nom { text-align: left; min-width: 170px; border-left: 0; font-size: 13px; padding: 0 12px; }
 .recap th { background: #F7F8FB; color: #6B7485; font-weight: 500; } .recap .conge { color: #0F8A6B; background: #F4FBF8; }
 .recap tr.groupe td { background: #F7F8FB; font-weight: 600; text-align: left; } .recap .tot { background: #F3F6FF; font-weight: 600; }
 .recap tr.total td { font-weight: 600; background: #F7F8FB; }
</style>
<div class="ecran" style="max-width:1500px">
 <div class="entete-ecran"><div><h1>Congés & capacité</h1><div class="sous-titre">Absences, récapitulatif annuel et capacité des équipes</div></div></div>
 <div class="onglets"><button class="onglet">Grille mensuelle</button><button class="onglet actif">Récap annuel 2026</button><button class="onglet">Capacité par sprint</button></div>
 <div class="carte">
  <div class="carte-titre"><div class="ligne-flex"><button class="btn">‹</button><b style="min-width:60px;text-align:center">2026</b><button class="btn">›</button>
     <h2 style="margin-left:14px">Jours travaillés et congés <span class="pale">ⓘ</span></h2></div>
   <div class="ligne-flex"><span class="discret">Jours de travail attendus par le client</span>
     <input class="champ" value="${OBJECTIF}" style="width:80px;text-align:center;font-weight:600"> <span class="discret">jours / personne</span> <span class="pale">ⓘ</span></div></div>
  <div style="overflow:auto"><table class="recap" style="border-collapse:collapse;width:100%">
   <thead><tr><th class="nom" rowspan="2">Personne</th>${MOIS.map(m => `<th colspan="2">${m}</th>`).join('')}<th rowspan="2">Total<br>travaillé</th><th rowspan="2">Total<br>congés</th><th rowspan="2">Reste à<br>prendre</th></tr>
   <tr>${MOIS.map(() => '<th>T</th><th class="conge">C</th>').join('')}</tr>
   <tr><td class="nom discret" style="font-size:12px">Jours ouvrés du mois</td>${D.ouvres.map(v => `<td colspan="2" class="discret">${v}</td>`).join('')}<td class="discret">${D.ouvres.reduce((a, b) => a + b, 0)}</td><td></td><td></td></tr></thead>
   <tbody><tr class="groupe"><td colspan="28">🏢 DSI › 👥 Applications</td></tr>${D.personnes.map(ligne).join('')}
   <tr class="total"><td class="nom">Total équipe</td>${MOIS.map((_, i) => `<td>${n(tot(i))}</td><td class="conge">${n(totc(i))}</td>`).join('')}
     <td class="tot">${n(D.personnes.reduce((s, p) => s + p.tt, 0))}</td><td class="tot conge">${n(D.personnes.reduce((s, p) => s + p.tc, 0))}</td><td class="tot"></td></tr></tbody></table></div></div>
 <div class="discret" style="font-size:12.5px;margin-top:10px">T = jours travaillés (1 + demi-journées) · C = jours non travaillés (congés, fériés, demi-journées) ·
   Reste à prendre = total travaillé − jours attendus par le client (rouge : dépassement ; vert : jours encore disponibles). Chiffres : votre onglet « Jours de congés ».</div></div>`;
(async () => {
  const racine = path.resolve(__dirname, '../../../..');
  const s = spawn('node', [path.join(racine, 'tests/serveur-simule.js'), '8161'], { stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1600, height: 560 } });
  await c.addInitScript(() => { window.CONFIG_SURCHARGE = { NEON_AUTH_URL: location.origin + '/auth', DATA_API_URL: location.origin + '/rest/v1' }; });
  await c.route('**/fonts.g*/**', r => r.abort());
  const p = await c.newPage(); await p.goto('http://localhost:8161/app/'); await p.waitForSelector('input[name=email]');
  await p.fill('input[name=email]', 'camille@test.fr'); await p.fill('input[name=motDePasse]', 'motdepasse'); await p.click('form button');
  await p.waitForSelector('.laterale'); await p.click('[data-action="aller"][data-ecran="conges"]'); await p.waitForTimeout(600);
  await p.evaluate(h => { document.querySelector('.contenu').innerHTML = h; }, html);
  await p.screenshot({ path: path.resolve(__dirname, '../recap-jours-travailles.png') });
  await b.close(); s.kill();
})();
