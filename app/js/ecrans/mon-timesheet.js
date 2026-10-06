/* ============================================================
   Mon dashboard › Mon timesheet › Saisir mes heures
   (maquette complements/mon-timesheet.png)
   - Saisie MENSUELLE : ses heures par jour du mois sur les projets où
     l'on est affecté (hors rôle Lecteur), puis « Soumettre le mois ».
   - Les actions Valider / Renvoyer (responsable d'équipe) servent à
     l'écran Suivi de mes équipes. Droits contrôlés en base (trigger).
   ============================================================ */
'use strict';

Ecrans.monTimesheet = {
  titre: 'Saisir mes heures',
  section: 'moi',
  rendre() {
    const esc = C.esc, moi = maRessource(), m = MoisTemps.courant(), cle = MoisTemps.cle(), fer = feries();
    const entete = C.entete('Saisir mes heures', 'Votre temps du mois sur les projets où vous êtes affecté(e), puis soumettez le mois à votre chef d’équipe', MoisTemps.navigation());
    if (!moi) return `<div class="ecran">${entete}<div class="carte" style="padding:16px">Votre compte n’est lié à aucune fiche ressource :
      renseignez l’email de votre compte sur votre fiche (Liste des ressources), puis reconnectez-vous.</div></div>`;

    const jours = Calculs.joursSemaineMois(m.annee, m.mois), statut = MoisTemps.statut(moi.id, cle);
    const verrouille = ['soumise', 'validee'].includes(statut);
    const feuille = etat.d.feuilles.find(f => f.ressourceId === moi.id && f.semaine === cle);
    // Projets proposés : mes affectations (hors Lecteur) + projets déjà saisis ce mois
    const ids = new Set(etat.d.affectations.filter(a => a.ressourceId === moi.id && a.role !== ROLES_PROJET.LECTEUR).map(a => a.projetId));
    etat.d.temps.filter(t => t.ressourceId === moi.id && jours.includes(t.jour)).forEach(t => ids.add(t.projetId));
    const mesProjets = [...ids].map(projet).filter(Boolean);
    const heure = (pId, j) => (etat.d.temps.find(t => t.ressourceId === moi.id && t.projetId === pId && t.jour === j) || {}).heures;
    const absence = j => etat.d.absences.find(a => a.ressourceId === moi.id && a.jour === j);
    // Début de semaine : trait vertical pour repérer les semaines dans le mois
    const classe = j => Calculs.depuisIso(j).getDay() === 1 ? ' class="debut-semaine"' : '';

    // Case d'un jour : absence d'une journée, férié, hors présence → non saisissable
    const caseJour = (p, j) => {
      const abs = absence(j);
      if (fer.has(j)) return `<td${classe(j)}><span class="jour-off" title="Jour férié">JF</span></td>`;
      if (!Calculs.estPresent(moi, j)) return `<td${classe(j)}><span class="jour-off" title="Hors période de présence">—</span></td>`;
      if (abs && Calculs.dureeAbsence(abs) >= 1) return `<td${classe(j)}><span class="jour-off" style="background:${C.teinte(couleurDe('abs', abs.type))}" title="${esc(abs.type)}">Abs</span></td>`;
      const h = heure(p.id, j);
      return `<td${classe(j)}><input class="saisie-mois" inputmode="decimal" value="${h ? Calculs.nombre(h) : ''}" ${verrouille ? 'disabled' : ''}
        title="${esc(abs ? abs.type + ' (demi-journée)' : '')}" data-action-change="saisirHeure" data-projet="${p.id}" data-jour="${j}"></td>`;
    };
    const lignes = mesProjets.map(p => {
      const total = jours.reduce((s, j) => s + Number(heure(p.id, j) || 0), 0);
      return `<tr><td class="col-projet">${C.code(p.code)} ${esc(p.nom)}</td>${jours.map(j => caseJour(p, j)).join('')}
        <td class="num"><b>${Calculs.nombre(total)} h</b></td></tr>`;
    }).join('');
    const h = Calculs.heuresMois(moi.id, m.annee, m.mois, etat.d.temps);
    const attendu = Calculs.heuresAttenduesMois(moi, m.annee, m.mois, etat.d.absences, fer);

    return `
    <div class="ecran">
      ${entete}
      <div class="carte">
        <div class="defilement-x"><table class="tableau grille-mois"><thead><tr><th class="col-projet">Projet</th>
          ${jours.map(j => { const d = Calculs.depuisIso(j); return `<th${classe(j)}>${Calculs.JOURS_INITIALES[d.getDay()]}<br>${d.getDate()}</th>`; }).join('')}
          <th class="num">Total</th></tr></thead>
          <tbody>${lignes || `<tr><td colspan="${jours.length + 2}">${C.vide('Aucun projet : vous n’êtes affecté(e) à aucun projet (hors rôle Lecteur).')}</td></tr>`}
            <tr class="groupe"><td class="col-projet">Total du jour</td>${h.parJour.map((x, i) => `<td${classe(jours[i])}>${x ? Calculs.nombre(x) : ''}</td>`).join('')}
              <td class="num" style="white-space:nowrap">${Calculs.nombre(h.total)} h</td></tr></tbody></table></div>
        <div class="carte-titre" style="border-top:1px solid var(--bordure-fine);border-bottom:0">
          <span class="ligne-flex">Statut : ${C.badgeFeuille(statut)}
            <b>${Calculs.nombre(h.total)} h</b><span class="discret">sur ${Calculs.nombre(attendu)} h attendues</span>
            ${statut === 'a_completer' && feuille && feuille.commentaire ? `<span style="color:#8A4B00">« ${esc(feuille.commentaire)} »</span>` : ''}
            <span class="discret">JF = jour férié · Abs = absence posée (Congés & capacité) ; une demi-journée reste saisissable.</span></span>
          ${verrouille ? '' : '<button class="btn primaire" data-action="soumettreMois">Soumettre le mois</button>'}
        </div>
      </div>
    </div>`;
  }
};

// Écrit (ou crée) la feuille d'une personne pour un mois (clé = 1er jour du mois, colonne `semaine`)
const ecrireFeuille = (ressourceId, semaine, statut, commentaire = null) =>
  Api.creer('feuilles_temps', { ressourceId, semaine, statut, commentaire }, 'ressource_id,semaine');

Object.assign(Actions, {
  // Saisie d'une case : nombre (virgule acceptée) ; vide = suppression de la saisie
  saisirHeure(d, el) {
    const moi = maRessource(), valeur = el.value.trim().replace(',', '.');
    const filtre = { ressource_id: 'eq.' + moi.id, projet_id: 'eq.' + d.projet, jour: 'eq.' + d.jour };
    if (valeur === '' || Number(valeur) === 0) return executer(() => Api.supprimer('temps_saisis', filtre), 'temps');
    if (isNaN(Number(valeur)) || Number(valeur) < 0 || Number(valeur) > 24) { notifier('Heures invalides (0 à 24)', 'erreur'); return rendre(); }
    executer(() => Api.creer('temps_saisis', { ressourceId: moi.id, projetId: d.projet, jour: d.jour, heures: Number(valeur) }, 'ressource_id,projet_id,jour'), 'temps');
  },
  soumettreMois: () => executer(() => ecrireFeuille(maRessource().id, MoisTemps.cle(), 'soumise'), 'feuilles'),
  validerFeuille: d => executer(() => ecrireFeuille(d.ressource, d.semaine, 'validee'), 'feuilles'),
  renvoyerFeuille(d) {
    const motif = prompt('Motif du renvoi (visible par la personne) :', 'Merci de compléter la semaine');
    if (motif !== null) executer(() => ecrireFeuille(d.ressource, d.semaine, 'a_completer', motif), 'feuilles');
  }
});
