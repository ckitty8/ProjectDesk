/* ============================================================
   Mon dashboard › Gestion des ressources › Liste des ressources
   (maquettes liste-ressources-board/liste-ressources-board.png et 09-mListe.png)
   Onglets :
   - Équipes           : tableau « Directions & équipes » (arborescence,
                         recherche, ressources, responsable, statut, actions) ;
   - Affectations      : arborescence équipe → projet → personnes (rôle) ;
   - Postes, Types de contrat : référentiels « poste » et « contrat »
                         (nombre de ressources, statut, actions).
   Modifications : administrateurs globaux (directions, équipes, postes,
   contrats) ; la base refuse de supprimer une unité ou une valeur utilisée.
   ============================================================ */
'use strict';

Ecrans.listeRessources = {
  titre: 'Gestion des ressources · Liste des ressources',
  section: 'moi',
  onglet: () => ui('listeRessources', { onglet: 'equipes' }).onglet,

  rendre() {
    const onglet = this.onglet(), { equipes, affectations } = etat.d;
    const onglets = C.onglets([
      { id: 'equipes', libelle: 'Équipes', compte: equipes.length + etat.d.directions.length },
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

  /* ---------- Onglet Équipes : directions & équipes ---------- */
  unites() {
    const esc = C.esc, admin = etat.estAdmin, { directions, equipes, ressources, projets } = etat.d;
    const replies = ui('listeRessources', { replies: {} }).replies;
    const nbRessources = equipeId => ressources.filter(r => r.equipeId === equipeId).length;
    const nomResponsable = id => { const r = ressource(id); return r ? esc(r.nom) : '<span class="pale">—</span>'; };
    // data-recherche : texte cherché (unité + ses équipes) ; utilisé par filtrerUnites sans redessiner
    const ligneEquipe = (e, enfant) => {
      const vide = !nbRessources(e.id) && !projets.some(p => p.equipeId === e.id);
      return `<tr data-recherche="${esc(e.nom.toLowerCase())}" ${enfant ? `data-parent="${e.directionId}"` : ''}>
        <td><span class="${enfant ? 'arbre-enfant' : 'arbre-parent'}" style="${enfant ? '' : 'padding-left:24px'}">${C.icone('equipe')}${esc(e.nom)} ${C.code(e.prefixe)}</span></td>
        <td class="num" style="text-align:center">${nbRessources(e.id)}</td><td>${nomResponsable(e.responsableId)}</td><td>${C.badgeActif(e.actif)}</td>
        <td class="num">${admin || estResponsableDe(e.id) ? C.boutonIcone('modifier', 'modifierEquipe', `data-id="${e.id}"`, 'Modifier l’équipe') : ''}
          ${admin ? C.boutonIcone('supprimer', 'supprimerEquipe', `data-id="${e.id}"`, vide ? 'Supprimer l’équipe' : 'Équipe non vide : passez-la en Inactive', !vide) : ''}</td></tr>`;
    };
    const lignes = directions.map(dir => {
      const sesEquipes = equipes.filter(e => e.directionId === dir.id), replie = !!replies[dir.id];
      const total = sesEquipes.reduce((s, e) => s + nbRessources(e.id), 0);
      const texte = [dir.nom, ...sesEquipes.map(e => e.nom)].join(' ').toLowerCase();
      return `<tr data-recherche="${esc(texte)}" data-nom="${esc(dir.nom.toLowerCase())}" data-direction="${dir.id}">
          <td><span class="arbre-parent">${sesEquipes.length ? `<button class="chevron" data-action="replierDirection" data-id="${dir.id}">${replie ? '▸' : '▾'}</button>` : '<span style="width:16px"></span>'}
            ${C.icone('direction')}<b style="font-weight:500">${esc(dir.nom)}</b></span></td>
          <td class="num" style="text-align:center">${total}</td><td>${nomResponsable(dir.responsableId)}</td><td>${C.badgeActif(dir.actif)}</td>
          <td class="num">${admin ? C.boutonIcone('modifier', 'modifierDirection', `data-id="${dir.id}"`, 'Modifier la direction')
            + C.boutonIcone('supprimer', 'supprimerDirection', `data-id="${dir.id}"`, sesEquipes.length ? 'Direction non vide : rattachez ses équipes ailleurs' : 'Supprimer la direction', !!sesEquipes.length) : ''}</td></tr>`
        + (replie ? '' : sesEquipes.map(e => ligneEquipe(e, true)).join(''));
    }).join('') + equipes.filter(e => !e.directionId).map(e => ligneEquipe(e, false)).join('');

    return `<div class="carte">
      <div class="carte-titre"><h2>Directions & équipes <span class="pale" title="Une direction regroupe des équipes ; chaque équipe est un espace de travail (membres, projets, demandes)">ⓘ</span></h2>
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
  modifierDirection: d => majEtat({ modale: { type: 'direction', id: d.id } }),
  supprimerDirection(d) {
    if (confirm('Supprimer cette direction ?')) executer(() => Api.supprimer('directions', { id: 'eq.' + d.id }), 'directions');
  },
  // Suppression d'une équipe vide : ligne « equipes » (contrôlée en base), puis organisation Neon Auth
  async supprimerEquipe(d) {
    if (!confirm('Supprimer cette équipe (vide) ?')) return;
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
