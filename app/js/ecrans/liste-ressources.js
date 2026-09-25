/* ============================================================
   Mon dashboard › Gestion des ressources › Liste des ressources
   (maquettes arborescence-ressources/arborescence-ressources.png,
   direction-espace-travail/ et liste-ressources-board/)
   Onglets :
   - Organisation : une seule arborescence
       Direction → Équipe → Projet → Membres (rôle sur le projet),
     plus, sous chaque unité, les personnes sans projet (fiches).
     Direction et équipe sont deux types de la table « equipes »
     (espaces de travail ; une direction regroupe en plus des équipes).
   - Postes, Types de contrat : référentiels « poste » et « contrat »
     (nombre de ressources, statut, actions).
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
  onglet: () => ui('listeRessources', { onglet: 'organisation' }).onglet,

  rendre() {
    const onglet = this.onglet(), admin = etat.estAdmin;
    const onglets = C.onglets([
      { id: 'organisation', libelle: 'Organisation', compte: etat.d.equipes.length },
      { id: 'postes', libelle: 'Postes', compte: valeursDe('poste', true).length },
      { id: 'contrats', libelle: 'Types de contrat', compte: valeursDe('contrat', true).length }
    ], onglet, 'ongletListeRessources');
    const actions = {
      organisation: '<button class="btn" data-action="toutDeplier">Tout déplier</button>'
        + (admin ? '<button class="btn primaire" data-action="nouvelleUnite" data-type="direction">+ Ajouter une direction</button>' : ''),
      postes: admin ? '<button class="btn primaire" data-action="ajouterValeurListe" data-ref="poste">+ Ajouter un poste</button>' : '',
      contrats: admin ? '<button class="btn primaire" data-action="ajouterValeurListe" data-ref="contrat">+ Ajouter un type de contrat</button>' : ''
    }[onglet];
    const corps = { organisation: () => this.organisation(),
      postes: () => this.valeurs('poste', 'poste', 'Postes'), contrats: () => this.valeurs('contrat', 'typeContrat', 'Types de contrat') }[onglet]();
    return `
    <div class="ecran" style="max-width:1300px">
      ${C.entete('Liste des ressources', 'Direction → équipes → projets → membres', actions)}
      ${onglets}${corps}
    </div>`;
  },

  /* ---------- Onglet Organisation : l'arborescence ----------
     Toutes les lignes sont produites ; celles dont un ancêtre est replié sont
     masquées (style display:none). Chaque ligne porte :
       data-id        identifiant du nœud (unité, projet ou « projet:personne ») ;
       data-chemin    identifiants de ses ancêtres, séparés par des espaces ;
       data-recherche texte cherché par filtrerArbre ;
       data-cache     « 1 » si masquée par un repli (restauré quand la recherche est vidée).
     État d'ouverture (ui listeRessources) : unités ouvertes par défaut (replies),
     projets fermés par défaut (projetsOuverts). */
  organisation() {
    const esc = C.esc, admin = etat.estAdmin, { equipes, ressources, projets, affectations } = etat.d;
    const etatUi = ui('listeRessources', { replies: {}, projetsOuverts: {} });
    const nbRessources = id => ressources.filter(r => r.equipeId === id).length;
    const enfants = id => equipes.filter(e => e.parentId === id);
    const nomRessource = id => { const r = ressource(id); return r ? esc(r.nom) : '<span class="pale">—</span>'; };
    const lignes = [];

    // Ajoute une ligne ; chemin = ancêtres ; masquee = un ancêtre est replié
    const ajouter = (id, chemin, masquee, recherche, cellules) => lignes.push(
      `<tr data-id="${id}" data-chemin="${chemin.join(' ')}" data-recherche="${esc(recherche.toLowerCase())}"${masquee ? ' data-cache="1" style="display:none"' : ''}>${cellules}</tr>`);
    const retrait = niveau => `padding-left:${niveau * 28}px`;
    const chevron = (id, ouvert, action) => `<button class="chevron" data-action="${action}" data-id="${id}">${ouvert ? '▾' : '▸'}</button>`;
    const sansChevron = '<span style="width:16px;display:inline-block"></span>';

    // Personne : membre d'un projet (rôle) ou personne de l'unité sans projet
    const lignePersonne = (r, a, niveau, chemin, masquee) => {
      const editable = a ? peutEditerProjet(projet(a.projetId)) : estMembreDe(r.equipeId) || admin;
      const detail = [r.poste, r.typeContrat].filter(Boolean).join(' · ');
      ajouter((a ? a.projetId + ':' : 'r:') + r.id, chemin, masquee, `${r.nom} ${r.poste || ''}`,
        `<td><span class="arbre-parent" style="${retrait(niveau)}">${sansChevron}${C.avatar(r.nom)}<span>${esc(r.nom)}</span> <span class="discret">${esc(detail)}</span></span></td>
         <td></td><td>${a ? C.badgeRef('role', a.role) : '<span class="pale">sans projet</span>'}</td><td></td>
         <td class="num">${editable ? `<a data-action="modifierRessource" data-id="${r.id}">Fiche</a>` : ''}
           ${a && editable ? ` &nbsp; <a data-action="assigner" data-ressource="${r.id}">Modifier</a>` : ''}</td>`);
    };

    // Projet et ses membres
    const ligneProjet = (p, niveau, chemin, masquee) => {
      const membres = affectations.filter(a => a.projetId === p.id), ouvert = !!etatUi.projetsOuverts[p.id];
      ajouter(p.id, chemin, masquee, `${p.code} ${p.nom}`,
        `<td><span class="arbre-parent" style="${retrait(niveau)}">${membres.length ? chevron(p.id, ouvert, 'deplierProjetArbre') : sansChevron}
            ${C.icone('projet')}${C.code(p.code)} ${esc(p.nom)}</span></td>
         <td class="num" style="text-align:center">${membres.length}</td><td>Chef : ${nomRessource(p.chefId)}</td>
         <td>${C.badgeRef('stp', p.statut)}</td>
         <td class="num"><span class="ligne-flex" style="justify-content:flex-end">${peutEditerProjet(p) ? `<a data-action="assigner" data-projet="${p.id}">+ Membre</a>` : ''}
           ${C.boutonIcone('modifier', 'ouvrirProjet', `data-id="${p.id}"`, peutEditerProjet(p) ? 'Modifier le projet' : 'Voir le projet')}</span></td>`);
      membres.forEach(a => { const r = ressource(a.ressourceId); if (r) lignePersonne(r, a, niveau + 1, [...chemin, p.id], masquee || !ouvert); });
    };

    // Unité (direction ou équipe) : ses équipes, ses projets, ses personnes sans projet
    const ligneUnite = (e, niveau, chemin, masquee) => {
      const direction = e.type === 'direction', sesEquipes = enfants(e.id), ouvert = !etatUi.replies[e.id];
      const sesProjets = projets.filter(p => p.equipeId === e.id);
      const sansProjet = ressources.filter(r => r.equipeId === e.id && !affectations.some(a => a.ressourceId === r.id));
      const total = nbRessources(e.id) + sesEquipes.reduce((s, x) => s + nbRessources(x.id), 0);
      const vide = !nbRessources(e.id) && !sesProjets.length && !sesEquipes.length;
      const aDesEnfants = sesEquipes.length || sesProjets.length || sansProjet.length;
      const membre = estMembreDe(e.id), libelle = direction ? 'la direction' : 'l’équipe';
      const boutons = [
        admin && direction ? `<a data-action="nouvelleUnite" data-type="equipe" data-parent="${e.id}">+ Équipe</a>` : '',
        membre ? `<a data-action="nouveauProjet" data-equipe="${e.id}">+ Projet</a>` : '',
        membre || admin ? `<a data-action="nouvelleRessource" data-equipe="${e.id}">+ Membre</a>` : '',
        admin || estResponsableDe(e.id) ? C.boutonIcone('modifier', 'modifierEquipe', `data-id="${e.id}"`, 'Modifier ' + libelle) : '',
        admin ? C.boutonIcone('supprimer', 'supprimerEquipe', `data-id="${e.id}"`, vide ? 'Supprimer ' + libelle
          : sesEquipes.length ? 'Direction non vide : rattachez ses équipes ailleurs' : 'Unité non vide : passez-la en Inactive', !vide) : ''
      ].filter(Boolean).join(' &nbsp; ');
      ajouter(e.id, chemin, masquee, e.nom,
        `<td><span class="arbre-parent" style="${retrait(niveau)}">${aDesEnfants ? chevron(e.id, ouvert, 'replierDirection') : sansChevron}
            ${C.icone(direction ? 'direction' : 'equipe')}<b style="font-weight:500">${esc(e.nom)}</b> ${C.code(e.prefixe)}
            <span class="pale" style="font-size:11px">${direction ? 'direction' : 'équipe'}</span></span></td>
         <td class="num" style="text-align:center">${total}${sesEquipes.length ? ` <span class="pale" style="font-size:11px">(dont ${nbRessources(e.id)} en direct)</span>` : ''}</td>
         <td>${nomRessource(e.responsableId)}</td><td>${C.badgeActif(e.actif !== false)}</td>
         <td class="num"><span class="ligne-flex" style="justify-content:flex-end">${boutons}</span></td>`);
      const sousChemin = [...chemin, e.id], sousMasquee = masquee || !ouvert;
      sesEquipes.forEach(x => ligneUnite(x, niveau + 1, sousChemin, sousMasquee));
      sesProjets.forEach(p => ligneProjet(p, niveau + 1, sousChemin, sousMasquee));
      sansProjet.forEach(r => lignePersonne(r, null, niveau + 1, sousChemin, sousMasquee));
    };

    // Racines : directions, puis équipes non rattachées (ordre alphabétique)
    const racines = equipes.filter(e => !e.parentId || !parId('equipes', e.parentId));
    [...racines.filter(e => e.type === 'direction'), ...racines.filter(e => e.type !== 'direction')].forEach(e => ligneUnite(e, 0, [], false));

    return `<div class="carte">
      <div class="carte-titre"><h2>Directions, équipes, projets et membres</h2>
        <label class="recherche-champ">${C.icone('recherche')}<input placeholder="Rechercher (unité, projet, personne)" data-action-saisie="filtrerArbre"></label></div>
      <table class="tableau" id="table-unites"><thead><tr><th>Nom</th><th style="text-align:center">Ressources</th><th>Responsable / rôle</th><th>Statut</th><th class="num">Actions</th></tr></thead>
        <tbody>${lignes.join('') || `<tr><td colspan="5">${C.vide(admin ? 'Aucune unité : « + Ajouter une direction » pour commencer.' : 'Aucune unité.')}</td></tr>`}</tbody></table></div>`;
  },

  /* ---------- Onglet Postes / Types de contrat ---------- */
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
    return `<div class="carte"><div class="carte-titre"><h2>${esc(titre)}</h2><span class="discret">Utilisés dans les fiches ressources</span></div>
      <table class="tableau"><thead><tr><th>Nom</th><th style="text-align:center">Ressources</th><th>Statut</th><th class="num">Actions</th></tr></thead>
      <tbody>${lignes || `<tr><td colspan="4">${C.vide('Aucune valeur.')}</td></tr>`}</tbody></table></div>`;
  },

};

Object.assign(Actions, {
  ongletListeRessources: d => majUi('listeRessources', { onglet: d.id }),

  /* Recherche dans l'arborescence, sans redessiner (pour garder la saisie) :
     une ligne est visible si elle correspond, si un de ses ancêtres correspond
     (on voit le contenu d'une équipe trouvée) ou si un de ses descendants
     correspond (on voit le chemin jusqu'à une personne trouvée). */
  filtrerArbre(_, el) {
    const q = el.value.trim().toLowerCase();
    const lignes = [...document.querySelectorAll('#table-unites tbody tr[data-id]')];
    if (!q) { lignes.forEach(tr => { tr.style.display = tr.dataset.cache ? 'none' : ''; }); return; }
    const trouvees = lignes.filter(tr => tr.dataset.recherche.includes(q));
    const idsTrouves = new Set(trouvees.map(tr => tr.dataset.id));
    const ancetresDesTrouvees = new Set(trouvees.flatMap(tr => tr.dataset.chemin.split(' ')));
    lignes.forEach(tr => {
      const visible = idsTrouves.has(tr.dataset.id) || ancetresDesTrouvees.has(tr.dataset.id)
        || tr.dataset.chemin.split(' ').some(id => idsTrouves.has(id));
      tr.style.display = visible ? '' : 'none';
    });
  },
  // Replier / déplier une unité (ouverte par défaut) ou un projet (fermé par défaut)
  replierDirection(d) {
    const replies = { ...ui('listeRessources', { replies: {} }).replies }; replies[d.id] = !replies[d.id];
    majUi('listeRessources', { replies });
  },
  deplierProjetArbre(d) {
    const projetsOuverts = { ...ui('listeRessources', { projetsOuverts: {} }).projetsOuverts }; projetsOuverts[d.id] = !projetsOuverts[d.id];
    majUi('listeRessources', { projetsOuverts });
  },
  toutDeplier: () => majUi('listeRessources', { replies: {}, projetsOuverts: Object.fromEntries(etat.d.projets.map(p => [p.id, true])) }),

  // Nouvelle unité : direction, ou équipe déjà rattachée à sa direction (data-parent)
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

  // Fenêtre d'affectation : pour une personne (data-ressource) ou pré-remplie sur un projet (data-projet)
  assigner: d => majEtat({ modale: { type: 'affectation', ressourceId: d.ressource || null, projetId: d.projet || null } }),
  nouvelleRessource: d => majEtat({ modale: { type: 'ressource', id: null, equipeId: d.equipe } }),
  modifierRessource: d => majEtat({ modale: { type: 'ressource', id: d.id } })
});
