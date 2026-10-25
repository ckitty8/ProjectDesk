/* ============================================================
   Suivi de mes équipes › Projets et Roadmap (maquette 02-gProjets.png) — lecture
   Onglets (porteur 2026-10-23, maquette roadmap-mep-sprints/) :
   - Projets : projets groupés par équipe, filtre par équipe (notion de ticket retirée de
     l'application à la demande du porteur, 2026-09-27) ; un clic ouvre le panneau de détail ;
   - Planning projet (porteur 2026-10-23, maquette planning-projet/) : sur une frise de 6 mois, les sprints
     de chaque projet (Mon dashboard › Projets et Roadmap › Sprints) et ses dates de mise en production
     (Mon dashboard › Projets et Roadmap › Mises en production) — PlanningProjet. Remplace les onglets
     « Planning des sprints » et « Planning des MEP » (2.32-2.33).
   ============================================================ */
'use strict';

Ecrans.projets = {
  titre: 'Projets et Roadmap',
  section: 'general',
  rendre() {
    const esc = C.esc, u = ui('projets', { equipe: 'toutes', onglet: 'projets' });
    const puce = (id, nom, couleur) => `<button class="puce${u.equipe === id ? ' active' : ''}" data-action="filtrerEquipeProjets" data-id="${id}">
      ${C.pastille(couleur)}${esc(nom)}</button>`;
    const filtres = puce('toutes', 'Toutes les équipes', COULEURS.pale) + etat.d.equipes.map(e => puce(e.id, e.nom, e.couleur)).join('');
    // Projets des équipes filtrées (le filtre vaut pour les deux onglets)
    const projets = etat.d.projets.filter(p => u.equipe === 'toutes' || p.equipeId === u.equipe);
    const onglets = C.onglets([{ id: 'projets', libelle: 'Projets' }, { id: 'planning', libelle: 'Planning projet' }], u.onglet, 'ongletProjets');
    const contenus = { projets: () => this.tableau(u), planning: () => PlanningProjet.rendre(projets) };
    return `
    <div class="ecran">
      ${C.entete('Projets et Roadmap', `${etat.d.projets.length} projets · avancement et sprints par équipe`, `<div class="puces">${filtres}</div>`)}
      ${onglets}${(contenus[u.onglet] || contenus.projets)()}
    </div>`;
  },

  // Onglet Projets : tableau des projets groupés par équipe
  tableau(u) {
    const esc = C.esc;
    const lignes = etat.d.equipes.filter(e => u.equipe === 'toutes' || e.id === u.equipe).map(e => {
      const siens = etat.d.projets.filter(p => p.equipeId === e.id);
      if (!siens.length) return '';
      return `<tr class="groupe"><td colspan="5"><span class="ligne-flex">${C.pastille(e.couleur)}${esc(e.nom)}
          <span class="discret poids-normal">${siens.length} projets · ${Calculs.pourcent(Calculs.avancementMoyen(siens))} d’avancement moyen</span></span></td></tr>`
        + siens.map(p => this.ligneProjet(p)).join('');
    }).join('');
    return `<div class="carte"><table class="tableau">
        <thead><tr><th>Projet</th><th>Chef de projet</th><th>Avancement ${C.aide('avancementProjet')}</th>
          <th>Échéance</th><th>Statut</th></tr></thead>
        <tbody>${lignes || `<tr><td colspan="5">${C.vide('Aucun projet.')}</td></tr>`}</tbody></table></div>`;
  },

  // Ligne d'un projet (un clic ouvre le panneau de détail)
  ligneProjet(p) {
    const esc = C.esc, chef = ressource(p.chefId);
    return `
      <tr class="cliquable" data-action="ouvrirProjet" data-id="${p.id}">
        <td>${esc(p.nom)}</td>
        <td>${chef ? `<span class="ligne-flex">${C.avatar(chef.nom)}${esc(chef.nom)}</span>` : '<span class="pale">—</span>'}</td>
        <td style="min-width:150px"><span class="ligne-flex">${C.barre(p.avancement, C.couleurStatutProjet(p.statut))}
          <span class="num" style="width:36px">${p.avancement}%</span></span></td>
        <td>${Calculs.formatCourt(p.fin)}</td><td>${C.badgeRef('stp', p.statut)}</td>
      </tr>`;
  }
};

/* ---------- Onglet Planning projet (maquette planning-projet/, porteur 2026-10-23) ----------
   Une ligne par projet ayant un sprint ou une MEP sur la période, sur une frise de 6 mois : sprints en blocs
   « S12 » (sprint en cours en bleu ; sprintsDuProjet) et mises en production en repères ▲ + version sous les
   sprints (couleur du statut, STATUTS_MEP ; misesEnProductionDe) ; trait vertical = aujourd'hui, détail au survol.
   Période : 6 mois à partir du mois précédent le mois en cours, décalable mois par mois (‹ Aujourd'hui ›). */
const PlanningProjet = {
  NB_MOIS: 6,
  // Premier jour de la période affichée (ISO) : choisi par les flèches, sinon le 1er du mois précédent
  debut() {
    const choisi = ui('planningProjet', {}).debut;
    if (choisi) return choisi;
    const d = Calculs.depuisIso(Calculs.aujourdhui());
    return Calculs.versIso(new Date(d.getFullYear(), d.getMonth() - 1, 1));
  },
  // Période : début, fin (dernier jour du 6e mois), nombre de jours et en-tête des mois
  periode() {
    const d = Calculs.depuisIso(this.debut()), debut = this.debut();
    const fin = Calculs.versIso(new Date(d.getFullYear(), d.getMonth() + this.NB_MOIS, 0)), total = Calculs.ecartJours(debut, fin) + 1;
    const mois = Array.from({ length: this.NB_MOIS }, (_, i) => new Date(d.getFullYear(), d.getMonth() + i, 1)).map(m => {
      const nbJours = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      return `<div style="width:${nbJours / total * 100}%">${Calculs.MOIS_COURTS[m.getMonth()]} ${String(m.getFullYear()).slice(2)}</div>`;
    }).join('');
    return { debut, fin, total, mois, position: iso => Math.max(0, Math.min(100, Calculs.ecartJours(debut, iso) / total * 100)) };
  },
  // Bloc d'un sprint : « S » + numéro de sprint, sprint en cours mis en avant, version et dates en infobulle
  bloc(s, per, jour) {
    const g = per.position(s.debut), l = Math.max(per.position(s.fin) - g, 0.5), numero = s.numeroSprint || s.numero;
    const titre = `Sprint ${numero}${s.nom ? ' · ' + s.nom : ''} : ${Calculs.formatCourt(s.debut)} → ${Calculs.formatCourt(s.fin)}`;
    return `<div class="gantt-sprint${s.debut <= jour && jour <= s.fin ? ' en-cours' : ''}" style="left:${g}%;width:${l}%"
      title="${C.esc(titre)}">S${numero}</div>`;
  },
  // Navigation de période et rappel de l'endroit où les sprints se saisissent
  navigation(per) {
    return `<div class="ligne-flex entre encart-compact"><div class="ligne-flex">
        <button class="btn" data-action="planningProjetAujourdhui">Aujourd’hui</button>
        <button class="btn" data-action="planningProjetDecaler" data-sens="-1">‹</button>
        <b>${Calculs.libelleMois(...this.anneeMois(per.debut))} → ${Calculs.libelleMois(...this.anneeMois(per.fin))}</b>
        <button class="btn" data-action="planningProjetDecaler" data-sens="1">›</button></div>
      <span class="discret texte-12">Sprints et MEP : saisis dans Mon dashboard › Projets et Roadmap</span></div>`;
  },
  // Repère d'une mise en production : ▲ + version à sa date, couleur de son statut, détail en infobulle
  repereMep(m, per) {
    const statut = STATUTS_MEP.find(x => x.valeur === m.statut) || STATUTS_MEP[0];
    // Tickets livrés (migration 044) : « 5 US · 3 bugs · 1 incidents », vide si aucun
    const tickets = m.nbBugs || m.nbIncidents || m.nbUs ? ` : ${m.nbUs || 0} US · ${m.nbBugs || 0} bugs · ${m.nbIncidents || 0} incidents` : '';
    const titre = `MEP ${m.version || ''} · ${Calculs.formatCourt(m.jour)} · ${statut.libelle}${tickets}`;
    return `<div class="gantt-mep" style="left:${per.position(m.jour)}%;color:${TONS[statut.ton].texte}" title="${C.esc(titre)}">▲ ${C.esc(m.version || 'MEP')}</div>`;
  },
  anneeMois(iso) { const d = Calculs.depuisIso(iso); return [d.getFullYear(), d.getMonth()]; },

  rendre(projets) {
    const per = this.periode(), jour = Calculs.aujourdhui(), dansPeriode = (debut, fin) => debut <= per.fin && fin >= per.debut;
    const lignes = projets.map(p => ({ p, sprints: sprintsDuProjet(p.id).filter(s => dansPeriode(s.debut, s.fin)),
      meps: misesEnProductionDe([p]).filter(m => dansPeriode(m.jour, m.jour)) }))
      .filter(x => x.sprints.length || x.meps.length).map(({ p, sprints, meps }) => `<div class="gantt-ligne"><div><div>${C.esc(p.nom)}</div></div>
        <div class="gantt-piste">${jour >= per.debut && jour <= per.fin ? `<div class="gantt-jour" style="left:${per.position(jour)}%"></div>` : ''}
          ${sprints.map(s => this.bloc(s, per, jour)).join('')}${meps.map(m => this.repereMep(m, per)).join('')}</div></div>`).join('');
    return `${this.navigation(per)}
      <div class="carte planning-projet"><div class="gantt-mois"><div class="libelle gantt-titre-col">Projet</div><div class="mois">${per.mois}</div></div>
        ${lignes || C.vide('Aucun sprint ni mise en production sur cette période.')}</div>
      <div class="discret texte-12"><span class="couleur-primaire">—</span> Aujourd’hui · S… : sprint (en bleu : en cours) ·
        ▲ : mise en production (bleu prévue, vert faite, orange reportée) · survol : détail</div>`;
  }
};

Object.assign(Actions, {
  filtrerEquipeProjets: d => majUi('projets', { equipe: d.id }),
  ongletProjets: d => majUi('projets', { onglet: d.id }),
  // Planning projet : décaler la période d'un mois, ou revenir à la période par défaut
  planningProjetDecaler(d) {
    const m = Calculs.depuisIso(PlanningProjet.debut());
    majUi('planningProjet', { debut: Calculs.versIso(new Date(m.getFullYear(), m.getMonth() + Number(d.sens), 1)) });
  },
  planningProjetAujourdhui: () => majUi('planningProjet', { debut: null })
});
