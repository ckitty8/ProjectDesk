/* ============================================================
   Mon dashboard › Mon timesheet › Mon historique
   (maquette docs/maquettes/mon-timesheet-historique/)
   - Bilan d'un mois : heures saisies, attendues, semaines validées.
   - Détail par semaine (statut de la feuille, lien vers la saisie)
     et répartition par projet. Lecture seule : la saisie se fait
     dans « Saisir mes heures ».
   - Calculs : Calculs.bilanTempsMois (aucun calcul dans la vue).
   ============================================================ */
'use strict';

Ecrans.mesTemps = {
  titre: 'Mon historique',
  section: 'moi',

  // Mois affiché (mois courant par défaut)
  mois() {
    const d = Calculs.depuisIso(Calculs.aujourdhui());
    return ui('mesTemps', { annee: d.getFullYear(), mois: d.getMonth() });
  },

  navigation(m) {
    return `<div class="ligne-flex"><button class="btn" data-action="moisTempsPrecedent">‹</button>
      <b>${Calculs.libelleMois(m.annee, m.mois)}</b>
      <button class="btn" data-action="moisTempsSuivant">›</button></div>`;
  },

  rendre() {
    const esc = C.esc, moi = maRessource(), m = this.mois();
    const entete = C.entete('Mon historique', 'Vos heures saisies sur le mois, par semaine et par projet', this.navigation(m));
    if (!moi) return `<div class="ecran">${entete}<div class="carte" style="padding:16px">Votre compte n’est lié à aucune fiche ressource :
      renseignez votre email sur votre fiche (Liste des ressources), puis reconnectez-vous.</div></div>`;

    const b = Calculs.bilanTempsMois(moi, m.annee, m.mois, etat.d.temps, etat.d.absences, feries(), etat.d.feuilles);
    const validees = b.semaines.filter(s => s.statut === 'validee').length;
    const taux = b.attendu ? b.saisi / b.attendu * 100 : 0;

    const lignesSemaines = b.semaines.map(s => `<tr>
        <td>S${Calculs.numeroSemaine(s.lundi)} · ${Calculs.formatCourt(s.lundi)} – ${Calculs.formatCourt(Calculs.ajouterJours(s.lundi, 4))}</td>
        <td class="num">${Calculs.nombre(s.saisi)} h</td><td class="num discret">${Calculs.nombre(s.attendu)} h</td>
        <td>${C.badgeFeuille(s.statut)}</td>
        <td class="num"><button class="btn petit" data-action="ouvrirSemaineTemps" data-semaine="${s.lundi}">Ouvrir la saisie</button></td></tr>`).join('');

    const lignesProjets = b.projets.map(x => {
      const p = projet(x.projetId) || { code: '?', nom: 'Projet supprimé' };
      const part = b.saisi ? x.heures / b.saisi * 100 : 0;
      return `<tr><td>${C.code(p.code)} ${esc(p.nom)}</td><td class="num">${Calculs.nombre(x.heures)} h</td>
        <td class="num">${Calculs.nombre(x.heures / CONFIG.HEURES_PAR_JOUR)} j</td>
        <td style="width:30%">${C.barre(part)}</td><td class="num">${Calculs.pourcent(part)}</td></tr>`;
    }).join('');

    return `
    <div class="ecran">
      ${entete}
      <div class="grille-kpi">
        ${C.kpi('Heures saisies', Calculs.nombre(b.saisi), ' h')}
        ${C.kpi('Heures attendues', Calculs.nombre(b.attendu), ' h', 'heuresAttendues')}
        ${C.kpi('Remplissage', Calculs.pourcent(taux))}
        ${C.kpi('Semaines validées', validees, ' / ' + b.semaines.length)}
      </div>
      <div class="carte"><div class="carte-titre"><h2>Par semaine</h2></div>
        <table class="tableau"><thead><tr><th>Semaine</th><th class="num">Saisi</th><th class="num">Attendu</th><th>Statut</th><th></th></tr></thead>
        <tbody>${lignesSemaines}</tbody></table></div>
      <div class="carte"><div class="carte-titre"><h2>Par projet</h2></div>
        <table class="tableau"><thead><tr><th>Projet</th><th class="num">Heures</th><th class="num">Jours</th><th>Part du mois</th><th class="num">%</th></tr></thead>
        <tbody>${lignesProjets || `<tr><td colspan="5">${C.vide('Aucune heure saisie sur ce mois.')}</td></tr>`}</tbody></table></div>
    </div>`;
  }
};

Object.assign(Actions, {
  moisTempsPrecedent() { const m = Ecrans.mesTemps.mois(); majUi('mesTemps', m.mois === 0 ? { annee: m.annee - 1, mois: 11 } : { mois: m.mois - 1 }); },
  moisTempsSuivant() { const m = Ecrans.mesTemps.mois(); majUi('mesTemps', m.mois === 11 ? { annee: m.annee + 1, mois: 0 } : { mois: m.mois + 1 }); },
  // Ouvre la semaine choisie dans l'écran de saisie
  ouvrirSemaineTemps(d) { majUi('semaine', { lundi: d.semaine }); allerA('monTimesheet'); }
});
