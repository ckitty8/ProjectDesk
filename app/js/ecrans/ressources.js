/* ============================================================
   Général › Gestion des ressources (maquette 03-gRess.png) — lecture
   Calendrier mensuel des absences + annuaire des ressources.
   Le composant Calendrier est partagé avec Mon dashboard › Congés.
   Vues : « Par équipe » (chaque personne une fois, étiquettes de projets,
   synthèse des absents par projet) et « Par projet » (membres d'un projet).
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

  // Vue du calendrier : « equipe » (défaut) ou « projet » (+ projet choisi) ; commune aux deux écrans
  vue: () => ui('calendrier', { mode: 'equipe', projetId: null }),
  // Projets proposés en vue « Par projet » (ceux qui ont des membres) et projet affiché
  projetsAvecMembres: () => etat.d.projets.filter(p => etat.d.affectations.some(a => a.projetId === p.id)),
  projetChoisi() { const liste = this.projetsAvecMembres(); return liste.find(p => p.id === this.vue().projetId) || liste[0] || null; },

  // Sélecteur « Par équipe / Par projet » (+ liste des projets en vue projet)
  selecteurVue() {
    const v = this.vue(), p = this.projetChoisi();
    return `<div class="ligne-flex" style="margin-left:14px"><div class="puces">
        <button class="puce${v.mode === 'equipe' ? ' active' : ''}" data-action="vueCalendrier" data-mode="equipe">Par équipe</button>
        <button class="puce${v.mode === 'projet' ? ' active' : ''}" data-action="vueCalendrier" data-mode="projet">Par projet</button></div>
      ${v.mode === 'projet' ? C.liste(this.projetsAvecMembres().map(x => ({ valeur: x.id, libelle: `${x.code} · ${x.nom}` })), p ? p.id : '',
        'class="champ" style="width:auto;height:30px" data-action-change="projetCalendrier"') : ''}</div>`;
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

    // Projets d'une personne (étiquettes à côté du nom, vue « Par équipe »)
    const projetsDe = r => etat.d.affectations.filter(a => a.ressourceId === r.id).map(a => projet(a.projetId)).filter(Boolean);
    // (au plus 3 étiquettes sur une ligne, puis « +N » ; liste complète en infobulle)
    const etiquettes = r => {
      const liste = projetsDe(r), MAX = 3;
      return liste.slice(0, MAX).map(p => `<span class="etiquette" title="${esc(p.code + ' · ' + p.nom)}">${esc(p.nom)}</span>`).join('')
        + (liste.length > MAX ? `<span class="etiquette" title="${esc(liste.slice(MAX).map(p => p.nom).join(', '))}">+${liste.length - MAX}</span>` : '');
    };

    // Ligne d'une personne (niveau = retrait ; complement = étiquettes, mention « responsable »)
    const lignePersonne = (r, niveau, complement = '') => {
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
      // complément (étiquettes de projets, « responsable ») sur une 2e ligne : la colonne reste étroite
      return `<tr data-personne="${r.id}"><td class="nom"><span class="ligne-flex" style="padding-left:${niveau * 16}px">${C.avatar(r.nom)}
        <span><span>${esc(r.nom)}</span>${complement ? `<span class="nom-complement">${complement}</span>` : ''}</span></span></td>${cases}${editable ? `<td class="num" style="padding:0 10px;white-space:nowrap">${Calculs.nombre(nb)} j</td>` : ''}</tr>`;
    };
    const ligneGroupe = (contenu, niveau, secondaire) => `<tr class="groupe"><td colspan="${jours.length + (editable ? 2 : 1)}">
      <span class="ligne-flex" style="padding-left:${niveau * 16}px;${secondaire ? 'font-weight:500;color:var(--discret)' : ''}">${contenu}</span></td></tr>`;

    // Synthèse d'un projet : absents / membres pour chaque jour ouvré (Calculs.absentsDuJour)
    const membresDe = p => etat.d.affectations.filter(a => a.projetId === p.id).map(a => a.ressourceId).filter(id => ressource(id));
    const ligneSynthese = (p, niveau) => {
      const ids = membresDe(p);
      const cases = jours.map(j => {
        if (!Calculs.estJourOuvre(j, fer)) return '<td class="ferme"></td>';
        const s = Calculs.absentsDuJour(ids, j, etat.d.absences);
        return s.niveau === 'aucun' ? '<td class="synthese-vide">·</td>'
          : `<td class="synthese ${s.niveau}" title="${Calculs.nombre(s.absents)} absent(s) sur ${s.total}">${Calculs.nombre(s.absents)}/${s.total}</td>`;
      }).join('');
      return `<tr class="ligne-synthese"><td class="nom"><span class="ligne-flex" style="padding-left:${niveau * 16}px">${C.icone('projet', 14)}${esc(p.nom)}</span></td>${cases}${editable ? '<td></td>' : ''}</tr>`;
    };

    // Vue « Par équipe » : chaque personne une seule fois sous son unité (responsable en tête),
    // puis la synthèse des absences par projet de l'unité (maquette conges-sans-doublon, pistes 2 et 3).
    const unite = (e, niveau) => {
      const sousEquipes = etat.d.equipes.filter(x => x.parentId === e.id);
      const projets = etat.d.projets.filter(p => p.equipeId === e.id && membresDe(p).length);
      const personnes = etat.d.ressources.filter(r => r.equipeId === e.id)
        .sort((a, b) => (b.id === e.responsableId) - (a.id === e.responsableId));
      const contenu = personnes.map(r => lignePersonne(r, niveau + 1,
          (r.id === e.responsableId ? '<span class="discret" style="font-size:11px">responsable</span>' : '') + etiquettes(r))).join('')
        + sousEquipes.map(x => unite(x, niveau + 1)).join('')
        + (projets.length ? ligneGroupe(`Projets — absents / membres par jour ${C.aide('syntheseProjets')}`, niveau + 1, true) + projets.map(p => ligneSynthese(p, niveau + 1)).join('') : '');
      if (!contenu) return '';
      return ligneGroupe(`${C.icone(e.type === 'direction' ? 'direction' : 'equipe', 14)}${C.pastille(e.couleur)}${esc(e.nom)}`, niveau, false) + contenu;
    };

    // Vue « Par projet » : les membres du projet choisi, une fois chacun, puis sa synthèse
    const vue = this.vue();
    let lignes;
    if (vue.mode === 'projet') {
      const p = this.projetChoisi();
      lignes = p ? ligneGroupe(`${C.icone('projet', 14)}${C.code(p.code)} ${esc(p.nom)} <span class="discret" style="font-weight:400">${membresDe(p).length} membres</span>`, 0, false)
        + membresDe(p).map(id => lignePersonne(ressource(id), 1)).join('') + ligneSynthese(p, 1) : '';
    } else {
      const racines = etat.d.equipes.filter(e => !e.parentId || !parId('equipes', e.parentId));
      lignes = [...racines.filter(e => e.type === 'direction'), ...racines.filter(e => e.type !== 'direction')].map(e => unite(e, 0)).join('');
    }

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
      <div class="carte"><div class="carte-titre"><div class="ligne-flex">${Calendrier.navigation()}${Calendrier.selecteurVue()}</div>${Calendrier.legende()}</div>${Calendrier.rendre(false)}</div>
      <div class="carte"><div class="carte-titre"><h2>Liste des ressources</h2><span class="discret">${etat.d.ressources.length} personnes</span></div>
        <table class="tableau"><thead><tr><th>Nom</th><th>Équipe</th><th>Poste</th><th>Projets</th><th class="num">Capacité</th></tr></thead>
        <tbody>${annuaire || `<tr><td colspan="5">${C.vide('Aucune ressource.')}</td></tr>`}</tbody></table></div>
    </div>`;
  }
};

Object.assign(Actions, {
  vueCalendrier: d => majUi('calendrier', { mode: d.mode }),
  projetCalendrier: (_, el) => majUi('calendrier', { projetId: el.value }),
  moisPrecedent() { const m = Calendrier.moisCourant(); majUi('calendrier', m.mois === 0 ? { annee: m.annee - 1, mois: 11 } : { mois: m.mois - 1 }); },
  moisSuivant() { const m = Calendrier.moisCourant(); majUi('calendrier', m.mois === 11 ? { annee: m.annee + 1, mois: 0 } : { mois: m.mois + 1 }); }
});
