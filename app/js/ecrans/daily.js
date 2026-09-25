/* ============================================================
   Mon dashboard › Daily (maquette 06-mDaily.png)
   Note de stand-up du jour (privée), enregistrée automatiquement,
   modèle Hier / Aujourd'hui / Blocages, historique des jours ouvrés.
   ============================================================ */
'use strict';

const MODELE_DAILY = 'Hier\n- \n\nAujourd’hui\n- \n\nBlocages\n- ';

Ecrans.daily = {
  titre: 'Daily',
  section: 'moi',
  jour: () => ui('daily', { jour: Calculs.aujourdhui() }).jour,
  texte: jour => (etat.d.notes.find(n => n.jour === jour) || {}).texte || '',

  // Jour ouvré précédent / suivant (on saute les week-ends)
  decaler(jour, sens) {
    let j = Calculs.ajouterJours(jour, sens);
    while (Calculs.estWeekend(j)) j = Calculs.ajouterJours(j, sens);
    return j;
  },

  rendre() {
    const esc = C.esc, jour = this.jour(), texte = this.texte(jour), estAujourdhui = jour === Calculs.aujourdhui();
    // Historique : 12 derniers jours ouvrés jusqu'à aujourd'hui
    const historique = []; let j = Calculs.aujourdhui();
    if (Calculs.estWeekend(j)) j = this.decaler(j, -1);
    for (let i = 0; i < 12; i++) { historique.push(j); j = this.decaler(j, -1); }

    return `
    <div class="ecran" style="display:grid;grid-template-columns:minmax(0,1fr) 300px;align-items:start;max-width:1280px">
      <div class="pile" style="gap:16px">
        ${C.entete('Daily', 'Notes de stand-up quotidien', `
          <button class="btn" data-action="dailyAujourdhui">Aujourd’hui</button>
          <button class="btn" data-action="dailyDecaler" data-sens="-1" title="Jour précédent">‹</button>
          <button class="btn" data-action="dailyDecaler" data-sens="1" title="Jour suivant">›</button>`)}
        <div class="carte">
          <div class="carte-titre"><span class="ligne-flex"><h2 style="font-size:16px">${Calculs.formatLong(jour)}</h2>
            ${estAujourdhui ? C.badge('Aujourd’hui', '#0033AD', '#E8EEFF') : ''}</span>
            <a data-action="insererModele">Insérer le modèle Hier / Aujourd’hui / Blocages</a></div>
          <textarea class="note-daily" id="note-daily" data-action-saisie="saisirNote" placeholder="Vos notes du jour…">${esc(texte)}</textarea>
          <div class="carte-titre" style="border-top:1px solid var(--bordure-fine);border-bottom:0">
            <span class="discret" id="nb-mots">${Calculs.nbMots(texte)} mots</span>
            <span class="discret" id="etat-sauvegarde"><span style="color:var(--succes)">●</span> Enregistré automatiquement</span></div>
        </div>
      </div>
      <div class="carte historique" style="margin-top:58px">
        <div class="carte-titre"><h2>Historique</h2></div>
        ${historique.map(h => {
          const t = this.texte(h), pts = Calculs.nbPoints(t);
          const premier = t.split('\n').find(l => l.trim().startsWith('-') && l.trim().length > 2);
          return `<a class="${h === jour ? 'actif' : ''}" data-action="dailyAller" data-jour="${h}">
            <div class="ligne-flex" style="justify-content:space-between"><b>${Calculs.formatLong(h).split(' ').slice(0, 3).join(' ')}</b>
              <span class="pale">${pts ? pts + ' points' : ''}</span></div>
            <div class="${premier ? '' : 'pale'}" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${premier ? esc(premier.replace(/^\s*-\s*/, '')) : 'Aucune note'}</div></a>`;
        }).join('')}
      </div>
    </div>`;
  }
};

// Enregistrement différé : on attend 800 ms sans frappe avant d'écrire en base
let minuteurDaily = null;
async function enregistrerNote(jour, texte) {
  const indicateur = document.getElementById('etat-sauvegarde');
  try {
    const [note] = await Api.creer('notes_daily', { userId: etat.session.user.id, jour, texte }, 'user_id,jour');
    etat.d.notes = etat.d.notes.filter(n => n.jour !== jour).concat(note);
    if (indicateur) indicateur.innerHTML = '<span style="color:var(--succes)">●</span> Enregistré automatiquement';
  } catch (e) {
    if (indicateur) indicateur.innerHTML = '<span style="color:var(--danger)">●</span> Échec de l’enregistrement : ' + C.esc(e.message);
  }
}

Object.assign(Actions, {
  // Frappe : pas de nouveau rendu (on garderait mal le curseur), mise à jour ciblée du compteur
  saisirNote(_, el) {
    document.getElementById('nb-mots').textContent = Calculs.nbMots(el.value) + ' mots';
    document.getElementById('etat-sauvegarde').textContent = 'Enregistrement…';
    const jour = Ecrans.daily.jour(), texte = el.value;
    clearTimeout(minuteurDaily);
    minuteurDaily = setTimeout(() => enregistrerNote(jour, texte), 800);
  },
  async insererModele() {
    const zone = document.getElementById('note-daily');
    zone.value = zone.value.trim() ? zone.value + '\n\n' + MODELE_DAILY : MODELE_DAILY;
    await enregistrerNote(Ecrans.daily.jour(), zone.value);
    rendre();
  },
  dailyAujourdhui: () => majUi('daily', { jour: Calculs.aujourdhui() }),
  dailyAller: d => majUi('daily', { jour: d.jour }),
  dailyDecaler: d => majUi('daily', { jour: Ecrans.daily.decaler(Ecrans.daily.jour(), Number(d.sens)) })
});
