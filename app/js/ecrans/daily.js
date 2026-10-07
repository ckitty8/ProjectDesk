/* ============================================================
   Mon dashboard › Daily — un daily PAR PROJET (maquette docs/maquettes/daily-par-projet/)
   - Une carte par projet où je suis affecté(e) (Chef de projet, Membre ; projet en cours),
     trois champs : Hier (la veille), Aujourd'hui, Blocages ; enregistrement automatique.
     Stockage : notes_daily_projet (migration 018), un texte par projet et par jour au
     format des rubriques (Calculs.decouperDaily / composerDaily).
   - Lien avec les congés : un jour d'absence d'une journée (Congés & capacité), aucun
     daily n'est attendu (cartes repliées) ; une demi-journée laisse la saisie ouverte.
   - Aide à la saisie : « Hier » rappelle l'« Aujourd'hui » noté le jour ouvré précédent.
   - Ancienne note unique du jour (notes_daily) : conservée, affichée en « note générale ».
   ============================================================ */
'use strict';

Ecrans.daily = {
  titre: 'Daily',
  section: 'moi',
  jour: () => ui('daily', { jour: Calculs.aujourdhui() }).jour,
  auChargement: () => recharger('notesProjet', 'notes'),
  // Ma note d'un projet un jour donné (texte au format des rubriques)
  texte: (projetId, jour) => (noteProjet(etat.session.user.id, projetId, jour) || {}).texte || '',
  // Ancienne note unique du jour (avant le daily par projet)
  noteGenerale: jour => (etat.d.notes.find(n => n.jour === jour && n.userId === etat.session.user.id) || {}).texte || '',

  // Jour ouvré précédent / suivant (on saute les week-ends)
  decaler(jour, sens) {
    let j = Calculs.ajouterJours(jour, sens);
    while (Calculs.estWeekend(j)) j = Calculs.ajouterJours(j, sens);
    return j;
  },

  // Bilan d'un jour : nombre de projets renseignés, et absence éventuelle (congés)
  bilan(jour, projets) {
    const moi = maRessource(), absence = moi && absenceDe(moi.id, jour);
    const absentJournee = !!absence && Calculs.dureeAbsence(absence) >= 1;
    return { absence, absentJournee, renseignes: projets.filter(p => this.texte(p.id, jour).trim()).length };
  },

  carteProjet(p, jour, absentJournee) {
    const esc = C.esc, champs = Calculs.decouperDaily(this.texte(p.id, jour));
    const veille = Calculs.decouperDaily(this.texte(p.id, this.decaler(jour, -1))).aujourdhui.split('\n')[0];
    const rempli = champs.hier.trim() || champs.aujourdhui.trim() || champs.blocages.trim();
    const etatCarte = absentJournee ? C.badge('Absent(e)', '#4A5363', '#F1F3F7')
      : rempli ? C.badge('Renseigné', '#0B6B4F', '#E3F5EC') : C.badge('À saisir', '#8A4B00', '#FFF3E0');
    const entete = `<div class="carte-titre"><span class="ligne-flex">${C.code(p.code)}<h2 style="font-size:15px">${esc(p.nom)}</h2></span>${etatCarte}</div>`;
    if (absentJournee && !rempli) return `<div class="carte">${entete}</div>`;   // carte repliée un jour d'absence
    const champ = (cle, titre, aide) => `<label class="champ-daily" style="padding:8px 0 0"><span class="libelle">${titre}</span>
      <textarea class="note-daily" style="min-height:62px" data-action-saisie="saisirNoteProjet" data-projet="${p.id}" data-champ="${cle}"
        placeholder="${esc(aide)}">${esc(champs[cle])}</textarea></label>`;
    return `<div class="carte" data-carte-projet="${p.id}">${entete}
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:0 16px 14px">
        ${champ('hier', 'Hier (la veille)', veille ? `Rappel d’hier : « ${veille} »` : 'Ce que j’ai fait hier…')}
        ${champ('aujourdhui', 'Aujourd’hui', 'Ce que je fais aujourd’hui…')}
        ${champ('blocages', 'Blocages', 'Ce qui me bloque (vide si rien)…')}</div></div>`;
  },

  rendre() {
    const esc = C.esc, jour = this.jour(), estAujourdhui = jour === Calculs.aujourdhui();
    const entete = C.entete('Daily', 'Un daily par projet sur lequel vous êtes affecté(e) · lié à vos congés', `
      <button class="btn" data-action="dailyAujourdhui">Aujourd’hui</button>
      <button class="btn" data-action="dailyDecaler" data-sens="-1" title="Jour précédent">‹</button>
      <button class="btn" data-action="dailyDecaler" data-sens="1" title="Jour suivant">›</button>`);
    if (!maRessource()) return `<div class="ecran">${entete}<div class="carte" style="padding:16px">Votre compte n’est lié à aucune fiche ressource :
      renseignez l’email de votre compte sur votre fiche (Liste des ressources), puis reconnectez-vous.</div></div>`;
    const projets = mesProjetsDaily(), b = this.bilan(jour, projets);

    // Historique : 12 derniers jours ouvrés jusqu'à aujourd'hui
    const historique = []; let j = Calculs.aujourdhui();
    if (Calculs.estWeekend(j)) j = this.decaler(j, -1);
    for (let i = 0; i < 12; i++) { historique.push(j); j = this.decaler(j, -1); }

    const bandeau = b.absence ? `<div class="carte" style="padding:12px 16px;background:#FFF8EC;border-color:#F3D9A8">
      ${b.absentJournee ? `Vous êtes en <b>${esc(b.absence.type)}</b> ce jour : aucun daily attendu.`
        : `Demi-journée de <b>${esc(b.absence.type)}</b> ce jour : la saisie reste ouverte.`}</div>` : '';
    const generale = this.noteGenerale(jour).trim() ? `<div class="carte"><div class="carte-titre"><h2 style="font-size:15px">Note générale</h2>
      <span class="discret">ancienne note du jour, avant le daily par projet</span></div>
      <div style="padding:0 16px 14px;line-height:1.55">${Ecrans.dailyEquipes.note(this.noteGenerale(jour))}</div></div>` : '';

    return `
    <div class="ecran" style="display:grid;grid-template-columns:minmax(0,1fr) 300px;align-items:start;max-width:1280px">
      <div class="pile" style="gap:16px">
        ${entete}
        <div class="carte" style="padding:12px 16px"><div class="ligne-flex" style="justify-content:space-between">
          <span class="ligne-flex"><h2 style="font-size:16px;margin:0">${Calculs.formatLong(jour)}</h2>${estAujourdhui ? C.badge('Aujourd’hui', '#0033AD', '#E8EEFF') : ''}</span>
          <span class="ligne-flex"><b id="daily-bilan">${b.absentJournee ? 'Absent(e)' : `${b.renseignes} / ${projets.length} projets renseignés`}</b>
            <span class="discret" id="etat-sauvegarde">· enregistrement automatique</span></span></div></div>
        ${bandeau}
        ${projets.map(p => this.carteProjet(p, jour, b.absentJournee)).join('') || `<div class="carte">${C.vide('Aucun projet en cours : vous n’êtes affecté(e) à aucun projet (hors rôle Lecteur).')}</div>`}
        ${generale}
      </div>
      <div class="carte historique" style="margin-top:58px">
        <div class="carte-titre"><h2>Historique ${C.aide('dailyVisibilite')}</h2></div>
        ${historique.map(h => {
          const bh = this.bilan(h, projets);
          return `<a class="${h === jour ? 'actif' : ''}" data-action="dailyAller" data-jour="${h}">
            <b>${Calculs.formatLong(h).split(' ').slice(0, 3).join(' ')}</b>
            <div>${bh.absentJournee ? C.badge(bh.absence.type, couleurDe('abs', bh.absence.type)) : `<span class="${bh.renseignes ? '' : 'pale'}">${bh.renseignes} / ${projets.length} projets</span>`}</div></a>`;
        }).join('')}
      </div>
    </div>`;
  }
};

// Enregistrement différé par projet : on attend 800 ms sans frappe avant d'écrire en base
const minuteursDaily = {};
async function enregistrerNoteProjet(projetId, jour, texte) {
  const indicateur = document.getElementById('etat-sauvegarde');
  try {
    // texte vide gardé tel quel (colonne non nulle) : effacer ses notes laisse une ligne vide
    const [note] = await Api.creer('notes_daily_projet', { userId: etat.session.user.id, jour, projetId, texte }, 'user_id,jour,projet_id', ['texte']);
    etat.d.notesProjet = (etat.d.notesProjet || []).filter(n => !(n.jour === jour && n.userId === note.userId && n.projetId === projetId)).concat(note);
    if (indicateur) indicateur.innerHTML = '· <span style="color:var(--succes)">●</span> enregistré';
    const bilan = document.getElementById('daily-bilan'), projets = mesProjetsDaily();
    if (bilan) bilan.textContent = `${Ecrans.daily.bilan(jour, projets).renseignes} / ${projets.length} projets renseignés`;
  } catch (e) {
    if (indicateur) indicateur.innerHTML = '· <span style="color:var(--danger)">●</span> échec : ' + C.esc(e.message);
  }
}

Object.assign(Actions, {
  // Frappe : pas de nouveau rendu (on garderait mal le curseur) ; on recompose le texte du projet
  saisirNoteProjet(d) {
    const valeur = cle => document.querySelector(`textarea[data-projet="${d.projet}"][data-champ="${cle}"]`).value;
    const texte = Calculs.composerDaily({ hier: valeur('hier'), aujourdhui: valeur('aujourdhui'), blocages: valeur('blocages') });
    document.getElementById('etat-sauvegarde').textContent = '· enregistrement…';
    const jour = Ecrans.daily.jour();
    clearTimeout(minuteursDaily[d.projet]);
    minuteursDaily[d.projet] = setTimeout(() => enregistrerNoteProjet(d.projet, jour, texte), 800);
  },
  dailyAujourdhui: () => majUi('daily', { jour: Calculs.aujourdhui() }),
  dailyAller: d => majUi('daily', { jour: d.jour }),
  dailyDecaler: d => majUi('daily', { jour: Ecrans.daily.decaler(Ecrans.daily.jour(), Number(d.sens)) })
});
