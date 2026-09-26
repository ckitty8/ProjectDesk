/* Maquettes « Congés & capacité sans doublon » : 4 pistes, rendues avec les styles de l'application
   (serveur simulé, contenu injecté). Usage : node docs/maquettes/conges-sans-doublon/sources/generer.js */
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const { spawn } = require('child_process'); const path = require('path');

// Données de septembre 2026 (celles de la capture du porteur)
const JOURS = Array.from({ length: 30 }, (_, i) => i + 1);
const LETTRES = ['M', 'M', 'J', 'V', 'S', 'D', 'L'];               // 1er septembre 2026 = mardi
const weekend = j => ['S', 'D'].includes(LETTRES[(j - 1) % 7]);
const ABS = { Christelle: [28, 29, 30], Nouha: [], Lenaic: [], Anne: [], Cerine: [] };
const PERS = { Anne: ['AC', 'Anne Caselli'], Nouha: ['N', 'Nouha'], Lenaic: ['LH', 'Lenaic Houssou'], Christelle: ['C', 'Christelle'], Cerine: ['CK', 'Cerine Kerarma'] };
const PROJETS = { 'APP-01 CDO': ['Nouha', 'Lenaic', 'Christelle'], 'APP-02 IA': ['Nouha', 'Christelle', 'Cerine'] };
const projetsDe = p => Object.keys(PROJETS).filter(k => PROJETS[k].includes(p)).map(k => k.split(' ')[1]);

const cases = (p, gris) => JOURS.map(j => `<td class="${weekend(j) ? 'ferme' : ''}">${!gris && ABS[p].includes(j) ? '<span class="case-absence" style="color:#0F8A6B;background:#E3F5EC">CV</span>' : ''}</td>`).join('');
const total = p => `<td class="num" style="padding:0 10px">${ABS[p].length} j</td>`;
const personne = (p, retrait, complement = '', gris = false) => `<tr${gris ? ' style="opacity:.45"' : ''}><td class="nom"><span class="ligne-flex" style="padding-left:${retrait}px">
  <span class="avatar">${PERS[p][0]}</span>${PERS[p][1]}${complement}</span></td>${gris ? `<td colspan="30" style="text-align:left;padding-left:12px;color:#8A93A3">voir ${gris}</td><td></td>` : cases(p) + total(p)}</tr>`;
const groupe = (html, retrait, secondaire) => `<tr class="groupe"><td colspan="32"><span class="ligne-flex" style="padding-left:${retrait}px;${secondaire ? 'font-weight:500;color:#6B7485' : ''}">${html}</span></td></tr>`;
const entete = `<thead><tr><th class="nom">Personne</th>${JOURS.map(j => `<th class="${weekend(j) ? 'ferme' : ''} ${j === 26 ? 'aujourdhui' : ''}">${LETTRES[(j - 1) % 7]}<br>${j}</th>`).join('')}<th>Total</th></tr></thead>`;
const tags = p => projetsDe(p).map(t => `<span class="code" style="margin-left:6px;padding:1px 6px;border:1px solid #E3E7EE;border-radius:4px">${t}</span>`).join('');
const baseGroupes = `${groupe('🏢 <b>DSI</b>', 0)}${groupe('👥 <b>Applications</b>', 16)}`;
const carte = (titre, barre, lignes, note) => `<div class="ecran" style="max-width:1400px">
  <div class="entete-ecran"><div><h1>Congés & capacité</h1><div class="sous-titre">${titre}</div></div></div>
  <div class="carte"><div class="carte-titre"><div class="ligne-flex"><button class="btn">‹</button><b style="min-width:130px;text-align:center">septembre 2026</b><button class="btn">›</button>${barre}</div>
    <div class="puces"><span class="puce active">Congés validé</span><span class="puce">Congés prévisionnel</span><span class="puce">Jours férié</span><span class="puce">Effacer</span></div></div>
    <div class="calendrier"><table>${entete}<tbody>${lignes}</tbody></table></div></div>
  <div class="discret" style="font-size:12.5px;margin-top:10px">${note}</div></div>`;

const vueSeg = actif => `<span style="margin-left:18px" class="puces"><span class="puce${actif === 'equipe' ? ' active' : ''}">Par équipe</span><span class="puce${actif === 'projet' ? ' active' : ''}">Par projet</span></span>`;
const synthese = (proj) => {
  const membres = PROJETS[proj];
  const cellules = JOURS.map(j => { if (weekend(j)) return '<td class="ferme"></td>';
    const n = membres.filter(p => ABS[p].includes(j)).length;
    return `<td style="${n ? `background:${n / membres.length > .5 ? '#FDECEC;color:#B42318' : '#FFF4E0;color:#8A4B00'};font-weight:600` : 'color:#B3BAC7'}">${n ? n + '/' + membres.length : '·'}</td>`; }).join('');
  return `<tr style="background:#FAFBFD"><td class="nom" style="padding-left:32px;color:#4A5363">📁 ${proj} <span class="discret" style="font-size:11px">absents / membres</span></td>${cellules}<td></td></tr>`;
};

const PISTES = {
  'piste-1-une-ligne-par-personne': carte('Piste 1 — une ligne par personne, groupée par équipe', '',
    baseGroupes + ['Anne', 'Nouha', 'Lenaic', 'Christelle', 'Cerine'].map(p => personne(p, 32, (p === 'Anne' ? '<span class="discret" style="margin-left:6px;font-size:11px">responsable</span>' : '') + tags(p))).join(''),
    'Chaque personne apparaît une seule fois. Ses projets sont rappelés en étiquettes à côté du nom. L’organisation détaillée reste dans Liste des ressources.'),
  'piste-2a-vue-par-equipe': carte('Piste 2 — sélecteur de vue : « Par équipe » (par défaut = piste 1)', vueSeg('equipe'),
    baseGroupes + ['Anne', 'Nouha', 'Lenaic', 'Christelle', 'Cerine'].map(p => personne(p, 32, tags(p))).join(''),
    'Vue par défaut identique à la piste 1.'),
  'piste-2b-vue-par-projet': carte('Piste 2 — sélecteur de vue : « Par projet »', vueSeg('projet') + '<select class="champ" style="width:auto;margin-left:10px"><option>APP-01 CDO</option></select>',
    groupe('📁 <b>APP-01 CDO</b> <span class="discret" style="font-weight:400;margin-left:6px">3 membres</span>', 0) + PROJETS['APP-01 CDO'].map(p => personne(p, 16)).join(''),
    'On choisit un projet : seuls ses membres sont affichés, chacun une fois.'),
  'piste-3-synthese-par-projet': carte('Piste 3 — une ligne par personne + synthèse des absences par projet', '',
    baseGroupes + ['Anne', 'Nouha', 'Lenaic', 'Christelle', 'Cerine'].map(p => personne(p, 32, tags(p))).join('')
      + groupe('Projets — absents par jour', 16, true) + Object.keys(PROJETS).map(synthese).join(''),
    'Sous l’équipe, une ligne par projet compte les absents de chaque jour (orange = au moins un, rouge = plus de la moitié). Aucun nom répété.'),
  'piste-4-renvoi-sans-repetition': carte('Piste 4 — regroupement par projet, sans répéter (déconseillée)', '',
    baseGroupes + personne('Anne', 32) + groupe('📁 APP-01 CDO', 32, true) + PROJETS['APP-01 CDO'].map(p => personne(p, 48)).join('')
      + groupe('📁 APP-02 IA', 32, true) + personne('Nouha', 48, '', 'APP-01 CDO') + personne('Christelle', 48, '', 'APP-01 CDO') + personne('Cerine', 48),
    'Une personne n’a ses congés que sous son premier projet ; ailleurs, simple renvoi grisé. Le choix du « premier » projet reste arbitraire.')
};

(async () => {
  const racine = path.resolve(__dirname, '../../../..');
  const s = spawn('node', [path.join(racine, 'tests/serveur-simule.js'), '8160'], { stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1440, height: 560 } });
  await c.addInitScript(() => { window.CONFIG_SURCHARGE = { NEON_AUTH_URL: location.origin + '/auth', DATA_API_URL: location.origin + '/rest/v1' }; });
  await c.route('**/fonts.g*/**', r => r.abort());
  const p = await c.newPage(); await p.goto('http://localhost:8160/app/'); await p.waitForSelector('input[name=email]');
  await p.fill('input[name=email]', 'camille@test.fr'); await p.fill('input[name=motDePasse]', 'motdepasse'); await p.click('form button');
  await p.waitForSelector('.laterale'); await p.click('[data-action="aller"][data-ecran="conges"]'); await p.waitForTimeout(600);
  for (const [nom, html] of Object.entries(PISTES)) {
    await p.evaluate(h => { document.querySelector('.contenu').innerHTML = h; }, html);
    const hauteur = await p.evaluate(() => document.querySelector('.contenu .ecran').getBoundingClientRect().bottom + 20);
    await p.setViewportSize({ width: 1440, height: Math.ceil(hauteur) });
    await p.screenshot({ path: path.resolve(__dirname, '..', nom + '.png') });
  }
  await b.close(); s.kill();
})();
