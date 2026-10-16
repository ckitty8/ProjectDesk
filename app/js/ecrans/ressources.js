/* ============================================================
   Suivi de mes équipes › Gestion des ressources (maquette 03-gRess.png) — lecture
   Calendrier mensuel des absences + annuaire des ressources.
   Le composant Calendrier est partagé avec Mon dashboard › Congés.
   Vues : « Par équipe » (chaque personne une fois, étiquettes de projets,
   synthèse des absents par projet) et « Par projet » (membres d'un projet).
   ============================================================ */
'use strict';

const Calendrier = {
  // Mois affiché (commun aux deux écrans calendrier) : { annee, mois (0-11) }
  moisCourant() {
    const j = Calculs.depuisIso(Calculs.aujourdhui());
    return ui('calendrier', { annee: j.getFullYear(), mois: j.getMonth() });
  },

  // Navigation de mois : [Aujourd'hui] ‹ octobre 2026 ›  (« Aujourd'hui » revient au mois en cours)
  navigation() {
    const { annee, mois } = this.moisCourant();
    return `<div class="ligne-flex"><button class="btn" data-action="calendrierAujourdhui">Aujourd’hui</button>
      <button class="btn" data-action="moisPrecedent">‹</button>
      <b style="min-width:130px;text-align:center">${Calculs.libelleMois(annee, mois)}</b>
      <button class="btn" data-action="moisSuivant">›</button></div>`;
  },

  // Vue du calendrier : « equipe » (défaut) ou « projet » (+ projet choisi) ; commune aux deux écrans
  vue: () => ui('calendrier', { mode: 'equipe', projetId: null }),
  // Projets proposés en vue « Par projet » (ceux qui ont des membres) et projet affiché
  projetsAvecMembres: () => etat.d.projets.filter(p => etat.d.affectations.some(a => a.projetId === p.id)),
  projetChoisi() { const liste = this.projetsAvecMembres(); return liste.find(p => p.id === this.vue().projetId) || liste[0] || null; },

  // Sélecteur « Par équipe / Par projet » (+ liste des projets en vue projet)
  selecteurVue() {
    const v = this.vue(), p = this.projetChoisi();
    return `<div class="ligne-flex" style="margin-left:14px"><div class="puces">
        <button class="puce${v.mode === 'equipe' ? ' active' : ''}" data-action="vueCalendrier" data-mode="equipe">Par équipe</button>
        <button class="puce${v.mode === 'projet' ? ' active' : ''}" data-action="vueCalendrier" data-mode="projet">Par projet</button></div>
      ${v.mode === 'projet' ? C.liste(this.projetsAvecMembres().map(x => ({ valeur: x.id, libelle: `${x.code} · ${x.nom}` })), p ? p.id : '',
        'class="champ champ-compact" data-action-change="projetCalendrier"') : ''}</div>`;
  },

  /* ---------- Tableau personnes × jours ----------
     Les méthodes ci-dessous reçoivent le « contexte » du mois affiché (contexte()) : jours, fériés,
     types d'absence, absences indexées par « personne|jour », et editable (clic pour poser/retirer). */
  contexte(editable) {
    const { annee, mois } = this.moisCourant();
    const jours = Calculs.joursDuMois(annee, mois);
    const absences = {};
    etat.d.absences.forEach(a => { absences[a.ressourceId + '|' + a.jour] = a; });
    return { editable, jours, fer: feries(), types: valeursDe('abs', true), absences, debut: jours[0], fin: jours[jours.length - 1] };
  },

  // Ligne d'en-tête : initiale et numéro de chaque jour (week-end / férié grisé, aujourd'hui marqué)
  enteteJours(ctx) {
    const aujourd = Calculs.aujourdhui();
    return ctx.jours.map(j => {
      const ferme = !Calculs.estJourOuvre(j, ctx.fer), d = Calculs.depuisIso(j);
      return `<th class="${ferme ? 'ferme' : ''} ${j === aujourd ? 'aujourdhui' : ''}">${Calculs.JOURS_INITIALES[d.getDay()]}<br>${d.getDate()}</th>`;
    }).join('');
  },

  /* Jour férié (table jours_feries) : affiché avec le type « Jours férié » (clé 'ferie', couleur et
     abrégé administrables) ; « F » gris si ce type est désactivé. Non cliquable, non décompté. */
  caseFeriee(ctx, j) {
    const esc = C.esc, typeFerie = ctx.types.find(x => x.libelle === ABSENCES.FERIE && x.actif);
    const libelle = ((etat.d.joursFeries || []).find(x => x.jour === j) || {}).libelle || 'Jour férié';
    return typeFerie
      ? `<span class="case-absence" title="${esc(libelle)}" style="color:${typeFerie.couleur};background:${C.teinte(typeFerie.couleur, .16)}">
        ${esc(typeFerie.abrege || 'JF')}</span>`
      : `<span title="${esc(libelle)}">F</span>`;
  },

  // Projets d'une personne en étiquettes (vue « Par équipe ») : 3 au plus, puis « +N » ; liste complète en infobulle
  etiquettes(r) {
    const esc = C.esc, MAX = 3;
    const liste = etat.d.affectations.filter(a => a.ressourceId === r.id).map(a => projet(a.projetId)).filter(Boolean);
    return liste.slice(0, MAX).map(p => `<span class="etiquette" title="${esc(p.code + ' · ' + p.nom)}">${esc(p.nom)}</span>`).join('')
      + (liste.length > MAX ? `<span class="etiquette" title="${esc(liste.slice(MAX).map(p => p.nom).join(', '))}">+${liste.length - MAX}</span>` : '');
  },

  /* Case d'une personne un jour ouvré : absence (demi-journée « ½ ») ; cliquable si editable. Renvoie { html, jours }.
     En lecture (Gestion des ressources), un jour sans absence qui est l'anniversaire de la personne porte 🎂. */
  caseAbsence(ctx, r, j) {
    const esc = C.esc, a = ctx.absences[r.id + '|' + j];
    const t = a && ctx.types.find(x => x.libelle === a.type), demi = a && Number(a.duree) === 0.5;
    const gateau = !ctx.editable && Calculs.estAnniversaire(r.dateNaissance, j) ? '<span class="anniversaire" title="Anniversaire">🎂</span>' : '';
    const contenu = t ? `<span class="case-absence" title="${esc(t.libelle)}${demi ? ' (demi-journée)' : ''}"
      style="color:${t.couleur};background:${C.teinte(t.couleur, .16)}">
      ${esc(t.abrege || t.libelle.slice(0, 2))}${demi ? '½' : ''}</span>` : gateau;
    const modifiable = ctx.editable && (r.id === (maRessource() || {}).id ? aDroit('mon_dashboard') : aDroit('conges_equipe'));
    const html = modifiable ? `<td class="cliquable" data-action="basculerAbsence" data-ressource="${r.id}" data-jour="${j}">${contenu}</td>`
      : `<td>${contenu}</td>`;
    return { html, jours: t ? (demi ? 0.5 : 1) : 0 };
  },

  // Ligne d'une personne (niveau = retrait ; complement = étiquettes, mention « responsable » sur une 2e ligne)
  lignePersonne(ctx, r, niveau, complement = '') {
    let total = 0;
    const cases = ctx.jours.map(j => {
      if (!Calculs.estJourOuvre(j, ctx.fer)) return `<td class="ferme">${ctx.fer.has(j) ? this.caseFeriee(ctx, j) : ''}</td>`;
      const c = this.caseAbsence(ctx, r, j);
      total += c.jours;
      return c.html;
    }).join('');
    return `<tr data-personne="${r.id}"><td class="nom"><span class="ligne-flex" style="padding-left:${niveau * 16}px">${C.avatar(r.nom)}
      <span><span>${C.esc(r.nom)}</span>${complement ? `<span class="nom-complement">${complement}</span>` : ''}</span></span></td>
        ${cases}${ctx.editable ? `<td class="num" style="padding:0 10px;white-space:nowrap">${Calculs.nombre(total)} j</td>` : ''}</tr>`;
  },

  // Ligne de titre (unité, projet) sur toute la largeur ; secondaire = intertitre discret
  ligneGroupe(ctx, contenu, niveau, secondaire) {
    return `<tr class="groupe"><td colspan="${ctx.jours.length + (ctx.editable ? 2 : 1)}">
      <span class="ligne-flex" style="padding-left:${niveau * 16}px;${secondaire ? 'font-weight:500;color:var(--discret)' : ''}">${contenu}</span></td></tr>`;
  },

  // Membres d'un projet présents sur le mois affiché
  membresDe(ctx, p) {
    return etat.d.affectations.filter(a => a.projetId === p.id).map(a => a.ressourceId)
      .filter(id => estPresenteSur(id, ctx.debut, ctx.fin));
  },

  // Synthèse d'un projet : absents / membres pour chaque jour ouvré (Calculs.absentsDuJour)
  ligneSynthese(ctx, p, niveau) {
    const ids = this.membresDe(ctx, p);
    const cases = ctx.jours.map(j => {
      if (!Calculs.estJourOuvre(j, ctx.fer)) return '<td class="ferme"></td>';
      const s = Calculs.absentsDuJour(ids, j, etat.d.absences);
      return s.niveau === 'aucun' ? '<td class="synthese-vide">·</td>'
        : `<td class="synthese ${s.niveau}" title="${Calculs.nombre(s.absents)} absent(s) sur ${s.total}">${Calculs.nombre(s.absents)}/${s.total}</td>`;
    }).join('');
    return `<tr class="ligne-synthese"><td class="nom"><span class="ligne-flex" style="padding-left:${niveau * 16}px">
      ${C.icone('projet', 14)}${C.esc(p.nom)}</span></td>${cases}${ctx.editable ? '<td></td>' : ''}</tr>`;
  },

  /* Vue « Par équipe » : chaque personne une seule fois sous son unité (responsable en tête), puis la
     synthèse des absences par projet de l'unité (maquette conges-sans-doublon, pistes 2 et 3). */
  unite(ctx, e, niveau) {
    const sousEquipes = etat.d.equipes.filter(x => x.parentId === e.id);
    const idsResponsables = responsablesDe(e.id).map(r => r.id), estResponsable = r => idsResponsables.includes(r.id);
    const projets = etat.d.projets.filter(p => p.equipeId === e.id && this.membresDe(ctx, p).length);
    const personnes = ressourcesPresentes(ctx.debut, ctx.fin).filter(r => r.equipeId === e.id)
      .sort((a, b) => estResponsable(b) - estResponsable(a));
    const responsable = r => estResponsable(r) ? '<span class="discret texte-11">responsable</span>' : '';
    const contenu = personnes.map(r => this.lignePersonne(ctx, r, niveau + 1, responsable(r) + this.etiquettes(r))).join('')
      + sousEquipes.map(x => this.unite(ctx, x, niveau + 1)).join('')
      + (projets.length ? this.ligneGroupe(ctx, `Projets — absents / membres par jour ${C.aide('syntheseProjets')}`, niveau + 1, true)
        + projets.map(p => this.ligneSynthese(ctx, p, niveau + 1)).join('') : '');
    if (!contenu) return '';
    const titre = `${C.icone(e.type === 'direction' ? 'direction' : 'equipe', 14)}${C.pastille(e.couleur)}${C.esc(e.nom)}`;
    return this.ligneGroupe(ctx, titre, niveau, false) + contenu;
  },

  // Vue « Par projet » : les membres du projet choisi, une fois chacun, puis sa synthèse
  lignesProjet(ctx) {
    const p = this.projetChoisi();
    if (!p) return '';
    const membres = this.membresDe(ctx, p);
    const titre = `${C.icone('projet', 14)}${C.code(p.code)} ${C.esc(p.nom)} <span class="discret poids-normal">${membres.length} membres</span>`;
    return this.ligneGroupe(ctx, titre, 0, false) + membres.map(id => this.lignePersonne(ctx, ressource(id), 1)).join('') + this.ligneSynthese(ctx, p, 1);
  },

  // Tableau personnes × jours ; editable = clic sur une case pour poser/retirer une absence (Congés & capacité)
  rendre(editable) {
    const ctx = this.contexte(editable);
    const lignes = this.vue().mode === 'projet' ? this.lignesProjet(ctx) : unitesRacines().map(e => this.unite(ctx, e, 0)).join('');
    return `<div class="calendrier"><table><thead><tr><th class="nom">Personne</th>${this.enteteJours(ctx)}${editable ? '<th>Total</th>' : ''}</tr></thead>
      <tbody>${lignes || `<tr><td class="nom" colspan="${ctx.jours.length + 1}">${C.vide('Aucune ressource.')}</td></tr>`}</tbody></table></div>`;
  },

  legende() {
    return `<div class="ligne-flex discret legende-calendrier">${valeursDe('abs').map(t =>
      `<span class="ligne-flex"><span class="pastille" style="background:${C.teinte(t.couleur, .2)};border:1px solid ${t.couleur}"></span>${C.esc(t.libelle)}</span>`).join('')}
      <span class="ligne-flex"><span class="pastille pastille-ferie"></span>Férié / week-end</span>
      ${naissanceDisponible() ? '<span class="ligne-flex">🎂 Anniversaire</span>' : ''}</div>`;
  }
};

Ecrans.ressources = {
  titre: 'Gestion des ressources',
  section: 'general',
  /* Deux onglets (maquette ressources-onglets-naissance, porteur 2026-10-16) : « Calendrier » des absences
     et « Liste des ressources » (annuaire filtrable). Réglages de l'écran : onglet, équipe, statut, recherche. */
  reglages: () => ui('ressources', { onglet: 'calendrier', equipeId: '', statut: '', q: '' }),

  // Onglet Calendrier : le composant Calendrier partagé, en lecture
  calendrier() {
    return `<div class="carte"><div class="carte-titre"><div class="ligne-flex">${Calendrier.navigation()}${Calendrier.selecteurVue()}</div>
      ${Calendrier.legende()}</div>${Calendrier.rendre(false)}</div>`;
  },

  // Fiches retenues par les filtres Équipe et Statut (la recherche par nom filtre les lignes affichées)
  fichesFiltrees(reg) {
    const statutOk = r => !reg.statut || (reg.statut === 'inactif') === estInactive(r);
    return etat.d.ressources.filter(r => (!reg.equipeId || r.equipeId === reg.equipeId) && statutOk(r));
  },

  // Rappel « Anniversaires d'<mois> » : personnes nées le mois en cours (jour et mois seulement)
  rappelAnniversaires() {
    if (!naissanceDisponible()) return '';
    const mois = Calculs.depuisIso(Calculs.aujourdhui()).getMonth();
    const liste = Calculs.anniversairesDuMois(etat.d.ressources.filter(r => !estInactive(r)), mois);
    const noms = liste.map(r => `<b>${C.esc(r.nom)}</b> (${Calculs.formatCourt(r.dateNaissance)})`).join(', ') || 'aucun';
    const libelle = Calculs.nomMois(mois), elision = ['a', 'o'].includes(libelle[0]);   // « d’avril, d’août, d’octobre »
    return `<span class="discret">🎂 Anniversaires ${elision ? 'd’' : 'de '}${libelle} : ${noms}</span>`;
  },

  // Barre de filtres : recherche (sans redessiner), équipe, statut, puis le rappel des anniversaires
  filtres(reg) {
    const equipes = optionsEquipes();
    const statuts = [{ valeur: '', libelle: 'Actifs et inactifs' }, { valeur: 'actif', libelle: 'Actifs' }, { valeur: 'inactif', libelle: 'Inactifs' }];
    return `<div class="carte"><div class="ligne-flex" style="gap:10px;flex-wrap:wrap">
      <label class="recherche-champ" style="width:260px">${C.icone('recherche')}<input placeholder="Rechercher une personne" value="${C.esc(reg.q)}"
        data-action-saisie="rechercherRessource"></label>
      ${C.liste(equipes, reg.equipeId, 'class="champ champ-compact" data-action-change="filtrerEquipeRessources"')}
      ${C.liste(statuts, reg.statut, 'class="champ champ-compact" data-action-change="filtrerStatutRessources"')}
      <span class="extensible"></span>${this.rappelAnniversaires()}</div></div>`;
  },

  /* Ligne de l'annuaire. Une personne avec une date de fin apparaît « Inactif » (grisée, en fin de liste)
     — demande du porteur 2026-10-06. data-recherche = nom en minuscules (recherche sans redessiner). */
  ligneAnnuaire(r, q, moisCourant) {
    const esc = C.esc, eq = equipe(r.equipeId), inactif = estInactive(r), nom = r.nom.toLowerCase();
    const fin = inactif ? ` <span class="discret texte-11">fin le ${Calculs.formatAvecAnnee(r.dateDepart)}</span>` : '';
    const gateau = r.dateNaissance && Calculs.depuisIso(r.dateNaissance).getMonth() === moisCourant ? ' 🎂' : '';
    const anniversaire = naissanceDisponible() ? `<td>${r.dateNaissance ? Calculs.formatCourt(r.dateNaissance) + gateau : '<span class="pale">—</span>'}</td>` : '';
    return `<tr data-recherche="${esc(nom)}"${inactif ? ' style="color:var(--discret)"' : ''}${q && !nom.includes(q) ? ' hidden' : ''}>
      <td><span class="ligne-flex">${C.avatar(r.nom)}${esc(r.nom)}</span></td>
      <td><span class="ligne-flex">${C.pastille(eq.couleur)}${esc(eq.nom)}</span></td>
      <td>${esc(r.poste || '—')}</td><td>${codesProjetsDe(r.id) || '<span class="pale">—</span>'}</td><td class="num">${r.capacite} %</td>
      <td>${C.badgeActif(!inactif, ['Actif', 'Inactif'])}${fin}</td>${anniversaire}</tr>`;
  },

  // Onglet Liste des ressources : filtres + annuaire de toutes les fiches (les autres écrans suivent la présence)
  liste() {
    const reg = this.reglages(), q = reg.q.trim().toLowerCase();
    const fiches = this.fichesFiltrees(reg).sort((a, b) => estInactive(a) - estInactive(b) || a.nom.localeCompare(b.nom));
    const moisCourant = Calculs.depuisIso(Calculs.aujourdhui()).getMonth(), colonnes = naissanceDisponible() ? 7 : 6;
    const lignes = fiches.map(r => this.ligneAnnuaire(r, q, moisCourant)).join('');
    return `${this.filtres(reg)}
      <div class="carte"><div class="carte-titre"><h2>Liste des ressources</h2>
        <span class="discret">${fiches.length} personnes · ${fiches.filter(estInactive).length} inactive(s)</span></div>
        <table class="tableau" id="annuaire-ressources"><thead><tr><th>Nom</th><th>Équipe</th><th>Poste</th><th>Projets</th><th class="num">Capacité</th>
          <th>Statut</th>${colonnes === 7 ? '<th>Anniversaire</th>' : ''}</tr></thead>
        <tbody>${lignes || `<tr><td colspan="${colonnes}">${C.vide('Aucune ressource.')}</td></tr>`}</tbody></table></div>`;
  },

  rendre() {
    const onglet = this.reglages().onglet;
    const onglets = C.onglets([{ id: 'calendrier', libelle: 'Calendrier' }, { id: 'liste', libelle: 'Liste des ressources' }],
      onglet, 'ongletRessources');
    return `
    <div class="ecran">
      ${C.entete('Gestion des ressources', 'Calendrier des absences et annuaire des ressources · lecture seule')}
      ${onglets}
      ${onglet === 'liste' ? this.liste() : this.calendrier()}
    </div>`;
  }
};

Object.assign(Actions, {
  // Gestion des ressources : onglet, filtres Équipe / Statut (redessinent)
  ongletRessources: d => majUi('ressources', { onglet: d.id }),
  filtrerEquipeRessources: (_, el) => majUi('ressources', { equipeId: el.value }),
  filtrerStatutRessources: (_, el) => majUi('ressources', { statut: el.value }),
  // Recherche par nom sans redessiner (garde la saisie) : masque les lignes ; mémorisée pour le prochain rendu
  rechercherRessource(_, el) {
    const q = el.value.trim().toLowerCase();
    majUi('ressources', { q: el.value }, { rendre: false });
    document.querySelectorAll('#annuaire-ressources tr[data-recherche]').forEach(tr => { tr.hidden = !tr.dataset.recherche.includes(q); });
  },
  vueCalendrier: d => majUi('calendrier', { mode: d.mode }),
  projetCalendrier: (_, el) => majUi('calendrier', { projetId: el.value }),
  // Retour au mois en cours (grille) et à l'année en cours (récap annuel, même réglage ui('calendrier'))
  calendrierAujourdhui() {
    const j = Calculs.depuisIso(Calculs.aujourdhui());
    majUi('calendrier', { annee: j.getFullYear(), mois: j.getMonth() });
  },
  moisPrecedent() { const m = Calendrier.moisCourant(); majUi('calendrier', m.mois === 0 ? { annee: m.annee - 1, mois: 11 } : { mois: m.mois - 1 }); },
  moisSuivant() { const m = Calendrier.moisCourant(); majUi('calendrier', m.mois === 11 ? { annee: m.annee + 1, mois: 0 } : { mois: m.mois + 1 }); }
});
