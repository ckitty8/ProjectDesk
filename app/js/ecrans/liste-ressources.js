/* ============================================================
   Mon dashboard › Gestion des ressources › Liste des ressources
   Spécification : docs/specifications/ressources.md (validée le 2026-10-12)
   Maquette : docs/maquettes/ressources-v2/1-liste.png
   Trois niveaux, dans un seul tableau :
     Équipe   — ses responsables (1 ou plusieurs, table responsables_equipe) ;
     Projet   — ses chefs de projet (1 ou plusieurs : affectations « Chef de projet ») ;
     Membres  — toutes les personnes affectées au projet : poste, rôle, statut.
   Puis « Sans affectation » : les personnes responsables de rien et affectées à rien.
   Les personnes inactives (date de départ saisie, estInactive) n'apparaissent pas (spécification § 6).
   Boutons de gestion affichés selon le périmètre (spécification § 4) : administrateur → tout ;
   responsable → ses équipes ; chef de projet → ses projets. La base reste seule juge.
   ============================================================ */
'use strict';

Ecrans.listeRessources = {
  titre: 'Gestion des ressources · Liste des ressources',
  section: 'moi',
  sansEquipePermis: () => etat.estAdmin,        // voir coquille.js : écran ouvert sans équipe

  rendre() {
    const admin = etat.estAdmin;
    const actions = `<label class="recherche-champ">${C.icone('recherche')}<input placeholder="Rechercher une personne" data-action-saisie="filtrerArbre"></label>`
      + (admin ? '<button class="btn" data-action="nouvelleRessource">+ Personne</button>' : '')
      + (admin ? '<button class="btn primaire" data-action="nouvelleUnite" data-type="equipe">+ Équipe</button>' : '');
    const equipes = [...etat.d.equipes].sort((a, b) => a.nom.localeCompare(b.nom));
    const lignes = equipes.map(e => this.lignesEquipe(e)).join('') + this.lignesSansAffectation() + this.lignesInactifs();
    return `
    <div class="ecran" style="max-width:1300px">
      ${C.entete('Liste des ressources', 'Équipe → Projet → Membres', actions)}
      <div class="carte" style="overflow:hidden"><div class="defilement-x"><table class="tableau arbre-ressources" id="arbre-ressources">
        <thead><tr><th style="width:36%">Équipe / Projet / Personne</th><th>Poste</th><th>Rôle ${C.aide('roleProjet')}</th><th>Statut</th><th class="num">Actions</th></tr></thead>
        <tbody>${lignes || `<tr><td colspan="5">${C.vide(admin ? 'Aucune équipe : « + Équipe » pour commencer.' : 'Aucune équipe.')}</td></tr>`}</tbody>
      </table></div></div>
    </div>`;
  },

  /* ---------- Les trois niveaux ---------- */
  // Équipe : nom, responsables (pastilles), « + responsable », « + Projet », puis ses projets
  lignesEquipe(e) {
    const esc = C.esc, ouvert = !ui('listeRessources', { replies: {} }).replies[e.id], gere = peutGererEquipe(e);
    const responsables = responsablesDe(e.id).map(r => this.pastille(r, gere
      ? `<button class="btn-icone" title="Retirer de ses responsables" data-action="retirerResponsable" data-equipe="${e.id}" data-ressource="${r.id}">✕</button>` : '')).join('');
    const projets = etat.d.projets.filter(p => p.equipeId === e.id).sort(parCode);
    const vide = !projets.length && !etat.d.ressources.some(r => r.equipeId === e.id);
    const actions = [gere ? `<a data-action="nouveauProjet" data-equipe="${e.id}">+ Projet</a>` : '',
      etat.estAdmin || estResponsableDe(e.id) ? `<a data-action="modifierEquipe" data-id="${e.id}">Modifier</a>` : '',
      etat.estAdmin && vide ? `<a class="discret" data-action="supprimerEquipe" data-id="${e.id}">Supprimer</a>` : ''].join('');
    const ligne = `<tr class="niveau-equipe" data-recherche="${esc(e.nom.toLowerCase())}">
      <td colspan="4">${this.chevron(e.id, ouvert)}<span class="nom-equipe">${esc(e.nom)}</span>
        <span class="libelle-role">Responsables</span>${responsables || '<span class="pale">aucun</span>'}
        ${gere ? `<a data-action="ajouterResponsable" data-equipe="${e.id}">+ responsable</a>` : ''}</td>
      <td class="num actions-ligne">${actions}</td></tr>`;
    return ligne + (ouvert ? projets.map(p => this.lignesProjet(p)).join('') : '');
  },

  // Projet : nom, chefs de projet (pastilles), « + chef », « + Membre », puis ses membres
  lignesProjet(p) {
    const esc = C.esc, ouvert = !ui('listeRessources', { replies: {} }).replies[p.id], gere = peutGererProjet(p);
    const affectations = etat.d.affectations.filter(a => a.projetId === p.id && nonInactive(a.ressourceId));
    const chefs = chefsDuProjet(p).map(r => this.pastille(r, '')).join('');
    const ligne = `<tr class="niveau-projet" data-recherche="${esc(`${p.code} ${p.nom}`.toLowerCase())}">
      <td colspan="4">${this.chevron(p.id, ouvert)}<span class="nom-projet">${esc(p.nom)}</span> ${C.code(p.code)}
        <span class="libelle-role">Chefs de projet</span>${chefs || '<span class="pale">aucun</span>'}
        ${gere ? `<a data-action="assigner" data-projet="${p.id}" data-role="${esc(ROLES_PROJET.CHEF)}">+ chef</a>` : ''}</td>
      <td class="num actions-ligne">${gere ? `<a data-action="assigner" data-projet="${p.id}">+ Membre</a>` : ''}
        <a data-action="ouvrirProjet" data-id="${p.id}">${gere ? 'Modifier' : 'Voir'}</a></td></tr>`;
    const membres = affectations.map(a => ({ r: ressource(a.ressourceId), a })).sort((x, y) => x.r.nom.localeCompare(y.r.nom));
    return ligne + (ouvert ? membres.map(({ r, a }) => this.lignePersonne(r, a, gere)).join('') : '');
  },

  // Une personne : sur un projet (a = son affectation) ou sans affectation (a = null)
  lignePersonne(r, a, gere) {
    const esc = C.esc;
    const roles = (a ? C.badgeRef('role', a.role) : '<span class="pale">—</span>')
      + (estAdministrateur(r) ? ' ' + C.badge('Admin', '#0033AD', '#E8EEFF') : '');
    const actions = [`<a data-action="modifierRessource" data-id="${r.id}">Fiche</a>`,
      a && gere ? `<a class="discret" data-action="retirerAffectation" data-id="${a.id}">Retirer</a>` : '',
      !a && etat.estAdmin ? `<a data-action="assigner" data-ressource="${r.id}">Affecter</a>` : ''].join('');
    return `<tr class="niveau-personne" data-ressource="${r.id}" data-recherche="${esc(r.nom.toLowerCase())}">
      <td><span class="ligne-flex">${C.avatar(r.nom)}<span class="nom-personne">${esc(r.nom)}</span></span></td>
      <td>${esc(r.poste || '—')}</td><td>${roles}</td><td>${C.badgeActif(true, ['Actif', 'Inactif'])}</td>
      <td class="num actions-ligne">${actions}</td></tr>`;
  },

  /* Sans affectation (spécification § 3) : personnes actives qui ne sont responsables d'aucune
     équipe et affectées à aucun projet. */
  lignesSansAffectation() {
    const responsables = new Set(etat.d.responsablesEquipe.map(x => x.ressourceId));
    const sans = etat.d.ressources.filter(r => !estInactive(r) && !responsables.has(r.id) && !etat.d.affectations.some(a => a.ressourceId === r.id))
      .sort((a, b) => a.nom.localeCompare(b.nom));
    if (!sans.length) return '';
    return `<tr class="niveau-sans" data-recherche="sans affectation"><td colspan="5"><span class="nom-equipe">Sans affectation</span>
        <span class="discret">personnes responsables de rien et affectées à aucun projet</span></td></tr>`
      + sans.map(r => this.lignePersonne(r, null, false)).join('');
  },

  /* Inactifs (administrateurs) : une personne inactive n'apparaît plus nulle part (spécification § 6) ;
     cette section repliée par défaut permet seulement de la retrouver pour la réactiver (fiche). */
  lignesInactifs() {
    const inactifs = etat.d.ressources.filter(estInactive).sort((a, b) => a.nom.localeCompare(b.nom));
    if (!etat.estAdmin || !inactifs.length) return '';
    const ouvert = ui('listeRessources', { inactifsOuverts: false }).inactifsOuverts;
    return `<tr class="niveau-sans" data-recherche="inactifs"><td colspan="5"><button class="chevron" data-action="replierInactifs">${ouvert ? '▾' : '▸'}</button>
        <span class="nom-equipe">Inactifs (${inactifs.length})</span><span class="discret">masqués partout ; ouvrez la fiche pour réactiver</span></td></tr>`
      + (ouvert ? inactifs.map(r => `<tr class="niveau-personne" data-ressource="${r.id}" data-recherche="${C.esc(r.nom.toLowerCase())}">
        <td><span class="ligne-flex">${C.avatar(r.nom)}<span class="nom-personne">${C.esc(r.nom)}</span></span></td><td>${C.esc(r.poste || '—')}</td>
        <td><span class="pale">—</span></td><td>${C.badgeActif(false, ['Actif', 'Inactif'])}</td>
        <td class="num actions-ligne"><a data-action="modifierRessource" data-id="${r.id}">Fiche</a></td></tr>`).join('') : '');
  },

  /* ---------- Petits éléments ---------- */
  chevron: (id, ouvert) => `<button class="chevron" data-action="replierNoeud" data-id="${id}">${ouvert ? '▾' : '▸'}</button>`,
  pastille: (r, bouton) => `<span class="pastille-personne">${C.avatar(r.nom)}${C.esc(r.nom)}${bouton}</span>`
};

Object.assign(Actions, {
  // Équipe ou projet : replié ↔ déplié (tout est déplié par défaut)
  replierNoeud(d) {
    const replies = { ...ui('listeRessources', { replies: {} }).replies }; replies[d.id] = !replies[d.id];
    majUi('listeRessources', { replies });
  },

  replierInactifs: () => majUi('listeRessources', { inactifsOuverts: !ui('listeRessources', { inactifsOuverts: false }).inactifsOuverts }),

  /* Recherche sans redessiner (pour garder la saisie) : une personne trouvée reste visible avec
     son projet et son équipe ; une équipe ou un projet trouvé montre tout son contenu. */
  filtrerArbre(_, el) {
    const q = el.value.trim().toLowerCase();
    let equipeLigne = null, projetLigne = null, equipeTrouvee = false, projetTrouve = false;
    document.querySelectorAll('#arbre-ressources tbody tr[data-recherche]').forEach(tr => {
      const trouve = !q || tr.dataset.recherche.includes(q), classe = tr.className;
      if (classe === 'niveau-equipe' || classe === 'niveau-sans') { equipeLigne = tr; projetLigne = null; equipeTrouvee = trouve; projetTrouve = false; }
      else if (classe === 'niveau-projet') { projetLigne = tr; projetTrouve = trouve; if (trouve) equipeLigne.hidden = false; }
      tr.hidden = !(trouve || equipeTrouvee || projetTrouve);
      if (trouve && classe === 'niveau-personne') { equipeLigne.hidden = false; if (projetLigne) projetLigne.hidden = false; }
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

  // Responsables d'une équipe (table responsables_equipe, migration 027)
  ajouterResponsable: d => majEtat({ modale: { type: 'responsable', equipeId: d.equipe || null, ressourceId: d.ressource || null } }),
  retirerResponsable(d) {
    if (!confirm(`Retirer ${ressource(d.ressource).nom} des responsables de ${equipe(d.equipe).nom} ?`)) return;
    executer(() => Api.supprimer('responsables_equipe', { equipe_id: 'eq.' + d.equipe, ressource_id: 'eq.' + d.ressource }), 'responsablesEquipe');
  },

  /* Fenêtre d'affectation : pour une personne (data-ressource) ou pré-remplie sur un projet
     (data-projet) ; data-role pré-choisit le rôle (« + chef » → Chef de projet) */
  assigner: d => majEtat({ modale: { type: 'affectation', ressourceId: d.ressource || null, projetId: d.projet || null, role: d.role || null } }),
  retirerAffectation(d) {
    const a = parId('affectations', d.id);
    if (!confirm(`Retirer ${ressource(a.ressourceId).nom} du projet ${projet(a.projetId).nom} ?`)) return;
    executer(() => Api.supprimer('affectations', { id: 'eq.' + d.id }), 'affectations');
  },
  /* Nouvelle personne (administrateurs). Tant que les droits ne viennent pas des rôles (étape 2 de la
     spécification), la fiche garde une équipe technique : l'équipe ouverte. */
  nouvelleRessource: () => majEtat({ modale: { type: 'ressource', id: null, equipeId: etat.equipeCourante || (etat.d.equipes[0] || {}).id } }),
  modifierRessource: d => majEtat({ modale: { type: 'ressource', id: d.id } }),
  /* Statut d'une personne : « Inactif » = date de fin saisie (règle du porteur) ; le bouton pose la
     date de fin à aujourd'hui, ou la retire pour réactiver la personne. Une personne inactive garde
     ses affectations mais n'apparaît plus (spécification § 6). */
  basculerActifRessource(d) {
    const r = ressource(d.id), inactive = estInactive(r);
    if (!inactive && !confirm(`Passer ${r.nom} inactif ? Sa date de départ sera aujourd’hui ; elle n’apparaîtra plus nulle part.`)) return;
    executer(async () => { await Api.modifier('ressources', { id: 'eq.' + d.id }, { dateDepart: inactive ? null : Calculs.aujourdhui() }); etat.modale = null; }, 'ressources');
  }
});
