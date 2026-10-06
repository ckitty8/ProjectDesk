/* ============================================================
   Mon dashboard › Mon timesheet › Suivi de mes équipes
   (maquette docs/maquettes/mon-timesheet-suivi-equipes/)
   - Feuilles du mois des personnes de mes équipes (saisie mensuelle) :
     projets, heures saisies / attendues, complétude, statut.
   - Responsable d'équipe (owner/admin) : Valider / Renvoyer les
     feuilles soumises (actions de mon-timesheet.js, droits en base).
   - Même tableau que Général › Timesheet (tableauFeuilles), limité
     à mes équipes.
   ============================================================ */
'use strict';

Ecrans.suiviEquipes = {
  titre: 'Suivi de mes équipes',
  section: 'moi',
  rendre() {
    const entete = C.entete('Suivi de mes équipes', 'Feuilles de temps du mois des personnes de vos équipes', MoisTemps.navigation());
    const equipes = mesEquipes();
    if (!equipes.length) return `<div class="ecran">${entete}${C.vide('Vous n’êtes membre d’aucune équipe.')}</div>`;

    const t = tableauFeuilles(equipes, true);
    const completude = t.attendu ? t.saisi / t.attendu * 100 : 0;
    return `
    <div class="ecran">
      ${entete}
      <div class="grille-kpi q4">${C.kpi('Heures saisies', Calculs.nombre(t.saisi) + ' h', `sur ${Calculs.nombre(t.attendu)} h attendues`)}
        ${C.kpi('Taux de complétude', Calculs.pourcent(completude), '', 'completude')}
        ${C.kpi('Feuilles à compléter', t.aCompleter)}${C.kpi('Feuilles à valider', t.aValider, '', 'aValider')}</div>
      ${t.html}
    </div>`;
  }
};
