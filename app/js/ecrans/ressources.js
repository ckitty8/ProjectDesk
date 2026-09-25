/* ============================================================
   Général › Gestion des ressources (maquette 03-gRess.png) — lecture
   Calendrier mensuel des absences + annuaire des ressources.
   Le composant Calendrier est partagé avec Mon dashboard › Congés.
   ============================================================ */
'use strict';

const Calendrier = {
  // Mois affiché (commun aux deux écrans calendrier) : { annee, mois (0-11) }
  moisCourant() {
    const j = Calculs.depuisIso(Calculs.aujourdhui());
    return ui('calendrier', { annee: j.getFullYear(), mois: j.getMonth() });
  },

  // Navigation de mois : ‹ octobre 2026 ›
  navigation() {
    const { annee, mois } = this.moisCourant();
    return `<div class="ligne-flex"><button class="btn" data-action="moisPrecedent">‹</button>
      <b style="min-width:130px;text-align:center">${Calculs.libelleMois(annee, mois)}</b>
      <button class="btn" data-action="moisSuivant">›</button></div>`;
  },

  // Tableau personnes × jours ; editable = clic sur une case pour poser/retirer une absence
  rendre(editable) {
    const esc = C.esc, { annee, mois } = this.moisCourant();
    const jours = Calculs.joursDuMois(annee, mois), fer = feries(), aujourd = Calculs.aujourdhui();
    const types = valeursDe('abs', true);
    const absence = {}; etat.d.absences.forEach(a => { absence[a.ressourceId + '|' + a.jour] = a; });

    const entete = jours.map(j => {
      const ferme = !Calculs.estJourOuvre(j, fer), d = Calculs.depuisIso(j);
      return `<th class="${ferme ? 'ferme' : ''} ${j === aujourd ? 'aujourdhui' : ''}">${Calculs.JOURS_INITIALES[d.getDay()]}<br>${d.getDate()}</th>`;
    }).join('');

    // Jour férié (table jours_feries) : affiché par défaut avec le type « Jours férié » (clé 'ferie',
    // couleur et abrégé administrables) ; « F » gris si ce type est désactivé. Non cliquable, non décompté.
    const typeFerie = types.find(x => x.libelle === ABSENCES.FERIE && x.actif);
    const libelleFerie = j => ((etat.d.joursFeries || []).find(x => x.jour === j) || {}).libelle || 'Jour férié';
    const caseFeriee = j => typeFerie
      ? `<span class="case-absence" title="${esc(libelleFerie(j))}" style="color:${typeFerie.couleur};background:${C.teinte(typeFerie.couleur, .16)}">${esc(typeFerie.abrege || 'JF')}</span>`
      : `<span title="${esc(libelleFerie(j))}">F</span>`;

    const lignes = etat.d.equipes.map(e => {
      const personnes = etat.d.ressources.filter(r => r.equipeId === e.id);
      if (!personnes.length) return '';
      return `<tr class="groupe"><td colspan="${jours.length + (editable ? 2 : 1)}"><span class="ligne-flex">${C.pastille(e.couleur)}${esc(e.nom)}</span></td></tr>` +
        personnes.map(r => {
          let nb = 0;
          const cases = jours.map(j => {
            const ferme = !Calculs.estJourOuvre(j, fer);
            if (ferme) return `<td class="ferme">${fer.has(j) ? caseFeriee(j) : ''}</td>`;
            // Absence du jour ; demi-journée (duree 0,5) marquée « ½ » et comptée 0,5
            const a = absence[r.id + '|' + j], t = a && types.find(x => x.libelle === a.type), demi = a && Number(a.duree) === 0.5;
            if (t) nb += demi ? 0.5 : 1;
            const contenu = t ? `<span class="case-absence" title="${esc(t.libelle)}${demi ? ' (demi-journée)' : ''}" style="color:${t.couleur};background:${C.teinte(t.couleur, .16)}">${esc(t.abrege || t.libelle.slice(0, 2))}${demi ? '½' : ''}</span>` : '';
            return editable ? `<td class="cliquable" data-action="basculerAbsence" data-ressource="${r.id}" data-jour="${j}">${contenu}</td>` : `<td>${contenu}</td>`;
          }).join('');
          return `<tr><td class="nom"><span class="ligne-flex">${C.avatar(r.nom)}${esc(r.nom)}</span></td>${cases}${editable ? `<td class="num" style="padding:0 10px">${Calculs.nombre(nb)} j</td>` : ''}</tr>`;
        }).join('');
    }).join('');

    return `<div class="calendrier"><table><thead><tr><th class="nom">Personne</th>${entete}${editable ? '<th>Total</th>' : ''}</tr></thead>
      <tbody>${lignes || `<tr><td class="nom" colspan="${jours.length + 1}">${C.vide('Aucune ressource.')}</td></tr>`}</tbody></table></div>`;
  },

  legende() {
    return `<div class="ligne-flex discret" style="gap:14px">${valeursDe('abs').map(t =>
      `<span class="ligne-flex"><span class="pastille" style="background:${C.teinte(t.couleur, .2)};border:1px solid ${t.couleur}"></span>${C.esc(t.libelle)}</span>`).join('')}
      <span class="ligne-flex"><span class="pastille" style="background:#F1F3F7;border:1px solid #D5DAE3"></span>Férié / week-end</span></div>`;
  }
};

Ecrans.ressources = {
  titre: 'Gestion des ressources',
  section: 'general',
  rendre() {
    const esc = C.esc;
    const annuaire = etat.d.ressources.map(r => {
      const eq = equipe(r.equipeId);
      const codes = etat.d.affectations.filter(a => a.ressourceId === r.id).map(a => projet(a.projetId)).filter(Boolean).map(p => C.code(p.code)).join(' ');
      return `<tr><td><span class="ligne-flex">${C.avatar(r.nom)}${esc(r.nom)}</span></td><td><span class="ligne-flex">${C.pastille(eq.couleur)}${esc(eq.nom)}</span></td>
        <td>${esc(r.poste || '—')}</td><td>${codes || '<span class="pale">—</span>'}</td><td class="num">${r.capacite} %</td></tr>`;
    }).join('');
    return `
    <div class="ecran">
      ${C.entete('Gestion des ressources', 'Calendrier des absences et annuaire des ressources · lecture seule')}
      <div class="carte"><div class="carte-titre">${Calendrier.navigation()}${Calendrier.legende()}</div>${Calendrier.rendre(false)}</div>
      <div class="carte"><div class="carte-titre"><h2>Liste des ressources</h2><span class="discret">${etat.d.ressources.length} personnes</span></div>
        <table class="tableau"><thead><tr><th>Nom</th><th>Équipe</th><th>Poste</th><th>Projets</th><th class="num">Capacité</th></tr></thead>
        <tbody>${annuaire || `<tr><td colspan="5">${C.vide('Aucune ressource.')}</td></tr>`}</tbody></table></div>
    </div>`;
  }
};

Object.assign(Actions, {
  moisPrecedent() { const m = Calendrier.moisCourant(); majUi('calendrier', m.mois === 0 ? { annee: m.annee - 1, mois: 11 } : { mois: m.mois - 1 }); },
  moisSuivant() { const m = Calendrier.moisCourant(); majUi('calendrier', m.mois === 11 ? { annee: m.annee + 1, mois: 0 } : { mois: m.mois + 1 }); }
});
