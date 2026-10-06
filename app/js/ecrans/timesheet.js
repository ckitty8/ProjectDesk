/* ============================================================
   Général › Timesheet (maquette 05-gTime.png) — lecture
   Heures déclarées par personne sur un mois, toutes équipes.
   (La saisie se fait dans Mon dashboard › Mon timesheet.)
   La saisie et la validation des heures sont MENSUELLES (porteur du
   projet, 2026-10-05) : une feuille par personne et par mois.
   ============================================================ */
'use strict';

// Mois affiché, partagé par les écrans de temps : ui('moisTemps') = { annee, mois (0-11) }
const MoisTemps = {
  courant() {
    const d = Calculs.depuisIso(Calculs.aujourdhui());
    return ui('moisTemps', { annee: d.getFullYear(), mois: d.getMonth() });
  },
  // Clé de la feuille du mois affiché (1er jour du mois)
  cle() { const m = this.courant(); return Calculs.debutMois(m.annee, m.mois); },
  navigation() {
    const m = this.courant();
    return `<div class="ligne-flex"><button class="btn" data-action="moisTempsPrecedent">‹</button>
      <b style="min-width:130px;text-align:center">${Calculs.libelleMois(m.annee, m.mois)}</b>
      <button class="btn" data-action="moisTempsSuivant">›</button></div>`;
  },
  // Statut de la feuille d'une personne pour un mois (en_saisie si aucune ligne)
  statut(ressourceId, cle) {
    const f = etat.d.feuilles.find(x => x.ressourceId === ressourceId && x.semaine === cle);
    return f ? f.statut : 'en_saisie';
  }
};

/* Tableau des feuilles d'un mois, groupé par équipe (Général › Timesheet et
   Mon timesheet › Suivi de mes équipes) : par personne, ses projets, heures
   saisies / attendues, complétude, statut. « avecValidation » ajoute la colonne
   Valider / Renvoyer pour les feuilles soumises des équipes dont je suis responsable.
   Renvoie le HTML et les totaux du mois (pour les indicateurs). */
function tableauFeuilles(equipes, avecValidation = false) {
  const esc = C.esc, fer = feries(), m = MoisTemps.courant(), cle = MoisTemps.cle();
  const totaux = { saisi: 0, attendu: 0, aCompleter: 0, aValider: 0 };
  const nbColonnes = 6 + (avecValidation ? 1 : 0);

  const lignes = equipes.map(e => {
    const personnes = etat.d.ressources.filter(r => r.equipeId === e.id);
    if (!personnes.length) return '';
    return `<tr class="groupe"><td colspan="${nbColonnes}"><span class="ligne-flex">${C.pastille(e.couleur)}${esc(e.nom)}</span></td></tr>` +
      personnes.map(r => {
        const saisi = Calculs.heuresMois(r.id, m.annee, m.mois, etat.d.temps).total;
        const attendu = Calculs.heuresAttenduesMois(r, m.annee, m.mois, etat.d.absences, fer);
        const statut = MoisTemps.statut(r.id, cle);
        totaux.saisi += saisi; totaux.attendu += attendu;
        if (statut !== 'validee' && saisi < attendu) totaux.aCompleter++;
        if (statut === 'soumise') totaux.aValider++;
        const codes = etat.d.affectations.filter(a => a.ressourceId === r.id).map(a => (projet(a.projetId) || {}).code).filter(Boolean).join(' · ');
        const boutons = statut === 'soumise' && estResponsableDe(e.id)
          ? `<button class="btn petit" data-action="renvoyerFeuille" data-ressource="${r.id}" data-semaine="${cle}">Renvoyer</button>
             <button class="btn petit succes" data-action="validerFeuille" data-ressource="${r.id}" data-semaine="${cle}">Valider</button>` : '';
        return `<tr><td><span class="ligne-flex">${C.avatar(r.nom)}${esc(r.nom)}</span></td><td class="code">${esc(codes)}</td>
          <td class="num"><b>${Calculs.nombre(saisi)} h</b> <span class="discret">/ ${Calculs.nombre(attendu)} h</span></td>
          <td style="width:18%">${C.barre(attendu ? Math.min(100, saisi / attendu * 100) : 0)}</td>
          <td class="num">${attendu ? Calculs.pourcent(saisi / attendu * 100) : '—'}</td><td>${C.badgeFeuille(statut)}</td>
          ${avecValidation ? `<td class="num" style="white-space:nowrap">${boutons}</td>` : ''}</tr>`;
      }).join('');
  }).join('');

  const html = `<div class="carte"><table class="tableau"><thead><tr><th>Personne</th><th>Projets</th>
    <th class="num">Saisi / attendu</th><th>Complétude</th><th class="num">%</th><th>Statut</th>${avecValidation ? '<th></th>' : ''}</tr></thead>
    <tbody>${lignes || `<tr><td colspan="${nbColonnes}">${C.vide('Aucune ressource.')}</td></tr>`}</tbody></table></div>`;
  return { html, ...totaux };
}

Ecrans.timesheet = {
  titre: 'Timesheet',
  section: 'general',
  rendre() {
    const t = tableauFeuilles(etat.d.equipes);
    const completude = t.attendu ? t.saisi / t.attendu * 100 : 0;
    return `
    <div class="ecran">
      ${C.entete('Timesheet', 'Heures déclarées par personne sur le mois · toutes équipes', MoisTemps.navigation())}
      <div class="grille-kpi q3">${C.kpi('Heures saisies', Calculs.nombre(t.saisi) + ' h', `sur ${Calculs.nombre(t.attendu)} h attendues`)}
        ${C.kpi('Taux de complétude', Calculs.pourcent(completude), '', 'completude')}${C.kpi('Feuilles à compléter', t.aCompleter)}</div>
      ${t.html}
    </div>`;
  }
};

Object.assign(Actions, {
  moisTempsPrecedent() { const m = MoisTemps.courant(); majUi('moisTemps', m.mois === 0 ? { annee: m.annee - 1, mois: 11 } : { mois: m.mois - 1 }); },
  moisTempsSuivant() { const m = MoisTemps.courant(); majUi('moisTemps', m.mois === 11 ? { annee: m.annee + 1, mois: 0 } : { mois: m.mois + 1 }); }
});
