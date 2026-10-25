/* ============================================================
   Mon dashboard › Trucs et astuces (menu à part, demande du porteur 2026-10-05 ;
   auparavant onglet de Mon dashboard › Administration)
   Deux thèmes (boutons du haut, maquette docs/maquettes/astuces-agile-roadmap/, 2026-10-12) :
   Agile — tout ce qui concerne l'agilité, en deux onglets :
   - KPI Agile Scrum et Kanban (textes : KPI_AGILE, config.js), avec un exemple
     chiffré par KPI calculé sur un projet choisi (CDO par défaut) ;
   - Rôles Scrum : organigramme détaillé (PO fonctionnel, PO technique, Scrum Master,
     tech lead, développeurs, QA…) et tableau « qui fait quoi » (ROLES_SCRUM,
     QUI_FAIT_QUOI_SCRUM, config.js ; maquette docs/maquettes/organigramme-scrum/).
   Roadmap — fiche pratique : vision → sprint, formats, méthode du projet, bonnes pratiques
   (textes : ROADMAP_ASTUCES, config.js).
   Test & Learn — méthode des projets IA (2026-10-15) : boucle hypothèse → décision, carte
   d'expérience, phases et critères de passage, indicateurs IA (textes : TEST_AND_LEARN, config.js).
   Lecture seule : aucune donnée n'est modifiée sur cet écran.
   ============================================================ */
'use strict';

Ecrans.astuces = {
  titre: 'Trucs et astuces',
  section: 'moi',
  sansEquipePermis: () => true,                  // utile même sans équipe ouverte
  // Thèmes (gros boutons du haut) : clé, libellé, ce qu'il contient, couleur et symbole de l'icône
  THEMES: [
    { cle: 'agile', libelle: 'Agile', detail: 'KPI Scrum et Kanban · Rôles Scrum', couleur: COULEURS.succes, symbole: '↻' },
    { cle: 'roadmap', libelle: 'Roadmap', detail: 'Construire et faire vivre une roadmap', couleur: COULEURS.violet, symbole: '➜' },
    { cle: 'testLearn', libelle: 'Test & Learn', detail: 'La méthode des projets IA', couleur: COULEURS.orange, symbole: '⚗' }
  ],

  rendre() {
    // Thèmes selon leur droit (matrice, migration 038) : le thème choisi s'il est permis, sinon le premier permis
    const permis = this.THEMES.filter(t => ongletPermis('astuces', t.cle)), u = ui('astuces', { theme: 'agile', onglet: 'kpi' });
    const theme = (permis.find(t => t.cle === u.theme) || permis[0] || {}).cle, onglet = u.onglet;
    const themes = permis.map(t => `<button class="theme${theme === t.cle ? ' actif' : ''}" data-action="themeAstuces" data-theme="${t.cle}">
      <span class="theme-icone" style="background:${t.couleur}">${t.symbole}</span><span><b>${t.libelle}</b><div class="discret">${t.detail}</div></span></button>`).join('');
    const puce = (cle, libelle) => `<button class="puce${onglet === cle ? ' active' : ''}" data-action="ongletAstuces" data-onglet="${cle}">${libelle}</button>`;
    const agile = `<div class="puces">${puce('kpi', 'KPI Agile')}${puce('roles', 'Rôles Scrum (organigramme)')}</div>
      ${onglet === 'roles' ? this.organigramme() : this.contenu()}`;
    return `
    <div class="ecran ecran-large">
      ${C.entete('Trucs et astuces', 'Fiches pratiques : agilité (KPI, rôles Scrum), roadmap et Test & Learn (projets IA)')}
      <div class="themes">${themes}</div>
      ${!theme ? C.aucunOnglet() : { roadmap: () => this.roadmap(), testLearn: () => this.testLearn() }[theme]?.() || agile}
    </div>`;
  },

  /* ---------- Roadmap : fiche pratique (textes ROADMAP_ASTUCES, config.js) ---------- */
  roadmap() {
    const esc = C.esc, R = ROADMAP_ASTUCES;
    const chaine = this.chaine(R.chaine);
    const formats = R.formats.map(f => `<div class="carte"><b style="color:${f.couleur}">${esc(f.titre)}</b><div class="discret">${esc(f.sousTitre)}</div>
      <div class="format-exemples">${f.exemples.map(([titre, detail], i) => `<div style="background:${f.fond[i]}"><b>${esc(titre)}</b><br>${esc(detail)}</div>`).join('')}</div>
      <div><b>Quand :</b> ${esc(f.quand)}</div></div>`).join('');
    const methodes = R.methodes.map(([methode, ...colonnes]) => `<tr><td><b>${esc(methode)}</b></td>${colonnes.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
    return `<div class="carte encart-moyen"><b>${esc(R.definition)}</b><div class="discret texte-12-5">${esc(R.precision)}</div></div>
      <div class="carte"><div class="carte-titre"><h2>De la vision au sprint</h2></div><div class="chaine">${chaine}</div></div>
      <div class="grille-formats">${formats}</div>
      <div class="carte"><div class="carte-titre"><h2>Selon la méthode du projet</h2><span class="discret">méthode choisie à la création du projet</span></div>
        <div class="defilement-x"><table class="tableau"><thead><tr><th>Méthode</th><th>Format conseillé</th><th>Unité de planification</th>
          <th>Revue de la roadmap</th></tr></thead>
        <tbody>${methodes}</tbody></table></div></div>
      <div class="grille-conseils">${this.listeConseils('✔ Bonnes pratiques', TONS.succes.texte, R.bonnesPratiques)}
        ${this.listeConseils('✕ Pièges à éviter', 'var(--danger)', R.pieges)}</div>
      <div class="carte encart-compact"><b>Dans ${esc(CONFIG.NOM_APPLICATION)}</b> : la roadmap se construit dans <b>Projets et Roadmap</b> (Gantt),
        la méthode du projet se choisit à sa création.</div>`;
  },

  // Étapes reliées par des flèches : [[étape, explication, couleur], …] (fiches Roadmap et Test & Learn)
  chaine(etapes) {
    return etapes.map(([etape, detail, couleur]) => `<div class="chaine-etape" style="border-top-color:${couleur}">
      <b>${C.esc(etape)}</b><div class="discret">${C.esc(detail)}</div></div>`).join('<div class="chaine-fleche">→</div>');
  },
  // Carte de conseils : titre coloré et liste à puces (bonnes pratiques, pièges, rituels)
  listeConseils(titre, couleur, lignes) {
    return `<div class="carte"><div class="carte-titre"><h2 style="color:${couleur}">${titre}</h2></div>
      <ul class="liste-conseils">${lignes.map(l => `<li>${C.esc(l)}</li>`).join('')}</ul></div>`;
  },

  /* ---------- Test & Learn : méthode des projets IA (textes TEST_AND_LEARN, config.js) ----------
     Même mise en page que la fiche Roadmap : encart de définition, chaîne (boucle), tableaux, conseils. */
  testLearn() {
    const esc = C.esc, T = TEST_AND_LEARN;
    const boucle = this.chaine(T.boucle);
    const tableau = (entetes, lignes) => `<div class="defilement-x"><table class="tableau"><thead><tr>${entetes.map(e => `<th>${e}</th>`).join('')}</tr></thead>
      <tbody>${lignes.map(([premiere, ...autres]) => `<tr><td><b>${esc(premiere)}</b></td>${autres.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    return `<div class="carte encart-moyen"><b>${esc(T.definition)}</b><div class="discret texte-12-5">${esc(T.precision)}</div></div>
      <div class="carte"><div class="carte-titre"><h2>La boucle Test & Learn</h2><span class="discret">on recommence avec l’hypothèse suivante ↺</span></div>
        <div class="chaine">${boucle}</div></div>
      <div class="carte"><div class="carte-titre"><h2>Carte d’expérience</h2><span class="discret">à remplir pour chaque test · exemple : Chatbot CDO</span></div>
        ${tableau(['Rubrique', 'À remplir', 'Exemple'], T.carte)}</div>
      <div class="carte"><div class="carte-titre"><h2>Les phases d’un projet IA</h2><span class="discret">on ne passe à la suivante que si le critère est atteint</span></div>
        ${tableau(['Phase', 'Objectif', 'Durée indicative', 'Critère de passage (go / no-go)'], T.phases)}</div>
      <div class="carte"><div class="carte-titre"><h2>Ce que l’on mesure sur un projet IA</h2></div>
        ${tableau(['Indicateur', 'Définition', 'Exemple'], T.indicateurs)}</div>
      <div class="grille-conseils">${this.listeConseils('↻ Rituels', 'var(--primaire)', T.rituels)}
        ${this.listeConseils('✔ Bonnes pratiques', TONS.succes.texte, T.bonnesPratiques)}</div>
      <div class="grille-conseils">${this.listeConseils('✕ Pièges à éviter', 'var(--danger)', T.pieges)}
        <div class="carte encart-compact"><b>Dans ${esc(CONFIG.NOM_APPLICATION)}</b> : notez chaque expérience et sa décision dans le <b>Daily</b>
          du projet IA (les blocages remontent dans Daily des équipes), planifiez les phases dans <b>Projets et Roadmap</b>
          (format Now / Next / Later) et fixez une boîte de temps pour chaque expérience.</div></div>`;
  },

  /* ---------- Rôles Scrum : organigramme détaillé ----------
     Sponsor (avec les parties prenantes à côté) → équipe Scrum : PO fonctionnel et PO technique
     (backlog unique co-priorisé), Scrum Master transverse → équipe de développement : tech lead,
     puis développeurs, QA et rôles d'appui. Traits : lignes CSS de .org-branches (theme.css). */
  carteRole(cle) {
    const esc = C.esc, r = ROLES_SCRUM[cle], couleur = FAMILLES_ROLES_SCRUM[r.famille].couleur;
    return `<div class="org-carte${r.pointille ? ' pointille' : ''}" style="border-top-color:${couleur}">
      <div class="org-titre" style="color:${couleur}">${esc(r.titre)}</div>
      ${r.sousTitre ? `<div class="org-sous-titre">${esc(r.sousTitre)}</div>` : ''}
      <div class="org-mission">${esc(r.mission)}</div>
      <ul>${r.actions.map(a => `<li>${esc(a)}</li>`).join('')}</ul>
      ${r.lien ? `<div class="org-lien">${esc(r.lien)}</div>` : ''}
      <div class="org-ceremonies">${r.ceremonies.map(c => `<span>${esc(c)}</span>`).join('')}</div></div>`;
  },

  // Onglet Rôles Scrum : légende, organigramme (sponsor → équipe Scrum → équipe de développement) et tableau « qui fait quoi »
  organigramme() {
    const esc = C.esc, carte = cle => this.carteRole(cle);
    const legende = Object.values(FAMILLES_ROLES_SCRUM).map(f => `<span class="ligne-flex">${C.pastille(f.couleur)}${esc(f.libelle)}</span>`).join('')
      + '<span class="ligne-flex"><span class="org-pointille-exemple"></span>transverse ou si besoin</span>';
    const tableau = `<table class="tableau tableau-roles"><thead><tr><th>Activité</th>
        ${QUI_FAIT_QUOI_SCRUM.colonnes.map(c => `<th class="num">${esc(ROLES_SCRUM[c].titre)}</th>`).join('')}</tr></thead>
      <tbody>${QUI_FAIT_QUOI_SCRUM.lignes.map(([activite, ...marques]) => `<tr><td><b>${esc(activite)}</b></td>
        ${marques.map(m => `<td class="num" style="font-size:16px;color:${m === '●' ? 'var(--primaire)' : 'var(--discret)'}">
          ${m}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    return `<div class="carte encart-moyen"><div class="ligne-flex" style="justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div><b>Organigramme d’une équipe Scrum</b><div class="discret texte-12-5">Le Product Ownership est partagé entre un PO fonctionnel et un PO technique,
          qui priorisent ensemble un backlog unique. Le Scrum Master sert toute l’équipe sans la diriger.</div></div>
        <div class="ligne-flex" style="gap:14px;font-size:12.5px">${legende}</div></div></div>
      <div class="carte org">
        <div class="org-haut"><div class="org-cote">${carte('partiesPrenantes')}<span class="org-tirets" title="besoins et retours"></span></div>
          ${carte('sponsor')}<div></div></div>
        <div class="org-trait"></div>
        <div class="org-cadre"><div class="org-cadre-titre">Équipe Scrum</div>
          <div class="org-noeud"><div class="org-groupe">Product Ownership <span class="discret">· backlog unique co-priorisé</span></div>
            <ul class="org-branches"><li>${carte('poFonctionnel')}</li><li>${carte('poTechnique')}</li><li>${carte('scrumMaster')}</li></ul></div>
          <div class="org-trait"></div>
          <div class="org-cadre org-cadre-dev"><div class="org-cadre-titre">Équipe de développement (Developers)</div>
            <div class="org-noeud">${carte('techLead')}
              <ul class="org-branches"><li>${carte('developpeurs')}</li><li>${carte('qa')}</li><li>${carte('uxUi')}</li><li>${carte('devops')}</li></ul></div></div>
        </div>
      </div>
      <div class="carte"><div class="carte-titre"><h2>Qui fait quoi</h2><span class="discret">● responsable · ○ contribue</span></div>${tableau}</div>`;
  },

  /* ---------- Trucs et astuces : KPI Agile (Scrum, Kanban) avec exemples chiffrés ----------
     Textes : KPI_AGILE (config.js). Exemples : calculés sur le projet choisi (par défaut CDO) —
     équipe, capacité et absences du sprint en cours sont réels ; les autres KPI (vélocité, flux…)
     sont illustratifs (signalés comme tels) et dimensionnés sur la taille de l'équipe, la notion
     de ticket ayant été retirée de l'application (2026-09-27). */
  contenu() {
    const esc = C.esc, n = Calculs.nombre;
    const projets = etat.d.projets.filter(p => etat.d.affectations.some(a => a.projetId === p.id));
    const choisi = parId('projets', ui('astuces', {}).projetId) || projets.find(p => p.nom === 'CDO') || projets[0];
    if (!choisi) return `<div class="carte">${C.vide('Aucun projet avec des membres : les exemples ont besoin d’un projet.')}</div>`;
    const ex = this.exemplesKpi(choisi);
    const selecteur = C.liste(projets.map(p => ({ valeur: p.id, libelle: p.nom })), choisi.id,
      'class="champ largeur-auto" data-action-change="projetAstuces"');
    const sections = KPI_AGILE.map(sec => `<div class="carte"><div class="carte-titre"><h2>${esc(sec.titre)}</h2></div>
      <table class="tableau tableau-kpi"><thead><tr><th>Indicateur</th><th>Définition / formule</th><th>Comment le lire</th><th>Exemple · ${esc(choisi.nom)}</th></tr></thead>
      <tbody>${sec.kpi.map(([cle, nom, def, lecture]) => `<tr><td><b>${esc(nom)}</b></td><td>${esc(def)}</td><td class="discret">${esc(lecture)}</td>
        <td>${ex[cle] || ''}</td></tr>`).join('')}</tbody></table></div>`).join('');
    return `<div class="carte encart-moyen"><div class="ligne-flex entre">
        <div><b>KPI Agile — Scrum et Kanban</b><div class="discret texte-12-5">Les exemples sont calculés sur le projet choisi.
          <span class="badge-reel">réel</span> = données du projet ;
          <span class="badge-illustratif">illustratif</span> = exemple à défaut de données suivies dans l’application.</div></div>
        <div class="ligne-flex"><span class="discret">Projet d’exemple</span>${selecteur}</div></div></div>${sections}`;
  },

  // Exemples chiffrés par KPI (clé de KPI_AGILE → HTML) pour un projet
  exemplesKpi(p) {
    const n = Calculs.nombre, esc = C.esc, fer = feries();
    const reel = t => `<span class="badge-reel">réel</span> ${t}`, illu = t => `<span class="badge-illustratif">illustratif</span> ${t}`;
    const membres = etat.d.affectations.filter(a => a.projetId === p.id).filter(a => estActive(a.ressourceId)).map(a => ressource(a.ressourceId));
    const nb = membres.length, noms = membres.map(r => esc(r.nom.split(' ')[0])).join(', ');
    const sprint = Calculs.sprintDe(Calculs.aujourdhui());
    const cap = Calculs.capacitePeriode(membres, sprint.debut, sprint.fin, etat.d.absences, fer);
    const scrum = Calculs.capaciteScrum(membres, cap.disponible);
    const absents = n(cap.theorique - cap.disponible);
    const velo = Math.round(nb * 6.5);                       // hypothèse illustrative : ~6,5 points par personne et par sprint
    return {
      velocite: illu(`${nb} personnes (${noms}) terminent ${velo - 3}, ${velo + 2} puis ${velo + 1} points sur 3 sprints → vélocité ≈ ${velo} points.`),
      capacite: reel(`Sprint ${sprint.numero} : ${n(cap.theorique)} j théoriques pour ${nb} personnes, ${absents} j d’absence → <b>${n(cap.disponible)} j</b> disponibles.`),
      engagement: illu(`L’équipe engage ${velo} points et en termine ${velo - 2} → say/do = ${Math.round((velo - 2) / velo * 100)} %.`),
      burndown: illu(`${velo} points sur 10 jours ouvrés → pente idéale ${n(velo / 10)} point/jour ; au jour 5, il devrait rester ≈ ${n(velo / 2)} points.`),
      burnup: illu(`Release de 120 points, ${velo * 3} livrés en 3 sprints ; si 10 points s’ajoutent au périmètre, la ligne cible monte à 130.`),
      objectif: illu('4 objectifs de sprint atteints sur les 5 derniers sprints → 80 %.'),
      focus: reel(`Capacité engageable ce sprint : (${n(cap.disponible)} − ${n(scrum.ceremonies)} j de cérémonies) × ${Math.round(CONFIG.FACTEUR_FOCUS * 100)} % = <b>
        ${n(scrum.engageable)} j</b>`)
        + `<br>${illu(`vélocité ${velo} points ÷ ${n(cap.disponible)} j = ${n(cap.disponible ? velo / cap.disponible : 0)} point/jour-homme.`)}`,
      debordement: illu(`3 points non terminés sur ${velo} engagés → ${Math.round(3 / velo * 100)} % de débordement.`),
      defauts: illu('2 anomalies remontées en recette après la livraison du sprint.'),
      imprevus: illu(`${n(cap.disponible * 0.15)} j de support sur ${n(cap.disponible)} j disponibles → 15 % d’imprévus.`),
      bonheur: illu(`Notes de rétrospective de ${noms} : 4, 3 et 4 → 3,7 / 5.`),
      leadTime: illu('Demande déposée le 1er septembre, livrée le 19 → lead time = 18 jours.'),
      cycleTime: illu('Travail commencé le 12 septembre, livré le 19 → cycle time = 7 jours.'),
      debit: illu(`${nb} personnes livrent 4 éléments par semaine.`),
      wip: illu(`WIP 6 ÷ débit 4 / semaine → cycle time moyen ≈ 1,5 semaine (loi de Little) ; limite conseillée ≈ ${nb * 2} (2 par personne).`),
      cfd: illu('La bande « En revue » passe de 2 à 6 éléments en 2 semaines → goulet d’étranglement en revue.'),
      age: illu('Un élément « En cours » depuis 12 jours alors que 85 % sont livrés en 10 jours → à regarder au daily.'),
      efficacite: illu('3 jours de travail actif sur 12 jours de lead time → 25 % d’efficacité de flux.'),
      bloque: illu('2 blocages cette semaine (identifiants de recette, attente d’arbitrage), 3 jours bloqués au total.'),
      sle: illu('Sur les 20 derniers éléments, 17 livrés en moins de 10 jours → « 85 % en moins de 10 jours ».')
    };
  }
};

Object.assign(Actions, {
  themeAstuces: d => majUi('astuces', { theme: d.theme }),
  ongletAstuces: d => majUi('astuces', { onglet: d.onglet }),
  projetAstuces: (_, el) => majUi('astuces', { projetId: el.value })
});
