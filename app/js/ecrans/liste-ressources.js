/* ============================================================
   Mon dashboard › Gestion des ressources › Liste des ressources
   Design conservé à la demande du porteur (2026-10-12) : celui de la production
   (maquette docs/maquettes/liste-ressources-ux/3-navigation-detail.png), avec les
   fonctionnalités de la spécification docs/specifications/ressources.md :
   - à gauche, la navigation : chaque équipe, ses responsables (1 ou plusieurs, table
     responsables_equipe) et ses projets ; puis « Sans affectation », « Inactifs »
     (administrateurs), Postes et Types de contrat ;
   - à droite, le détail de ce qui est choisi :
       équipe  → responsables, projets (avec leurs chefs de projet), personnes de ses projets ;
       projet  → chefs de projet (1 ou plusieurs), puis membres et lecteurs ;
       Sans affectation / Inactifs → les personnes concernées ;
       Postes / Types de contrat → référentiels « poste » et « contrat ».
   Une personne n'appartient pas à une équipe : elle y figure par ce qu'elle fait (responsable,
   chef, membre ou lecteur d'un projet). Une personne inactive n'apparaît plus (spécification § 6),
   sauf dans « Inactifs ». Partout les mêmes liens : « + Affecter une personne » (fiche existante)
   et « + Nouvelle personne » (création puis affectation).
   Boutons affichés selon le périmètre (spécification § 4) : administrateur → tout ;
   responsable → ses équipes ; chef de projet → ses projets. La base reste seule juge.
   ============================================================ */
'use strict';

Ecrans.listeRessources = {
  titre: 'Gestion des ressources · Liste des ressources',
  section: 'moi',
  sansEquipePermis: () => etat.estAdmin,        // voir coquille.js : écran ouvert sans équipe

  rendre() {
    const actions = etat.estAdmin ? '<button class="btn primaire" data-action="nouvelleUnite" data-type="equipe">+ Ajouter une équipe</button>' : '';
    const choix = this.selection();
    return `
    <div class="ecran" style="max-width:1300px">
      ${C.entete('Liste des ressources', 'Choisissez une équipe ou un projet à gauche : ses personnes s’affichent à droite', actions)}
      <div class="liste-ressources">
        ${this.navigation(choix)}
        <div class="detail-ressources" id="detail-ressources">${this.detail(choix)}</div>
      </div>
    </div>`;
  },

  /* ---------- Données affichées ---------- */
  equipes: () => [...etat.d.equipes].sort((a, b) => a.nom.localeCompare(b.nom)),
  // Affectations actives d'un projet (personne non inactive)
  affectationsDu: p => etat.d.affectations.filter(a => a.projetId === p.id && nonInactive(a.ressourceId)),
  // Personnes d'une équipe : ses responsables et les personnes de ses projets, une seule fois chacune
  personnesDe(e) {
    const ids = new Set(responsablesDe(e.id).map(r => r.id));
    etat.d.projets.filter(p => p.equipeId === e.id).forEach(p => this.affectationsDu(p).forEach(a => ids.add(a.ressourceId)));
    return [...ids].map(ressource).sort((a, b) => a.nom.localeCompare(b.nom));
  },
  // Sans affectation (spécification § 3) : actives, responsables d'aucune équipe, affectées à aucun projet
  sansAffectation() {
    const responsables = new Set(etat.d.responsablesEquipe.map(x => x.ressourceId));
    return etat.d.ressources.filter(r => !estInactive(r) && !responsables.has(r.id) && !etat.d.affectations.some(a => a.ressourceId === r.id))
      .sort((a, b) => a.nom.localeCompare(b.nom));
  },
  inactifs: () => etat.d.ressources.filter(estInactive).sort((a, b) => a.nom.localeCompare(b.nom)),

  /* Élément choisi : celui mémorisé s'il existe encore, sinon l'équipe ouverte, sinon la première équipe */
  selection() {
    const choix = ui('listeRessources', { choix: null }).choix, equipes = this.equipes();
    const existe = c => c && (['postes', 'contrats', 'sans', 'inactifs'].includes(c.type)
      || (c.type === 'projet' && projet(c.id)) || (c.type === 'equipe' && equipes.some(e => e.id === c.id)));
    if (existe(choix)) return choix;
    const parDefaut = equipes.find(e => e.id === etat.equipeCourante) || equipes[0];
    return parDefaut ? { type: 'equipe', id: parDefaut.id } : { type: 'aucun' };
  },

  /* ---------- Colonne de gauche : navigation ----------
     Chaque élément porte data-recherche (texte cherché par filtrerArbre : son nom et celui des
     personnes qu'il montre) ; une équipe et ses éléments forment un .noeud-groupe ; data-nom = nom
     de l'équipe seul. */
  navigation(choix) {
    const esc = C.esc;
    const actif = (type, id) => choix.type === type && (!id || choix.id === id) ? ' actif' : '';
    const noms = liste => liste.map(r => r.nom).join(' ');
    const groupes = this.equipes().map(e => {
      const responsables = responsablesDe(e.id).map(r => `<a class="noeud personne" data-action="choisirNoeud" data-type="equipe" data-id="${e.id}"
          data-recherche="${esc(r.nom.toLowerCase())}">${C.avatar(r.nom)}<span>${esc(r.nom)}</span> <span class="compte">responsable</span></a>`).join('');
      const projets = etat.d.projets.filter(p => p.equipeId === e.id).sort(parCode).map(p => {
        const personnes = this.affectationsDu(p).map(a => ressource(a.ressourceId));
        return `<a class="noeud projet${actif('projet', p.id)}" data-action="choisirNoeud" data-type="projet" data-id="${p.id}"
          data-recherche="${esc(`${p.code} ${p.nom} ${noms(personnes)}`.toLowerCase())}">${esc(p.nom)} <span class="compte">${personnes.length}</span></a>`;
      }).join('');
      return `<div class="noeud-groupe">
        <a class="noeud equipe${actif('equipe', e.id)}" data-action="choisirNoeud" data-type="equipe" data-id="${e.id}" data-nom="${esc(e.nom.toLowerCase())}"
          data-recherche="${esc(e.nom.toLowerCase())}">${esc(e.nom)} <span class="compte">${this.personnesDe(e).length}</span></a>
        ${responsables}${projets}</div>`;
    }).join('');
    const sans = this.sansAffectation(), inactifs = this.inactifs();
    return `<nav class="carte nav-ressources" id="nav-ressources">
      <label class="recherche-champ">${C.icone('recherche')}<input placeholder="Rechercher une personne, un projet" data-action-saisie="filtrerArbre"></label>
      ${groupes || C.vide(etat.estAdmin ? 'Aucune équipe : « + Ajouter une équipe » pour commencer.' : 'Aucune équipe.')}
      <div class="nav-separateur"></div>
      <a class="noeud${actif('sans')}" data-action="choisirNoeud" data-type="sans">Sans affectation <span class="compte">${sans.length}</span></a>
      ${etat.estAdmin ? `<a class="noeud${actif('inactifs')}" data-action="choisirNoeud" data-type="inactifs">Inactifs <span class="compte">${inactifs.length}</span></a>` : ''}
      <a class="noeud${actif('postes')}" data-action="choisirNoeud" data-type="postes">Postes <span class="compte">${valeursDe('poste', true).length}</span></a>
      <a class="noeud${actif('contrats')}" data-action="choisirNoeud" data-type="contrats">Types de contrat <span class="compte">${valeursDe('contrat', true).length}</span></a>
    </nav>`;
  },

  /* ---------- Colonne de droite : détail de l'élément choisi ---------- */
  detail(choix) {
    if (choix.type === 'postes') return this.valeurs('poste', 'poste', 'Postes');
    if (choix.type === 'contrats') return this.valeurs('contrat', 'typeContrat', 'Types de contrat');
    if (choix.type === 'sans') return this.detailSansAffectation();
    if (choix.type === 'inactifs') return this.detailInactifs();
    if (choix.type === 'projet') return this.detailProjet(projet(choix.id));
    if (choix.type === 'equipe') return this.detailEquipe(equipe(choix.id));
    return '';
  },

  // Équipe : responsables, projets (chefs de projet, nombre de membres), personnes de ses projets
  detailEquipe(e) {
    const esc = C.esc, admin = etat.estAdmin, gere = peutGererEquipe(e);
    const projets = etat.d.projets.filter(p => p.equipeId === e.id).sort(parCode), personnes = this.personnesDe(e);
    const vide = !projets.length && !etat.d.ressources.some(r => r.equipeId === e.id);
    const boutons = [
      admin || estResponsableDe(e.id) ? `<button class="btn" data-action="modifierEquipe" data-id="${e.id}">Modifier l’équipe</button>` : '',
      admin ? C.boutonIcone('supprimer', 'supprimerEquipe', `data-id="${e.id}"`, vide ? 'Supprimer l’équipe' : 'Équipe non vide : retirez d’abord ses projets et ses personnes', !vide) : ''
    ].join('');
    const responsables = responsablesDe(e.id).map(r => `<div class="carte-personne responsable">${C.avatar(r.nom)}<div style="flex:1;min-width:0">
        <div class="nom-personne">${esc(r.nom)}</div><div class="discret">${esc(r.poste || 'Responsable de l’équipe')}</div></div>
        <a data-action="modifierRessource" data-id="${r.id}">Fiche</a>
        ${gere ? `<a class="discret" data-action="retirerResponsable" data-equipe="${e.id}" data-ressource="${r.id}">Retirer</a>` : ''}</div>`).join('');
    const lignesProjets = projets.map(p => `<tr class="cliquable" data-action="choisirNoeud" data-type="projet" data-id="${p.id}"><td>${C.code(p.code)}</td>
        <td><b style="font-weight:500">${esc(p.nom)}</b></td><td>${C.badgeRef('stp', p.statut)}</td>
        <td>${esc(chefsDuProjet(p).map(r => r.nom).join(', ')) || '<span class="pale">—</span>'}</td>
        <td class="num">${this.affectationsDu(p).filter(a => a.role !== ROLES_PROJET.CHEF).length}</td></tr>`).join('');
    return `
      <div class="carte detail-entete"><div><h2 class="detail-titre">${esc(e.nom)} ${C.code(e.prefixe)}</h2>
        <div class="discret">${projets.length} projet(s) · ${personnes.length} personne(s)</div></div><span style="flex:1"></span>${boutons}</div>
      <div class="carte"><div class="carte-titre"><h2>Responsables ${C.aide('responsablesEquipe')}</h2>
          ${gere ? `<a data-action="ajouterResponsable" data-equipe="${e.id}">+ Responsable</a>` : ''}</div>
        <div class="cartes-personnes">${responsables || '<span class="pale">Aucun responsable.</span>'}</div></div>
      <div class="carte"><div class="carte-titre"><h2>Projets</h2>${gere ? `<a data-action="nouveauProjet" data-equipe="${e.id}">+ Projet</a>` : ''}</div>
        <table class="tableau"><thead><tr><th>Code</th><th>Projet</th><th>Statut</th><th>Chefs de projet</th><th class="num">Membres</th></tr></thead>
        <tbody>${lignesProjets || `<tr><td colspan="5">${C.vide('Aucun projet.')}</td></tr>`}</tbody></table></div>
      <div class="carte"><div class="carte-titre"><h2>Personnes de l’équipe ${esc(e.nom)}</h2>${gere ? this.liensAjout(e.id, null) : ''}</div>
        ${this.tableauPersonnes(personnes.map(r => ({ r })), 'Aucune personne : affectez-en à un projet de l’équipe.', false, e.id)}</div>`;
  },

  // Projet : chefs de projet en cartes, puis membres et lecteurs en tableau
  detailProjet(p) {
    const esc = C.esc, gere = peutGererProjet(p), chefs = chefsDuProjet(p);
    const membres = this.affectationsDu(p).filter(a => a.role !== ROLES_PROJET.CHEF)
      .map(a => ({ r: ressource(a.ressourceId), a })).sort((x, y) => x.r.nom.localeCompare(y.r.nom));
    const cartesPo = chefs.map(r => {
      const a = this.affectationsDu(p).find(x => x.ressourceId === r.id && x.role === ROLES_PROJET.CHEF);
      return `<div class="carte-personne">${C.avatar(r.nom)}<div style="flex:1;min-width:0">
        <div class="nom-personne">${esc(r.nom)}</div><div class="discret">${esc(r.poste || '—')}</div></div>
        <a data-action="modifierRessource" data-id="${r.id}">Fiche</a>
        ${a ? (gere ? `<a class="discret" data-action="retirerAffectation" data-id="${a.id}">Retirer</a>` : '') : '<span class="pale" title="Chef inscrit sur l’ancienne fiche projet">fiche projet</span>'}</div>`;
    }).join('');
    const indicateur = (n, libelle) => `<div><b>${n}</b><span class="discret">${libelle}</span></div>`;
    return `
      <div class="carte detail-entete"><div><a class="discret" data-action="choisirNoeud" data-type="equipe" data-id="${p.equipeId}">${esc(equipe(p.equipeId).nom)} ›</a>
        <h2 class="detail-titre">${esc(p.nom)} ${C.code(p.code)} ${C.badgeRef('stp', p.statut)}</h2></div><span style="flex:1"></span>
        <div class="detail-kpi">${indicateur(chefs.length, 'chef(s) de projet')}${indicateur(membres.length, 'membres')}</div>
        <button class="btn" data-action="ouvrirProjet" data-id="${p.id}">${gere ? 'Modifier le projet' : 'Voir le projet'}</button></div>
      <div class="carte"><div class="carte-titre"><h2>Chefs de projet ${C.aide('chefsProjet')}</h2>
          ${gere ? `<a data-action="assigner" data-projet="${p.id}" data-role="${esc(ROLES_PROJET.CHEF)}">+ Chef de projet</a>` : ''}</div>
        <div class="cartes-personnes">${cartesPo || '<span class="pale">Aucun chef de projet.</span>'}</div></div>
      <div class="carte"><div class="carte-titre"><h2>Membres</h2>${gere ? this.liensAjout(p.equipeId, p.id) : ''}</div>
        ${this.tableauPersonnes(membres, 'Aucun membre.', gere)}</div>`;
  },

  // Sans affectation : personnes à affecter (administrateurs, responsables, chefs selon leur périmètre)
  detailSansAffectation() {
    return `<div class="carte"><div class="carte-titre"><h2>Sans affectation</h2>
        <span class="discret">Responsables d’aucune équipe et affectées à aucun projet</span></div>
      ${this.tableauPersonnes(this.sansAffectation().map(r => ({ r })), 'Tout le monde est affecté.')}</div>`;
  },
  // Inactifs (administrateurs) : masqués partout ailleurs ; « Réactiver » retire la date de départ
  detailInactifs() {
    return `<div class="carte"><div class="carte-titre"><h2>Inactifs</h2>
        <span class="discret">Masqués dans toute l’application ; leurs affectations sont conservées</span></div>
      ${this.tableauPersonnes(this.inactifs().map(r => ({ r })), 'Aucune personne inactive.')}</div>`;
  },

  // « + Affecter une personne » et « + Nouvelle personne » : les mêmes liens sur une équipe et sur un projet
  liensAjout(equipeId, projetId) {
    const projetAttr = projetId ? ` data-projet="${projetId}"` : '';
    return `<span class="ligne-flex"><a data-action="assigner"${projetAttr}>+ Affecter une personne</a><span class="pale">·</span>
      <a data-action="nouvelleRessource" data-equipe="${equipeId}"${projetAttr}>+ Nouvelle personne</a></span>`;
  },

  /* Tableau de personnes : [{ r, a }] (a = affectation sur le projet affiché, sinon absente).
     Rôles : déduits de ses affectations (spécification § 5) — sur un projet, son rôle sur ce
     projet ; sur une équipe (equipeId), ses rôles dans cette équipe ; ailleurs, tous ses rôles.
     Statut cliquable (passer inactif / réactiver) pour qui gère. */
  tableauPersonnes(lignes, texteVide, gereProjet = false, equipeId = null) {
    const corps = lignes.map(x => this.lignePersonne(x, gereProjet, equipeId)).join('');
    return `<div class="defilement-x"><table class="tableau tableau-personnes"><thead><tr><th>Personne</th><th>Poste</th>
        <th>Rôles ${C.aide('roleProjet')}</th><th>Statut</th><th></th></tr></thead>
      <tbody>${corps || `<tr><td colspan="5">${C.vide(texteVide)}</td></tr>`}</tbody></table></div>`;
  },
  lignePersonne({ r, a }, gereProjet, equipeId) {
    const esc = C.esc, inactive = estInactive(r), badge = C.badgeActif(!inactive, ['Actif', 'Inactif']);
    const roles = (a ? C.badgeRef('role', a.role) : this.rolesDe(r, equipeId)) + (estAdministrateur(r) ? ' ' + C.badge('Admin', '#0033AD', '#E8EEFF') : '');
    const actions = [`<a data-action="modifierRessource" data-id="${r.id}">Fiche</a>`,
      a && gereProjet ? `<a class="discret" data-action="retirerAffectation" data-id="${a.id}">Retirer</a>` : '',
      !a && !equipeId && !inactive ? `<a data-action="assigner" data-ressource="${r.id}">Affecter</a>` : ''].join(' ');
    return `<tr data-ressource="${r.id}"${inactive ? ' class="inactive"' : ''}><td><span class="ligne-flex">${C.avatar(r.nom)}<span class="nom-personne">${esc(r.nom)}</span></span></td>
      <td>${esc(r.poste || '—')}</td><td class="projets-personne">${roles}</td>
      <td>${etat.estAdmin || gereProjet ? `<button class="lien-btn" data-action="basculerActifRessource" data-id="${r.id}" title="${inactive ? 'Réactiver (retire la date de départ)' : 'Passer inactif (date de départ = aujourd’hui)'}">${badge}</button>` : badge}</td>
      <td class="num actions-ligne">${actions}</td></tr>`;
  },
  /* Rôles d'une personne, un par ligne : « Responsable · Applications », « VISTA · Chef de projet », « CDO · Membre » ;
     limités à une équipe si equipeId est donné */
  rolesDe(r, equipeId) {
    const dansEquipe = id => !equipeId || id === equipeId;
    const responsable = etat.d.responsablesEquipe.filter(x => x.ressourceId === r.id && dansEquipe(x.equipeId))
      .map(x => `<div>Responsable · ${C.esc(equipe(x.equipeId).nom)}</div>`);
    const projets = etat.d.affectations.filter(a => a.ressourceId === r.id && projet(a.projetId) && dansEquipe(projet(a.projetId).equipeId))
      .map(a => `<div>${C.esc(projet(a.projetId).nom)} · ${C.esc(a.role)}</div>`);
    return [...responsable, ...projets].join('') || '<span class="pale">aucun</span>';
  },

  /* ---------- Postes / Types de contrat ---------- */
  // refId : référentiel ; champ : propriété de la ressource qui porte la valeur
  valeurs(refId, champ, titre) {
    const esc = C.esc, admin = etat.estAdmin;
    const lignes = valeursDe(refId, true).map(v => {
      const n = etat.d.ressources.filter(r => r[champ] === v.libelle).length;
      return `<tr><td><span class="ligne-flex">${C.pastille(v.couleur)}${esc(v.libelle)}</span></td><td class="num" style="text-align:center">${n}</td>
        <td>${admin ? `<button class="lien-btn" title="Activer / désactiver" data-action="basculerValeur" data-id="${v.id}">${C.badgeActif(v.actif)}</button>` : C.badgeActif(v.actif)}</td>
        <td class="num">${admin ? C.boutonIcone('modifier', 'renommerValeurListe', `data-id="${v.id}"`, 'Renommer (met à jour les fiches)')
          + C.boutonIcone('supprimer', 'supprimerValeurListe', `data-id="${v.id}"`, n ? 'Valeur utilisée : passez-la en Inactive' : 'Supprimer', !!n) : ''}</td></tr>`;
    }).join('');
    return `<div class="carte"><div class="carte-titre"><h2>${esc(titre)}</h2>
        ${admin ? `<a data-action="ajouterValeurListe" data-ref="${refId}">+ Ajouter</a>` : '<span class="discret">Utilisés dans les fiches ressources</span>'}</div>
      <table class="tableau"><thead><tr><th>Nom</th><th style="text-align:center">Ressources</th><th>Statut ${C.aide('valeursListe')}</th><th class="num">Actions</th></tr></thead>
      <tbody>${lignes || `<tr><td colspan="4">${C.vide('Aucune valeur.')}</td></tr>`}</tbody></table></div>`;
  }
};

Object.assign(Actions, {
  // Choix d'une équipe, d'un projet ou d'une liste dans la navigation
  choisirNoeud: d => majUi('listeRessources', { choix: { type: d.type, id: d.id || null } }),

  /* Recherche dans la navigation, sans redessiner (pour garder la saisie) : un élément est
     visible s'il correspond (son nom ou une de ses personnes) ; toute l'équipe reste visible
     si son nom correspond ; l'équipe d'un élément trouvé reste visible (le chemin). */
  filtrerArbre(_, el) {
    const q = el.value.trim().toLowerCase();
    document.querySelectorAll('#nav-ressources .noeud-groupe').forEach(groupe => {
      const [tete, ...noeuds] = groupe.querySelectorAll('[data-recherche]');
      const equipeTrouvee = !q || tete.dataset.nom.includes(q);
      const trouves = noeuds.filter(n => equipeTrouvee || n.dataset.recherche.includes(q));
      noeuds.forEach(n => { n.style.display = trouves.includes(n) ? '' : 'none'; });
      groupe.style.display = equipeTrouvee || trouves.length ? '' : 'none';
    });
  },

  // Nouvelle équipe (administrateurs)
  nouvelleUnite: d => majEtat({ modale: { type: 'equipe', id: null, typeUnite: d.type, parentId: null } }),
  // Suppression d'une équipe vide (contrôlée en base), puis de son organisation de connexion
  async supprimerEquipe(d) {
    if (!confirm(`Supprimer l’équipe « ${equipe(d.id).nom} » (vide) ?`)) return;
    const ok = await executer(() => Api.supprimer('equipes', { id: 'eq.' + d.id }), 'equipes');
    if (ok) { await Api.supprimerOrganisation(d.id).catch(() => {}); if (etat.equipeCourante === d.id) majEtat({ equipeCourante: null }); }
  },

  // Postes et types de contrat
  ajouterValeurListe(d) {
    const libelle = (prompt(d.ref === 'poste' ? 'Nouveau poste :' : 'Nouveau type de contrat :') || '').trim();
    if (libelle) executer(() => Api.creer('valeurs_referentiel', { referentielId: d.ref, libelle, ordre: valeursDe(d.ref, true).length + 1, couleur: '#4A5363' }), 'valeurs');
  },
  renommerValeurListe(d) {
    const v = parId('valeurs', d.id), libelle = (prompt('Nouveau nom :', v.libelle) || '').trim();
    if (libelle && libelle !== v.libelle) executer(() => Api.modifier('valeurs_referentiel', { id: 'eq.' + d.id }, { libelle }), 'valeurs', 'ressources');
  },
  supprimerValeurListe(d) {
    if (confirm('Supprimer cette valeur ?')) executer(() => Api.supprimer('valeurs_referentiel', { id: 'eq.' + d.id }), 'valeurs');
  },

  // Responsables d'une équipe (table responsables_equipe, migration 027)
  ajouterResponsable: d => majEtat({ modale: { type: 'responsable', equipeId: d.equipe || null, ressourceId: d.ressource || null } }),
  retirerResponsable(d) {
    if (!confirm(`Retirer ${ressource(d.ressource).nom} des responsables de ${equipe(d.equipe).nom} ?`)) return;
    executer(() => Api.supprimer('responsables_equipe', { equipe_id: 'eq.' + d.equipe, ressource_id: 'eq.' + d.ressource }), 'responsablesEquipe');
  },

  /* Fenêtre d'affectation : pour une personne (data-ressource) ou pré-remplie sur un projet
     (data-projet) ; data-role pré-choisit le rôle (« + Chef de projet ») */
  assigner: d => majEtat({ modale: { type: 'affectation', ressourceId: d.ressource || null, projetId: d.projet || null, role: d.role || null } }),
  retirerAffectation(d) {
    const a = parId('affectations', d.id);
    if (!confirm(`Retirer ${ressource(a.ressourceId).nom} du projet ${projet(a.projetId).nom} ?`)) return;
    executer(() => Api.supprimer('affectations', { id: 'eq.' + d.id }), 'affectations');
  },
  /* Nouvelle personne : affectée dès sa création à un projet (obligatoire sauf administrateur,
     Modale.projetCreation), pré-choisi depuis un projet. La fiche garde une équipe technique (celle
     du projet choisi) tant que les droits ne viennent pas des rôles (étape 2 de la spécification). */
  nouvelleRessource: d => majEtat({ modale: { type: 'ressource', id: null, equipeId: d.equipe || etat.equipeCourante, projetId: d.projet || '' } }),
  modifierRessource: d => majEtat({ modale: { type: 'ressource', id: d.id } }),
  /* Statut d'une personne : « Inactif » = date de départ saisie (règle du porteur) ; le bouton pose la
     date de départ à aujourd'hui, ou la retire pour réactiver la personne. Une personne inactive garde
     ses affectations mais n'apparaît plus (spécification § 6). */
  basculerActifRessource(d) {
    const r = ressource(d.id), inactive = estInactive(r);
    if (!inactive && !confirm(`Passer ${r.nom} inactif ? Sa date de départ sera aujourd’hui ; elle n’apparaîtra plus nulle part.`)) return;
    executer(async () => { await Api.modifier('ressources', { id: 'eq.' + d.id }, { dateDepart: inactive ? null : Calculs.aujourdhui() }); etat.modale = null; }, 'ressources');
  }
});
