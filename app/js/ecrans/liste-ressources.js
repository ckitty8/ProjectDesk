/* ============================================================
   Mon dashboard › Gestion des ressources › Liste des ressources
   (maquette 09-mListe.png)
   Arborescence équipe → projet → personnes affectées (rôle),
   ajout de ressources, affectations (fenêtre « Assigner »).
   ============================================================ */
'use strict';

Ecrans.listeRessources = {
  titre: 'Gestion des ressources · Liste des ressources',
  section: 'moi',
  rendre() {
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
        const membres = affectations.filter(a => a.projetId === p.id);
        const editable = peutEditerProjet(p);
        return `<tr><td colspan="3" style="padding-left:40px">${C.code(p.code)} ${esc(p.nom)} <span class="discret">${membres.length} membres</span></td>
            <td class="num">${editable ? `<button class="btn petit" data-action="assigner" data-projet="${p.id}">+ Ajouter une personne</button>` : ''}</td></tr>` +
          membres.map(a => { const r = ressource(a.ressourceId); if (!r) return '';
            return `<tr><td style="padding-left:64px"><span class="ligne-flex">${C.avatar(r.nom)}<b style="font-weight:500">${esc(r.nom)}</b>
                <span class="discret">${esc(r.poste || '')}</span> <span class="pale">${autres(r.id, p.id)}</span></span></td><td></td>
              <td class="num">${C.badgeRef('role', a.role)}</td>
              <td class="num">${editable ? `<a data-action="assigner" data-ressource="${r.id}">Modifier</a>` : ''}</td></tr>`; }).join('');
      }).join('');
      // Personnes de l'équipe (fiches) — permet de modifier nom, poste, capacité, email
      const fiches = sesPersonnes.map(r => `<tr><td style="padding-left:40px"><span class="ligne-flex">${C.avatar(r.nom)}${esc(r.nom)}
          <span class="discret">${esc(r.poste || '')} · ${r.capacite} %${r.userId ? ' · compte lié' : r.email ? ' · ' + esc(r.email) : ''}</span></span></td><td></td><td></td>
        <td class="num">${modifiable ? `<a data-action="modifierRessource" data-id="${r.id}">Fiche</a>` : ''}</td></tr>`).join('');
      return entete + lignesProjets + (sesPersonnes.length ? `<tr><td colspan="4" class="libelle" style="padding:12px 12px 4px 40px">Personnes de l’équipe</td></tr>${fiches}` : '');
    }).join('');

    return `
    <div class="ecran" style="max-width:1200px">
      ${C.entete('Liste des ressources', 'Affectations par équipe, projet et personne',
        `<button class="btn" data-action="toutDeplier">Tout déplier</button><button class="btn primaire" data-action="assigner">+ Assigner une ressource</button>`)}
      <div class="grille-kpi q4">${kpis}</div>
      <div class="carte"><table class="tableau"><tbody>${blocs || `<tr><td>${C.vide('Aucune équipe.')}</td></tr>`}</tbody></table></div>
    </div>`;
  }
};

Object.assign(Actions, {
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
