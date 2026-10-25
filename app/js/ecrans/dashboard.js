/* ============================================================
   Suivi de mes équipes › Dashboard général (maquette 01-gDash.png) — lecture
   Indicateurs (projets actifs, avancement, risques, occupation) et
   projets à surveiller (objectifs OKR retirés : porteur 2026-10-25).
   ============================================================ */
'use strict';

Ecrans.dashboard = {
  titre: 'Dashboard général',
  section: 'general',
  // Indicateurs : projets actifs, avancement moyen, projets à risque, taux d'occupation de la semaine
  indicateurs(jour) {
    const { projets, ressources, temps, absences } = etat.d, actifs = Calculs.projetsActifs(projets);
    const aRisque = actifs.filter(p => [STATUTS_PROJET.A_RISQUE, STATUTS_PROJET.EN_RETARD].includes(p.statut)).length;
    const occupation = Calculs.tauxOccupation(ressources, Calculs.lundi(jour), temps, absences, feries());
    return [
      C.kpi('Projets actifs', actifs.length, `${projets.length - actifs.length} terminés`),
      C.kpi('Avancement moyen', Calculs.pourcent(Calculs.avancementMoyen(actifs)), 'projets actifs', 'avancementMoyen'),
      C.kpi('Projets à risque ou en retard', aRisque, '', 'projetsRisque'),
      C.kpi('Taux d’occupation', Calculs.pourcent(occupation), `cible ${CONFIG.CIBLE_OCCUPATION} %`, 'tauxOccupation')
    ].join('');
  },

  // Projets à surveiller (à risque, en retard, échéance proche) : un clic ouvre le projet
  lignesASurveiller(jour) {
    return Calculs.projetsASurveiller(etat.d.projets, jour).map(p => `
      <tr class="cliquable" data-action="ouvrirProjet" data-id="${p.id}">
        <td>${C.esc(p.nom)}<div class="discret texte-12">${C.esc(equipe(p.equipeId).nom)} · échéance ${Calculs.formatCourt(p.fin)}</div></td>
        <td class="num">${C.badgeRef('stp', p.statut)}</td></tr>`).join('');
  },

  rendre() {
    const jour = Calculs.aujourdhui(), surveiller = this.lignesASurveiller(jour);
    return `
    <div class="ecran">
      ${C.entete('Dashboard général', 'Vue consolidée des équipes')}
      <div class="grille-kpi">${this.indicateurs(jour)}</div>
      <div class="carte"><div class="carte-titre"><h2>Projets à surveiller ${C.aide('projetsSurveiller')}</h2></div>
        <table class="tableau"><tbody>${surveiller || `<tr><td>${C.vide('Aucun projet à risque ni échéance proche.')}</td></tr>`}</tbody></table></div>
    </div>`;
  }
};
