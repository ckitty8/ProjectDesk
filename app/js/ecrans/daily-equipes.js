/* ============================================================
   Général › Daily des équipes (maquette daily-equipes/daily-equipes.png)
   Notes de stand-up des membres de mes équipes pour un jour donné :
   filtre par équipe, encadré « Blocages du jour », une carte par
   membre (membres sans note signalés, avec leur absence éventuelle).
   Lecture seule. Droits en base : migration 004 (coéquipiers).
   ============================================================ */
'use strict';

Ecrans.dailyEquipes = {
  titre: 'Daily des équipes',
  section: 'general',
  jour: () => ui('dailyEquipes', { jour: Calculs.aujourdhui() }).jour,
  auChargement: () => recharger('notes'),

  // Membres affichés : ceux de mes équipes (ou de l'équipe filtrée), sans doublon.
  // Chaque membre garde la première équipe trouvée pour l'étiquette.
  membres(filtre) {
    const vus = new Map();
    mesEquipes().filter(e => filtre === 'toutes' || e.id === filtre).forEach(e =>
      (etat.membresEquipe[e.id] || []).forEach(m => { if (!vus.has(m.userId)) vus.set(m.userId, { ...m, equipe: e }); }));
    return [...vus.values()].sort((a, b) => a.nom.localeCompare(b.nom));
  },

  // Note affichée : rubriques en gras, rubrique « Blocages » en rouge (sauf « Aucun »)
  note(texte) {
    const esc = C.esc;
    return Calculs.rubriquesDaily(texte).map(r => {
      const bloquante = Calculs.estRubriqueBlocages(r.titre) && Calculs.blocagesDaily(texte).length;
      const style = bloquante ? ' style="color:var(--danger)"' : '';
      return (r.titre ? `<b${style}>${esc(r.titre)}</b><br>` : '') + r.lignes.map(l => `<span${style}>- ${esc(l)}</span><br>`).join('');
    }).join('');
  },

  rendre() {
    const esc = C.esc, jour = this.jour(), filtre = ui('dailyEquipes', { equipe: 'toutes' }).equipe;
    const entete = C.entete('Daily des équipes', 'Notes de stand-up des membres de vos équipes · lecture seule', `
      <button class="btn" data-action="dailyEquipesAujourdhui">Aujourd’hui</button>
      <button class="btn" data-action="dailyEquipesDecaler" data-sens="-1" title="Jour précédent">‹</button>
      <b style="min-width:210px;text-align:center">${Calculs.formatLong(jour)}</b>
      <button class="btn" data-action="dailyEquipesDecaler" data-sens="1" title="Jour suivant">›</button>`);
    if (!mesEquipes().length) return `<div class="ecran">${entete}<div class="carte">${C.vide('Vous n’êtes membre d’aucune équipe : aucun daily à afficher.')}</div></div>`;

    const membres = this.membres(filtre);
    const noteDe = userId => etat.d.notes.find(n => n.userId === userId && n.jour === jour);
    const avecNote = membres.filter(m => noteDe(m.userId) && noteDe(m.userId).texte.trim());
    const blocages = avecNote.flatMap(m => Calculs.blocagesDaily(noteDe(m.userId).texte).map(b => ({ nom: m.nom, texte: b })));

    const puce = (id, nom, couleur) => `<button class="puce${filtre === id ? ' active' : ''}" data-action="filtrerDailyEquipes" data-id="${id}">${C.pastille(couleur)}${esc(nom)}</button>`;
    const puces = (mesEquipes().length > 1 ? puce('toutes', 'Toutes mes équipes', '#8A93A3') : '') + mesEquipes().map(e => puce(e.id, e.nom, e.couleur)).join('');

    // Carte d'un membre : sa note, ou « pas de daily » (avec l'absence du jour si elle est posée)
    const carte = m => {
      const n = noteDe(m.userId), eqLabel = `<span class="ligne-flex discret">${C.pastille(m.equipe.couleur)}${esc(m.equipe.nom)}</span>`;
      if (n && n.texte.trim()) return `<div class="carte" style="padding:14px 16px">
        <div class="ligne-flex" style="margin-bottom:8px">${C.avatar(m.nom)}<b style="flex:1">${esc(m.nom)}</b>${eqLabel}</div>
        <div style="line-height:1.55">${this.note(n.texte)}</div></div>`;
      const fiche = etat.d.ressources.find(r => r.userId === m.userId);
      const absence = fiche && etat.d.absences.find(a => a.ressourceId === fiche.id && a.jour === jour);
      return `<div class="carte" style="padding:14px 16px;background:var(--fond-entete)"><div class="ligne-flex">${C.avatar(m.nom)}
        <b style="flex:1;color:var(--discret)">${esc(m.nom)}</b><span class="discret">${absence ? `Pas de daily · absent (${esc(absence.type)})` : 'Pas encore de daily'}</span></div></div>`;
    };

    return `
    <div class="ecran">
      ${entete}
      <div class="ligne-flex" style="flex-wrap:wrap"><div class="puces">${puces}</div><span style="flex:1"></span>
        <span class="discret">${avecNote.length} note${avecNote.length > 1 ? 's' : ''} sur ${membres.length} membres · ${blocages.length} blocage${blocages.length > 1 ? 's' : ''} signalé${blocages.length > 1 ? 's' : ''}</span></div>
      ${blocages.length ? `<div class="carte" style="border-color:#F3D9A8;background:#FFF8EC;padding:12px 16px"><b style="color:#8A4B00">Blocages du jour</b>
        <div style="margin-top:6px;display:grid;grid-template-columns:180px 1fr;gap:4px 12px">${blocages.map(b => `<span>${esc(b.nom)}</span><span>${esc(b.texte)}</span>`).join('')}</div></div>` : ''}
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;align-items:start">
        ${[...avecNote, ...membres.filter(m => !avecNote.includes(m))].map(carte).join('') || C.vide('Aucun membre.')}
      </div>
      <div class="discret" style="font-size:12px">Notes conservées à l’affichage sur ${JOURS_DAILY} jours.</div>
    </div>`;
  }
};

Object.assign(Actions, {
  filtrerDailyEquipes: d => majUi('dailyEquipes', { equipe: d.id }),
  dailyEquipesAujourdhui: () => majUi('dailyEquipes', { jour: Calculs.aujourdhui() }),
  dailyEquipesDecaler: d => majUi('dailyEquipes', { jour: Ecrans.daily.decaler(Ecrans.dailyEquipes.jour(), Number(d.sens)) })
});
