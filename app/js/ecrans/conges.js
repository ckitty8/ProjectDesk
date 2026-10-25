/* ============================================================
   Mon dashboard › Gestion des ressources › Congés
   (maquette 08-mCong.png ; blocs répartis en onglets à la demande du
   porteur, 2026-09-25)
   Onglets :
   - Grille mensuelle : choisir un type d'absence (« pinceau ») puis
     cliquer sur les jours pour l'appliquer ou le retirer ;
   - Récap annuel : jours travaillés / congés par mois et leurs totaux, par équipe et par année
     (maquette recap-jours-travailles ; l'objectif de jours du client et le reste à prendre sont retirés, porteur 2026-10-25).
   Modifiable : sa propre ligne et celles de ses équipes (règle RLS).
   ============================================================ */
'use strict';

Ecrans.conges = {
  titre: 'Gestion des ressources · Congés',
  section: 'moi',
  pinceau: () => ui('conges', { pinceau: ABSENCES.CP }).pinceau,

  /* ---------- Onglet Récap annuel : jours travaillés et congés ----------
     Reprise de l'onglet « Jours de congés » du fichier du porteur (maquette
     recap-jours-travailles). Calculs : Calculs.recapJoursTravailles. */
  recap(annee) {
    const esc = C.esc, fer = feries(), n = Calculs.nombre;
    const MOIS = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
    const ouvres = MOIS.map((_, m) => Calculs.joursDuMois(annee, m).filter(j => !Calculs.estWeekend(j)).length);

    // Ligne d'une personne : 12 mois (jours travaillés, congés) et totaux
    const lignePersonne = (r, niveau) => {
      // Arrivée / départ dans l'année : mention sous le nom ; mois hors présence affichés « — »
      const rc = Calculs.recapJoursTravailles(r.id, annee, etat.d.absences, fer, r);
      const dansAnnee = d => d && d.startsWith(String(annee));
      const mentions = [dansAnnee(r.dateArrivee) ? 'arrivée le ' + Calculs.formatCourt(r.dateArrivee) : '',
        dansAnnee(r.dateDepart) ? 'départ le ' + Calculs.formatCourt(r.dateDepart) : '']
        .filter(Boolean).map(t => `<span class="discret texte-11">${t}</span>`).join('');
      return { rc, html: `<tr><td class="nom"><span class="ligne-flex" style="padding-left:${niveau * 16}px">${C.avatar(r.nom)}${esc(r.nom)}${mentions}</span></td>
        ${rc.mois.map(m => m.ouvres ? `<td>${n(m.travailles)}</td>
          <td class="conge">${m.conges ? n(m.conges) : '·'}</td>` : '<td class="pale">—</td><td class="conge pale">—</td>').join('')}
        <td class="tot">${n(rc.travailles)}</td><td class="tot conge">${n(rc.conges)}</td></tr>` };
    };
    // Unité : ligne de groupe, ses personnes, son total
    const unite = (e, niveau) => {
      const personnes = ressourcesPresentes(`${annee}-01-01`, `${annee}-12-31`).filter(r => r.equipeId === e.id).map(r => lignePersonne(r, niveau + 1));
      const sous = etat.d.equipes.filter(x => x.parentId === e.id).map(x => unite(x, niveau + 1)).join('');
      if (!personnes.length && !sous) return '';
      const somme = f => personnes.reduce((s, p) => s + f(p.rc), 0);
      const total = personnes.length ? `<tr class="total"><td class="nom" style="padding-left:${(niveau + 1) * 16 + 12}px">Total ${esc(e.nom)}</td>
        ${MOIS.map((_, m) => `<td>${n(somme(rc => rc.mois[m].travailles))}</td><td class="conge">${n(somme(rc => rc.mois[m].conges))}</td>`).join('')}
        <td class="tot">${n(somme(rc => rc.travailles))}</td><td class="tot conge">${n(somme(rc => rc.conges))}</td></tr>` : '';
      return `<tr class="groupe"><td colspan="${MOIS.length * 2 + 3}"><span class="ligne-flex" style="padding-left:${niveau * 16}px">
          ${C.icone(e.type === 'direction' ? 'direction' : 'equipe', 14)}${C.pastille(e.couleur)}${esc(e.nom)}</span></td></tr>`
        + personnes.map(p => p.html).join('') + total + sous;
    };
    const lignes = unitesRacines().map(e => unite(e, 0)).join('');

    return `<div class="carte"><div class="carte-titre"><div class="ligne-flex">
        <button class="btn" data-action="calendrierAujourdhui">Aujourd’hui</button>
        <button class="btn" data-action="anneePrecedente">‹</button><b style="min-width:60px;text-align:center">${annee}</b>
          <button class="btn" data-action="anneeSuivante">›</button>
        <h2 style="margin-left:14px">Jours travaillés et congés ${C.aide('recapTravail')}</h2></div></div>
      <div class="defilement"><table class="recap-travail">
        <thead><tr><th class="nom" rowspan="2">Personne</th>${MOIS.map(m => `<th colspan="2">${m}</th>`).join('')}
          <th rowspan="2">Total<br>travaillé</th><th rowspan="2">Total<br>congés</th></tr>
          <tr>${MOIS.map(() => '<th>T</th><th class="conge">C</th>').join('')}</tr>
          <tr><td class="nom discret">Jours de semaine du mois</td>${ouvres.map(v => `<td colspan="2" class="discret">${v}</td>`).join('')}
            <td class="discret">${ouvres.reduce((a, b) => a + b, 0)}</td><td></td></tr></thead>
        <tbody>${lignes || `<tr><td colspan="${MOIS.length * 2 + 3}">${C.vide('Aucune ressource.')}</td></tr>`}</tbody></table></div></div>`;
  },
  // Onglets selon leur droit (matrice, migration 038)
  onglets: annee => ongletsPermis('conges', [
    { id: 'grille', libelle: 'Grille mensuelle' },
    { id: 'recap', libelle: `Récap annuel ${annee}` }
  ]),

  rendre() {
    const esc = C.esc, pinceau = this.pinceau(), annee = Calendrier.moisCourant().annee;
    const pinceaux = [...valeursDe('abs').map(t => ({ id: t.libelle, libelle: t.libelle, couleur: t.couleur })), { id: 'effacer', libelle: 'Effacer', couleur: COULEURS.effacer }]
      .map(p => `<button class="puce${p.id === pinceau ? ' active' : ''}" data-action="choisirPinceau" data-id="${esc(p.id)}">
        <span class="pastille" style="background:${C.teinte(p.couleur, .2)};border:1px solid ${p.couleur}"></span>${esc(p.libelle)}</button>`).join('');

    // Contenu de chaque onglet
    const liste = this.onglets(annee), onglet = ongletAffiche(liste, ui('conges', { onglet: 'grille' }).onglet);
    if (!onglet) return `<div class="ecran">${C.entete('Congés', '')}${C.aucunOnglet()}</div>`;
    // Sélecteur de mois juste au-dessus du calendrier, à gauche (demande du porteur)
    const grille = `<div class="carte"><div class="carte-titre"><div class="ligne-flex">${Calendrier.navigation()}${Calendrier.selecteurVue()}</div>
      <div class="puces">${pinceaux}${C.aide('pinceau')}</div></div>${Calendrier.rendre(true)}</div>`;
    const recapAnnuel = this.recap(annee);
    const onglets = C.onglets(liste, onglet, 'ongletConges');

    return `
    <div class="ecran">
      ${C.entete('Congés', onglet === 'grille'
        ? 'Choisissez un type d’absence puis cliquez sur les jours pour l’appliquer ou le retirer' : 'Absences et récapitulatif annuel')}
      ${onglets}
      ${{ grille, recap: recapAnnuel }[onglet] || grille}
    </div>`;
  }
};

Object.assign(Actions, {
  ongletConges: d => majUi('conges', { onglet: d.id }),
  anneePrecedente: () => majUi('calendrier', { annee: Calendrier.moisCourant().annee - 1 }),
  anneeSuivante: () => majUi('calendrier', { annee: Calendrier.moisCourant().annee + 1 }),
  choisirPinceau: d => majUi('conges', { pinceau: d.id }),

  // Clic sur un jour : applique le type choisi, ou retire l'absence si c'est le même type (ou « Effacer »)
  basculerAbsence(d) {
    const pinceau = Ecrans.conges.pinceau();
    // (un clic pose toujours une journée entière ; les demi-journées viennent de l'import du planning)
    const existante = absenceDe(d.ressource, d.jour);
    const filtre = { ressource_id: 'eq.' + d.ressource, jour: 'eq.' + d.jour };
    if (pinceau === 'effacer' || (existante && existante.type === pinceau)) {
      if (existante) executer(() => Api.supprimer('absences', filtre), 'absences');
    } else {
      executer(() => Api.creer('absences', { ressourceId: d.ressource, jour: d.jour, type: pinceau, duree: 1 }, 'ressource_id,jour'), 'absences');
    }
  }
});
