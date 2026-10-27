/* ============================================================
   Rôles : Administration › onglet « Rôles » (administrateurs) : « Utilisateurs et rôles » ;
   Administration créateur (créateur seul, porteur 2026-10-23, maquette matrice-createur/) :
   onglets « Matrice des droits » et « Qui a quel rôle » (matrice(), tableauParRole()).
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
  /* Vue « Qui a quel rôle » (alignée sur la Simulation, porteur 2026-10-22, maquette qui-a-quel-role/) : mêmes
     rôles que la Simulation (Simulation.ROLES : les 6 rôles d'accès + Compte en attente, sans le Créateur).
     Chaque fiche active est rangée sous le rôle choisi dans le tableau « Utilisateurs et rôles » (roleChoisi :
     prévu s'il y en a un, sinon actuel), avec son équipe et l'état de son compte (lié, prévu, sans compte).
     Présentée en tableau (porteur 2026-10-27). */
  parRole() {
    const groupes = Object.fromEntries(Simulation.ROLES.map(role => [role.cle, []]));
    ressourcesActives().forEach(r => {
      const compte = !r.userId ? 'sans compte' : rolePrevu(r) ? 'rôle prévu' : 'compte lié';
      (groupes[this.roleChoisi(r)] || []).push({ nom: r.nom, equipe: equipe(r.equipeId).nom, compte });
    });
    etat.comptesEnAttente.filter(c => !c.invite).forEach(c => groupes.sansEquipe.push({ nom: c.nom || c.email, equipe: '—', compte: c.email }));
    Object.values(groupes).forEach(liste => liste.sort((x, y) => x.nom.localeCompare(y.nom)));
    return groupes;
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
    return affectationsDe(r.id).map(a => `<div class="ligne-flex projet-role">${esc(projet(a.projetId).nom)}
      <span class="discret texte-12">· ${esc(a.role)}</span></div>`).join('') || '<span class="pale">aucun projet</span>';
  },

  /* Ligne d'un utilisateur (maquette tableau-roles/, porteur 2026-10-13) : équipe, projets, compte relié,
     poste (affiché ; il se modifie dans Liste des ressources) et rôle d'accès (liste, modifiable ici) */
  lignePersonne(r) {
    const esc = C.esc, prevu = rolePrevu(r);
    const compte = r.userId ? C.badgeTon('Compte lié', 'succes') : C.badgeTon('Pas encore connecté', 'attention');
    // Administrateur : choisi ou retiré seulement avec le droit « Nommer un administrateur »
    const admin = this.roleChoisi(r) === 'admin', nommer = aDroit('nommer_admin');
    const options = ROLES_CHOISISSABLES.map(cle => ({ valeur: cle, libelle: ROLES_ACCES[cle].libelle,
      desactive: !nommer && (cle === 'admin' || admin) && cle !== this.roleChoisi(r) }));
    const verrou = aDroit('roles') ? '' : ' disabled';
    const effet = prevu ? 'rôle prévu : appliqué à sa connexion (email vérifié)' : r.userId ? 'appliqué' : '';
    return `<tr data-recherche="${esc((r.nom + ' ' + (r.email || '')).toLowerCase())}">
      <td><span class="ligne-flex">${C.avatar(r.nom)}<b>${esc(r.nom)}</b></span>
        <div class="discret texte-12">${esc(r.email || 'email à renseigner sur la fiche')}</div></td>
      <td><span class="ligne-flex">${C.pastille(equipe(r.equipeId).couleur)}${esc(equipe(r.equipeId).nom)}</span></td>
      <td>${this.projetsDe(r)}</td>
      <td>${compte}</td>
      <td>${esc(r.poste || '—')}</td>
      <td>${C.liste(options, this.roleChoisi(r), `class="champ champ-mini" data-action-change="affecterRole" data-id="${r.id}"${verrou}`)}
        ${effet ? `<div class="discret texte-12">${effet}</div>` : ''}</td></tr>`;
  },

  /* Tableau « par rôle » : une ligne de titre par rôle (son nom, le nombre de personnes et les menus qu'il ouvre d'après
     la matrice), puis une ligne par personne : nom, équipe, état du compte */
  tableauParRole() {
    const esc = C.esc, groupes = this.parRole();
    const lignes = Simulation.ROLES.map(role => {
      const personnes = groupes[role.cle];
      return `<tr class="groupe"><td colspan="3"><span class="ligne-flex"><b style="color:${role.couleur}">${esc(role.libelle)}</b>
          <span class="discret poids-normal">${personnes.length} personne(s)</span></span>
          <div class="discret texte-12 poids-normal">${esc(role.description)}</div></td></tr>`
        + (personnes.map(x => `<tr><td><span class="ligne-flex">${C.avatar(x.nom)}${esc(x.nom)}</span></td><td>${esc(x.equipe)}</td>
          <td class="discret">${esc(x.compte)}</td></tr>`).join('') || '<tr><td colspan="3" class="pale">personne</td></tr>');
    }).join('');
    return `<div class="carte"><table class="tableau tableau-qui-a-quel-role"><thead><tr><th>Personne</th><th>Équipe</th><th>Compte</th></tr></thead>
      <tbody>${lignes}</tbody></table></div>`;
  },

  // Tableau « Utilisateurs et rôles » : filtres (recherche, équipe, rôle) puis une ligne par personne
  utilisateurs() {
    const u = ui('roles', { equipe: '', role: '' });
    const personnes = ressourcesActives()
      .filter(r => !u.equipe || r.equipeId === u.equipe)
      .filter(r => !u.role || this.roleChoisi(r) === u.role)
      .sort((a, b) => equipe(a.equipeId).nom.localeCompare(equipe(b.equipeId).nom) || a.nom.localeCompare(b.nom));
    const equipes = optionsEquipes();
    const roles = [{ valeur: '', libelle: 'Tous les rôles' }, ...ROLES_CHOISISSABLES.map(cle => ({ valeur: cle, libelle: ROLES_ACCES[cle].libelle }))];
    const filtres = `<input class="champ" style="width:260px" placeholder="Rechercher une personne…" data-action-saisie="filtrerRoles">
      ${C.liste(equipes, u.equipe, 'class="champ champ-compact" data-action-change="filtreRoles" data-filtre="equipe"')}
      ${C.liste(roles, u.role, 'class="champ champ-compact" data-action-change="filtreRoles" data-filtre="role"')}`;
    return `${C.barreOutils(filtres, '<span class="discret">Rôles de projet (Chef de projet, Membre, Lecteur) : projet par projet, dans Liste des ressources</span>')}
      <div class="carte"><div class="carte-titre"><h2>Utilisateurs et rôles</h2><span class="discret">${personnes.length} personne(s)</span></div>
        <div class="defilement-x"><table class="tableau tableau-roles-acces"><thead><tr><th>Utilisateur</th><th>Équipe</th><th>Projet(s)</th>
          <th>Compte relié</th><th>Poste</th><th>Rôle ${C.aide('roleAcces')}</th></tr></thead>
        <tbody>${personnes.map(r => this.lignePersonne(r)).join('') || `<tr><td colspan="6">${C.vide('Personne ne correspond aux filtres.')}</td></tr>`}</tbody>
        </table></div></div>`;
  },

  /* Matrice des droits (maquettes roles-droits/, matrice-sections/, matrice-par-menu/) : une colonne par rôle,
     la ligne « Périmètre », puis les menus de la barre latérale en deux sections — Suivi de mes équipes, Mon dashboard
     (SECTIONS_DROITS) — avec, pour chacun, ses droits (DROITS, propriété menu) et les menus ouverts à tous
     (MENUS_SANS_DROIT). Le créateur a tout (colonne fixe) ;
     Administrateur × Rôles reste « Oui » (garde-fou de la base, migration 031). Modifiable par le créateur seul
     (migration 041) : chaque changement est enregistré aussitôt (table droits_roles) ; la base refuse aux autres. */
  matrice() {
    const esc = C.esc, modifiable = etat.estCreateur, nbColonnes = 3 + ROLES_CHOISISSABLES.length;
    const entete = ROLES_CHOISISSABLES.map(role => `<th class="centre">${esc(ROLES_ACCES[role].libelle)}</th>`).join('');
    const perimetres = ROLES_CHOISISSABLES.map(role => `<td class="centre discret texte-12">${esc(PERIMETRES[role])}</td>`).join('');
    const createur = contenu => `<td class="centre">${contenu}</td>`;   // colonne Créateur (tous les droits, fixe)
    /* Première colonne : « ↳ Onglet « … » » pour un droit d'onglet (migration 038), sinon le nom du menu, écrit
       seulement sur la première ligne du menu (lignes consécutives d'un même menu) */
    const nom = (d, i, liste) => d.onglet ? `<span class="ligne-onglet">↳ Onglet « ${esc(d.onglet)} »</span>`
      : i && liste[i - 1].menu === d.menu ? '' : `<b>${esc(d.menu)}</b>`;
    const ligne = (d, i, liste) => d.cle ? `<tr><td>${nom(d, i, liste)}</td><td>${esc(d.libelle)}</td>
      ${createur(C.badgeTon('Oui · fixe', 'violet'))}${ROLES_CHOISISSABLES.map(role => this.celluleNiveau(role, d.cle, modifiable)).join('')}</tr>`
      : `<tr><td>${nom(d, i, liste)}</td><td>${esc(d.libelle)}</td>
      ${createur(C.badgeTon('Tous', 'neutre'))}${ROLES_CHOISISSABLES.map(() => `<td class="centre">${C.badgeTon('Tous', 'neutre')}</td>`).join('')}</tr>`;
    const sections = SECTIONS_DROITS.map(sec => `<tr class="groupe"><td colspan="${nbColonnes}"><b>${esc(sec.libelle)}</b></td></tr>`
      + this.lignesSection(sec.cle).map(ligne).join('')).join('');
    return `<div class="carte"><div class="carte-titre"><h2>Matrice des droits</h2>
        <span class="discret">Oui = modifie · Lecture = voit · Non = ni l’un ni l’autre — sur le périmètre du rôle${modifiable ? '' : ' · consultation'}</span></div>
      <div class="defilement-x"><table class="tableau tableau-matrice"><thead><tr><th>Menu / onglet</th><th>Ce qu’on peut y faire</th>
        <th class="centre">Créateur</th>${entete}</tr></thead>
        <tbody><tr class="groupe"><td><b>Périmètre</b></td><td class="discret">ce que couvre le rôle</td>
          ${createur(`<span class="discret texte-12">${esc(PERIMETRES.createur)}</span>`)}${perimetres}</tr>${sections}</tbody></table></div></div>
      <div class="discret texte-12">Les droits de menu et d’onglet règlent l’affichage ; ce qu’on peut modifier est appliqué par la base.
        Un onglet « Non » disparaît de la page ; si tous ses onglets sont « Non », le menu disparaît aussi.
        Un rôle se donne dans Mon dashboard › Administration › Rôles.</div>`;
  },

  /* Lignes d'une section de la matrice, dans l'ordre de DROITS ; un menu ouvert à tous (MENUS_SANS_DROIT, sans clé)
     est placé juste avant les droits de ses onglets (Trucs et astuces), ou à la fin de la section s'il n'en a pas */
  lignesSection(section) {
    const lignes = DROITS.filter(d => d.section === section);
    MENUS_SANS_DROIT.filter(m => m.section === section).forEach(m => {
      const position = lignes.findIndex(d => d.menu === m.menu);
      lignes.splice(position < 0 ? lignes.length : position, 0, m);
    });
    return lignes;
  },

  /* Case d'un rôle × droit : liste Oui / Lecture / Non, enregistrée aussitôt (majDroit). Figée hors créateur,
     pour Administrateur × Rôles, et pour un droit absent de la table droits_roles (niveau de repli affiché, voir niveauDuRole) */
  celluleNiveau(role, droit, modifiable) {
    const niveau = niveauDuRole(role, droit);
    const fixe = !modifiable || (role === 'admin' && droit === 'roles') || !droitEnBase(droit);
    const options = Object.entries(NIVEAUX_DROIT).map(([valeur, n]) => ({ valeur, libelle: n.libelle }));
    return `<td class="centre">${C.liste(options, niveau, `class="champ champ-mini ${NIVEAUX_DROIT[niveau].classe}" data-action-change="majDroit"
      data-role="${role}" data-droit="${droit}"${fixe ? ' disabled' : ''}`)}</td>`;
  },

  // Onglet Rôles d'Administration : utilisateurs et rôles (matrice et « qui a quel rôle » : Administration créateur)
  onglet() {
    return this.utilisateurs();
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
  // Niveau d'un droit pour un rôle (matrice) : enregistré aussitôt ; la base refuse sans le droit « roles »
  majDroit(d, el) {
    executer(() => Api.modifier('droits_roles', { role: 'eq.' + d.role, droit: 'eq.' + d.droit }, { niveau: el.value }), 'droitsRoles');
  },
  // Recherche par nom ou email : masque les lignes sans redessiner l'écran (la saisie garde le focus)
  filtrerRoles(d, el) {
    const texte = el.value.trim().toLowerCase();
    document.querySelectorAll('.tableau-roles-acces tbody tr[data-recherche]').forEach(tr => {
      tr.style.display = tr.dataset.recherche.includes(texte) ? '' : 'none';
    });
  }
});
