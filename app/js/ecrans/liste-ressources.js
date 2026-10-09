/* ============================================================
   Mon dashboard › Gestion des ressources › Liste des ressources
   (maquette docs/maquettes/liste-ressources-ux/3-navigation-detail.png,
   piste 3 retenue par le porteur le 2026-10-09)
   Deux colonnes :
   - à gauche, la navigation : les équipes (Applications, IA, AMOA…),
     sous chacune son responsable et ses projets ; puis Postes et
     Types de contrat. Le niveau « direction » n'est plus affiché
     (consigne du porteur : « on oublie la direction DSI ») ;
   - à droite, le détail de ce qui est choisi :
       équipe  → responsable (hors projet), projets, personnes sans projet ;
       projet  → Product Owners (rôle « Chef de projet »), puis membres ;
       Postes / Types de contrat → référentiels « poste » et « contrat ».
   Les dates de présence se modifient dans la fiche de la personne.
   Écran ouvert sans équipe pour un administrateur (vue d'organisation).
   Droits d'affichage des boutons : unités et listes → administrateurs ;
   projets et personnes → membres de l'unité ; membres d'un projet →
   peutEditerProjet. La base (RLS, triggers) reste seule juge.
   ============================================================ */
'use strict';

Ecrans.listeRessources = {
  titre: 'Gestion des ressources · Liste des ressources',
  section: 'moi',
  sansEquipePermis: () => etat.estAdmin,        // voir coquille.js : écran ouvert sans équipe

  rendre() {
    const etatUi = ui('listeRessources', { inactifs: true });
    const nbInactifs = etat.d.ressources.filter(estInactive).length;
    const actions = `<button class="btn" data-action="basculerInactifs">${etatUi.inactifs ? 'Masquer' : 'Afficher'} les ressources inactives (${nbInactifs})</button>`
      + (etat.estAdmin ? '<button class="btn primaire" data-action="nouvelleUnite" data-type="equipe">+ Ajouter une équipe</button>' : '');
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

  /* ---------- Ce qui est affiché ---------- */
  // Personnes affichées : les inactives (date de fin saisie) seulement si « Afficher les ressources inactives »
  ressources() {
    const avecInactifs = ui('listeRessources', { inactifs: true }).inactifs;
    return etat.d.ressources.filter(r => avecInactifs || !estInactive(r));
  },
  /* Unités de la navigation. Le niveau « direction » n'est plus montré (consigne du porteur,
     2026-10-09) : les équipes d'une direction (ex. Applications, IA, AMOA sous DSI) sont listées
     directement. Une direction reste listée si elle porte elle-même des projets ou des
     personnes (rien n'est caché) ou si elle est vide (pour pouvoir la supprimer). */
  unites() {
    const { equipes, projets, ressources } = etat.d;
    const porteDuContenu = e => projets.some(p => p.equipeId === e.id) || ressources.some(r => r.equipeId === e.id);
    const affichee = e => e.type !== 'direction' || porteDuContenu(e) || !equipes.some(x => x.parentId === e.id);
    return [...equipes.filter(e => affichee(e) && e.type !== 'direction'), ...equipes.filter(e => affichee(e) && e.type === 'direction')];
  },
  /* Élément choisi : celui mémorisé s'il existe encore, sinon l'équipe ouverte,
     sinon la première unité de la navigation. */
  selection() {
    const choix = ui('listeRessources', { choix: null }).choix, unites = this.unites();
    const existe = c => c && (['postes', 'contrats'].includes(c.type)
      || (c.type === 'projet' && projet(c.id)) || (c.type === 'equipe' && unites.some(e => e.id === c.id)));
    if (existe(choix)) return choix;
    const parDefaut = unites.find(e => e.id === etat.equipeCourante) || unites[0];
    return parDefaut ? { type: 'equipe', id: parDefaut.id } : { type: 'aucun' };
  },
  /* Rôles sur un projet. Product Owner = rôle « Chef de projet » (libellé du référentiel, inchangé
     en base) ; le chef inscrit sur la fiche du projet compte aussi, même sans affectation. */
  rolesDuProjet(p, ressources) {
    const affectations = etat.d.affectations.filter(a => a.projetId === p.id);
    const fiche = a => ressources.find(r => r.id === a.ressourceId);
    const productOwners = affectations.filter(a => a.role === ROLES_PROJET.CHEF).map(fiche).filter(Boolean);
    const chef = ressources.find(r => r.id === p.chefId);
    if (chef && !productOwners.includes(chef) && !affectations.some(a => a.ressourceId === chef.id)) productOwners.unshift(chef);
    const membres = affectations.filter(a => a.role !== ROLES_PROJET.CHEF).map(a => ({ r: fiche(a), role: a.role })).filter(x => x.r);
    return { productOwners, membres };
  },

  /* ---------- Colonne de gauche : navigation ----------
     Chaque élément porte data-recherche (texte cherché par filtrerArbre : son nom et celui
     des personnes qu'il montre — pour l'équipe, ses personnes sans projet) ; une équipe et
     ses éléments forment un .noeud-groupe ; data-nom = nom de l'équipe seul. */
  navigation(choix) {
    const esc = C.esc, ressources = this.ressources();
    const actif = (type, id) => choix.type === type && choix.id === id ? ' actif' : '';
    const noms = liste => liste.map(r => r.nom).join(' ');
    const groupes = this.unites().map(e => {
      const responsable = ressources.find(r => r.id === e.responsableId);
      const personnes = ressources.filter(r => r.equipeId === e.id);
      const projets = etat.d.projets.filter(p => p.equipeId === e.id).map(p => {
        const { productOwners, membres } = this.rolesDuProjet(p, ressources);
        const equipeProjet = [...productOwners, ...membres.map(m => m.r)];
        return `<a class="noeud projet${actif('projet', p.id)}" data-action="choisirNoeud" data-type="projet" data-id="${p.id}"
          data-recherche="${esc(`${p.code} ${p.nom} ${noms(equipeProjet)}`.toLowerCase())}">${esc(p.nom)} <span class="compte">${equipeProjet.length}</span></a>`;
      }).join('');
      return `<div class="noeud-groupe">
        <a class="noeud equipe${actif('equipe', e.id)}" data-action="choisirNoeud" data-type="equipe" data-id="${e.id}" data-nom="${esc(e.nom.toLowerCase())}"
          data-recherche="${esc(`${e.nom} ${noms(personnes.filter(r => !etat.d.affectations.some(a => a.ressourceId === r.id)))}`.toLowerCase())}">${esc(e.nom)} <span class="compte">${personnes.length}</span></a>
        ${responsable ? `<a class="noeud personne" data-action="choisirNoeud" data-type="equipe" data-id="${e.id}" data-recherche="${esc(responsable.nom.toLowerCase())}">
          ${C.avatar(responsable.nom)}<span>${esc(responsable.nom)}</span> <span class="compte">responsable</span></a>` : ''}
        ${projets}</div>`;
    }).join('');
    return `<nav class="carte nav-ressources" id="nav-ressources">
      <label class="recherche-champ">${C.icone('recherche')}<input placeholder="Rechercher une personne, un projet" data-action-saisie="filtrerArbre"></label>
      ${groupes || C.vide(etat.estAdmin ? 'Aucune équipe : « + Ajouter une équipe » pour commencer.' : 'Aucune équipe.')}
      <div class="nav-separateur"></div>
      <a class="noeud${actif('postes')}" data-action="choisirNoeud" data-type="postes">Postes <span class="compte">${valeursDe('poste', true).length}</span></a>
      <a class="noeud${actif('contrats')}" data-action="choisirNoeud" data-type="contrats">Types de contrat <span class="compte">${valeursDe('contrat', true).length}</span></a>
    </nav>`;
  },

  /* ---------- Colonne de droite : détail de l'élément choisi ---------- */
  detail(choix) {
    if (choix.type === 'postes') return this.valeurs('poste', 'poste', 'Postes');
    if (choix.type === 'contrats') return this.valeurs('contrat', 'typeContrat', 'Types de contrat');
    if (choix.type === 'projet') return this.detailProjet(projet(choix.id));
    if (choix.type === 'equipe') return this.detailEquipe(equipe(choix.id));
    return '';
  },

  // Équipe : responsable (souvent hors projet, ex. Anne pour Applications), projets, personnes sans projet
  detailEquipe(e) {
    const esc = C.esc, admin = etat.estAdmin, membre = estMembreDe(e.id), ressources = this.ressources();
    const personnes = ressources.filter(r => r.equipeId === e.id);
    const projets = etat.d.projets.filter(p => p.equipeId === e.id);
    const affectee = r => etat.d.affectations.some(a => a.ressourceId === r.id);
    const responsable = personnes.find(r => r.id === e.responsableId) || ressources.find(r => r.id === e.responsableId);
    const sansProjet = personnes.filter(r => r !== responsable && !affectee(r));
    const vide = !personnes.length && !projets.length && !etat.d.equipes.some(x => x.parentId === e.id);
    const boutons = [
      admin || estResponsableDe(e.id) ? `<button class="btn" data-action="modifierEquipe" data-id="${e.id}">Modifier l’équipe</button>` : '',
      admin ? C.boutonIcone('supprimer', 'supprimerEquipe', `data-id="${e.id}"`, vide ? 'Supprimer l’équipe' : 'Équipe non vide : retirez d’abord ses projets et ses membres', !vide) : ''
    ].join('');
    const lignesProjets = projets.map(p => {
      const { productOwners, membres } = this.rolesDuProjet(p, ressources);
      return `<tr class="cliquable" data-action="choisirNoeud" data-type="projet" data-id="${p.id}"><td>${C.code(p.code)}</td><td><b style="font-weight:500">${esc(p.nom)}</b></td>
        <td>${C.badgeRef('stp', p.statut)}</td><td>${esc(productOwners.map(r => r.nom).join(', ')) || '<span class="pale">—</span>'}</td><td class="num">${membres.length}</td></tr>`;
    }).join('');
    return `
      <div class="carte detail-entete"><div><h2 class="detail-titre">${esc(e.nom)} ${C.code(e.prefixe)}</h2>
        <div class="discret">${projets.length} projet(s) · ${personnes.length} personne(s)</div></div><span style="flex:1"></span>${boutons}</div>
      ${responsable ? this.carteResponsable(responsable, affectee(responsable)) : ''}
      <div class="carte"><div class="carte-titre"><h2>Projets</h2>${membre ? `<a data-action="nouveauProjet" data-equipe="${e.id}">+ Projet</a>` : ''}</div>
        <table class="tableau"><thead><tr><th>Code</th><th>Projet</th><th>Statut</th><th>Product Owners</th><th class="num">Membres</th></tr></thead>
        <tbody>${lignesProjets || `<tr><td colspan="5">${C.vide('Aucun projet.')}</td></tr>`}</tbody></table></div>
      <div class="carte"><div class="carte-titre"><h2>Personnes sans projet</h2>${membre || admin ? `<a data-action="nouvelleRessource" data-equipe="${e.id}">+ Personne</a>` : ''}</div>
        ${this.tableauPersonnes(sansProjet.map(r => ({ r })), 'Aucune personne sans projet.')}</div>`;
  },
  /* Responsable de l'équipe : en tête, signalé « hors projet » s'il n'est affecté à aucun projet.
     Il compte comme toute personne de l'équipe dans Congés & capacité (règle de présence, etat.js). */
  carteResponsable(r, affecte) {
    const esc = C.esc, editable = estMembreDe(r.equipeId) || etat.estAdmin;
    return `<div class="carte detail-entete responsable">${C.avatar(r.nom, true)}
      <div><div class="nom-personne">${esc(r.nom)}</div><div class="discret">Responsable de l’équipe${r.poste ? ' · ' + esc(r.poste) : ''}</div></div>
      <span style="flex:1"></span>${affecte ? '' : C.badge('Hors projet', '#5B2DA0', '#EDE6FA')}
      ${estInactive(r) ? C.badgeActif(false, ['Actif', 'Inactif']) : C.badge('Comptée dans Congés & capacité', '#0033AD', '#E8EEFF')}
      ${editable ? `<a data-action="modifierRessource" data-id="${r.id}">Fiche</a>` : ''}</div>`;
  },

  // Projet : Product Owners en cartes, puis membres (et lecteurs) en tableau
  detailProjet(p) {
    const esc = C.esc, ressources = this.ressources(), editable = peutEditerProjet(p);
    const { productOwners, membres } = this.rolesDuProjet(p, ressources);
    const departs = [...productOwners, ...membres.map(m => m.r)].filter(r => r.dateDepart && r.dateDepart >= Calculs.aujourdhui()).length;
    const cartesPo = productOwners.map(r => `<div class="carte-po">${C.avatar(r.nom)}<div style="flex:1;min-width:0">
        <div class="nom-personne">${esc(r.nom)}</div><div class="discret">${esc([r.typeContrat, Calculs.libellePresence(r, Calculs.aujourdhui())].filter(Boolean).join(' · '))}</div></div>
        ${estMembreDe(r.equipeId) || etat.estAdmin ? `<a data-action="modifierRessource" data-id="${r.id}">Fiche</a>` : ''}</div>`).join('');
    const indicateur = (n, libelle) => `<div><b>${n}</b><span class="discret">${libelle}</span></div>`;
    return `
      <div class="carte detail-entete"><div><a class="discret" data-action="choisirNoeud" data-type="equipe" data-id="${p.equipeId}">${esc(equipe(p.equipeId).nom)} ›</a>
        <h2 class="detail-titre">${esc(p.nom)} ${C.code(p.code)} ${C.badgeRef('stp', p.statut)}</h2></div><span style="flex:1"></span>
        <div class="detail-kpi">${indicateur(productOwners.length, 'Product Owners')}${indicateur(membres.length, 'membres')}${indicateur(departs, 'départ(s) prévu(s)')}</div>
        <button class="btn" data-action="ouvrirProjet" data-id="${p.id}">${editable ? 'Modifier le projet' : 'Voir le projet'}</button></div>
      <div class="carte"><div class="carte-titre"><h2>Product Owners ${C.aide('productOwners')}</h2><span class="discret">rôle « ${esc(ROLES_PROJET.CHEF)} »</span></div>
        <div class="cartes-po">${cartesPo || '<span class="pale">Aucun Product Owner.</span>'}
          ${editable ? `<a class="carte-po ajout" data-action="assigner" data-projet="${p.id}" data-role="${esc(ROLES_PROJET.CHEF)}">+ Ajouter un Product Owner</a>` : ''}</div></div>
      <div class="carte"><div class="carte-titre"><h2>Membres</h2>${editable ? `<a data-action="assigner" data-projet="${p.id}">+ Membre</a>` : ''}</div>
        ${this.tableauPersonnes(membres, 'Aucun membre.', true)}</div>`;
  },

  /* Tableau de personnes : [{ r, role }] ; avecRole = colonne « Rôle » (membres d'un projet).
     Statut : « Inactif » dès qu'une date de fin est saisie (règle du porteur, 2026-10-05) ;
     cliquable par l'équipe de la personne (pose ou retire la date de fin). */
  tableauPersonnes(lignes, texteVide, avecRole = false) {
    const esc = C.esc, aujourdhui = Calculs.aujourdhui();
    const corps = lignes.map(({ r, role }) => {
      const editable = estMembreDe(r.equipeId) || etat.estAdmin, badge = C.badgeActif(!estInactive(r), ['Actif', 'Inactif']);
      return `<tr data-ressource="${r.id}"><td><span class="ligne-flex">${C.avatar(r.nom)}<span class="nom-personne">${esc(r.nom)}</span></span></td>
        <td>${esc(r.poste || '—')}</td><td>${esc(r.typeContrat || '—')}</td>${avecRole ? `<td>${C.badgeRef('role', role)}</td>` : ''}
        <td class="${r.dateDepart ? 'presence-fin' : 'discret'}">${esc(Calculs.libellePresence(r, aujourdhui)) || '<span class="pale">—</span>'}</td>
        <td>${editable ? `<button class="lien-btn" data-action="basculerActifRessource" data-id="${r.id}" title="${estInactive(r) ? 'Réactiver (retire la date de fin)' : 'Rendre inactive (date de fin = aujourd’hui)'}">${badge}</button>` : badge}</td>
        <td class="num">${editable ? `<a data-action="modifierRessource" data-id="${r.id}">Fiche</a> &nbsp; <a data-action="assigner" data-ressource="${r.id}">Projets</a>` : ''}</td></tr>`;
    }).join('');
    return `<table class="tableau"><thead><tr><th>Personne</th><th>Poste</th><th>Contrat</th>${avecRole ? '<th>Rôle</th>' : ''}<th>Présence ${C.aide('datesPresence')}</th><th>Statut ${C.aide('statutPersonne')}</th><th></th></tr></thead>
      <tbody>${corps || `<tr><td colspan="${avecRole ? 7 : 6}">${C.vide(texteVide)}</td></tr>`}</tbody></table>`;
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
  // Choix d'une équipe, d'un projet ou d'une liste (Postes, Types de contrat) dans la navigation
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
      const visible = equipeTrouvee || trouves.length || tete.dataset.recherche.includes(q);
      tete.style.display = groupe.style.display = visible ? '' : 'none';
    });
  },

  // Nouvelle unité (équipe par défaut ; le type direction reste choisissable dans la fenêtre)
  nouvelleUnite: d => majEtat({ modale: { type: 'equipe', id: null, typeUnite: d.type, parentId: d.parent || null } }),
  // Suppression d'une unité vide : ligne « equipes » (contrôlée en base), puis organisation Neon Auth
  async supprimerEquipe(d) {
    if (!confirm(`Supprimer « ${equipe(d.id).nom} » (vide) ?`)) return;
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

  /* Fenêtre d'affectation : pour une personne (data-ressource) ou pré-remplie sur un projet
     (data-projet) ; data-role pré-choisit le rôle (« + Ajouter un Product Owner » → Chef de projet) */
  assigner: d => majEtat({ modale: { type: 'affectation', ressourceId: d.ressource || null, projetId: d.projet || null, role: d.role || null } }),
  nouvelleRessource: d => majEtat({ modale: { type: 'ressource', id: null, equipeId: d.equipe } }),
  modifierRessource: d => majEtat({ modale: { type: 'ressource', id: d.id } }),
  // Statut d'une personne : « Inactif » = date de fin saisie (règle du porteur) ; le bouton pose la date
  // de fin à aujourd'hui, ou la retire pour réactiver la personne
  basculerActifRessource(d) {
    const r = ressource(d.id), inactive = estInactive(r);
    if (!inactive && !confirm(`Rendre ${r.nom} inactive ? Sa date de fin sera aujourd’hui.`)) return;
    executer(() => Api.modifier('ressources', { id: 'eq.' + d.id }, { dateDepart: inactive ? null : Calculs.aujourdhui() }), 'ressources');
  },
  basculerInactifs: () => majUi('listeRessources', { inactifs: !ui('listeRessources', { inactifs: true }).inactifs })
});
