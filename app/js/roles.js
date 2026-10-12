/* ============================================================
   Rôles : qui a quel rôle — Administration › onglet « ★ Rôles » (créateur)
   (maquette docs/maquettes/liste-roles/ ; demande du porteur 2026-10-12)
   ------------------------------------------------------------
   Lecture seule : les rôles sont calculés à partir des données existantes, à un seul
   endroit (ce fichier), pour être réutilisés par « Rôles et droits » :
   - Créateur : table createur (migration 025) ;
   - Administrateur : table administrateurs ;
   - Responsable d'équipe : responsable de l'unité (fiche) ou owner / admin de l'organisation ;
   - Chef de projet, Membre, Lecteur : affectations aux projets (et chef de la fiche projet) ;
   - Compte en attente : inscrit sans équipe (comptes_en_attente, migration 024).
   ============================================================ */
'use strict';

const Roles = {
  /* Rôles affichés, du plus large au plus restreint : clé, libellé, couleur, ce que le rôle permet.
     Liste unique : reprise par la Simulation des rôles (simulation.js), hors Créateur. */
  LISTE: [
    { cle: 'createur', libelle: 'Créateur', couleur: '#5B2A9E', description: 'Tous les droits sur toutes les équipes ; seul à nommer un administrateur.' },
    { cle: 'admin', libelle: 'Administrateur', couleur: '#003CC8', description: 'Équipes, référentiels, jours fériés, comptes en attente.' },
    { cle: 'responsable', libelle: 'Responsable d’équipe', couleur: '#7A3FC2', description: 'Son unité : valide les timesheets, lit tous les daily de l’unité, règle les envois.' },
    { cle: 'chef', libelle: 'Chef de projet', couleur: '#0F8A6B', description: 'Ses projets : plan de charge, envoi du daily, sprints.' },
    { cle: 'membre', libelle: 'Membre de projet', couleur: '#4A5363', description: 'Saisit son daily, ses heures et ses congés.' },
    { cle: 'lecteur', libelle: 'Lecteur de projet', couleur: '#8A93A3', description: 'Consulte ses projets sans les modifier.' },
    { cle: 'sansEquipe', libelle: 'Compte en attente', couleur: '#B25E09', description: 'Inscrit, sans accès tant qu’un administrateur ne l’a pas donné.' }
  ],

  /* Rôles d'une fiche ressource : liste de { cle, precision } (ex. Chef de projet · CDO).
     Un même rôle de projet peut apparaître plusieurs fois (un par projet). */
  dePersonne(r) {
    const roles = [];
    const compte = r.userId;
    if (compte && (etat.d.createur || []).some(c => c.userId === compte)) roles.push({ cle: 'createur' });
    if (compte && etat.d.administrateurs.some(a => a.userId === compte)) roles.push({ cle: 'admin' });
    // Responsable : mêmes règles que le rôle d'accès (etat.js) — désigné sur une unité, ou owner / admin
    // de l'organisation de son équipe
    const unites = etat.d.equipes.filter(e => e.responsableId === r.id);
    if (!estResponsableDesigne(r) && estResponsableEquipe(r)) unites.push(equipe(r.equipeId));
    unites.forEach(e => roles.push({ cle: 'responsable', precision: e.nom }));
    const roleProjet = { [ROLES_PROJET.CHEF]: 'chef', [ROLES_PROJET.MEMBRE]: 'membre', [ROLES_PROJET.LECTEUR]: 'lecteur' };
    etat.d.affectations.filter(a => a.ressourceId === r.id).forEach(a => {
      const p = projet(a.projetId);
      if (p && roleProjet[a.role]) roles.push({ cle: roleProjet[a.role], precision: p.nom });
    });
    // Chef désigné sur la fiche projet sans affectation « Chef de projet »
    etat.d.projets.filter(p => p.chefId === r.id && !roles.some(x => x.cle === 'chef' && x.precision === p.nom))
      .forEach(p => roles.push({ cle: 'chef', precision: p.nom }));
    return roles;
  },

  // Personnes par rôle (pour la vue « par rôle ») : { cle: [{ nom, precision }] }
  parRole() {
    const groupes = Object.fromEntries(this.LISTE.map(role => [role.cle, []]));
    ressourcesActives().forEach(r => this.dePersonne(r).forEach(x => groupes[x.cle].push({ nom: r.nom, precision: x.precision })));
    // Créateur et administrateurs dont le compte n'est relié à aucune fiche ressource (toutes les fiches,
    // présentes ou parties : une fiche inactive reste reliée au compte — DAT § 10, point 7)
    const sansFiche = userId => !(etat.d.ressources || []).some(r => r.userId === userId);
    (etat.d.createur || []).filter(c => sansFiche(c.userId)).forEach(c => groupes.createur.push({ nom: c.email, precision: 'compte sans fiche' }));
    etat.d.administrateurs.filter(a => sansFiche(a.userId)).forEach(() => groupes.admin.push({ nom: 'Compte sans fiche ressource' }));
    etat.comptesEnAttente.filter(c => !c.invite).forEach(c => groupes.sansEquipe.push({ nom: c.nom || c.email, precision: c.email }));
    return groupes;
  },

  badge(cle, precision) {
    const role = this.LISTE.find(x => x.cle === cle);
    return C.badge(role.libelle + (precision ? ' · ' + precision : ''), role.couleur);
  },

  // Onglet d'Administration : vue par rôle (cartes) puis vue par personne (tableau)
  onglet() {
    const esc = C.esc, groupes = this.parRole();
    const cartes = this.LISTE.map(role => {
      const personnes = groupes[role.cle];
      return `<div class="carte" style="padding:12px 14px;border-top:4px solid ${role.couleur}">
        <div class="ligne-flex" style="justify-content:space-between"><b style="color:${role.couleur}">${esc(role.libelle)}</b>
          <span class="discret">${personnes.length}</span></div>
        <div class="discret" style="font-size:12px;margin:4px 0 8px">${esc(role.description)}</div>
        ${personnes.map(x => `<div style="padding:2px 0">${esc(x.nom)}${x.precision ? ` <span class="discret">· ${esc(x.precision)}</span>` : ''}</div>`).join('')
          || '<div class="pale">personne</div>'}</div>`;
    }).join('');
    const lignes = ressourcesActives().sort((a, b) => a.nom.localeCompare(b.nom)).map(r => {
      const roles = this.dePersonne(r);
      return `<tr><td><span class="ligne-flex">${C.avatar(r.nom)}<b>${esc(r.nom)}</b></span></td>
        <td><span class="ligne-flex">${C.pastille(equipe(r.equipeId).couleur)}${esc(equipe(r.equipeId).nom)}</span></td>
        <td>${r.userId ? C.badge('Oui', '#0B6B4F', '#E3F5EC') : '<span class="pale">pas de compte</span>'}</td>
        <td><span class="ligne-flex" style="flex-wrap:wrap;gap:4px">${roles.map(x => this.badge(x.cle, x.precision)).join('') || '<span class="pale">aucun rôle</span>'}</span></td></tr>`;
    }).join('');
    return `<div class="carte" style="padding:12px 16px;background:#F5F0FD;border-color:#D9C7F5">
        <b>Qui a quel rôle.</b> Consultation : les rôles viennent des données (créateur, administrateurs, responsables des unités,
        affectations aux projets, comptes en attente). Ils se modifieront ici avec « Rôles et droits ».</div>
      <div class="grille-roles">${cartes}</div>
      <div class="carte"><div class="carte-titre"><h2>Par personne</h2><span class="discret">${ressourcesActives().length} personnes présentes</span></div>
        <table class="tableau"><thead><tr><th>Personne</th><th>Équipe</th><th>Compte relié</th><th>Rôles</th></tr></thead>
        <tbody>${lignes}</tbody></table></div>`;
  }
};
