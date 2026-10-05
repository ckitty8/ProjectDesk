/* ============================================================
   Maquettes « Roadmap fonctionnelle » (4 pistes de design), injectées dans la vraie
   application servie par le serveur simulé, écran Mon dashboard › Projets et Roadmap.
   Données : demandes ouvertes du fichier CDO-ROADMAP-NEW.xlsm (donnees.json, noms des
   demandeurs remplacés par des noms fictifs). Rang calculé selon docs/specifications/roadmap.md.
   Usage : node docs/maquettes/roadmap/sources/generer.js
   ============================================================ */
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); // Playwright global
const { spawn } = require('child_process'); const fs = require('fs'), path = require('path');

/* ==== Données et règle de classement (spécifications § 1) ==== */
const demandes = JSON.parse(fs.readFileSync(path.join(__dirname, 'donnees.json'), 'utf8'));
const score = d => d.complexite ? (0.5 * d.impactClient + 0.3 * d.impactCollab) / (0.2 * d.complexite) : null;
demandes.forEach(d => { d.score = score(d); });
// Stratégique d'abord, puis priorité du demandeur, puis score décroissant ; sans complexité = après ceux qui ont un score
demandes.sort((a, b) => (b.strategique - a.strategique) || ((a.priorite || 9) - (b.priorite || 9)) ||
  ((b.score === null ? -1 : b.score) - (a.score === null ? -1 : a.score)));
demandes.forEach((d, i) => { d.rang = i + 1; });

// Sprints du projet CDO tels que saisis dans Administration › Sprints (exemple)
const SPRINTS = [
  { nom: 'Alnilam', debut: '28/09', fin: '09/10', engageable: 14 },
  { nom: 'Alnitak', debut: '12/10', fin: '23/10', engageable: 12.5 },
  { nom: 'Alphard', debut: '26/10', fin: '06/11', engageable: 14 },
  { nom: 'Alpheratz', debut: '09/11', fin: '20/11', engageable: 11 }
];
// Couleurs des statuts (référentiel administrable « Statut roadmap », valeurs proposées)
const STATUTS = {
  'Nouveau': ['#4A5568', '#EEF1F5'], 'Prêt pour dév': ['#5B3CC4', '#EFEAFF'], 'Dév en cours': ['#003CC8', '#E8EEFF'],
  'En attente': ['#8A4B00', '#FFF1DC'], 'Recette DSI': ['#0B6B6B', '#E1F4F4'], 'Recette PO': ['#0B6B4F', '#E3F5EC'], 'Terminé': ['#0B6B4F', '#E3F5EC']
};

/* ==== Petits composants HTML (mêmes classes que l'application) ==== */
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
const nb = n => String(Math.round(n * 10) / 10).replace('.', ',');
const badge = s => { const [c, f] = STATUTS[s] || ['#4A5568', '#EEF1F5']; return `<span class="badge" style="color:${c};background:${f}">${esc(s)}</span>`; };
const etiquette = t => t ? `<span class="etiquette" style="max-width:150px">${esc(t)}</span>` : '';
const etoile = d => d.strategique ? '<span title="Stratégique" style="color:#D98A1C">★</span>' : '';
const valScore = d => d.score === null
  ? '<span class="badge" style="color:#8A4B00;background:#FFF1DC">complexité à saisir</span>' : `<b>${nb(d.score)}</b>`;
const coupe = (t, n) => t.length > n ? t.slice(0, n - 1) + '…' : t;
const ouvertes = demandes.length, enRecette = demandes.filter(d => d.statut.startsWith('Recette')).length;
const chiffrage = demandes.reduce((s, d) => s + (d.chiffrage || 0), 0), aSaisir = demandes.filter(d => d.score === null).length;

// En-tête commun : onglets de Projets et Roadmap, projet, KPI
function entete(sousTitre, actions = '') {
  return `<div class="entete-ecran"><div><h1 style="font-size:22px;font-weight:600;margin:0">Projets et Roadmap</h1>
      <div class="sous-titre">${sousTitre}</div></div>
      <div class="actions-ecran"><select class="champ" style="height:32px;width:150px"><option>CDO</option></select>${actions}
      <button class="btn">Importer un fichier Excel</button><button class="btn primaire">+ Nouvelle demande</button></div></div>
    <div class="onglets"><button class="onglet">Gantt des projets</button><button class="onglet actif">Roadmap fonctionnelle<span class="compte">${ouvertes}</span></button></div>
    <div class="grille-kpi">
      <div class="carte kpi"><div class="kpi-libelle">Demandes ouvertes</div><div class="kpi-valeur">${ouvertes}</div></div>
      <div class="carte kpi"><div class="kpi-libelle">En recette (DSI / PO)</div><div class="kpi-valeur">${enRecette}</div></div>
      <div class="carte kpi"><div class="kpi-libelle">Chiffrage restant</div><div class="kpi-valeur">${nb(chiffrage)}<span class="kpi-complement">j-h chiffrés</span></div></div>
      <div class="carte kpi"><div class="kpi-libelle">Complexité à saisir</div><div class="kpi-valeur" style="color:#D98A1C">${aSaisir}<span class="kpi-complement">rang provisoire</span></div></div></div>`;
}
const ecran = corps => `<div style="padding:24px;display:flex;flex-direction:column;gap:16px">${corps}</div>`;
const filtres = `<div class="ligne-flex" style="gap:10px"><div class="puces">
    <span class="puce active">Tous les statuts</span><span class="puce">Nouveau</span><span class="puce">Prêt pour dév</span>
    <span class="puce">En recette</span><span class="puce">En attente</span></div><span style="flex:1"></span>
    <select class="champ" style="height:30px;width:170px"><option>Tous les parcours</option></select>
    <select class="champ" style="height:30px;width:160px"><option>Tous les demandeurs</option></select></div>`;

/* ==== Piste 1 : liste priorisée (tableau classé par rang) ==== */
function piste1(selection) {
  const lignes = demandes.slice(0, 15).map(d => `<tr class="cliquable"${d === selection ? ' style="outline:2px solid #B7C8F5;outline-offset:-2px"' : ''}>
      <td class="code" style="font-size:13px;color:#141A26;font-weight:600">${d.rang}</td><td>${etoile(d)}</td>
      <td><div>${esc(coupe(d.titre, 90))}</div><div style="margin-top:3px">${etiquette(d.parcours)}</div></td>
      <td class="nowrap">${esc(d.demandeur)}</td><td style="text-align:center">${d.priorite ?? '—'}</td>
      <td style="text-align:center">${d.impactClient ?? '—'} / ${d.impactCollab ?? '—'}</td><td style="text-align:center">${d.complexite ?? '—'}</td>
      <td>${valScore(d)}</td><td>${badge(d.statut)}</td><td>${esc(d.sprint) || '<span class="pale">—</span>'}</td>
      <td style="text-align:right">${d.chiffrage ? nb(d.chiffrage) + ' j' : '<span class="pale">—</span>'}</td></tr>`).join('');
  return ecran(entete('Roadmap fonctionnelle du projet · demandes classées par rang de traitement DSI') + filtres +
    `<div class="carte" style="overflow:hidden"><table class="tableau"><thead><tr><th style="width:48px">Rang</th><th style="width:16px"></th><th style="width:36%">Demande</th><th>Demandeur</th>
      <th>Prio.</th><th title="Impact client / impact collaborateur">Impacts</th><th>Cplx.</th><th>Score</th><th>Statut</th><th>Sprint</th><th style="text-align:right">J-h</th></tr></thead>
      <tbody>${lignes}</tbody></table>
      <div class="discret" style="padding:10px 16px;font-size:12px">15 sur ${ouvertes} · ★ stratégique · impacts = client / collaborateur · rang = stratégique, puis priorité du demandeur, puis score</div></div>`);
}

/* ==== Fiche d'une demande (panneau latéral), avec le sprint en liste déroulante ==== */
function fiche(d) {
  const ligne = (l, v) => `<span>${l}</span><span>${v}</span>`;
  const liste = (v, opts) => `<select class="champ" style="height:30px">${opts.map(o => `<option${o === v ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  return `<div class="voile"></div><div class="panneau">
    <div class="panneau-entete"><div><div class="code">CDO · rang ${d.rang}</div><div style="font-size:16px;font-weight:600;margin-top:4px">${esc(d.titre)}</div>
      <div style="margin-top:6px" class="ligne-flex">${badge(d.statut)} ${etiquette(d.parcours)}</div></div><button class="fermer">✕</button></div>
    <div class="panneau-corps">
      <div><span class="libelle">Identification</span><div class="infos">${ligne('Demandeur', esc(d.demandeur))}${ligne('Parcours', esc(d.parcours))}${ligne('Catégorie', esc(d.categorie || '—'))}</div></div>
      <div><span class="libelle">Priorisation</span><div class="infos">
        ${ligne('Stratégique', liste(d.strategique ? 'Oui' : 'Non', ['Oui', 'Non']))}${ligne('Priorité', liste(String(d.priorite), ['1', '2', '3']))}
        ${ligne('Impact client', liste(String(d.impactClient), ['1', '2', '3']))}${ligne('Impact collab.', liste(String(d.impactCollab), ['1', '2', '3']))}
        ${ligne('Complexité', liste(String(d.complexite), ['1', '2', '3', '4', '5']))}
        ${ligne('Score / rang', `${valScore(d)} <span class="discret">→ rang ${d.rang} (calculé)</span>`)}</div></div>
      <div><span class="libelle">Développement et recette</span><div class="infos">
        ${ligne('Statut', liste(d.statut, Object.keys(STATUTS)))}
        ${ligne('Sprint', `<div style="position:relative"><div class="champ" style="height:30px;display:flex;align-items:center;justify-content:space-between;border-color:#003CC8">${esc(d.sprint || 'Choisir un sprint')}<span>▾</span></div>
          <div class="carte" style="position:absolute;left:0;right:0;top:34px;z-index:2;box-shadow:0 8px 24px rgba(10,22,51,.14);padding:4px 0">
          <div class="discret" style="padding:4px 10px;font-size:11px">Sprints du projet CDO (Administration › Sprints)</div>
          ${['— Non planifié —', ...SPRINTS.map(s => `${s.nom} · ${s.debut} → ${s.fin}`)].map((o, i) => `<div style="padding:6px 10px;${i === 1 ? 'background:#E8EEFF;color:#0033AD' : ''}">${o}</div>`).join('')}</div></div>`)}
        ${ligne('Chiffrage', '<input class="champ" style="height:30px;width:90px" value="' + (d.chiffrage ? nb(d.chiffrage) : '') + '"> j-h')}</div></div>
    </div><div class="panneau-pied"><button class="btn danger">Supprimer</button><span style="flex:1"></span><button class="btn">Annuler</button><button class="btn primaire">Enregistrer</button></div></div>`;
}

/* ==== Piste 2 : tableau Kanban par statut ==== */
function piste2() {
  const colonnes = ['Nouveau', 'Prêt pour dév', 'En attente', 'Recette DSI', 'Recette PO'];
  const carte = d => `<div class="fiche"><div class="ligne-flex" style="justify-content:space-between"><span class="code">#${d.rang} ${etoile(d)}</span>${d.score === null ? '<span class="badge" style="color:#8A4B00;background:#FFF1DC">cplx ?</span>' : `<span class="code">score ${nb(d.score)}</span>`}</div>
      <div style="font-weight:500">${esc(coupe(d.titre, 64))}</div><div class="ligne-flex" style="justify-content:space-between">${etiquette(d.parcours)}<span class="discret" style="font-size:11.5px">${esc(d.sprint)}</span></div></div>`;
  const cols = colonnes.map(s => { const l = demandes.filter(d => d.statut === s);
    return `<div class="colonne"><div class="colonne-titre">${badge(s)}<span class="discret">${l.length}</span></div>${l.slice(0, 5).map(carte).join('')}
      ${l.length > 5 ? `<div class="discret" style="text-align:center;font-size:12px">+ ${l.length - 5} autres</div>` : ''}</div>`; }).join('');
  return ecran(entete('Roadmap fonctionnelle du projet · suivi par statut (glisser une carte pour changer son statut)') + filtres +
    `<div class="kanban" style="grid-template-columns:repeat(5,minmax(0,1fr))">${cols}</div>`);
}

/* ==== Piste 3 : planification par sprint (charge chiffrée / capacité engageable) ==== */
function piste3() {
  // Exemple de planification : demandes déjà planifiées + suivantes par rang (illustratif)
  const plan = { Alnilam: demandes.filter(d => d.sprint === 'Alnilam') };
  const restantes = demandes.filter(d => !d.sprint && d.score !== null);
  plan.Alnitak = restantes.slice(0, 4); plan.Alphard = restantes.slice(4, 8); plan.Alpheratz = restantes.slice(8, 10);
  const chiffre = d => d.chiffrage || d.complexite || 1;
  const carte = d => `<div class="fiche" style="gap:3px"><div class="ligne-flex" style="justify-content:space-between"><span class="code">#${d.rang} ${etoile(d)}</span><span class="code">${nb(chiffre(d))} j-h</span></div>
      <div>${esc(coupe(d.titre, 58))}</div></div>`;
  const nonPlan = demandes.filter(d => !d.sprint && !Object.values(plan).flat().includes(d));
  const cols = [`<div class="colonne" style="background:#F5F7FA;border:1px dashed #C9D1DE"><div class="colonne-titre">À planifier<span class="discret">${nonPlan.length}</span></div>
      <div class="discret" style="font-size:12px;padding:0 4px">Par rang de traitement</div>${nonPlan.slice(0, 6).map(carte).join('')}</div>`,
    ...SPRINTS.map(s => { const l = plan[s.nom] || [], charge = l.reduce((t, d) => t + chiffre(d), 0), taux = charge / s.engageable;
      const coul = taux > 1 ? '#A32020' : taux > 0.85 ? '#D98A1C' : '#0F8A6B';
      return `<div class="colonne"><div class="colonne-titre" style="flex-direction:column;align-items:stretch;gap:4px">
          <div class="ligne-flex" style="justify-content:space-between"><span>${s.nom}</span><span class="code">${s.debut} → ${s.fin}</span></div>
          <span class="barre"><span style="width:${Math.min(100, taux * 100)}%;background:${coul}"></span></span>
          <span style="font-size:12px;font-weight:400;color:${coul}">${nb(charge)} j-h planifiés / ${nb(s.engageable)} j-h engageables</span></div>
        ${l.map(carte).join('')}</div>`; })].join('');
  return ecran(entete('Roadmap fonctionnelle du projet · planification dans les sprints (Administration › Sprints)') +
    `<div class="kanban" style="grid-template-columns:repeat(5,minmax(0,1fr))">${cols}</div>
    <div class="discret" style="font-size:12px">Capacité engageable reprise de l’onglet Capacité · sans chiffrage, la complexité sert d’estimation provisoire.</div>`);
}

/* ==== Piste 4 : matrice valeur / effort (aide à l'arbitrage) ==== */
function piste4() {
  const valeur = d => 0.5 * d.impactClient + 0.3 * d.impactCollab;
  const niveaux = [['Valeur forte', v => v >= 1.9], ['Valeur moyenne', v => v >= 1.3 && v < 1.9], ['Valeur faible', v => v < 1.3]];
  const avecCplx = demandes.filter(d => d.complexite && d.impactClient);
  const fond = (i, c) => (i === 0 && c <= 2) ? '#E3F5EC' : (i === 2 && c >= 4) ? '#FBEAEA' : '#fff';
  const cellules = niveaux.map(([lib, test], i) => `<div class="libelle" style="margin:0;align-self:center">${lib}</div>` +
    [1, 2, 3, 4, 5].map(c => { const l = avecCplx.filter(d => d.complexite === c && test(valeur(d)));
      return `<div class="carte" style="padding:8px 10px;min-height:110px;background:${fond(i, c)}"><div style="font-size:20px;font-weight:600">${l.length || ''}</div>
        ${l.slice(0, 3).map(d => `<div style="font-size:11.5px;margin-top:3px"><span class="code">#${d.rang}</span> ${esc(coupe(d.titre, 34))}</div>`).join('')}</div>`; }).join('')).join('');
  const sans = demandes.filter(d => !d.complexite);
  return ecran(entete('Roadmap fonctionnelle du projet · matrice valeur / effort pour arbitrer') +
    `<div style="display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:16px;align-items:start">
      <div class="carte" style="padding:16px"><div style="display:grid;grid-template-columns:110px repeat(5,minmax(0,1fr));gap:8px">
        <div></div>${[1, 2, 3, 4, 5].map(c => `<div class="libelle" style="text-align:center;margin:0">Complexité ${c}</div>`).join('')}${cellules}</div>
        <div class="ligne-flex discret" style="margin-top:12px;font-size:12px;gap:16px"><span><span class="pastille" style="background:#9ED9C2"></span> gains rapides : forte valeur, peu d’effort</span>
        <span><span class="pastille" style="background:#EDB3B3"></span> à challenger : faible valeur, effort élevé</span><span>Valeur = 0,5 × impact client + 0,3 × impact collab.</span></div></div>
      <div class="carte"><div class="carte-titre"><b>Complexité à saisir</b><span class="badge" style="color:#8A4B00;background:#FFF1DC">${sans.length}</span></div>
        <div style="padding:8px 16px">${sans.slice(0, 9).map(d => `<div style="padding:6px 0;border-bottom:1px solid #EEF1F5;font-size:12.5px"><span class="code">#${d.rang}</span> ${esc(coupe(d.titre, 40))}</div>`).join('')}
        <div class="discret" style="font-size:12px;padding-top:8px">Hors matrice tant que la complexité n’est pas saisie.</div></div></div></div>`);
}

/* ==== Captures ==== */
(async () => {
  const racine = path.resolve(__dirname, '../../../..');
  const s = spawn('node', [path.join(racine, 'tests/serveur-simule.js'), '8141'], { stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
  const b = await chromium.launch(); const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await c.addInitScript(() => { window.CONFIG_SURCHARGE = { NEON_AUTH_URL: location.origin + '/auth', DATA_API_URL: location.origin + '/rest/v1' }; });
  await c.route('**/fonts.g*/**', r => r.abort());
  const p = await c.newPage(); await p.goto('http://localhost:8141/app/'); await p.waitForSelector('input[name=email]');
  await p.fill('input[name=email]', 'camille@test.fr'); await p.fill('input[name=motDePasse]', 'motdepasse'); await p.click('form button');
  await p.waitForSelector('.laterale'); await p.click('[data-action="aller"][data-ecran="mesProjets"]'); await p.waitForTimeout(300);
  const pistes = [['piste-1-liste-priorisee', piste1()], ['piste-1b-fiche-demande', piste1(demandes[7]), fiche(demandes[7])],
    ['piste-2-kanban-statuts', piste2()], ['piste-3-planification-sprints', piste3()], ['piste-4-matrice-valeur-effort', piste4()]];
  for (const [nom, html, panneau] of pistes) {
    await p.evaluate(([h, pan]) => { document.querySelector('.contenu').innerHTML = h; document.querySelectorAll('.maquette-panneau').forEach(e => e.remove());
      if (pan) { const d = document.createElement('div'); d.className = 'maquette-panneau'; d.innerHTML = pan; document.body.appendChild(d); } }, [html, panneau]);
    await p.screenshot({ path: path.resolve(__dirname, `../${nom}.png`) });
  }
  await b.close(); s.kill();
})();
