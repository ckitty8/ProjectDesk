/* ============================================================
   Mon dashboard › Mon timesheet › Saisir mes heures
   (maquette complements/mon-timesheet.png)
   - Saisie de ses heures par jour sur les projets où l'on est affecté
     (hors rôle Lecteur), puis « Soumettre ».
   - Les actions Valider / Renvoyer (responsable d'équipe) servent à
     l'écran Suivi de mes équipes. Droits contrôlés en base (trigger).
   ============================================================ */
'use strict';

Ecrans.monTimesheet = {
  titre: 'Saisir mes heures',
  section: 'moi',
  rendre() {
    const esc = C.esc, moi = maRessource(), lundi = Semaine.lundi(), fer = feries();
    const entete = C.entete('Saisir mes heures', 'Votre temps sur les projets où vous êtes affecté(e), puis soumettez la semaine à votre chef d’équipe', Semaine.navigation());
    if (!moi) return `<div class="ecran">${entete}<div class="carte" style="padding:16px">Votre compte n’est lié à aucune fiche ressource :
      renseignez l’email de votre compte sur votre fiche (Liste des ressources), puis reconnectez-vous.</div></div>`;

    const jours = Calculs.joursOuvresSemaine(lundi), statut = Semaine.statut(moi.id, lundi);
    const verrouille = ['soumise', 'validee'].includes(statut);
    const feuille = etat.d.feuilles.find(f => f.ressourceId === moi.id && f.semaine === lundi);
    // Projets proposés : mes affectations + projets déjà saisis cette semaine
    const ids = new Set(etat.d.affectations.filter(a => a.ressourceId === moi.id && a.role !== ROLES_PROJET.LECTEUR).map(a => a.projetId));
    etat.d.temps.filter(t => t.ressourceId === moi.id && jours.includes(t.jour)).forEach(t => ids.add(t.projetId));
    const mesProjets = [...ids].map(projet).filter(Boolean);
    const heure = (pId, j) => (etat.d.temps.find(t => t.ressourceId === moi.id && t.projetId === pId && t.jour === j) || {}).heures;
    const absence = j => etat.d.absences.find(a => a.ressourceId === moi.id && a.jour === j);

    const lignes = mesProjets.map(p => {
      let total = 0;
      const cases = jours.map(j => {
        const abs = absence(j);
        if (abs) return `<td class="num">${C.badge(abs.type, couleurDe('abs', abs.type))}</td>`;
        if (fer.has(j)) return `<td class="num pale">Férié</td>`;
        const h = heure(p.id, j); total += Number(h || 0);
        return `<td class="num"><input class="saisie-heure" inputmode="decimal" value="${h ? Calculs.nombre(h) : ''}" ${verrouille ? 'disabled' : ''}
          data-action-change="saisirHeure" data-projet="${p.id}" data-jour="${j}"></td>`;
      }).join('');
      return `<tr><td>${C.code(p.code)} ${esc(p.nom)}</td>${cases}<td class="num"><b>${Calculs.nombre(total)} h</b></td></tr>`;
    }).join('');
    const h = Calculs.heuresSemaine(moi.id, lundi, etat.d.temps);
    const attendu = Calculs.heuresAttendues(moi, lundi, etat.d.absences, fer);

    return `
    <div class="ecran">
      ${entete}
      <div class="carte">
        <table class="tableau"><thead><tr><th style="width:34%">Projet</th>
          ${jours.map(j => { const d = Calculs.depuisIso(j); return `<th class="num">${['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'][d.getDay()]} ${d.getDate()}</th>`; }).join('')}
          <th class="num">Total</th></tr></thead>
          <tbody>${lignes || `<tr><td colspan="7">${C.vide('Aucun projet : vous n’êtes affecté(e) à aucun projet (hors rôle Lecteur).')}</td></tr>`}
            <tr class="groupe"><td>Total du jour</td>${h.parJour.map(x => `<td class="num">${x ? Calculs.nombre(x) + ' h' : '—'}</td>`).join('')}
              <td class="num">${Calculs.nombre(h.total)} h <span class="discret" style="font-weight:400">/ ${Calculs.nombre(attendu)} h</span></td></tr></tbody></table>
        <div class="carte-titre" style="border-top:1px solid var(--bordure-fine);border-bottom:0">
          <span class="ligne-flex">Statut : ${C.badgeFeuille(statut)}
            ${statut === 'a_completer' && feuille && feuille.commentaire ? `<span style="color:#8A4B00">« ${esc(feuille.commentaire)} »</span>` : ''}
            <span class="discret">Les projets proposés sont ceux où vous êtes affecté(e). Les absences posées sont reprises automatiquement.</span></span>
          ${verrouille ? '' : '<button class="btn primaire" data-action="soumettreSemaine">Soumettre la semaine</button>'}
        </div>
      </div>
    </div>`;
  }
};

// Écrit (ou crée) la feuille d'une personne pour une semaine
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
  soumettreSemaine: () => executer(() => ecrireFeuille(maRessource().id, Semaine.lundi(), 'soumise'), 'feuilles'),
  validerFeuille: d => executer(() => ecrireFeuille(d.ressource, d.semaine, 'validee'), 'feuilles'),
  renvoyerFeuille(d) {
    const motif = prompt('Motif du renvoi (visible par la personne) :', 'Merci de compléter la semaine');
    if (motif !== null) executer(() => ecrireFeuille(d.ressource, d.semaine, 'a_completer', motif), 'feuilles');
  }
});
