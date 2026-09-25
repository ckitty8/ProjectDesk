/* ============================================================
   Mon dashboard › Mon timesheet (maquette complements/mon-timesheet.png)
   - Saisie de ses heures par projet et par jour, puis « Soumettre ».
   - Responsable d'équipe (owner/admin) : feuilles soumises à valider
     ou à renvoyer. Les droits sont contrôlés en base (trigger).
   ============================================================ */
'use strict';

Ecrans.monTimesheet = {
  titre: 'Mon timesheet',
  section: 'moi',
  rendre() {
    const esc = C.esc, moi = maRessource(), lundi = Semaine.lundi(), fer = feries();
    const entete = C.entete('Mon timesheet', 'Saisissez vos heures par projet, puis soumettez la semaine à votre chef d’équipe', Semaine.navigation());
    if (!moi) return `<div class="ecran">${entete}<div class="carte" style="padding:16px">Votre compte n’est lié à aucune fiche ressource :
      demandez à votre équipe de créer votre fiche avec votre email (Liste des ressources).</div>${this.aValider()}</div>`;

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
      ${this.aValider()}
    </div>`;
  },

  // Feuilles soumises des équipes dont je suis responsable
  aValider() {
    const esc = C.esc;
    const equipesResp = mesEquipes().filter(e => estResponsableDe(e.id));
    if (!equipesResp.length) return '';
    return equipesResp.map(e => {
      const ids = new Set(etat.d.ressources.filter(r => r.equipeId === e.id).map(r => r.id));
      const soumises = etat.d.feuilles.filter(f => ids.has(f.ressourceId) && f.statut === 'soumise');
      const lignes = soumises.map(f => {
        const r = ressource(f.ressourceId), total = Calculs.heuresSemaine(r.id, f.semaine, etat.d.temps).total;
        return `<tr><td>${esc(r.nom)}</td><td>S${Calculs.numeroSemaine(f.semaine)} · ${Calculs.formatCourt(f.semaine)}</td><td class="num">${Calculs.nombre(total)} h</td>
          <td>${C.badgeFeuille(f.statut)}</td><td class="num"><button class="btn petit" data-action="renvoyerFeuille" data-ressource="${r.id}" data-semaine="${f.semaine}">Renvoyer</button>
          <button class="btn petit succes" data-action="validerFeuille" data-ressource="${r.id}" data-semaine="${f.semaine}">Valider</button></td></tr>`;
      }).join('');
      return `<div class="carte"><div class="carte-titre"><h2>À valider — équipe ${esc(e.nom)}</h2><span class="discret">visible par le chef d’équipe (owner/admin)</span></div>
        <table class="tableau"><thead><tr><th>Personne</th><th>Semaine</th><th class="num">Heures</th><th>Statut</th><th></th></tr></thead>
        <tbody>${lignes || `<tr><td colspan="5">${C.vide('Aucune feuille en attente de validation.')}</td></tr>`}</tbody></table></div>`;
    }).join('');
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
