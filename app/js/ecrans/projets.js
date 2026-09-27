/* ============================================================
   Général › Projets et Roadmap (maquette 02-gProjets.png) — lecture
   Projets groupés par équipe, filtre par équipe (notion de ticket retirée
   de l'application à la demande du porteur, 2026-09-27).
   Un clic sur un projet ouvre le panneau de détail.
   ============================================================ */
'use strict';

Ecrans.projets = {
  titre: 'Projets et Roadmap',
  section: 'general',
  rendre() {
    const esc = C.esc;
    const u = ui('projets', { equipe: 'toutes' });
    const { projets, equipes } = etat.d;

    const puce = (id, nom, couleur) => `<button class="puce${u.equipe === id ? ' active' : ''}" data-action="filtrerEquipeProjets" data-id="${id}">
      ${C.pastille(couleur)}${esc(nom)}</button>`;
    const filtres = puce('toutes', 'Toutes les équipes', '#8A93A3') + equipes.map(e => puce(e.id, e.nom, e.couleur)).join('');

    const lignes = equipes.filter(e => u.equipe === 'toutes' || e.id === u.equipe).map(e => {
      const siens = projets.filter(p => p.equipeId === e.id);
      if (!siens.length) return '';
      return `<tr class="groupe"><td colspan="6"><span class="ligne-flex">${C.pastille(e.couleur)}${esc(e.nom)}
          <span class="discret" style="font-weight:400">${siens.length} projets · ${Calculs.pourcent(Calculs.avancementMoyen(siens))} d’avancement moyen</span></span></td></tr>`
        + siens.map(p => this.ligneProjet(p)).join('');
    }).join('');

    return `
    <div class="ecran">
      ${C.entete('Projets et Roadmap', `${projets.length} projets · objectifs et avancement par équipe`, `<div class="puces">${filtres}</div>`)}
      <div class="carte"><table class="tableau">
        <thead><tr><th>Projet</th><th>Objectif · Résultat clé</th><th>Chef de projet</th><th>Avancement ${C.aide('avancementProjet')}</th><th>Échéance</th><th>Statut</th></tr></thead>
        <tbody>${lignes || `<tr><td colspan="6">${C.vide('Aucun projet.')}</td></tr>`}</tbody></table></div>
    </div>`;
  },

  // Ligne d'un projet (un clic ouvre le panneau de détail)
  ligneProjet(p) {
    const esc = C.esc, chef = ressource(p.chefId);
    const kr = parId('resultatsCles', p.resultatCleId), obj = kr ? parId('objectifs', kr.objectifId) : null;
    return `
      <tr class="cliquable" data-action="ouvrirProjet" data-id="${p.id}">
        <td>${esc(p.nom)}<div>${C.code(p.code)}</div></td>
        <td>${obj ? `${esc(obj.code)} · ${esc(obj.titre)}<div class="discret">${esc(kr.code)} · ${esc(kr.libelle)}</div>` : '<span class="pale">—</span>'}</td>
        <td>${chef ? `<span class="ligne-flex">${C.avatar(chef.nom)}${esc(chef.nom)}</span>` : '<span class="pale">—</span>'}</td>
        <td style="min-width:150px"><span class="ligne-flex">${C.barre(p.avancement, C.couleurStatutProjet(p.statut))}<span class="num" style="width:36px">${p.avancement}%</span></span></td>
        <td>${Calculs.formatCourt(p.fin)}</td><td>${C.badgeRef('stp', p.statut)}</td>
      </tr>`;
  }
};

Object.assign(Actions, {
  filtrerEquipeProjets: d => majUi('projets', { equipe: d.id })
});
