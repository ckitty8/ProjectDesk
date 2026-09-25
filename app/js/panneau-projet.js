/* ============================================================
   Panneau latéral « Projet » (maquette 11-panneau-projet.png)
   - Détail : objectif, chef, période, statut, avancement, équipe
     projet, tickets. Modifiable si peutEditerProjet (sinon lecture).
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
    const kr = parId('resultatsCles', p.resultatCleId), obj = kr ? parId('objectifs', kr.objectifId) : null;
    const tickets = etat.d.tickets.filter(t => t.projetId === p.id), n = Calculs.compteTickets(tickets);
    const membres = etat.d.affectations.filter(a => a.projetId === p.id);
    const note = ecranGeneral ? 'Vue générale en lecture seule. Modifiez ce projet depuis Mon dashboard.'
      : !editable ? 'Rôle Lecteur ou autre équipe : modification impossible.' : '';

    const statut = editable ? C.liste(valeursDe('stp').map(v => v.libelle), p.statut, `class="champ" style="width:auto" data-action-change="majProjet" data-champ="statut" data-id="${p.id}"`) : C.badgeRef('stp', p.statut);
    const ticketsHtml = tickets.map(t => `<div class="ligne-flex" style="padding:7px 0;border-bottom:1px solid var(--bordure-fine)">
        ${C.code(t.numero)}<span style="flex:1">${esc(t.titre)}</span>
        ${editable ? C.liste(valeursDe('stt').map(v => v.libelle), t.statut, `class="champ" style="width:auto;height:26px;font-size:12px" data-action-change="statutTicket" data-id="${t.id}"`) : C.badgeRef('stt', t.statut)}</div>`).join('');

    return `<aside class="panneau">
      <div class="panneau-entete"><div><div class="ligne-flex discret">${C.code(p.code)} ${C.pastille(eq.couleur)}${esc(eq.nom)}</div><h2 style="font-size:18px;margin-top:4px">${esc(p.nom)}</h2></div>
        <button class="fermer" data-action="fermer" title="Fermer">✕</button></div>
      <div class="panneau-corps">
        ${p.description ? `<div>${esc(p.description)}</div>` : ''}
        <div class="infos">
          <span>Objectif</span><span>${obj ? esc(obj.code + ' · ' + obj.titre) : '—'}</span>
          <span>Résultat clé</span><span>${kr ? esc(kr.code + ' · ' + kr.libelle) : '—'}</span>
          <span>Chef de projet</span><span class="ligne-flex">${chef ? C.avatar(chef.nom) + esc(chef.nom) : '—'}</span>
          <span>Période</span><span>${Calculs.formatCourt(p.debut)} → ${Calculs.formatCourt(p.fin)}</span>
          <span>Statut</span><span>${statut}</span>
        </div>
        <div><div class="ligne-flex" style="justify-content:space-between"><span class="discret">Avancement · ${n.termines}/${n.total} tickets</span><b id="avancement-valeur">${p.avancement}%</b></div>
          ${editable ? `<input type="range" min="0" max="100" step="5" value="${p.avancement}" style="width:100%" data-action-saisie="apercuAvancement" data-action-change="majProjet" data-champ="avancement" data-id="${p.id}">`
            : `<div style="margin-top:8px">${C.barre(p.avancement, C.couleurStatutProjet(p.statut))}</div>`}</div>
        ${note ? `<div class="discret" style="font-size:12px">${note}</div>` : ''}
        <div><div class="libelle">Équipe projet</div>${membres.map(a => { const r = ressource(a.ressourceId); return r ? `<div class="ligne-flex" style="padding:5px 0">${C.avatar(r.nom)}<span style="flex:1">${esc(r.nom)}</span>${C.badgeRef('role', a.role)}</div>` : ''; }).join('') || '<span class="pale">Aucun membre.</span>'}
          ${editable ? `<a data-action="assigner" data-projet="${p.id}">+ Ajouter une personne</a>` : ''}</div>
        <div><div class="libelle">Tickets</div>${ticketsHtml || '<span class="pale">Aucun ticket.</span>'}
          ${editable ? `<form class="ligne-flex" style="margin-top:8px" data-action-envoi="ajouterTicket" data-projet="${p.id}">
            <input class="champ" name="titre" placeholder="Nouveau ticket" required>${C.liste(valeursDe('prio').map(v => v.libelle), 'Moyenne', 'class="champ" name="priorite" style="width:auto"')}
            <button class="btn">Ajouter</button></form>` : ''}</div>
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
  // Déplacement du curseur : affichage immédiat du pourcentage (enregistrement au relâchement)
  apercuAvancement: (_, el) => { document.getElementById('avancement-valeur').textContent = el.value + '%'; },
  majProjet(d, el) {
    const valeur = d.champ === 'avancement' ? Number(el.value) : el.value;
    executer(() => Api.modifier('projets', { id: 'eq.' + d.id }, { [d.champ]: valeur }), 'projets');
  },
  statutTicket: (d, el) => executer(() => Api.modifier('tickets', { id: 'eq.' + d.id }, { statut: el.value }), 'tickets'),
  ajouterTicket(d, form) {
    const f = new FormData(form), p = projet(d.projet);
    const numeros = etat.d.tickets.filter(t => t.projetId === p.id).map(t => Number(t.numero.split('.').pop()) || 0);
    const numero = `${p.code}.${Math.max(0, ...numeros) + 1}`;
    executer(() => Api.creer('tickets', { projetId: p.id, numero, titre: f.get('titre'), priorite: f.get('priorite') }), 'tickets');
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
