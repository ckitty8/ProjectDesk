/* ============================================================
   Général › Dashboard général (maquette 01-gDash.png) — lecture
   Indicateurs, objectifs du trimestre (OKR), progression par
   trimestre et par équipe, projets à surveiller.
   ============================================================ */
'use strict';

Ecrans.dashboard = {
  titre: 'Dashboard général',
  section: 'general',
  rendre() {
    const esc = C.esc, jour = Calculs.aujourdhui(), annee = Number(jour.slice(0, 4));
    const trimestreCourant = Calculs.trimestreDe(jour);
    const t = ui('dashboard', { trimestre: trimestreCourant }).trimestre;
    const { projets, tickets, objectifs, resultatsCles, ressources, temps, absences } = etat.d;
    const actifs = Calculs.projetsActifs(projets);

    // Indicateurs
    const aRisque = actifs.filter(p => [STATUTS_PROJET.A_RISQUE, STATUTS_PROJET.EN_RETARD].includes(p.statut)).length;
    const occupation = Calculs.tauxOccupation(ressources, Calculs.lundi(jour), temps, absences, feries());
    const kpis = [
      C.kpi('Projets actifs', actifs.length, `${projets.length - actifs.length} terminés`),
      C.kpi('Avancement moyen', Calculs.pourcent(Calculs.avancementMoyen(actifs)), 'projets actifs', 'avancementMoyen'),
      C.kpi('Projets à risque ou en retard', aRisque, '', 'projetsRisque'),
      C.kpi('Tickets ouverts', Calculs.ticketsOuverts(tickets), `sur ${tickets.length}`),
      C.kpi('Taux d’occupation', Calculs.pourcent(occupation), `cible ${CONFIG.CIBLE_OCCUPATION} %`, 'tauxOccupation')
    ].join('');

    // Objectifs du trimestre choisi
    const objs = objectifs.filter(o => o.annee === annee && o.trimestre === t);
    const nbKr = resultatsCles.filter(k => objs.some(o => o.id === k.objectifId)).length;
    const cartesObjectifs = objs.map(o => {
      const eq = equipe(o.equipeId), krs = resultatsCles.filter(k => k.objectifId === o.id);
      const [fond, texte] = CONFIANCES[o.confiance];
      return `
      <div class="carte" style="padding:16px;display:flex;flex-direction:column;gap:10px">
        <div class="ligne-flex" style="justify-content:space-between"><span class="ligne-flex discret">${C.pastille(eq.couleur)}${esc(eq.nom)}</span>
          ${C.badge('Confiance ' + o.confiance, texte, fond)}</div>
        <h2>${esc(o.titre)}</h2>
        <div class="ligne-flex">${C.barre(Calculs.progressionObjectif(krs), eq.couleur)}<b>${Calculs.pourcent(Calculs.progressionObjectif(krs))}</b></div>
        <div style="border-top:1px solid var(--bordure-fine);padding-top:8px;display:flex;flex-direction:column;gap:6px">
          ${krs.map(k => `<div class="ligne-flex">${C.code(k.code)}<span style="flex:1">${esc(k.libelle)}</span>
            <span style="width:48px">${C.barre(k.progression, '#8CA6E8', 'fine')}</span><span class="num discret" style="width:38px">${k.progression}%</span></div>`).join('')}
        </div>
      </div>`;
    }).join('');

    // Progression par trimestre (atteinte moyenne des OKR) pour chaque équipe
    const lignesTrimestres = etat.d.equipes.map(e => `
      <tr><td><span class="ligne-flex">${C.pastille(e.couleur)}${esc(e.nom)}</span></td>
        ${[1, 2, 3, 4].map(q => {
          const v = Calculs.atteinteTrimestre(objectifs, resultatsCles, e.id, annee, q);
          return `<td>${v === null ? '<span class="pale">—</span>' : `<span class="ligne-flex"><span style="width:50px">${C.barre(v, q === trimestreCourant ? '#8CA6E8' : e.couleur)}</span>${Calculs.pourcent(v)}</span>`}</td>`;
        }).join('')}</tr>`).join('');

    const surveiller = Calculs.projetsASurveiller(projets, jour).map(p => `
      <tr class="cliquable" data-action="ouvrirProjet" data-id="${p.id}"><td>${C.code(p.code)}</td>
        <td>${esc(p.nom)}<div class="discret" style="font-size:12px">${esc(equipe(p.equipeId).nom)} · échéance ${Calculs.formatCourt(p.fin)}</div></td>
        <td class="num">${C.badgeRef('stp', p.statut)}</td></tr>`).join('');

    return `
    <div class="ecran">
      ${C.entete('Dashboard général', `Vue consolidée des équipes · T${t} ${annee}`,
        `<div class="puces">${[1, 2, 3, 4].map(q => `<button class="puce${q === t ? ' active' : ''}" data-action="choisirTrimestre" data-t="${q}">T${q}</button>`).join('')}</div>`)}
      <div class="grille-kpi">${kpis}</div>
      <div class="ligne-flex" style="justify-content:space-between"><h2>Objectifs T${t} ${annee}</h2>
        <span class="discret">${objs.length} objectifs · ${nbKr} résultats clés</span></div>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px">${cartesObjectifs || `<div class="carte">${C.vide('Aucun objectif pour ce trimestre (saisie : Mon dashboard › Projets et Roadmap).')}</div>`}</div>
      <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,.75fr);gap:16px;align-items:start">
        <div class="carte"><div class="carte-titre"><h2>Progression par trimestre</h2><span class="discret">Atteinte moyenne des OKR · ${annee}</span></div>
          <table class="tableau"><thead><tr><th>Équipe</th><th>T1</th><th>T2</th><th>T3</th><th>T4</th></tr></thead><tbody>${lignesTrimestres}</tbody></table></div>
        <div class="carte"><div class="carte-titre"><h2>Projets à surveiller ${C.aide('projetsSurveiller')}</h2></div>
          <table class="tableau"><tbody>${surveiller || `<tr><td>${C.vide('Aucun projet à risque ni échéance proche.')}</td></tr>`}</tbody></table></div>
      </div>
    </div>`;
  }
};

Object.assign(Actions, {
  choisirTrimestre: d => majUi('dashboard', { trimestre: Number(d.t) })
});
