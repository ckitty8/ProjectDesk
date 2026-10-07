/* ============================================================
   Général › Daily des équipes — daily PAR PROJET (maquette docs/maquettes/daily-par-projet/)
   Pour le jour choisi, les dailies des projets que je peux lire (peutLireDailyProjet, même
   règle qu'en base) : les projets où je suis affecté(e) ; le responsable d'une unité voit
   tous les projets de son unité et des unités rattachées (ex. Anne, Applications) ; un
   administrateur voit tout. Filtre par projet, « Blocages du jour » en tête, puis une carte
   par membre (affecté hors Lecteur, présent ce jour-là) : sa note du projet, ou « pas de
   daily » avec son absence éventuelle (Congés & capacité). Lecture seule.
   ============================================================ */
'use strict';

Ecrans.dailyEquipes = {
  titre: 'Daily des équipes',
  section: 'general',
  jour: () => ui('dailyEquipes', { jour: Calculs.aujourdhui() }).jour,
  auChargement: () => recharger('notesProjet'),

  // Membres d'un projet attendus au daily ce jour-là : affectés hors Lecteur et présents (arrivée / fin)
  membres(p, jour) {
    return etat.d.affectations.filter(a => a.projetId === p.id && a.role !== ROLES_PROJET.LECTEUR && estPresenteSur(a.ressourceId, jour))
      .map(a => ressource(a.ressourceId)).sort((x, y) => x.nom.localeCompare(y.nom));
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
    const esc = C.esc, jour = this.jour();
    const entete = C.entete('Daily des équipes', 'Daily par projet des membres de vos projets · lecture seule', `
      <button class="btn" data-action="dailyEquipesAujourdhui">Aujourd’hui</button>
      <button class="btn" data-action="dailyEquipesDecaler" data-sens="-1" title="Jour précédent">‹</button>
      <b style="min-width:210px;text-align:center">${Calculs.formatLong(jour)}</b>
      <button class="btn" data-action="dailyEquipesDecaler" data-sens="1" title="Jour suivant">›</button>`);
    const visibles = projetsDailyVisibles();
    if (!visibles.length) return `<div class="ecran">${entete}<div class="carte">${C.vide('Aucun projet en cours dont vous pouvez lire le daily.')}</div></div>`;

    const filtre = ui('dailyEquipes', { projet: 'tous' }).projet;
    const projets = visibles.filter(p => filtre === 'tous' || p.id === filtre);
    const noteDe = (r, p) => r.userId ? noteProjet(r.userId, p.id, jour) : null;
    const remplie = n => !!n && !!n.texte.trim();

    // Blocages du jour, tous projets affichés
    const blocages = projets.flatMap(p => this.membres(p, jour).filter(r => remplie(noteDe(r, p)))
      .flatMap(r => Calculs.blocagesDaily(noteDe(r, p).texte).map(texte => ({ code: p.code, nom: r.nom, texte }))));

    const puce = (id, libelle) => `<button class="puce${filtre === id ? ' active' : ''}" data-action="filtrerDailyEquipes" data-id="${id}">${esc(libelle)}</button>`;
    const puces = (visibles.length > 1 ? puce('tous', 'Tous mes projets') : '') + visibles.map(p => puce(p.id, `${p.code} · ${p.nom}`)).join('');

    // Carte d'un membre : sa note du projet, ou « pas de daily » (avec son absence du jour si elle est posée)
    const carte = (r, p) => {
      const n = noteDe(r, p);
      if (remplie(n)) return `<div class="carte" style="padding:14px 16px">
        <div class="ligne-flex" style="margin-bottom:8px">${C.avatar(r.nom)}<b style="flex:1">${esc(r.nom)}</b>${C.code(p.code)}</div>
        <div style="line-height:1.55">${this.note(n.texte)}</div></div>`;
      const absence = absenceDe(r.id, jour);
      const motif = absence ? `Pas de daily · absent(e) (${esc(absence.type)})` : r.userId ? 'Pas encore de daily sur ce projet' : 'Pas de compte relié à sa fiche';
      return `<div class="carte" style="padding:14px 16px;background:var(--fond-entete)"><div class="ligne-flex">${C.avatar(r.nom)}
        <b style="flex:1;color:var(--discret)">${esc(r.nom)}</b><span class="discret">${motif}</span></div></div>`;
    };
    const section = p => {
      const membres = this.membres(p, jour), avec = membres.filter(r => remplie(noteDe(r, p)));
      return `<div class="carte-titre" style="padding:6px 2px;border:0"><span class="ligne-flex">${C.code(p.code)}<h2 style="font-size:15px">${esc(p.nom)}</h2></span>
          <span class="discret">${avec.length} / ${membres.length} daily</span></div>
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;align-items:start;margin-bottom:14px">
          ${[...avec, ...membres.filter(r => !avec.includes(r))].map(r => carte(r, p)).join('') || C.vide('Aucun membre présent ce jour.')}</div>`;
    };

    return `
    <div class="ecran">
      ${entete}
      <div class="ligne-flex" style="flex-wrap:wrap"><div class="puces">${puces}</div><span style="flex:1"></span>
        <span class="discret">${blocages.length} blocage${blocages.length > 1 ? 's' : ''} signalé${blocages.length > 1 ? 's' : ''}</span></div>
      ${blocages.length ? `<div class="carte" style="border-color:#F3C1C1;background:#FFF5F5;padding:12px 16px"><b style="color:var(--danger)">Blocages du jour</b>
        <div style="margin-top:6px;display:grid;grid-template-columns:240px 1fr;gap:4px 12px">${blocages.map(b => `<span>${C.code(b.code)} ${esc(b.nom)}</span><span>${esc(b.texte)}</span>`).join('')}</div></div>` : ''}
      ${projets.map(section).join('')}
      <div class="discret" style="font-size:12px">Notes conservées à l’affichage sur ${JOURS_DAILY} jours. Vous voyez le daily de vos projets ; le responsable d’une unité voit tous les projets de son unité.</div>
    </div>`;
  }
};

Object.assign(Actions, {
  filtrerDailyEquipes: d => majUi('dailyEquipes', { projet: d.id }),
  dailyEquipesAujourdhui: () => majUi('dailyEquipes', { jour: Calculs.aujourdhui() }),
  dailyEquipesDecaler: d => majUi('dailyEquipes', { jour: Ecrans.daily.decaler(Ecrans.dailyEquipes.jour(), Number(d.sens)) })
});
