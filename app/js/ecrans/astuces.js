/* ============================================================
   Mon dashboard › Trucs et astuces (menu à part, demande du porteur 2026-10-05 ;
   auparavant onglet de Mon dashboard › Administration)
   Deux onglets :
   - KPI Agile Scrum et Kanban (textes : KPI_AGILE, config.js), avec un exemple
     chiffré par KPI calculé sur un projet choisi (CDO par défaut) ;
   - Rôles Scrum : organigramme détaillé (PO fonctionnel, PO technique, Scrum Master,
     tech lead, développeurs, QA…) et tableau « qui fait quoi » (ROLES_SCRUM,
     QUI_FAIT_QUOI_SCRUM, config.js ; maquette docs/maquettes/organigramme-scrum/).
   Lecture seule : aucune donnée n'est modifiée sur cet écran.
   ============================================================ */
'use strict';

Ecrans.astuces = {
  titre: 'Trucs et astuces',
  section: 'moi',
  sansEquipePermis: () => true,                  // utile même sans équipe ouverte
  rendre() {
    const onglet = ui('astuces', { onglet: 'kpi' }).onglet;
    const puce = (cle, libelle) => `<button class="puce${onglet === cle ? ' active' : ''}" data-action="ongletAstuces" data-onglet="${cle}">${libelle}</button>`;
    return `
    <div class="ecran" style="max-width:1500px">
      ${C.entete('Trucs et astuces', 'Les KPI Agile (Scrum, Kanban) et les rôles d’une équipe Scrum expliqués')}
      <div class="puces">${puce('kpi', 'KPI Agile')}${puce('roles', 'Rôles Scrum (organigramme)')}</div>
      ${onglet === 'roles' ? this.organigramme() : this.contenu()}
    </div>`;
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

  organigramme() {
    const esc = C.esc, carte = cle => this.carteRole(cle);
    const legende = Object.values(FAMILLES_ROLES_SCRUM).map(f => `<span class="ligne-flex">${C.pastille(f.couleur)}${esc(f.libelle)}</span>`).join('')
      + '<span class="ligne-flex"><span class="org-pointille-exemple"></span>transverse ou si besoin</span>';
    const tableau = `<table class="tableau tableau-roles"><thead><tr><th>Activité</th>
        ${QUI_FAIT_QUOI_SCRUM.colonnes.map(c => `<th class="num">${esc(ROLES_SCRUM[c].titre)}</th>`).join('')}</tr></thead>
      <tbody>${QUI_FAIT_QUOI_SCRUM.lignes.map(([activite, ...marques]) => `<tr><td><b>${esc(activite)}</b></td>
        ${marques.map(m => `<td class="num" style="font-size:16px;color:${m === '●' ? 'var(--primaire)' : 'var(--discret)'}">${m}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    return `<div class="carte" style="padding:14px 16px"><div class="ligne-flex" style="justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div><b>Organigramme d’une équipe Scrum</b><div class="discret" style="font-size:12.5px">Le Product Ownership est partagé entre un PO fonctionnel et un PO technique,
          qui priorisent ensemble un backlog unique. Le Scrum Master sert toute l’équipe sans la diriger.</div></div>
        <div class="ligne-flex" style="gap:14px;font-size:12.5px">${legende}</div></div></div>
      <div class="carte org">
        <div class="org-haut"><div class="org-cote">${carte('partiesPrenantes')}<span class="org-tirets" title="besoins et retours"></span></div>${carte('sponsor')}<div></div></div>
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
    const selecteur = C.liste(projets.map(p => ({ valeur: p.id, libelle: `${p.code} · ${p.nom}` })), choisi.id,
      'class="champ" style="width:auto" data-action-change="projetAstuces"');
    const sections = KPI_AGILE.map(sec => `<div class="carte"><div class="carte-titre"><h2>${esc(sec.titre)}</h2></div>
      <table class="tableau tableau-kpi"><thead><tr><th>Indicateur</th><th>Définition / formule</th><th>Comment le lire</th><th>Exemple · ${esc(choisi.nom)}</th></tr></thead>
      <tbody>${sec.kpi.map(([cle, nom, def, lecture]) => `<tr><td><b>${esc(nom)}</b></td><td>${esc(def)}</td><td class="discret">${esc(lecture)}</td>
        <td>${ex[cle] || ''}</td></tr>`).join('')}</tbody></table></div>`).join('');
    return `<div class="carte" style="padding:14px 16px"><div class="ligne-flex" style="justify-content:space-between">
        <div><b>KPI Agile — Scrum et Kanban</b><div class="discret" style="font-size:12.5px">Les exemples sont calculés sur le projet choisi.
          <span class="badge-reel">réel</span> = données du projet ; <span class="badge-illustratif">illustratif</span> = exemple à défaut de données suivies dans l’application.</div></div>
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
      focus: reel(`Capacité engageable ce sprint : (${n(cap.disponible)} − ${n(scrum.ceremonies)} j de cérémonies) × ${Math.round(CONFIG.FACTEUR_FOCUS * 100)} % = <b>${n(scrum.engageable)} j</b>`)
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
  ongletAstuces: d => majUi('astuces', { onglet: d.onglet }),
  projetAstuces: (_, el) => majUi('astuces', { projetId: el.value })
});
