/* ============================================================
   Mon dashboard › Gestion des ressources › Congés & capacité
   (maquette 08-mCong.png ; blocs répartis en onglets à la demande du
   porteur, 2026-09-25)
   Onglets :
   - Grille mensuelle : choisir un type d'absence (« pinceau ») puis
     cliquer sur les jours pour l'appliquer ou le retirer ;
   - Récap annuel : jours travaillés / congés par mois et reste à prendre par rapport aux
     jours attendus par le client (par équipe et par année ; maquette recap-jours-travailles) ;
   - Capacité par sprint et par équipe, en jours-homme.
   Modifiable : sa propre ligne et celles de ses équipes (règle RLS).
   ============================================================ */
'use strict';

Ecrans.conges = {
  titre: 'Gestion des ressources · Congés & capacité',
  section: 'moi',
  pinceau: () => ui('conges', { pinceau: ABSENCES.CP }).pinceau,

  /* ---------- Capacité par sprint : calcul « type » Scrum, à titre d'information ----------
     Appliqué au sprint en cours pour chaque équipe (Calculs.capaciteScrum). */
  calculScrum(sprint, fer) {
    const esc = C.esc, n = Calculs.nombre;
    const lignes = etat.d.equipes.map(e => {
      const pers = etat.d.ressources.filter(r => r.equipeId === e.id);
      if (!pers.length) return '';
      const c = Calculs.capaciteScrum(pers, Calculs.capacitePeriode(pers, sprint.debut, sprint.fin, etat.d.absences, fer).disponible);
      return `<tr><td><span class="ligne-flex">${C.pastille(e.couleur)}${esc(e.nom)}</span></td><td class="num">${n(c.disponible)} j</td>
        <td class="num">− ${n(c.ceremonies)} j</td><td class="num">× ${Math.round(CONFIG.FACTEUR_FOCUS * 100)} %</td>
        <td class="num"><b>${n(c.engageable)} j</b></td><td class="num">${n(c.heures)} h</td></tr>`;
    }).join('');
    return `<div class="carte info-scrum"><div class="carte-titre"><h2>Calcul type Scrum — à titre d’information ${C.aide('calculScrum')}</h2>
        <span class="discret">Sprint ${sprint.numero} en cours</span></div>
      <div style="padding:0 16px 12px" class="discret">
        <b style="color:var(--texte)">Capacité engageable</b> = (jours-homme disponibles − cérémonies) × facteur de focus<br>
        · jours disponibles : jours ouvrés du sprint × capacité (%) de chaque personne, moins absences et fériés (tableau ci-dessus) ;<br>
        · cérémonies : ${n(CONFIG.CEREMONIES_JOURS_SPRINT)} j par personne et par sprint (planning, daily, revue, rétrospective, affinage) ;<br>
        · facteur de focus : ${Math.round(CONFIG.FACTEUR_FOCUS * 100)} % (interruptions, support, réunions hors sprint).<br>
        En points : engagement ≈ vélocité moyenne des 3 derniers sprints × (capacité de ce sprint ÷ capacité habituelle).</div>
      <table class="tableau"><thead><tr><th>Équipe</th><th class="num">Disponible</th><th class="num">Cérémonies</th><th class="num">Focus</th><th class="num">Engageable</th><th class="num">Soit</th></tr></thead>
        <tbody>${lignes}</tbody></table></div>`;
  },

  /* ---------- Onglet Récap annuel : jours travaillés / congés / reste à prendre ----------
     Reprise de l'onglet « Jours de congés » du fichier du porteur (maquette
     recap-jours-travailles). Calculs : Calculs.recapJoursTravailles ; objectif client
     par équipe et par année : objectifJoursTravail (table objectifs_jours_travail). */
  recap(annee) {
    const esc = C.esc, fer = feries(), n = Calculs.nombre;
    const MOIS = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
    const ouvres = MOIS.map((_, m) => Calculs.joursDuMois(annee, m).filter(j => !Calculs.estWeekend(j)).length);
    const reste = v => `<b class="${v < 0 ? 'reste-negatif' : 'reste-positif'}">${v > 0 ? '+' : ''}${n(v)}</b>`;

    const lignePersonne = (r, objectif, niveau) => {
      const rc = Calculs.recapJoursTravailles(r.id, annee, etat.d.absences, fer, objectif);
      return { rc, html: `<tr><td class="nom"><span class="ligne-flex" style="padding-left:${niveau * 16}px">${C.avatar(r.nom)}${esc(r.nom)}</span></td>
        ${rc.mois.map(m => `<td>${n(m.travailles)}</td><td class="conge">${m.conges ? n(m.conges) : '·'}</td>`).join('')}
        <td class="tot">${n(rc.travailles)}</td><td class="tot conge">${n(rc.conges)}</td><td class="tot">${reste(rc.reste)}</td></tr>` };
    };
    // Unité : ligne de groupe avec son objectif (modifiable par un admin ou le responsable), ses personnes, son total
    const unite = (e, niveau) => {
      const objectif = objectifJoursTravail(e.id, annee), modifiable = etat.estAdmin || estResponsableDe(e.id);
      const personnes = etat.d.ressources.filter(r => r.equipeId === e.id).map(r => lignePersonne(r, objectif, niveau + 1));
      const sous = etat.d.equipes.filter(x => x.parentId === e.id).map(x => unite(x, niveau + 1)).join('');
      if (!personnes.length && !sous) return '';
      const champObjectif = modifiable
        ? `<input type="number" min="1" max="366" step="0.5" class="champ objectif-client" value="${objectif}" data-action-change="objectifTravail" data-equipe="${e.id}" data-annee="${annee}">`
        : `<b>${n(objectif)}</b>`;
      const somme = f => personnes.reduce((s, p) => s + f(p.rc), 0);
      const total = personnes.length ? `<tr class="total"><td class="nom" style="padding-left:${(niveau + 1) * 16 + 12}px">Total ${esc(e.nom)}</td>
        ${MOIS.map((_, m) => `<td>${n(somme(rc => rc.mois[m].travailles))}</td><td class="conge">${n(somme(rc => rc.mois[m].conges))}</td>`).join('')}
        <td class="tot">${n(somme(rc => rc.travailles))}</td><td class="tot conge">${n(somme(rc => rc.conges))}</td><td class="tot"></td></tr>` : '';
      return `<tr class="groupe"><td colspan="${MOIS.length * 2 + 4}"><span class="ligne-flex" style="padding-left:${niveau * 16}px">
          ${C.icone(e.type === 'direction' ? 'direction' : 'equipe', 14)}${C.pastille(e.couleur)}${esc(e.nom)}
          <span class="discret" style="font-weight:400;margin-left:14px">Jours attendus par le client</span>${champObjectif}
          <span class="discret" style="font-weight:400">jours / personne</span>${C.aide('objectifClient')}</span></td></tr>`
        + personnes.map(p => p.html).join('') + total + sous;
    };
    const racines = etat.d.equipes.filter(e => !e.parentId || !parId('equipes', e.parentId));
    const lignes = [...racines.filter(e => e.type === 'direction'), ...racines.filter(e => e.type !== 'direction')].map(e => unite(e, 0)).join('');

    return `<div class="carte"><div class="carte-titre"><div class="ligne-flex">
        <button class="btn" data-action="anneePrecedente">‹</button><b style="min-width:60px;text-align:center">${annee}</b><button class="btn" data-action="anneeSuivante">›</button>
        <h2 style="margin-left:14px">Jours travaillés et congés ${C.aide('recapTravail')}</h2></div></div>
      <div style="overflow:auto"><table class="recap-travail">
        <thead><tr><th class="nom" rowspan="2">Personne</th>${MOIS.map(m => `<th colspan="2">${m}</th>`).join('')}
          <th rowspan="2">Total<br>travaillé</th><th rowspan="2">Total<br>congés</th><th rowspan="2">Reste à<br>prendre</th></tr>
          <tr>${MOIS.map(() => '<th>T</th><th class="conge">C</th>').join('')}</tr>
          <tr><td class="nom discret">Jours de semaine du mois</td>${ouvres.map(v => `<td colspan="2" class="discret">${v}</td>`).join('')}
            <td class="discret">${ouvres.reduce((a, b) => a + b, 0)}</td><td></td><td></td></tr></thead>
        <tbody>${lignes || `<tr><td colspan="${MOIS.length * 2 + 4}">${C.vide('Aucune ressource.')}</td></tr>`}</tbody></table></div></div>`;
  },
  onglet: () => ui('conges', { onglet: 'grille' }).onglet,

  rendre() {
    const esc = C.esc, pinceau = this.pinceau(), annee = Calendrier.moisCourant().annee;
    const pinceaux = [...valeursDe('abs').map(t => ({ id: t.libelle, libelle: t.libelle, couleur: t.couleur })), { id: 'effacer', libelle: 'Effacer', couleur: '#B3BAC7' }]
      .map(p => `<button class="puce${p.id === pinceau ? ' active' : ''}" data-action="choisirPinceau" data-id="${esc(p.id)}">
        <span class="pastille" style="background:${C.teinte(p.couleur, .2)};border:1px solid ${p.couleur}"></span>${esc(p.libelle)}</button>`).join('');

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
    // Sélecteur de mois juste au-dessus du calendrier, à gauche (demande du porteur)
    const grille = `<div class="carte"><div class="carte-titre"><div class="ligne-flex">${Calendrier.navigation()}${Calendrier.selecteurVue()}</div><div class="puces">${pinceaux}${C.aide('pinceau')}</div></div>${Calendrier.rendre(true)}</div>`;
    const recapAnnuel = this.recap(annee);
    const capacite = `<div class="carte" style="overflow:auto"><div class="carte-titre"><h2>Capacité par sprint ${C.aide('capaciteSprint')}</h2><span class="discret">jours-homme disponibles / théoriques</span></div>
      <table class="tableau"><thead><tr><th>Équipe</th>${sprints.map(s => `<th ${s.numero === courant ? 'style="background:#F3F6FF;color:var(--primaire)"' : ''}>Sprint ${s.numero}${s.numero === courant ? ' · en cours' : ''}
        <div style="text-transform:none;letter-spacing:0">${Calculs.formatCourt(s.debut)} – ${Calculs.formatCourt(s.fin)}</div></th>`).join('')}</tr></thead>
        <tbody>${lignesCap}${ligneTotal}</tbody></table></div>${this.calculScrum(sprints.find(s => s.numero === courant), fer)}`;
    const onglets = C.onglets([
      { id: 'grille', libelle: 'Grille mensuelle' },
      { id: 'recap', libelle: `Récap annuel ${annee}` },
      { id: 'capacite', libelle: 'Capacité par sprint' }
    ], onglet, 'ongletConges');

    return `
    <div class="ecran">
      ${C.entete('Congés & capacité', onglet === 'grille' ? 'Choisissez un type d’absence puis cliquez sur les jours pour l’appliquer ou le retirer' : 'Absences, récapitulatif annuel et capacité des équipes')}
      ${onglets}
      ${{ grille, recap: recapAnnuel, capacite }[onglet]}
    </div>`;
  }
};

Object.assign(Actions, {
  ongletConges: d => majUi('conges', { onglet: d.id }),
  anneePrecedente: () => majUi('calendrier', { annee: Calendrier.moisCourant().annee - 1 }),
  anneeSuivante: () => majUi('calendrier', { annee: Calendrier.moisCourant().annee + 1 }),
  // Objectif client d'une équipe pour l'année (upsert sur la clé équipe + année)
  objectifTravail(d, el) {
    const jours = Number(el.value);
    if (!(jours > 0 && jours <= 366)) return notifier('Nombre de jours invalide', 'erreur');
    executer(() => Api.creer('objectifs_jours_travail', { equipeId: d.equipe, annee: Number(d.annee), jours }, 'equipe_id,annee'), 'objectifsTravail');
  },
  choisirPinceau: d => majUi('conges', { pinceau: d.id }),

  // Clic sur un jour : applique le type choisi, ou retire l'absence si c'est le même type (ou « Effacer »)
  basculerAbsence(d) {
    const pinceau = Ecrans.conges.pinceau();
    // (un clic pose toujours une journée entière ; les demi-journées viennent de l'import du planning)
    const existante = etat.d.absences.find(a => a.ressourceId === d.ressource && a.jour === d.jour);
    const filtre = { ressource_id: 'eq.' + d.ressource, jour: 'eq.' + d.jour };
    if (pinceau === 'effacer' || (existante && existante.type === pinceau)) {
      if (existante) executer(() => Api.supprimer('absences', filtre), 'absences');
    } else {
      executer(() => Api.creer('absences', { ressourceId: d.ressource, jour: d.jour, type: pinceau, duree: 1 }, 'ressource_id,jour'), 'absences');
    }
  }
});
