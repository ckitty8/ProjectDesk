/* ============================================================
   Fenêtres modales
   - affectation : assigner une ressource à des projets, avec un rôle
                   (maquette : « Assigner une ressource »)
   - ressource   : fiche d'une personne (nom, poste, capacité, email)
   - unite       : « + Ajouter une unité » : choix Direction ou Équipe
   - equipe      : créer / modifier une unité (direction ou équipe : type,
                   rattachement, statut), membres et invitations
   - objectifs   : objectifs (OKR) et résultats clés de mon équipe
   ============================================================ */
'use strict';

const Modale = {
  rendre() {
    const m = etat.modale;
    const corps = { affectation: this.affectation, ressource: this.ressource, equipe: this.equipe, objectifs: this.objectifs,
      unite: this.unite }[m.type].call(this, m);
    return `<div class="modale">${corps}</div>`;
  },
  entete: titre => `<div class="panneau-entete"><h2>${C.esc(titre)}</h2><button type="button" class="fermer" data-action="fermer">✕</button></div>`,

  /* ---------- Affectations d'une ressource ---------- */
  affectation(m) {
    const esc = C.esc;
    const personnes = etat.d.ressources.map(r => ({ valeur: r.id, libelle: `${r.nom} — ${equipe(r.equipeId).nom}` }));
    const rId = m.ressourceId || '';
    const actuelles = rId ? etat.d.affectations.filter(a => a.ressourceId === rId) : [];
    // Projets proposés : ceux que je peux modifier, groupés par équipe
    const groupes = etat.d.equipes.map(e => {
      const projets = etat.d.projets.filter(p => p.equipeId === e.id && peutEditerProjet(p));
      if (!projets.length) return '';
      return `<div class="libelle" style="margin-top:10px">${esc(e.nom)}</div>` + projets.map(p => {
        const a = actuelles.find(x => x.projetId === p.id), coche = a || (!rId && m.projetId === p.id);
        return `<label class="ligne-flex" style="padding:5px 0"><input type="checkbox" name="projet" value="${p.id}" ${coche ? 'checked' : ''}>
          ${C.code(p.code)}<span style="flex:1">${esc(p.nom)}</span>
          ${C.liste(valeursDe('role').map(v => v.libelle), a ? a.role : ROLES_PROJET.MEMBRE, `class="champ" style="width:auto;height:28px" name="role-${p.id}"`)}</label>`;
      }).join('');
    }).join('');
    const nbCoches = rId ? actuelles.length : (m.projetId ? 1 : 0);
    return `<form class="pile" style="gap:0;min-height:0;flex:1;display:flex;flex-direction:column" data-action-envoi="enregistrerAffectations">
      ${this.entete(rId ? `Affectations de ${ressource(rId).nom}` : m.projetId ? `Ajouter une ressource à ${projet(m.projetId).code}` : 'Assigner une ressource')}
      <div class="panneau-corps"><div><label class="libelle">Ressource</label>
        ${C.liste([{ valeur: '', libelle: '— choisir —' }, ...personnes], rId, 'class="champ" name="ressource" required data-action-change="choisirRessourceAffectation"')}</div>
        <div>${groupes || C.vide('Aucun projet modifiable.')}</div></div>
      <div class="panneau-pied"><span class="discret" style="flex:1">${nbCoches} affectation(s)</span>
        <button type="button" class="btn" data-action="fermer">Annuler</button><button class="btn primaire">Enregistrer les affectations</button></div></form>`;
  },

  /* ---------- Fiche ressource ---------- */
  ressource(m) {
    const esc = C.esc, r = m.id ? ressource(m.id) : { equipeId: m.equipeId, capacite: 100 };
    return `<form data-action-envoi="enregistrerRessource" data-id="${m.id || ''}" data-equipe="${r.equipeId}">
      ${this.entete(m.id ? 'Fiche de ' + r.nom : 'Nouvelle personne · ' + equipe(r.equipeId).nom)}
      <div class="panneau-corps">
        <div><label class="libelle">Nom complet</label><input class="champ" name="nom" value="${esc(r.nom || '')}" required></div>
        <div class="deux-colonnes"><div><label class="libelle">Poste</label>${this.listeReferentiel('poste', r.poste, 'poste')}</div>
          <div><label class="libelle">Type de contrat</label>${this.listeReferentiel('contrat', r.typeContrat, 'typeContrat')}</div></div>
        <div><label class="libelle">Capacité (%)</label><input class="champ" type="number" min="0" max="100" name="capacite" value="${r.capacite}" required style="width:120px"></div>
        <div><label class="libelle">Email (lien automatique avec son compte)</label><input class="champ" type="email" name="email" value="${esc(r.email || '')}"></div>
        ${r.userId ? '<div class="discret">Compte de connexion lié.</div>' : ''}
      </div>
      <div class="panneau-pied">${m.id ? '<button type="button" class="btn danger" data-action="supprimerRessource" data-id="' + m.id + '">Supprimer</button><span style="flex:1"></span>' : ''}
        <button type="button" class="btn" data-action="fermer">Annuler</button><button class="btn primaire">Enregistrer</button></div></form>`;
  },

  /* ---------- Équipe : création / modification, membres et invitations ---------- */
  equipe(m) {
    const esc = C.esc, e = m.id ? equipe(m.id) : { nom: '', prefixe: '', couleur: '#003CC8', type: m.typeUnite || 'equipe' };
    const libelleType = e.type === 'direction' ? 'Direction' : 'Équipe';
    // Directions proposées pour le rattachement (sauf l'unité elle-même)
    const directions = etat.d.equipes.filter(x => x.type === 'direction' && x.id !== m.id).map(x => ({ valeur: x.id, libelle: x.nom }));
    const personnes = m.id ? etat.d.ressources.filter(r => r.equipeId === m.id).map(r => ({ valeur: r.id, libelle: r.nom })) : [];
    const membres = (m.organisation && m.organisation.members) || [];
    const invitations = ((m.organisation && m.organisation.invitations) || []).filter(i => i.status === 'pending');
    const peutInviter = m.id && (etat.estAdmin || estResponsableDe(m.id));
    return `<div style="display:flex;flex-direction:column;min-height:0">
      ${this.entete(m.id ? libelleType + ' ' + e.nom : (e.type === 'direction' ? 'Nouvelle direction' : 'Nouvelle équipe'))}
      <div class="panneau-corps">
        <form class="pile" data-action-envoi="enregistrerEquipe" data-id="${m.id || ''}">
          <fieldset style="border:0;padding:0;margin:0;display:contents" ${etat.estAdmin ? '' : 'disabled'}>
          <div class="deux-colonnes"><div><label class="libelle">Nom</label><input class="champ" name="nom" value="${esc(e.nom)}" required></div>
            <div class="deux-colonnes"><div><label class="libelle">Préfixe projets</label><input class="champ" name="prefixe" value="${esc(e.prefixe)}" maxlength="4" required style="text-transform:uppercase"></div>
              <div><label class="libelle">Couleur</label><input type="color" class="couleur-choix" style="width:100%;height:34px" name="couleur" value="${e.couleur}"></div></div></div>
          <div class="deux-colonnes"><div><label class="libelle">Type</label>${C.liste([{ valeur: 'equipe', libelle: 'Équipe' }, { valeur: 'direction', libelle: 'Direction' }], e.type, 'class="champ" name="type"')}</div>
            <div><label class="libelle">Rattachée à (équipe seulement)</label>${C.liste([{ valeur: '', libelle: '— aucune direction —' }, ...directions], e.parentId || '', 'class="champ" name="parentId"')}</div></div>
          <div class="deux-colonnes"><div><label class="libelle">Statut</label>${C.liste([{ valeur: 'true', libelle: 'Active' }, { valeur: 'false', libelle: 'Inactive' }], String(e.actif !== false), 'class="champ" name="actif"')}</div>
            <div>${m.id ? `<label class="libelle">Responsable</label>${C.liste([{ valeur: '', libelle: '—' }, ...personnes], e.responsableId || '', 'class="champ" name="responsableId"')}` : ''}</div></div>
          <div class="discret" style="font-size:12px">Direction et équipe sont des espaces de travail (membres, projets, demandes) ; une direction peut en plus regrouper des équipes. Changer le type ne change ni les membres ni les projets.</div>
          ${etat.estAdmin ? `<div style="text-align:right"><button class="btn primaire">${m.id ? 'Enregistrer' : 'Créer'}</button></div>`
            : '<div class="discret" style="font-size:12px">Nom, préfixe, couleur et responsable : modifiables par un administrateur.</div>'}
          </fieldset>
        </form>
        ${m.id ? `<div><div class="libelle">Membres (comptes de connexion)</div>
          ${m.organisation ? membres.map(mb => `<div class="ligne-flex" style="padding:5px 0">${C.avatar(mb.user ? mb.user.name : '?')}
            <span style="flex:1">${esc(mb.user ? mb.user.name + ' · ' + mb.user.email : mb.userId)}</span>${C.badge(mb.role, '#4A5363', '#F1F3F7')}</div>`).join('') : '<span class="pale">Chargement…</span>'}
          ${invitations.map(i => `<div class="ligne-flex discret" style="padding:5px 0">✉ ${esc(i.email)} · ${esc(i.role)} · invitation en attente</div>`).join('')}</div>
          ${peutInviter ? `<form class="ligne-flex" data-action-envoi="inviterDansEquipe" data-id="${m.id}">
            <input class="champ" type="email" name="email" placeholder="email@entreprise.fr" required>
            ${C.liste([{ valeur: 'member', libelle: 'member' }, { valeur: 'admin', libelle: 'admin (valide les temps)' }], 'member', 'class="champ" name="role" style="width:auto"')}
            <button class="btn">Inviter</button></form>
            <div class="discret" style="font-size:12px">La personne invitée crée son compte avec cet email : l’invitation apparaît sur son écran de choix d’équipe.</div>` : ''}` : ''}
      </div></div>`;
  },

  // Liste d'un référentiel (postes, contrats) ; garde la valeur actuelle même si elle est désactivée
  listeReferentiel(refId, valeur, nom) {
    const valeurs = valeursDe(refId).map(v => v.libelle);
    if (valeur && !valeurs.includes(valeur)) valeurs.unshift(valeur);
    return C.liste([{ valeur: '', libelle: '—' }, ...valeurs], valeur || '', `class="champ" name="${nom}"`);
  },

  /* ---------- « + Ajouter une unité » : direction ou équipe ---------- */
  unite() {
    const choix = (type, icone, titre, texte) => `<button class="carte-choix" style="text-align:left;background:#fff;cursor:pointer" data-action="choisirTypeUnite" data-type="${type}">
      ${C.icone(icone, 22)}<div><b>${titre}</b><div class="discret" style="font-size:12px">${texte}</div></div></button>`;
    return `<div style="display:flex;flex-direction:column">${this.entete('Ajouter une unité')}
      <div class="panneau-corps">
        ${choix('direction', 'direction', 'Direction', 'Regroupe des équipes (ex. DSI, Métier, Finance). Pas d’espace de travail propre.')}
        ${choix('equipe', 'equipe', 'Équipe', 'Espace de travail : membres, projets, demandes. Peut être rattachée à une direction.')}
      </div></div>`;
  },

  /* ---------- Objectifs (OKR) de l'équipe courante ---------- */
  objectifs() {
    const esc = C.esc, jour = Calculs.aujourdhui(), eqId = etat.equipeCourante;
    const periode = ui('objectifs', { annee: Number(jour.slice(0, 4)), trimestre: Calculs.trimestreDe(jour) });
    const modifiable = estMembreDe(eqId);
    const objs = etat.d.objectifs.filter(o => o.equipeId === eqId && o.annee === periode.annee && o.trimestre === periode.trimestre);
    const blocs = objs.map(o => {
      const krs = etat.d.resultatsCles.filter(k => k.objectifId === o.id);
      return `<div class="carte" style="padding:12px 14px">
        <div class="ligne-flex">${C.code(o.code)}<b style="flex:1">${esc(o.titre)}</b>
          ${modifiable ? C.liste(Object.keys(CONFIANCES).map(c => ({ valeur: c, libelle: 'Confiance ' + c })), o.confiance, `class="champ" style="width:auto;height:28px" data-action-change="confianceObjectif" data-id="${o.id}"`) : ''}</div>
        ${krs.map(k => `<div class="ligne-flex" style="margin-top:8px">${C.code(k.code)}<span style="flex:1">${esc(k.libelle)}</span>
          ${modifiable ? `<input type="number" min="0" max="100" class="saisie-heure" value="${k.progression}" data-action-change="progressionKr" data-id="${k.id}"> %` : k.progression + ' %'}</div>`).join('')}
        ${modifiable ? `<form class="ligne-flex" style="margin-top:8px" data-action-envoi="ajouterKr" data-objectif="${o.id}">
          <input class="champ" name="libelle" placeholder="Nouveau résultat clé (ex. Disponibilité 99,9 %)" required><button class="btn petit">Ajouter</button></form>` : ''}
      </div>`;
    }).join('');
    return `<div style="display:flex;flex-direction:column;min-height:0">
      ${this.entete(`Objectifs ${equipe(eqId).nom} · T${periode.trimestre} ${periode.annee}`)}
      <div class="panneau-corps">
        <div class="puces">${[1, 2, 3, 4].map(q => `<button class="puce${q === periode.trimestre ? ' active' : ''}" data-action="trimestreObjectifs" data-t="${q}">T${q}</button>`).join('')}</div>
        ${blocs || C.vide('Aucun objectif sur ce trimestre.')}
        ${modifiable ? `<form class="ligne-flex" data-action-envoi="ajouterObjectif"><input class="champ" name="titre" placeholder="Nouvel objectif (ex. Fiabiliser la plateforme)" required>
          <button class="btn primaire">Ajouter l’objectif</button></form>` : ''}
      </div></div>`;
  }
};

Object.assign(Actions, {
  /* Affectations */
  choisirRessourceAffectation: (_, el) => majEtat({ modale: { ...etat.modale, ressourceId: el.value || null } }),
  async enregistrerAffectations(_, form) {
    const f = new FormData(form), rId = f.get('ressource');
    const coches = new Set(f.getAll('projet'));
    const actuelles = etat.d.affectations.filter(a => a.ressourceId === rId);
    await executer(async () => {
      for (const p of etat.d.projets.filter(x => peutEditerProjet(x))) {
        const a = actuelles.find(x => x.projetId === p.id), role = f.get('role-' + p.id);
        if (coches.has(p.id) && !a) await Api.creer('affectations', { projetId: p.id, ressourceId: rId, role });
        else if (coches.has(p.id) && a && a.role !== role) await Api.modifier('affectations', { id: 'eq.' + a.id }, { role });
        else if (!coches.has(p.id) && a) await Api.supprimer('affectations', { id: 'eq.' + a.id });
      }
      etat.modale = null;
    }, 'affectations');
  },

  /* Ressources */
  enregistrerRessource(d, form) {
    const f = Object.fromEntries(new FormData(form)); f.capacite = Number(f.capacite);
    executer(async () => {
      if (d.id) await Api.modifier('ressources', { id: 'eq.' + d.id }, f);
      else await Api.creer('ressources', { ...f, equipeId: d.equipe });
      etat.modale = null;
    }, 'ressources');
  },
  supprimerRessource(d) {
    if (!confirm('Supprimer cette personne ? Ses affectations, absences et temps seront supprimés.')) return;
    executer(async () => { await Api.supprimer('ressources', { id: 'eq.' + d.id }); etat.modale = null; }, 'ressources', 'affectations', 'absences', 'temps');
  },

  /* Unités : le choix Direction / Équipe ouvre la même fenêtre, type pré-rempli */
  choisirTypeUnite: d => majEtat({ modale: { type: 'equipe', id: null, typeUnite: d.type } }),

  /* Équipes */
  async modifierEquipe(d) {
    majEtat({ modale: { type: 'equipe', id: d.id, organisation: null } });
    try { const organisation = await Api.lireOrganisation(d.id); if (etat.modale && etat.modale.id === d.id) majEtat({ modale: { ...etat.modale, organisation } }); }
    catch (e) { notifier('Membres illisibles : ' + e.message, 'erreur'); }
  },
  // Création : organisation Neon Auth (le créateur en devient propriétaire) + ligne « equipes »
  async enregistrerEquipe(d, form) {
    const f = Object.fromEntries(new FormData(form)); f.prefixe = f.prefixe.toUpperCase(); f.actif = f.actif !== 'false';
    // Une direction n'est rattachée à rien ; champ vide = pas de rattachement (la base contrôle aussi)
    f.parentId = f.type === 'direction' ? null : (f.parentId || null);
    if (f.responsableId === '') f.responsableId = null;
    await executer(async () => {
      if (d.id) { await Api.modifier('equipes', { id: 'eq.' + d.id }, f); }
      else {
        const slug = f.nom.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36);
        const org = await Api.creerOrganisation(f.nom, slug);
        await Api.creer('equipes', { id: org.id, nom: f.nom, prefixe: f.prefixe, couleur: f.couleur, type: f.type, parentId: f.parentId, actif: f.actif });
        etat.organisations = await Api.listerOrganisations();
        etat.rolesEquipe[org.id] = 'owner';
        // Première équipe de l'utilisateur : elle devient l'équipe ouverte
        if (!etat.equipeCourante) { etat.equipeCourante = org.id; ecrireMemoire('equipe', org.id); }
      }
      etat.modale = null;
    }, 'equipes');
  },
  async inviterDansEquipe(d, form) {
    const f = new FormData(form);
    try { await Api.inviterMembre(d.id, f.get('email'), f.get('role')); notifier('Invitation envoyée'); await Actions.modifierEquipe({ id: d.id }); }
    catch (e) { notifier(e.message, 'erreur'); }
  },

  /* Objectifs */
  trimestreObjectifs: d => majUi('objectifs', { trimestre: Number(d.t) }),
  ajouterObjectif(_, form) {
    const p = ui('objectifs', { annee: Number(Calculs.aujourdhui().slice(0, 4)), trimestre: Calculs.trimestreDe(Calculs.aujourdhui()) });
    const numero = etat.d.objectifs.filter(o => o.equipeId === etat.equipeCourante && o.annee === p.annee).length + 1;
    executer(() => Api.creer('objectifs', { equipeId: etat.equipeCourante, annee: p.annee, trimestre: p.trimestre, code: 'O' + numero, titre: new FormData(form).get('titre') }), 'objectifs');
  },
  confianceObjectif: (d, el) => executer(() => Api.modifier('objectifs', { id: 'eq.' + d.id }, { confiance: el.value }), 'objectifs'),
  ajouterKr(d, form) {
    const o = parId('objectifs', d.objectif), n = etat.d.resultatsCles.filter(k => k.objectifId === o.id).length + 1;
    executer(() => Api.creer('resultats_cles', { objectifId: o.id, code: `KR${o.code.slice(1)}.${n}`, libelle: new FormData(form).get('libelle') }), 'resultatsCles');
  },
  progressionKr(d, el) {
    const v = Math.max(0, Math.min(100, Number(el.value) || 0));
    executer(() => Api.modifier('resultats_cles', { id: 'eq.' + d.id }, { progression: v }), 'resultatsCles');
  }
});
