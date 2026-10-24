/* ============================================================
   Suivi de mes équipes › Timesheet (maquette 05-gTime.png ; suivi des équipes : docs/maquettes/menus-general/)
   Heures déclarées par personne sur un mois, toutes équipes ; validation des feuilles par les
   responsables d'équipe (seule écriture de la section « Suivi de mes équipes », voir Ecrans.timesheet).
   (La saisie se fait dans Mon dashboard › Saisir mes heures.)
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

/* Tableau des feuilles d'un mois, groupé par équipe (Suivi de mes équipes › Timesheet) : par personne, ses projets, heures
   saisies / attendues, complétude, statut. « avecValidation » ajoute la colonne
   Valider / Renvoyer pour les feuilles soumises des équipes dont je suis responsable.
   Renvoie le HTML et les totaux du mois (pour les indicateurs). */
function tableauFeuilles(equipes, avecValidation = false) {
  const esc = C.esc, fer = feries(), m = MoisTemps.courant(), cle = MoisTemps.cle();
  const joursDuMois = Calculs.joursDuMois(m.annee, m.mois);
  const totaux = { saisi: 0, attendu: 0, aCompleter: 0, aValider: 0 };
  const nbColonnes = avecValidation ? 7 : 6;

  // Ligne d'une personne : ses projets, saisi / attendu du mois, complétude, statut, actions
  const lignePersonne = (r, e) => {
    const saisi = Calculs.heuresMois(r.id, m.annee, m.mois, etat.d.temps).total;
    const attendu = Calculs.heuresAttenduesMois(r, m.annee, m.mois, etat.d.absences, fer);
    const completude = attendu ? saisi / attendu * 100 : 0;
    const statut = MoisTemps.statut(r.id, cle);
    totaux.saisi += saisi; totaux.attendu += attendu;
    if (statut !== 'validee' && saisi < attendu) totaux.aCompleter++;
    if (statut === 'soumise' && peutValiderEquipe(e.id)) totaux.aValider++;   // feuilles que JE peux valider

    const projets = nomsProjetsDe(r.id);
    const boutons = statut === 'soumise' && peutValiderEquipe(e.id)
      ? `<button class="btn petit" data-action="renvoyerFeuille" data-ressource="${r.id}" data-semaine="${cle}">Renvoyer</button>
         <button class="btn petit succes" data-action="validerFeuille" data-ressource="${r.id}" data-semaine="${cle}">Valider</button>` : '';
    return `<tr><td><span class="ligne-flex">${C.avatar(r.nom)}${esc(r.nom)}</span></td><td>${projets}</td>
      <td class="num"><b>${Calculs.nombre(saisi)} h</b> <span class="discret">/ ${Calculs.nombre(attendu)} h</span></td>
      <td style="width:18%">${C.barre(Math.min(100, completude))}</td>
      <td class="num">${attendu ? Calculs.pourcent(completude) : '—'}</td><td>${C.badgeFeuille(statut)}</td>
      ${avecValidation ? `<td class="num sans-retour">${boutons}</td>` : ''}</tr>`;
  };

  // Par équipe : les personnes présentes au moins un jour du mois (arrivée / date de fin)
  const lignes = equipes.map(e => {
    const personnes = ressourcesPresentes(joursDuMois[0], joursDuMois[joursDuMois.length - 1]).filter(r => r.equipeId === e.id);
    if (!personnes.length) return '';
    return `<tr class="groupe"><td colspan="${nbColonnes}"><span class="ligne-flex">${C.pastille(e.couleur)}${esc(e.nom)}</span></td></tr>`
      + personnes.map(r => lignePersonne(r, e)).join('');
  }).join('');

  const html = `<div class="carte"><table class="tableau"><thead><tr><th>Personne</th><th>Projets</th>
    <th class="num">Saisi / attendu</th><th>Complétude</th><th class="num">%</th><th>Statut</th>${avecValidation ? '<th></th>' : ''}</tr></thead>
    <tbody>${lignes || `<tr><td colspan="${nbColonnes}">${C.vide('Aucune ressource.')}</td></tr>`}</tbody></table></div>`;
  return { html, ...totaux };
}

/* Suivi de mes équipes › Timesheet est aussi l'écran de suivi des équipes (porteur, 2026-10-12 : « Suivi de mes
   équipes » retiré de Mon timesheet). Seule exception à la lecture seule de la section : le responsable
   d'une équipe y valide ou renvoie les feuilles soumises de SES équipes (boutons, contrôle en base). */
Ecrans.timesheet = {
  titre: 'Timesheet',
  section: 'general',
  rendre() {
    const valide = mesEquipes().some(e => peutValiderEquipe(e.id));
    const t = tableauFeuilles(etat.d.equipes, valide);
    const completude = t.attendu ? t.saisi / t.attendu * 100 : 0;
    return `
    <div class="ecran">
      ${C.entete('Timesheet', `Heures déclarées par personne sur le mois · toutes équipes${valide ? ' · validation des feuilles de vos équipes' : ''}`,
        MoisTemps.navigation())}
      <div class="grille-kpi ${valide ? 'q4' : 'q3'}">${C.kpi('Heures saisies', Calculs.nombre(t.saisi) + ' h', `sur ${Calculs.nombre(t.attendu)} h attendues`)}
        ${C.kpi('Taux de complétude', Calculs.pourcent(completude), '', 'completude')}${C.kpi('Feuilles à compléter', t.aCompleter)}
        ${valide ? C.kpi('Feuilles à valider', t.aValider, '', 'aValider') : ''}</div>
      ${t.html}
    </div>`;
  }
};

Object.assign(Actions, {
  moisTempsPrecedent() { const m = MoisTemps.courant(); majUi('moisTemps', m.mois === 0 ? { annee: m.annee - 1, mois: 11 } : { mois: m.mois - 1 }); },
  moisTempsSuivant() { const m = MoisTemps.courant(); majUi('moisTemps', m.mois === 11 ? { annee: m.annee + 1, mois: 0 } : { mois: m.mois + 1 }); }
});
