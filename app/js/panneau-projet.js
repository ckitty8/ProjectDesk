/* ============================================================
   Panneau latéral « Projet » (maquette 11-panneau-projet.png)
   - Détail réduit à la demande du porteur (2026-09-25) : nom,
     description, chef de projet, équipe projet (membres et rôles).
     Objectif, résultat clé, période, statut, avancement et tickets ne
     sont plus affichés ici (colonnes conservées en base).
     Modifiable si peutEditerProjet (sinon lecture) ; suppression du
     projet par un membre de son équipe (règle RLS).
     Depuis la section « Général », le panneau reste en lecture.
   - Création : formulaire « Nouveau projet » (bouton de Mes projets,
     de la Liste des ressources, ou depuis une demande acceptée).
   ============================================================ */
'use strict';

const Panneau = {
  rendre() {
    return etat.panneau.type === 'nouveauProjet' ? this.nouveauProjet(etat.panneau) : this.projet(projet(etat.panneau.id));
  },

  projet(p) {
    if (!p) return '';
    const esc = C.esc, eq = equipe(p.equipeId), chef = ressource(p.chefId);
    const ecranGeneral = (Ecrans[etat.ecran] || {}).section === 'general';
    const editable = !ecranGeneral && peutEditerProjet(p);
    const membres = etat.d.affectations.filter(a => a.projetId === p.id);
    const note = ecranGeneral ? 'Vue générale en lecture seule. Modifiez ce projet depuis Mon dashboard.'
      : !editable ? 'Rôle Lecteur ou autre équipe : modification impossible.' : '';

    // Champ modifiable du projet (enregistré à la sortie du champ par majProjet)
    const champ = (nom, html) => editable ? html.replace('<CHAMP', `data-action-change="majProjet" data-champ="${nom}" data-id="${p.id}"`) : '';
    const personnesEquipe = etat.d.ressources.filter(r => r.equipeId === p.equipeId).map(r => ({ valeur: r.id, libelle: r.nom }));
    return `<aside class="panneau">
      <div class="panneau-entete"><div style="flex:1"><div class="ligne-flex discret">${C.code(p.code)} ${C.pastille(eq.couleur)}${esc(eq.nom)}</div>
          ${editable ? champ('nom', `<input class="champ" style="font-size:16px;font-weight:600;margin-top:4px" value="${esc(p.nom)}" required <CHAMP>`)
            : `<h2 style="font-size:18px;margin-top:4px">${esc(p.nom)}</h2>`}</div>
        <button class="fermer" data-action="fermer" title="Fermer">✕</button></div>
      <div class="panneau-corps">
        ${editable ? champ('description', `<textarea class="champ" rows="2" placeholder="Description" <CHAMP>${esc(p.description || '')}</textarea>`)
          : p.description ? `<div>${esc(p.description)}</div>` : ''}
        <div class="infos">
          <span>Chef de projet</span><span class="ligne-flex">${editable ? champ('chefId', C.liste([{ valeur: '', libelle: '—' }, ...personnesEquipe], p.chefId || '', 'class="champ" style="width:auto" <CHAMP'))
            : chef ? C.avatar(chef.nom) + esc(chef.nom) : '—'}</span>
        </div>
        ${note ? `<div class="discret" style="font-size:12px">${note}</div>` : ''}
        <div><div class="libelle">Équipe projet</div>${membres.map(a => { const r = ressource(a.ressourceId); return r ? `<div class="ligne-flex" style="padding:5px 0">${C.avatar(r.nom)}<span style="flex:1">${esc(r.nom)}</span>${C.badgeRef('role', a.role)}</div>` : ''; }).join('') || '<span class="pale">Aucun membre.</span>'}
          ${editable ? `<a data-action="assigner" data-projet="${p.id}">+ Membre</a>` : ''}</div>
        ${editable && estMembreDe(p.equipeId) ? `<div style="border-top:1px solid var(--bordure-fine);padding-top:12px">
          <button class="btn danger" data-action="supprimerProjet" data-id="${p.id}">Supprimer le projet</button></div>` : ''}
      </div>
    </aside>`;
  },

  // Formulaire de création ; valeurs pré-remplies possibles (depuis une demande, ou l'équipe
  // choisie dans Liste des ressources : v.equipeId ; sinon l'équipe ouverte).
  // Champs réduits à la demande du porteur (2026-09-25) : code, nom, description, chef.
  // Résultat clé, dates et statut restent vides / par défaut (« Planifié », valeur SQL par défaut).
  nouveauProjet(v) {
    const esc = C.esc, eqId = v.equipeId || etat.equipeCourante, eq = equipe(eqId);
    const personnes = etat.d.ressources.filter(r => r.equipeId === eqId).map(r => ({ valeur: r.id, libelle: r.nom }));
    const moi = maRessource();
    return `<aside class="panneau"><form class="pile" style="height:100%;gap:0" data-action-envoi="creerProjet">
      <div class="panneau-entete"><div><div class="ligne-flex discret">${C.pastille(eq.couleur)}${esc(eq.nom)}</div><h2 style="font-size:18px;margin-top:4px">Nouveau projet</h2></div>
        <button type="button" class="fermer" data-action="fermer">✕</button></div>
      <div class="panneau-corps">
        <div><label class="libelle">Code</label><input class="champ" name="code" value="${Calculs.prochainCodeProjet(eq.prefixe, etat.d.projets)}" required></div>
        <div><label class="libelle">Nom</label><input class="champ" name="nom" value="${esc(v.nom || '')}" required></div>
        <div><label class="libelle">Description</label><textarea class="champ" name="description" rows="3">${esc(v.description || '')}</textarea></div>
        <div><label class="libelle">Chef de projet</label>${C.liste([{ valeur: '', libelle: '—' }, ...personnes], moi && moi.equipeId === eqId ? moi.id : '', 'class="champ" name="chefId"')}</div>
        <input type="hidden" name="equipeId" value="${eqId}">
        ${v.demandeId ? `<input type="hidden" name="demandeId" value="${v.demandeId}"><div class="discret">Le projet sera rattaché à la demande d’origine.</div>` : ''}
      </div>
      <div class="panneau-pied"><button type="button" class="btn" data-action="fermer">Annuler</button><button class="btn primaire">Créer le projet</button></div>
    </form></aside>`;
  }
};

Object.assign(Actions, {
  // Modification d'un champ du projet (nom, description, chef) ; champ vidé = valeur nulle (nom obligatoire)
  majProjet(d, el) {
    const brut = el.value.trim();
    if (d.champ === 'nom' && !brut) return notifier('Le nom est obligatoire', 'erreur');
    const valeur = brut || null;
    executer(() => Api.modifier('projets', { id: 'eq.' + d.id }, { [d.champ]: valeur }), 'projets');
  },
  supprimerProjet(d) {
    if (!confirm('Supprimer ce projet ? Ses tickets, affectations et heures saisies seront supprimés.')) return;
    executer(async () => { await Api.supprimer('projets', { id: 'eq.' + d.id }); etat.panneau = null; }, 'projets', 'tickets', 'affectations', 'temps', 'demandes');
  },
  // Création : projet, affectation du chef, rattachement à la demande d'origine
  async creerProjet(_, form) {
    const f = Object.fromEntries(new FormData(form));
    const demandeId = f.demandeId; delete f.demandeId;
    const ok = await executer(async () => {
      const [cree] = await Api.creer('projets', f);
      if (f.chefId) await Api.creer('affectations', { projetId: cree.id, ressourceId: f.chefId, role: ROLES_PROJET.CHEF });
      if (demandeId) await Api.modifier('demandes', { id: 'eq.' + demandeId }, { projetId: cree.id });
      etat.panneau = { type: 'projet', id: cree.id };
    }, 'projets', 'affectations', 'demandes');
    if (ok) notifier('Projet créé');
  }
});
