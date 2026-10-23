/* ============================================================
   Suivi de mes équipes › Projets et Roadmap (maquette 02-gProjets.png) — lecture
   Onglets (porteur 2026-10-23, maquette roadmap-mep-sprints/) :
   - Projets : projets groupés par équipe, filtre par équipe (notion de ticket retirée de
     l'application à la demande du porteur, 2026-09-27) ; un clic ouvre le panneau de détail ;
   - Planning des MEP : mises en production des projets par mois (PlanningMep, table mises_en_production,
     saisies dans Mon dashboard › Projets et Roadmap › MEP) ;
   - Planning des sprints : les sprints de chaque projet sur une frise de 6 mois (PlanningSprints).
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
    const onglets = C.onglets([{ id: 'projets', libelle: 'Projets' }, { id: 'mep', libelle: 'Planning des MEP' },
      { id: 'sprints', libelle: 'Planning des sprints' }], u.onglet, 'ongletProjets');
    const contenus = { projets: () => this.tableau(u), mep: () => PlanningMep.rendre(projets), sprints: () => PlanningSprints.rendre(projets) };
    return `
    <div class="ecran">
      ${C.entete('Projets et Roadmap', `${etat.d.projets.length} projets · objectifs, avancement et sprints par équipe`, `<div class="puces">${filtres}</div>`)}
      ${onglets}${(contenus[u.onglet] || contenus.projets)()}
    </div>`;
  },

  // Onglet Projets : tableau des projets groupés par équipe
  tableau(u) {
    const esc = C.esc;
    const lignes = etat.d.equipes.filter(e => u.equipe === 'toutes' || e.id === u.equipe).map(e => {
      const siens = etat.d.projets.filter(p => p.equipeId === e.id);
      if (!siens.length) return '';
      return `<tr class="groupe"><td colspan="6"><span class="ligne-flex">${C.pastille(e.couleur)}${esc(e.nom)}
          <span class="discret poids-normal">${siens.length} projets · ${Calculs.pourcent(Calculs.avancementMoyen(siens))} d’avancement moyen</span></span></td></tr>`
        + siens.map(p => this.ligneProjet(p)).join('');
    }).join('');
    return `<div class="carte"><table class="tableau">
        <thead><tr><th>Projet</th><th>Objectif · Résultat clé</th><th>Chef de projet</th><th>Avancement ${C.aide('avancementProjet')}</th>
          <th>Échéance</th><th>Statut</th></tr></thead>
        <tbody>${lignes || `<tr><td colspan="6">${C.vide('Aucun projet.')}</td></tr>`}</tbody></table></div>`;
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
        <td style="min-width:150px"><span class="ligne-flex">${C.barre(p.avancement, C.couleurStatutProjet(p.statut))}
          <span class="num" style="width:36px">${p.avancement}%</span></span></td>
        <td>${Calculs.formatCourt(p.fin)}</td><td>${C.badgeRef('stp', p.statut)}</td>
      </tr>`;
  }
};

/* ---------- Onglet Planning des sprints (maquette roadmap-mep-sprints/3-planning-sprints.png) ----------
   Une ligne par projet qui a des sprints sur la période, ses sprints en blocs « S12 » sur une frise de 6 mois ;
   sprint en cours en bleu, trait vertical = aujourd'hui, version et dates au survol. Les sprints sont ceux saisis
   dans Mon dashboard › Administration › Sprints (sprintsDuProjet, etat.js). Période : 6 mois à partir du mois
   précédent le mois en cours, décalable mois par mois (‹ Aujourd'hui ›). */
/* ---------- Onglet Planning des MEP (2026-10-23, maquette roadmap-mep-sprints/2-planning-mep.png) ----------
   Une ligne par mise en production, groupées par mois ; la prochaine MEP prévue est mise en avant.
   Par défaut à partir du 1er du mois en cours ; « Voir les MEP passées » affiche tout l'historique. */
const PlanningMep = {
  // Ligne d'une MEP : date, projet, version, contenu, statut
  ligne(m, prochaine) {
    const p = projet(m.projetId), esc = C.esc;
    return `<tr${prochaine ? ' class="ligne-prochaine"' : ''}><td><b>${Calculs.formatCourt(m.jour)}</b>${prochaine ? ' ' + C.badgeTon('Prochaine', 'info') : ''}</td>
      <td>${C.code(p.code)} ${esc(p.nom)}</td><td>${esc(m.version || '')}</td><td>${esc(m.contenu || '')}</td><td>${badgeMep(m.statut)}</td></tr>`;
  },

  rendre(projets) {
    const passees = ui('planningMep', {}).passees, jour = Calculs.aujourdhui(), debutMois = jour.slice(0, 8) + '01';
    const meps = misesEnProductionDe(projets).filter(m => passees || m.jour >= debutMois);
    const prochaine = meps.find(m => m.statut === 'prevue' && m.jour >= jour);
    let moisCourant = '';
    // Une ligne de groupe à chaque changement de mois, puis les MEP du mois
    const lignes = meps.map(m => {
      const mois = m.jour.slice(0, 7), groupe = mois !== moisCourant
        ? `<tr class="groupe"><td colspan="5">${Calculs.libelleMois(...PlanningSprints.anneeMois(m.jour))}</td></tr>` : '';
      moisCourant = mois;
      return groupe + this.ligne(m, m === prochaine);
    }).join('');
    return `<div class="ligne-flex entre encart-compact">
        <button class="btn" data-action="planningMepPassees">${passees ? 'Masquer les MEP passées' : 'Voir les MEP passées'}</button>
        <span class="discret texte-12">MEP saisies dans Mon dashboard › Projets et Roadmap › MEP</span></div>
      <div class="carte"><table class="tableau"><thead><tr><th>Date</th><th>Projet</th><th>Version</th><th>Contenu</th><th>Statut</th></tr></thead>
        <tbody>${lignes || `<tr><td colspan="5">${C.vide('Aucune mise en production prévue.')}</td></tr>`}</tbody></table></div>`;
  }
};

const PlanningSprints = {
  NB_MOIS: 6,
  // Premier jour de la période affichée (ISO) : choisi par les flèches, sinon le 1er du mois précédent
  debut() {
    const choisi = ui('planningSprints', {}).debut;
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
        <button class="btn" data-action="planningSprintsAujourdhui">Aujourd’hui</button>
        <button class="btn" data-action="planningSprintsDecaler" data-sens="-1">‹</button>
        <b>${Calculs.libelleMois(...this.anneeMois(per.debut))} → ${Calculs.libelleMois(...this.anneeMois(per.fin))}</b>
        <button class="btn" data-action="planningSprintsDecaler" data-sens="1">›</button></div>
      <span class="discret texte-12">Sprints saisis dans Mon dashboard › Administration › Sprints</span></div>`;
  },
  anneeMois(iso) { const d = Calculs.depuisIso(iso); return [d.getFullYear(), d.getMonth()]; },

  rendre(projets) {
    const per = this.periode(), jour = Calculs.aujourdhui();
    const lignes = projets.map(p => ({ p, sprints: sprintsDuProjet(p.id).filter(s => s.debut <= per.fin && s.fin >= per.debut) }))
      .filter(x => x.sprints.length).map(({ p, sprints }) => `<div class="gantt-ligne"><div><div>${C.code(p.code)} ${C.esc(p.nom)}</div></div>
        <div class="gantt-piste">${jour >= per.debut && jour <= per.fin ? `<div class="gantt-jour" style="left:${per.position(jour)}%"></div>` : ''}
          ${sprints.map(s => this.bloc(s, per, jour)).join('')}</div></div>`).join('');
    return `${this.navigation(per)}
      <div class="carte planning-sprints"><div class="gantt-mois"><div class="libelle gantt-titre-col">Projet</div><div class="mois">${per.mois}</div></div>
        ${lignes || C.vide('Aucun sprint saisi sur cette période.')}</div>
      <div class="discret texte-12"><span class="couleur-primaire">—</span> Aujourd’hui · en bleu : sprint en cours · survol : version et dates du sprint</div>`;
  }
};

Object.assign(Actions, {
  filtrerEquipeProjets: d => majUi('projets', { equipe: d.id }),
  ongletProjets: d => majUi('projets', { onglet: d.id }),
  planningMepPassees: () => majUi('planningMep', { passees: !ui('planningMep', {}).passees }),
  // Planning des sprints : décaler la période d'un mois, ou revenir à la période par défaut
  planningSprintsDecaler(d) {
    const m = Calculs.depuisIso(PlanningSprints.debut());
    majUi('planningSprints', { debut: Calculs.versIso(new Date(m.getFullYear(), m.getMonth() + Number(d.sens), 1)) });
  },
  planningSprintsAujourdhui: () => majUi('planningSprints', { debut: null })
});
