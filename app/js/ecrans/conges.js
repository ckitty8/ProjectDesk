/* ============================================================
   Mon dashboard › Gestion des ressources › Congés & capacité
   (maquette 08-mCong.png ; blocs répartis en onglets à la demande du
   porteur, 2026-09-25)
   Onglets :
   - Grille mensuelle : choisir un type d'absence (« pinceau ») puis
     cliquer sur les jours pour l'appliquer ou le retirer ;
   - Récap annuel : mêmes personnes que la grille (droit CP : config.js) ;
   - Capacité par sprint et par équipe, en jours-homme.
   Modifiable : sa propre ligne et celles de ses équipes (règle RLS).
   ============================================================ */
'use strict';

Ecrans.conges = {
  titre: 'Gestion des ressources · Congés & capacité',
  section: 'moi',
  pinceau: () => ui('conges', { pinceau: ABSENCES.CP }).pinceau,
  onglet: () => ui('conges', { onglet: 'grille' }).onglet,

  rendre() {
    const esc = C.esc, pinceau = this.pinceau(), annee = Calendrier.moisCourant().annee;
    const pinceaux = [...valeursDe('abs').map(t => ({ id: t.libelle, libelle: t.libelle, couleur: t.couleur })), { id: 'effacer', libelle: 'Effacer', couleur: '#B3BAC7' }]
      .map(p => `<button class="puce${p.id === pinceau ? ' active' : ''}" data-action="choisirPinceau" data-id="${esc(p.id)}">
        <span class="pastille" style="background:${C.teinte(p.couleur, .2)};border:1px solid ${p.couleur}"></span>${esc(p.libelle)}</button>`).join('');

    // Récap annuel : mêmes personnes que la grille (toutes les équipes, groupées)
    const types = valeursDe('abs', true);
    const personnes = etat.d.equipes.flatMap(e => etat.d.ressources.filter(r => r.equipeId === e.id));
    const recap = personnes.map(r => {
      const rc = Calculs.recapConges(r.id, annee, etat.d.absences, types);
      return `<tr><td><span class="ligne-flex">${C.pastille(equipe(r.equipeId).couleur)}${esc(r.nom)}</span></td>
        <td><span class="ligne-flex"><span style="width:60px">${C.barre(rc.cpPris / CONFIG.DROIT_CP_ANNUEL * 100, '#003CC8', 'fine')}</span>${rc.cpPris}</span></td>
        ${types.filter(t => t.libelle !== ABSENCES.CP).map(t => `<td class="num">${rc.parType[t.libelle] || 0}</td>`).join('')}
        <td class="num"><b>${rc.total}</b></td><td class="num"><b>${rc.soldeCp}</b></td></tr>`;
    }).join('');

    // Capacité par sprint et par équipe
    const sprints = Calculs.sprintsAutour(Calculs.aujourdhui());
    const courant = Calculs.sprintDe(Calculs.aujourdhui()).numero, fer = feries();
    const cellule = cap => `<td><b>${Calculs.nombre(cap.disponible)} j</b> <span class="pale">/ ${Calculs.nombre(cap.theorique)}</span>
      <div style="width:70px">${C.barre(cap.theorique ? cap.disponible / cap.theorique * 100 : 0, '#003CC8', 'fine')}</div></td>`;
    const lignesCap = etat.d.equipes.map(e => {
      const pers = etat.d.ressources.filter(r => r.equipeId === e.id);
      if (!pers.length) return '';
      return `<tr><td><span class="ligne-flex">${C.pastille(e.couleur)}${esc(e.nom)}</span></td>${sprints.map(s => cellule(Calculs.capacitePeriode(pers, s.debut, s.fin, etat.d.absences, fer))).join('')}</tr>`;
    }).join('');
    const ligneTotal = `<tr class="groupe"><td>Total</td>${sprints.map(s => cellule(Calculs.capacitePeriode(etat.d.ressources, s.debut, s.fin, etat.d.absences, fer))).join('')}</tr>`;

    // Contenu de chaque onglet
    const onglet = this.onglet();
    const grille = `<div class="carte"><div class="carte-titre"><h2>Grille mensuelle</h2><div class="puces">${pinceaux}</div></div>${Calendrier.rendre(true)}</div>`;
    const recapAnnuel = `<div class="carte"><div class="carte-titre"><h2>Récap annuel ${annee}</h2><span class="discret">en jours · droit CP : ${CONFIG.DROIT_CP_ANNUEL} j</span></div>
      <table class="tableau"><thead><tr><th>Personne</th><th>CP pris</th>${types.filter(t => t.libelle !== ABSENCES.CP).map(t => `<th class="num">${esc(t.abrege || t.libelle)}</th>`).join('')}
        <th class="num">Total</th><th class="num">Solde</th></tr></thead>
        <tbody>${recap || `<tr><td colspan="8">${C.vide('Aucune ressource.')}</td></tr>`}</tbody></table></div>`;
    const capacite = `<div class="carte" style="overflow:auto"><div class="carte-titre"><h2>Capacité par sprint</h2><span class="discret">jours-homme disponibles / théoriques</span></div>
      <table class="tableau"><thead><tr><th>Équipe</th>${sprints.map(s => `<th ${s.numero === courant ? 'style="background:#F3F6FF;color:var(--primaire)"' : ''}>Sprint ${s.numero}${s.numero === courant ? ' · en cours' : ''}
        <div style="text-transform:none;letter-spacing:0">${Calculs.formatCourt(s.debut)} – ${Calculs.formatCourt(s.fin)}</div></th>`).join('')}</tr></thead>
        <tbody>${lignesCap}${ligneTotal}</tbody></table></div>`;
    const onglets = C.onglets([
      { id: 'grille', libelle: 'Grille mensuelle' },
      { id: 'recap', libelle: `Récap annuel ${annee}` },
      { id: 'capacite', libelle: 'Capacité par sprint' }
    ], onglet, 'ongletConges');
    // Navigation mensuelle : utile à la grille et au récap (année affichée)
    const navigation = onglet === 'capacite' ? '' : Calendrier.navigation();

    return `
    <div class="ecran">
      ${C.entete('Congés & capacité', onglet === 'grille' ? 'Choisissez un type d’absence puis cliquez sur les jours pour l’appliquer ou le retirer' : 'Absences, récapitulatif annuel et capacité des équipes', navigation)}
      ${onglets}
      ${{ grille, recap: recapAnnuel, capacite }[onglet]}
    </div>`;
  }
};

Object.assign(Actions, {
  ongletConges: d => majUi('conges', { onglet: d.id }),
  choisirPinceau: d => majUi('conges', { pinceau: d.id }),

  // Clic sur un jour : applique le type choisi, ou retire l'absence si c'est le même type (ou « Effacer »)
  basculerAbsence(d) {
    const pinceau = Ecrans.conges.pinceau();
    const existante = etat.d.absences.find(a => a.ressourceId === d.ressource && a.jour === d.jour);
    const filtre = { ressource_id: 'eq.' + d.ressource, jour: 'eq.' + d.jour };
    if (pinceau === 'effacer' || (existante && existante.type === pinceau)) {
      if (existante) executer(() => Api.supprimer('absences', filtre), 'absences');
    } else {
      executer(() => Api.creer('absences', { ressourceId: d.ressource, jour: d.jour, type: pinceau }, 'ressource_id,jour'), 'absences');
    }
  }
});
