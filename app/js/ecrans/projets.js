/* ============================================================
   Général › Projets et Roadmap (maquette 02-gProjets.png) — lecture
   Projets groupés par équipe, filtre par équipe, tickets dépliables.
   Un clic sur un projet ouvre le panneau de détail.
   ============================================================ */
'use strict';

Ecrans.projets = {
  titre: 'Projets et Roadmap',
  section: 'general',
  rendre() {
    const esc = C.esc;
    const u = ui('projets', { equipe: 'toutes', ouverts: {} });
    const { projets, tickets, equipes } = etat.d;

    const puce = (id, nom, couleur) => `<button class="puce${u.equipe === id ? ' active' : ''}" data-action="filtrerEquipeProjets" data-id="${id}">
      ${C.pastille(couleur)}${esc(nom)}</button>`;
    const filtres = puce('toutes', 'Toutes les équipes', '#8A93A3') + equipes.map(e => puce(e.id, e.nom, e.couleur)).join('');

    const lignes = equipes.filter(e => u.equipe === 'toutes' || e.id === u.equipe).map(e => {
      const siens = projets.filter(p => p.equipeId === e.id);
      if (!siens.length) return '';
      return `<tr class="groupe"><td colspan="8"><span class="ligne-flex">${C.pastille(e.couleur)}${esc(e.nom)}
          <span class="discret" style="font-weight:400">${siens.length} projets · ${Calculs.pourcent(Calculs.avancementMoyen(siens))} d’avancement moyen</span></span></td></tr>`
        + siens.map(p => this.ligneProjet(p, tickets.filter(t => t.projetId === p.id), !!u.ouverts[p.id])).join('');
    }).join('');

    return `
    <div class="ecran">
      ${C.entete('Projets et Roadmap', `${projets.length} projets · objectifs, avancement et tickets par équipe`, `<div class="puces">${filtres}</div>`)}
      <div class="carte"><table class="tableau">
        <thead><tr><th style="width:24px"></th><th>Projet</th><th>Objectif · Résultat clé</th><th>Chef de projet</th><th>Avancement ${C.aide('avancementProjet')}</th><th>Tickets</th><th>Échéance</th><th>Statut</th></tr></thead>
        <tbody>${lignes || `<tr><td colspan="8">${C.vide('Aucun projet.')}</td></tr>`}</tbody></table></div>
    </div>`;
  },

  // Ligne d'un projet, suivie de ses tickets si elle est dépliée
  ligneProjet(p, tickets, ouvert) {
    const esc = C.esc, chef = ressource(p.chefId), n = Calculs.compteTickets(tickets);
    const kr = parId('resultatsCles', p.resultatCleId), obj = kr ? parId('objectifs', kr.objectifId) : null;
    const ligne = `
      <tr class="cliquable" data-action="ouvrirProjet" data-id="${p.id}">
        <td><button class="lien-btn" data-action="deplierProjet" data-id="${p.id}" title="Tickets">${ouvert ? '▾' : '▸'}</button></td>
        <td>${esc(p.nom)}<div>${C.code(p.code)}</div></td>
        <td>${obj ? `${esc(obj.code)} · ${esc(obj.titre)}<div class="discret">${esc(kr.code)} · ${esc(kr.libelle)}</div>` : '<span class="pale">—</span>'}</td>
        <td>${chef ? `<span class="ligne-flex">${C.avatar(chef.nom)}${esc(chef.nom)}</span>` : '<span class="pale">—</span>'}</td>
        <td style="min-width:150px"><span class="ligne-flex">${C.barre(p.avancement, C.couleurStatutProjet(p.statut))}<span class="num" style="width:36px">${p.avancement}%</span></span></td>
        <td>${n.termines}/${n.total}</td><td>${Calculs.formatCourt(p.fin)}</td><td>${C.badgeRef('stp', p.statut)}</td>
      </tr>`;
    if (!ouvert) return ligne;
    return ligne + (tickets.map(t => {
      const qui = ressource(t.assigneId);
      return `<tr><td></td><td>${C.code(t.numero)}</td><td colspan="2">${esc(t.titre)}</td>
        <td style="color:${couleurDe('prio', t.priorite)}">${esc(t.priorite)}</td><td>${qui ? C.avatar(qui.nom) : ''}</td><td></td><td>${C.badgeRef('stt', t.statut)}</td></tr>`;
    }).join('') || `<tr><td></td><td colspan="7" class="pale">Aucun ticket.</td></tr>`);
  }
};

Object.assign(Actions, {
  filtrerEquipeProjets: d => majUi('projets', { equipe: d.id }),
  deplierProjet(d, el, e) {
    e.stopPropagation();                         // ne pas ouvrir le panneau
    const ouverts = { ...ui('projets', { ouverts: {} }).ouverts };
    ouverts[d.id] = !ouverts[d.id];
    majUi('projets', { ouverts });
  }
});
