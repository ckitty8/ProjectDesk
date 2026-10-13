/* ============================================================
   Rôles : Administration › onglet « Rôles » (administrateurs)
   (maquettes docs/maquettes/liste-roles/ et affecter-roles/ ; porteur 2026-10-12 et 2026-10-13)
   ------------------------------------------------------------
   - Rôle d'accès de chaque personne, choisi ici (Administrateur, Responsable d'équipe, Membre) :
     fonction affecter_role (migration 029) ; rôle prévu si la personne n'est pas encore connectée.
   - Vue « qui a quel rôle » : rôles calculés à partir des données, à un seul endroit (ce fichier) :
   - Créateur : table createur (migration 025) ;
   - Administrateur : table administrateurs ;
   - Responsable d'équipe : responsables_equipe (migration 027) ou owner / admin de l'organisation ;
   - Chef de projet, Membre, Lecteur : affectations aux projets (et chef de la fiche projet) ;
   - Compte en attente : inscrit sans équipe (comptes_en_attente, migration 024).
   ============================================================ */
'use strict';

const Roles = {
  /* Rôles affichés, du plus large au plus restreint : clé, libellé, couleur, ce que le rôle permet.
     Liste unique : reprise par la Simulation des rôles (simulation.js), hors Créateur. */
  LISTE: [
    { cle: 'createur', libelle: 'Créateur', couleur: COULEURS.createur, description: 'Tous les droits sur toutes les équipes ; seul à nommer un administrateur.' },
    { cle: 'admin', libelle: 'Administrateur', couleur: COULEURS.primaire, description: 'Équipes, référentiels, jours fériés, comptes en attente.' },
    { cle: 'responsable', libelle: 'Responsable d’équipe', couleur: COULEURS.violet,
      description: 'Son unité : valide les timesheets, lit tous les daily de l’unité, règle les envois.' },
    { cle: 'chef', libelle: 'Chef de projet', couleur: COULEURS.succes, description: 'Ses projets : plan de charge, envoi du daily, sprints.' },
    { cle: 'membre', libelle: 'Membre de projet', couleur: COULEURS.neutre, description: 'Saisit son daily, ses heures et ses congés.' },
    { cle: 'lecteur', libelle: 'Lecteur de projet', couleur: COULEURS.pale, description: 'Consulte ses projets sans les modifier.' },
    { cle: 'sansEquipe', libelle: 'Compte en attente', couleur: COULEURS.orange, description: 'Inscrit, sans accès tant qu’un administrateur ne l’a pas donné.' }
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
    const unites = etat.d.equipes.filter(e => responsablesDe(e.id).includes(r));
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

  /* ---------- Onglet Administration › Rôles (maquette docs/maquettes/affecter-roles/) ----------
     Ouvert à tous les administrateurs (porteur, 2026-10-13). Le rôle d'accès de chaque personne se
     choisit dans la liste de sa ligne et s'enregistre aussitôt (fonction affecter_role, migration 029).
     Personne pas encore connectée (ou email non vérifié) : rôle prévu, appliqué à sa connexion. */
  // Rôle d'accès affiché dans la liste : le rôle prévu s'il y en a un, sinon le rôle actuel, compte relié ou non
  roleChoisi: r => rolePrevu(r) || roleDeLaFiche(r),

  // Projets d'une personne, un par ligne : code, nom et son rôle sur le projet
  projetsDe(r) {
    const esc = C.esc;
    return affectationsDe(r.id).map(a => `<div class="ligne-flex projet-role">${C.code(projet(a.projetId).code)}${esc(projet(a.projetId).nom)}
      <span class="discret texte-12">· ${esc(a.role)}</span></div>`).join('') || '<span class="pale">aucun projet</span>';
  },

  /* Ligne d'un utilisateur (maquette tableau-roles/, porteur 2026-10-13) : équipe, projets, compte relié,
     poste (affiché ; il se modifie dans Liste des ressources) et rôle d'accès (liste, modifiable ici) */
  lignePersonne(r) {
    const esc = C.esc, prevu = rolePrevu(r);
    const compte = r.userId ? C.badgeTon('Compte lié', 'succes') : C.badgeTon('Pas encore connecté', 'attention');
    const options = ROLES_CHOISISSABLES.map(cle => ({ valeur: cle, libelle: ROLES_ACCES[cle].libelle }));
    const effet = prevu ? 'rôle prévu : appliqué à sa connexion (email vérifié)' : r.userId ? 'appliqué' : '';
    return `<tr data-recherche="${esc((r.nom + ' ' + (r.email || '')).toLowerCase())}">
      <td><span class="ligne-flex">${C.avatar(r.nom)}<b>${esc(r.nom)}</b></span>
        <div class="discret texte-12">${esc(r.email || 'email à renseigner sur la fiche')}</div></td>
      <td><span class="ligne-flex">${C.pastille(equipe(r.equipeId).couleur)}${esc(equipe(r.equipeId).nom)}</span></td>
      <td>${this.projetsDe(r)}</td>
      <td>${compte}</td>
      <td>${esc(r.poste || '—')}</td>
      <td>${C.liste(options, this.roleChoisi(r), `class="champ champ-mini" data-action-change="affecterRole" data-id="${r.id}"`)}
        ${effet ? `<div class="discret texte-12">${effet}</div>` : ''}</td></tr>`;
  },

  // Cartes « par rôle » : qui a chaque rôle (créateur, administrateurs, responsables, rôles de projet, comptes en attente)
  cartesParRole() {
    const esc = C.esc, groupes = this.parRole();
    return this.LISTE.map(role => {
      const personnes = groupes[role.cle];
      return `<div class="carte" style="padding:12px 14px;border-top:4px solid ${role.couleur}">
        <div class="ligne-flex entre"><b style="color:${role.couleur}">${esc(role.libelle)}</b>
          <span class="discret">${personnes.length}</span></div>
        <div class="discret" style="font-size:12px;margin:4px 0 8px">${esc(role.description)}</div>
        ${personnes.map(x => `<div style="padding:2px 0">${esc(x.nom)}${x.precision ? ` <span class="discret">· ${esc(x.precision)}</span>` : ''}</div>`).join('')
          || '<div class="pale">personne</div>'}</div>`;
    }).join('');
  },

  // Onglet : filtres (recherche, équipe, rôle), tableau des rôles d'accès, puis vue « qui a quel rôle »
  onglet() {
    const u = ui('roles', { equipe: '', role: '' });
    const personnes = ressourcesActives()
      .filter(r => !u.equipe || r.equipeId === u.equipe)
      .filter(r => !u.role || this.roleChoisi(r) === u.role)
      .sort((a, b) => equipe(a.equipeId).nom.localeCompare(equipe(b.equipeId).nom) || a.nom.localeCompare(b.nom));
    const equipes = [{ valeur: '', libelle: 'Toutes les équipes' }, ...etat.d.equipes.map(e => ({ valeur: e.id, libelle: e.nom }))];
    const roles = [{ valeur: '', libelle: 'Tous les rôles' }, ...ROLES_CHOISISSABLES.map(cle => ({ valeur: cle, libelle: ROLES_ACCES[cle].libelle }))];
    const filtres = `<input class="champ" style="width:260px" placeholder="Rechercher une personne…" data-action-saisie="filtrerRoles">
      ${C.liste(equipes, u.equipe, 'class="champ champ-compact" data-action-change="filtreRoles" data-filtre="equipe"')}
      ${C.liste(roles, u.role, 'class="champ champ-compact" data-action-change="filtreRoles" data-filtre="role"')}`;
    return `${C.barreOutils(filtres, '<span class="discret">Rôles de projet (Chef de projet, Membre, Lecteur) : projet par projet, dans Liste des ressources</span>')}
      <div class="carte"><div class="carte-titre"><h2>Utilisateurs et rôles</h2><span class="discret">${personnes.length} personne(s)</span></div>
        <div class="defilement-x"><table class="tableau tableau-roles-acces"><thead><tr><th>Utilisateur</th><th>Équipe</th><th>Projet(s)</th>
          <th>Compte relié</th><th>Poste</th><th>Rôle ${C.aide('roleAcces')}</th></tr></thead>
        <tbody>${personnes.map(r => this.lignePersonne(r)).join('') || `<tr><td colspan="6">${C.vide('Personne ne correspond aux filtres.')}</td></tr>`}</tbody>
        </table></div></div>
      <div class="carte-titre" style="border:0;padding:4px 2px"><h2>Qui a quel rôle</h2><span class="discret">vue d’ensemble, rôles de projet compris</span></div>
      <div class="grille-roles">${this.cartesParRole()}</div>`;
  }
};

Object.assign(Actions, {
  // Rôle d'accès choisi dans la liste d'une ligne (administrateurs ; la base contrôle le droit)
  affecterRole(d, el) {
    executer(async () => {
      const resultat = await Api.executer('affecter_role', { p_ressource: d.id, p_role: el.value });
      await chargerRoles();
      notifier(resultat === 'prevu' ? 'Rôle prévu : il s’appliquera à la connexion de la personne' : 'Rôle d’accès enregistré');
    }, 'administrateurs', 'responsablesEquipe', 'rolesPrevus', 'rolesAcces');
  },
  filtreRoles: (d, el) => majUi('roles', { [d.filtre]: el.value }),
  // Recherche par nom ou email : masque les lignes sans redessiner l'écran (la saisie garde le focus)
  filtrerRoles(d, el) {
    const texte = el.value.trim().toLowerCase();
    document.querySelectorAll('.tableau-roles-acces tbody tr[data-recherche]').forEach(tr => {
      tr.style.display = tr.dataset.recherche.includes(texte) ? '' : 'none';
    });
  }
});
