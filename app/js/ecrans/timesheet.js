/* ============================================================
   Général › Timesheet (maquette 05-gTime.png) — lecture
   Heures déclarées par personne sur une semaine, toutes équipes.
   (La saisie se fait dans Mon dashboard › Mon timesheet.)
   ============================================================ */
'use strict';

// Navigation de semaine, partagée avec Mon timesheet : ui('semaine').lundi
const Semaine = {
  lundi: () => ui('semaine', { lundi: Calculs.lundi(Calculs.aujourdhui()) }).lundi,
  navigation() {
    const l = this.lundi(), v = Calculs.ajouterJours(l, 4);
    return `<div class="ligne-flex"><button class="btn" data-action="semainePrecedente">‹</button>
      <b>Semaine ${Calculs.numeroSemaine(l)} · ${Calculs.formatCourt(l)} – ${Calculs.formatAvecAnnee(v)}</b>
      <button class="btn" data-action="semaineSuivante">›</button></div>`;
  },
  // Statut de la feuille d'une personne (en_saisie si aucune ligne)
  statut(ressourceId, lundi) {
    const f = etat.d.feuilles.find(x => x.ressourceId === ressourceId && x.semaine === lundi);
    return f ? f.statut : 'en_saisie';
  }
};

/* Tableau des feuilles d'une semaine, groupé par équipe (Général › Timesheet et
   Mon timesheet › Suivi de mes équipes). « avecValidation » ajoute la colonne
   Valider / Renvoyer pour les feuilles soumises des équipes dont je suis responsable.
   Renvoie le HTML et les totaux de la semaine (pour les indicateurs). */
function tableauFeuilles(equipes, lundi, avecValidation = false) {
  const esc = C.esc, fer = feries(), jours = Calculs.joursOuvresSemaine(lundi);
  const totaux = { saisi: 0, attendu: 0, aCompleter: 0, aValider: 0 };
  const nbColonnes = jours.length + 4 + (avecValidation ? 1 : 0);

  const lignes = equipes.map(e => {
    const personnes = etat.d.ressources.filter(r => r.equipeId === e.id);
    if (!personnes.length) return '';
    return `<tr class="groupe"><td colspan="${nbColonnes}"><span class="ligne-flex">${C.pastille(e.couleur)}${esc(e.nom)}</span></td></tr>` +
      personnes.map(r => {
        const h = Calculs.heuresSemaine(r.id, lundi, etat.d.temps);
        const attendu = Calculs.heuresAttendues(r, lundi, etat.d.absences, fer);
        const statut = Semaine.statut(r.id, lundi);
        totaux.saisi += h.total; totaux.attendu += attendu;
        if (statut !== 'validee' && h.total < attendu) totaux.aCompleter++;
        if (statut === 'soumise') totaux.aValider++;
        const cases = h.jours.map((j, i) => {
          const abs = etat.d.absences.find(a => a.ressourceId === r.id && a.jour === j);
          if (abs) return `<td class="num">${C.badge(abs.type, couleurDe('abs', abs.type))}</td>`;
          if (fer.has(j)) return `<td class="num pale">Férié</td>`;
          return `<td class="num">${h.parJour[i] ? Calculs.nombre(h.parJour[i]) : '<span class="pale">—</span>'}</td>`;
        }).join('');
        const codes = etat.d.affectations.filter(a => a.ressourceId === r.id).map(a => (projet(a.projetId) || {}).code).filter(Boolean).join(' · ');
        const boutons = statut === 'soumise' && estResponsableDe(e.id)
          ? `<button class="btn petit" data-action="renvoyerFeuille" data-ressource="${r.id}" data-semaine="${lundi}">Renvoyer</button>
             <button class="btn petit succes" data-action="validerFeuille" data-ressource="${r.id}" data-semaine="${lundi}">Valider</button>` : '';
        return `<tr><td><span class="ligne-flex">${C.avatar(r.nom)}${esc(r.nom)}</span></td><td class="code">${esc(codes)}</td>${cases}
          <td class="num"><b>${Calculs.nombre(h.total)} h</b> <span class="discret">/ ${Calculs.nombre(attendu)}</span></td><td>${C.badgeFeuille(statut)}</td>
          ${avecValidation ? `<td class="num" style="white-space:nowrap">${boutons}</td>` : ''}</tr>`;
      }).join('');
  }).join('');

  const html = `<div class="carte"><table class="tableau"><thead><tr><th>Personne</th><th>Projets</th>
    ${jours.map(j => { const d = Calculs.depuisIso(j); return `<th class="num">${['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'][d.getDay()]} ${d.getDate()}</th>`; }).join('')}
    <th class="num">Total / attendu</th><th>Statut</th>${avecValidation ? '<th></th>' : ''}</tr></thead>
    <tbody>${lignes || `<tr><td colspan="${nbColonnes}">${C.vide('Aucune ressource.')}</td></tr>`}</tbody></table></div>`;
  return { html, ...totaux };
}

Ecrans.timesheet = {
  titre: 'Timesheet',
  section: 'general',
  rendre() {
    const t = tableauFeuilles(etat.d.equipes, Semaine.lundi());
    const completude = t.attendu ? t.saisi / t.attendu * 100 : 0;
    return `
    <div class="ecran">
      ${C.entete('Timesheet', 'Heures déclarées par personne · toutes équipes', Semaine.navigation())}
      <div class="grille-kpi q3">${C.kpi('Heures saisies', Calculs.nombre(t.saisi) + ' h', `sur ${Calculs.nombre(t.attendu)} h attendues`)}
        ${C.kpi('Taux de complétude', Calculs.pourcent(completude), '', 'completude')}${C.kpi('Feuilles à compléter', t.aCompleter)}</div>
      ${t.html}
    </div>`;
  }
};

Object.assign(Actions, {
  semainePrecedente: () => majUi('semaine', { lundi: Calculs.ajouterJours(Semaine.lundi(), -7) }),
  semaineSuivante: () => majUi('semaine', { lundi: Calculs.ajouterJours(Semaine.lundi(), 7) })
});
