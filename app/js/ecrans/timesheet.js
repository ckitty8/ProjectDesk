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

Ecrans.timesheet = {
  titre: 'Timesheet',
  section: 'general',
  rendre() {
    const esc = C.esc, lundi = Semaine.lundi(), fer = feries();
    const jours = Calculs.joursOuvresSemaine(lundi);
    let totalSaisi = 0, totalAttendu = 0, aCompleter = 0;

    const lignes = etat.d.equipes.map(e => {
      const personnes = etat.d.ressources.filter(r => r.equipeId === e.id);
      if (!personnes.length) return '';
      return `<tr class="groupe"><td colspan="${jours.length + 4}"><span class="ligne-flex">${C.pastille(e.couleur)}${esc(e.nom)}</span></td></tr>` +
        personnes.map(r => {
          const h = Calculs.heuresSemaine(r.id, lundi, etat.d.temps);
          const attendu = Calculs.heuresAttendues(r, lundi, etat.d.absences, fer);
          const statut = Semaine.statut(r.id, lundi);
          totalSaisi += h.total; totalAttendu += attendu;
          if (statut !== 'validee' && h.total < attendu) aCompleter++;
          const cases = h.jours.map((j, i) => {
            const abs = etat.d.absences.find(a => a.ressourceId === r.id && a.jour === j);
            if (abs) return `<td class="num">${C.badge(abs.type, couleurDe('abs', abs.type))}</td>`;
            if (fer.has(j)) return `<td class="num pale">Férié</td>`;
            return `<td class="num">${h.parJour[i] ? Calculs.nombre(h.parJour[i]) : '<span class="pale">—</span>'}</td>`;
          }).join('');
          const codes = etat.d.affectations.filter(a => a.ressourceId === r.id).map(a => (projet(a.projetId) || {}).code).filter(Boolean).join(' · ');
          return `<tr><td><span class="ligne-flex">${C.avatar(r.nom)}${esc(r.nom)}</span></td><td class="code">${esc(codes)}</td>${cases}
            <td class="num"><b>${Calculs.nombre(h.total)} h</b></td><td>${C.badgeFeuille(statut)}</td></tr>`;
        }).join('');
    }).join('');

    const completude = totalAttendu ? totalSaisi / totalAttendu * 100 : 0;
    return `
    <div class="ecran">
      ${C.entete('Timesheet', 'Heures déclarées par personne · toutes équipes', Semaine.navigation())}
      <div class="grille-kpi q3">${C.kpi('Heures saisies', Calculs.nombre(totalSaisi) + ' h', `sur ${Calculs.nombre(totalAttendu)} h attendues`)}
        ${C.kpi('Taux de complétude', Calculs.pourcent(completude), '', 'completude')}${C.kpi('Feuilles à compléter', aCompleter)}</div>
      <div class="carte"><table class="tableau"><thead><tr><th>Personne</th><th>Projets</th>
        ${jours.map(j => { const d = Calculs.depuisIso(j); return `<th class="num">${['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'][d.getDay()]} ${d.getDate()}</th>`; }).join('')}
        <th class="num">Total</th><th>Statut</th></tr></thead><tbody>${lignes || `<tr><td colspan="9">${C.vide('Aucune ressource.')}</td></tr>`}</tbody></table></div>
    </div>`;
  }
};

Object.assign(Actions, {
  semainePrecedente: () => majUi('semaine', { lundi: Calculs.ajouterJours(Semaine.lundi(), -7) }),
  semaineSuivante: () => majUi('semaine', { lundi: Calculs.ajouterJours(Semaine.lundi(), 7) })
});
