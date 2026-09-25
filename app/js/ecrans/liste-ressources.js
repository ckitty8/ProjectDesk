/* ============================================================
   Mon dashboard › Gestion des ressources › Liste des ressources
   (maquettes liste-ressources-board/liste-ressources-board.png et 09-mListe.png)
   Onglets :
   - Équipes           : tableau « Directions & équipes » (arborescence,
                         recherche, ressources, responsable, statut, actions) ;
   - Affectations      : arborescence équipe → projet → personnes (rôle) ;
   - Postes, Types de contrat : référentiels « poste » et « contrat »
                         (nombre de ressources, statut, actions).
   Direction et équipe sont deux types de la même table « equipes »
   (espaces de travail ; une direction regroupe en plus des équipes —
   maquette direction-espace-travail/direction-espace-travail.png).
   Modifications : administrateurs globaux (unités, postes, contrats) ;
   la base refuse de supprimer une unité ou une valeur utilisée.
   ============================================================ */
'use strict';

Ecrans.listeRessources = {
  titre: 'Gestion des ressources · Liste des ressources',
  section: 'moi',
  onglet: () => ui('listeRessources', { onglet: 'equipes' }).onglet,

  rendre() {
    const onglet = this.onglet(), { equipes, affectations } = etat.d;
    const onglets = C.onglets([
      { id: 'equipes', libelle: 'Équipes', compte: equipes.length },
      { id: 'affectations', libelle: 'Affectations', compte: affectations.length },
      { id: 'postes', libelle: 'Postes', compte: valeursDe('poste', true).length },
      { id: 'contrats', libelle: 'Types de contrat', compte: valeursDe('contrat', true).length }
    ], onglet, 'ongletListeRessources');
    const admin = etat.estAdmin;
    const actions = {
      equipes: admin ? '<button class="btn primaire" data-action="ajouterUnite">+ Ajouter une unité</button>' : '',
      affectations: '<button class="btn" data-action="toutDeplier">Tout déplier</button><button class="btn primaire" data-action="assigner">+ Assigner une ressource</button>',
      postes: admin ? '<button class="btn primaire" data-action="ajouterValeurListe" data-ref="poste">+ Ajouter un poste</button>' : '',
      contrats: admin ? '<button class="btn primaire" data-action="ajouterValeurListe" data-ref="contrat">+ Ajouter un type de contrat</button>' : ''
    }[onglet];
    const corps = { equipes: () => this.unites(), affectations: () => this.affectations(),
      postes: () => this.valeurs('poste', 'poste', 'Postes'), contrats: () => this.valeurs('contrat', 'typeContrat', 'Types de contrat') }[onglet]();
    return `
    <div class="ecran" style="max-width:1300px">
      ${C.entete('Liste des ressources', 'Organisation des équipes, affectations, postes et types de contrat', actions)}
      ${onglets}${corps}
    </div>`;
  },

  /* ---------- Onglet Équipes : directions & équipes ----------
     Toute unité est une ligne de « equipes » (espace de travail) ; une direction
     (type 'direction') peut en plus regrouper des équipes (parentId). */
  unites() {
    const esc = C.esc, admin = etat.estAdmin, { equipes, ressources, projets } = etat.d;
    const replies = ui('listeRessources', { replies: {} }).replies;
    const nbRessources = id => ressources.filter(r => r.equipeId === id).length;
    const enfants = id => equipes.filter(e => e.parentId === id);
    const nomResponsable = id => { const r = ressource(id); return r ? esc(r.nom) : '<span class="pale">—</span>'; };

    // Une ligne d'unité. data-recherche : texte cherché (unité + ses équipes), lu par filtrerUnites
    const ligne = (e, enfant) => {
      const sesEquipes = enfants(e.id), direction = e.type === 'direction', replie = !!replies[e.id];
      const total = nbRessources(e.id) + sesEquipes.reduce((s, x) => s + nbRessources(x.id), 0);
      const vide = !nbRessources(e.id) && !projets.some(p => p.equipeId === e.id) && !sesEquipes.length;
      const texte = [e.nom, ...sesEquipes.map(x => x.nom)].join(' ').toLowerCase();
      const chevron = sesEquipes.length ? `<button class="chevron" data-action="replierDirection" data-id="${e.id}">${replie ? '▸' : '▾'}</button>`
        : (enfant ? '' : '<span style="width:16px"></span>');
      const libelle = direction ? 'la direction' : 'l’équipe';
      const raisonNonVide = sesEquipes.length ? 'Direction non vide : rattachez ses équipes ailleurs' : 'Unité non vide : passez-la en Inactive';
      return `<tr data-recherche="${esc(texte)}" data-nom="${esc(e.nom.toLowerCase())}" data-direction="${e.id}" ${enfant ? `data-parent="${e.parentId}"` : ''}>
        <td><span class="${enfant ? 'arbre-enfant' : 'arbre-parent'}">${chevron}${C.icone(direction ? 'direction' : 'equipe')}
          ${direction ? `<b style="font-weight:500">${esc(e.nom)}</b>` : esc(e.nom)} ${C.code(e.prefixe)}</span></td>
        <td class="num" style="text-align:center">${total}${sesEquipes.length ? ` <span class="pale" style="font-size:11px">(dont ${nbRessources(e.id)} en direct)</span>` : ''}</td>
        <td>${nomResponsable(e.responsableId)}</td><td>${C.badgeActif(e.actif !== false)}</td>
        <td class="num">${admin || estResponsableDe(e.id) ? C.boutonIcone('modifier', 'modifierEquipe', `data-id="${e.id}"`, 'Modifier ' + libelle) : ''}
          ${admin ? C.boutonIcone('supprimer', 'supprimerEquipe', `data-id="${e.id}"`, vide ? 'Supprimer ' + libelle : raisonNonVide, !vide) : ''}</td></tr>`
        + (replie ? '' : sesEquipes.map(x => ligne(x, true)).join(''));
    };
    // Racines : directions puis équipes non rattachées (ordre alphabétique conservé)
    const racines = equipes.filter(e => !e.parentId || !parId('equipes', e.parentId));
    const lignes = [...racines.filter(e => e.type === 'direction'), ...racines.filter(e => e.type !== 'direction')].map(e => ligne(e, false)).join('');

    return `<div class="carte">
      <div class="carte-titre"><h2>Directions & équipes <span class="pale" title="Toute unité est un espace de travail (membres, projets, demandes) ; une direction peut en plus regrouper des équipes">ⓘ</span></h2>
        <label class="recherche-champ">${C.icone('recherche')}<input placeholder="Rechercher une unité" data-action-saisie="filtrerUnites"></label></div>
      <table class="tableau" id="table-unites"><thead><tr><th>Nom</th><th style="text-align:center">Ressources</th><th>Responsable</th><th>Statut</th><th class="num">Actions</th></tr></thead>
        <tbody>${lignes || `<tr><td colspan="5">${C.vide('Aucune unité. « + Ajouter une unité » (administrateur).')}</td></tr>`}</tbody></table></div>`;
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

  /* ---------- Onglet Affectations : équipe → projet → personnes ---------- */
  affectations() {
    const esc = C.esc, { equipes, projets, ressources, affectations } = etat.d;
    const ouvertes = ui('listeRessources', { ouvertes: { [etat.equipeCourante]: true } }).ouvertes;
    const kpis = [C.kpi('Équipes', equipes.length), C.kpi('Projets', projets.length), C.kpi('Personnes', ressources.length), C.kpi('Affectations', affectations.length)].join('');
    // Nombre d'autres projets d'une personne (affichage « +2 autres projets »)
    const autres = (rId, pId) => { const n = affectations.filter(a => a.ressourceId === rId && a.projetId !== pId).length;
      return n ? `+${n} autre${n > 1 ? 's' : ''} projet${n > 1 ? 's' : ''}` : ''; };

    const blocs = equipes.map(e => {
      const sesProjets = projets.filter(p => p.equipeId === e.id), sesPersonnes = ressources.filter(r => r.equipeId === e.id);
      const ouvert = !!ouvertes[e.id], modifiable = estMembreDe(e.id);
      const entete = `<tr class="groupe"><td colspan="3"><span class="ligne-flex"><button class="lien-btn" data-action="deplierEquipe" data-id="${e.id}">${ouvert ? '▾' : '▸'}</button>
          ${C.pastille(e.couleur)}${esc(e.nom)} <span class="discret" style="font-weight:400">${sesProjets.length} projets · ${sesPersonnes.length} personnes</span></span></td>
        <td class="num">${modifiable ? `<a data-action="nouvelleRessource" data-equipe="${e.id}">+ Personne</a> &nbsp; <a data-action="nouveauProjet">+ Projet</a>` : ''}</td></tr>`;
      if (!ouvert) return entete;
      const lignesProjets = sesProjets.map(p => {
        const membres = affectations.filter(a => a.projetId === p.id), editable = peutEditerProjet(p);
        return `<tr><td colspan="3" style="padding-left:40px">${C.code(p.code)} ${esc(p.nom)} <span class="discret">${membres.length} membres</span></td>
            <td class="num">${editable ? `<button class="btn petit" data-action="assigner" data-projet="${p.id}">+ Ajouter une personne</button>` : ''}</td></tr>` +
          membres.map(a => { const r = ressource(a.ressourceId); if (!r) return '';
            return `<tr><td style="padding-left:64px"><span class="ligne-flex">${C.avatar(r.nom)}<b style="font-weight:500">${esc(r.nom)}</b>
                <span class="discret">${esc(r.poste || '')}</span> <span class="pale">${autres(r.id, p.id)}</span></span></td><td></td>
              <td class="num">${C.badgeRef('role', a.role)}</td>
              <td class="num">${editable ? `<a data-action="assigner" data-ressource="${r.id}">Modifier</a>` : ''}</td></tr>`; }).join('');
      }).join('');
      // Personnes de l'équipe (fiches) — nom, poste, type de contrat, capacité, email
      const fiches = sesPersonnes.map(r => `<tr><td style="padding-left:40px"><span class="ligne-flex">${C.avatar(r.nom)}${esc(r.nom)}
          <span class="discret">${esc(r.poste || '')}${r.typeContrat ? ' · ' + esc(r.typeContrat) : ''} · ${r.capacite} %${r.userId ? ' · compte lié' : r.email ? ' · ' + esc(r.email) : ''}</span></span></td><td></td><td></td>
        <td class="num">${modifiable ? `<a data-action="modifierRessource" data-id="${r.id}">Fiche</a>` : ''}</td></tr>`).join('');
      return entete + lignesProjets + (sesPersonnes.length ? `<tr><td colspan="4" class="libelle" style="padding:12px 12px 4px 40px">Personnes de l’équipe</td></tr>${fiches}` : '');
    }).join('');
    return `<div class="grille-kpi q4">${kpis}</div>
      <div class="carte"><table class="tableau"><tbody>${blocs || `<tr><td>${C.vide('Aucune équipe.')}</td></tr>`}</tbody></table></div>`;
  }
};

Object.assign(Actions, {
  ongletListeRessources: d => majUi('listeRessources', { onglet: d.id }),

  // Recherche : on masque les lignes sans correspondance (sans redessiner, pour garder la saisie)
  filtrerUnites(_, el) {
    const q = el.value.trim().toLowerCase();
    document.querySelectorAll('#table-unites tbody tr[data-recherche]').forEach(tr => {
      const parent = tr.dataset.parent && document.querySelector(`#table-unites tr[data-direction="${tr.dataset.parent}"]`);
      const visible = !q || tr.dataset.recherche.includes(q) || (parent && parent.dataset.nom.includes(q));
      tr.style.display = visible ? '' : 'none';
    });
  },
  replierDirection(d) {
    const replies = { ...ui('listeRessources', { replies: {} }).replies }; replies[d.id] = !replies[d.id];
    majUi('listeRessources', { replies });
  },

  ajouterUnite: () => majEtat({ modale: { type: 'unite' } }),
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

  deplierEquipe(d) {
    const ouvertes = { ...ui('listeRessources', { ouvertes: { [etat.equipeCourante]: true } }).ouvertes };
    ouvertes[d.id] = !ouvertes[d.id]; majUi('listeRessources', { ouvertes });
  },
  toutDeplier: () => majUi('listeRessources', { ouvertes: Object.fromEntries(etat.d.equipes.map(e => [e.id, true])) }),
  // Fenêtre d'affectation : pour une personne (data-ressource) ou pré-remplie sur un projet (data-projet)
  assigner: d => majEtat({ modale: { type: 'affectation', ressourceId: d.ressource || null, projetId: d.projet || null } }),
  nouvelleRessource: d => majEtat({ modale: { type: 'ressource', id: null, equipeId: d.equipe } }),
  modifierRessource: d => majEtat({ modale: { type: 'ressource', id: d.id } })
});
