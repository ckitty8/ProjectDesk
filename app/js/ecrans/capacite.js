/* ============================================================
   Mon dashboard › Congés & capacité › onglet Capacité
   (maquette docs/maquettes/capacite-saisie/)
   Pour un projet (CDO par défaut) et un sprint (le sprint en cours par défaut) :
   - indicateurs : disponible, engageable (Scrum), vélocité, prévision ;
   - capacité des membres (calculée : congés, fériés, arrivées et départs) ;
   - vélocité : points engagés / terminés SAISIS par sprint ;
   - répartition du sprint : idéal (REPARTITION_SPRINT) et jours réels SAISIS par catégorie.
   Calculs : Calculs.capacitePeriode, capaciteScrum, velocite, repartitionSprint.
   Saisies : tables sprints_projet et repartitions_sprint (etat.d.sprintsProjet, repartitionsSprint).
   ============================================================ */
'use strict';

const Capacite = {
  /* Projet et sprint affichés (choix mémorisé dans ui('capacite')) */
  projetChoisi() {
    const projets = Calendrier.projetsAvecMembres();
    return parId('projets', ui('capacite', {}).projetId) || projets.find(p => p.nom === 'CDO') || projets[0] || null;
  },
  /* Sprints du projet : saisis par le porteur dans Administration › Sprints (version, début, fin ;
     table sprints_projet, migration 014). Sprint affiché : celui choisi par les flèches ‹ ›,
     sinon le sprint en cours, sinon le dernier commencé, sinon le premier. */
  sprintChoisi(sprints) {
    const choisi = sprints.find(s => s.numero === ui('capacite', {}).numero);
    if (choisi) return choisi;
    const jour = Calculs.aujourdhui();
    return sprints.find(s => s.debut <= jour && jour <= s.fin) || [...sprints].reverse().find(s => s.debut <= jour) || sprints[0];
  },
  // Saisies d'un projet pour un sprint (lignes vides si rien n'est encore saisi)
  saisieSprint: (projetId, numero) => (etat.d.sprintsProjet || []).find(s => s.projetId === projetId && s.numero === numero) || {},
  joursReels: (projetId, numero, categorie) => {
    const r = (etat.d.repartitionsSprint || []).find(x => x.projetId === projetId && x.numero === numero && x.categorie === categorie);
    return r ? Number(r.jours) : null;
  },

  /* Données du sprint affiché, calculées une fois pour toutes les cartes :
     - membresSprint : membres présents sur le sprint (arrivée / départ) ; capSprint, scrum : leur capacité ;
     - precedents : sprints précédents (l'historique de vélocité garde tous les membres, capacité proratisée) ;
     - v : vélocité moyenne et prévision, si des points terminés sont saisis. */
  donnees(p, sprints) {
    const fer = feries(), sprint = this.sprintChoisi(sprints), rang = sprints.indexOf(sprint);
    const membres = etat.d.affectations.filter(a => a.projetId === p.id).map(a => ressource(a.ressourceId)).filter(Boolean);
    const cap = (pers, s) => Calculs.capacitePeriode(pers, s.debut, s.fin, etat.d.absences, fer);
    const membresSprint = membres.filter(r => Calculs.estPresentSur(r, sprint.debut, sprint.fin));
    const capSprint = cap(membresSprint, sprint);
    const precedents = sprints.slice(Math.max(0, rang - CONFIG.SPRINTS_MOYENNE_VELOCITE), rang)
      .map(s => ({ s, capacite: cap(membres, s).disponible, ...s }));
    const historique = precedents.filter(h => h.pointsTermines != null).map(h => ({ points: Number(h.pointsTermines), capacite: h.capacite }));
    return {
      p, sprints, sprint, rang, cap, membresSprint, capSprint, precedents, historique, modifiable: peutEditerProjet(p),
      scrum: Calculs.capaciteScrum(membresSprint, capSprint.disponible),
      v: historique.length ? Calculs.velocite(historique, capSprint.disponible) : null
    };
  },

  // Boutons communs : réglage des sprints du projet et méthode de calcul
  boutons(p) {
    return `<button class="btn" data-action="allerSprints" data-id="${p.id}"
      title="Saisir les sprints (version, début, fin) dans Administration › Sprints">Sprints du projet</button>
      <button class="btn" data-action="ouvrirMethodeCapacite">Méthode de calcul Scrum</button>`;
  },
  // Choix du projet (projets qui ont des membres)
  selecteurProjet(p) {
    return C.liste(Calendrier.projetsAvecMembres().map(x => ({ valeur: x.id, libelle: `${x.code} · ${x.nom}` })), p.id,
      'class="champ champ-compact" data-action-change="projetCapaciteSaisie"');
  },

  // Bandeau du haut : choix du projet (+ navigation entre sprints s'il y en a), boutons à droite
  bandeau(p, navigation = '') {
    return `<div class="carte encart-compact"><div class="ligne-flex entre">
      <div class="ligne-flex"><span class="discret">Projet</span>${this.selecteurProjet(p)}${navigation}</div>
      <div class="ligne-flex">${this.boutons(p)}</div></div></div>`;
  },

  // Navigation entre les sprints du projet : « Aujourd'hui », ‹ sprint affiché (dates) ›
  navigationSprints(d) {
    const { sprints, sprint, rang } = d, jour = Calculs.aujourdhui();
    const enCours = sprint.debut <= jour && jour <= sprint.fin;
    return `
        <button class="btn" data-action="capaciteAujourdhui" title="Sprint en cours">Aujourd’hui</button>
        <button class="btn" data-action="sprintCapacite" data-numero="${(sprints[rang - 1] || sprint).numero}" ${rang ? '' : 'disabled'}>‹</button>
        <b style="min-width:230px;text-align:center">${C.esc(nomSprint(sprint))}${enCours ? ' · en cours' : ''}
          <span class="discret poids-normal">${Calculs.formatCourt(sprint.debut)} – ${Calculs.formatCourt(sprint.fin)}</span></b>
        <button class="btn" data-action="sprintCapacite" data-numero="${(sprints[rang + 1] || sprint).numero}"
          ${rang < sprints.length - 1 ? '' : 'disabled'}>›</button>`;
  },

  // Indicateurs : disponible, engageable, vélocité moyenne, prévision
  indicateurs(d) {
    const n = Calculs.nombre, { capSprint, scrum, v, historique, sprint } = d;
    return `<div class="grille-kpi">
      ${C.kpi('Disponible', `${n(capSprint.disponible)} j`, `sur ${n(capSprint.theorique)} j théoriques`)}
      ${C.kpi('Capacité engageable', `${n(scrum.engageable)} j`, `soit ${n(scrum.heures)} h`)}
      ${C.kpi('Vélocité moyenne', v ? `${n(v.velocite)} pts` : '—', v ? `${historique.length} sprint(s) saisi(s)` : 'saisir les points ci-dessous')}
      ${C.kpi(`Prévision · ${C.esc(nomSprint(sprint))}`, v ? `≈ ${n(v.prevision)} pts` : '—', 'ajustée à la capacité')}</div>`;
  },

  // Capacité des membres (calculée : congés, fériés, arrivées et départs)
  carteMembres(d) {
    const esc = C.esc, n = Calculs.nombre, { membresSprint, sprint, cap, scrum, capSprint } = d;
    const lignes = membresSprint.map(r => {
      const c = cap([r], sprint);
      return `<tr><td><span class="ligne-flex">${C.avatar(r.nom)}${esc(r.nom)}</span></td><td class="num">${r.capacite ?? 100} %</td>
        <td class="num">${n(c.theorique)} j</td><td class="num">${c.theorique - c.disponible ? '− ' + n(c.theorique - c.disponible) + ' j' : '—'}</td>
          <td class="num"><b>${n(c.disponible)} j</b></td></tr>`;
    }).join('');
    return `<div class="carte"><div class="carte-titre"><h2>Capacité des membres · ${esc(nomSprint(sprint))}</h2><span class="discret">calculée</span></div>
      <table class="tableau"><thead><tr><th>Membre</th><th class="num">Capacité</th><th class="num">Jours ouvrés</th>
        <th class="num">Absences</th><th class="num">Disponible</th></tr></thead>
      <tbody>${lignes}<tr class="groupe"><td colspan="4">Total · engageable ${n(scrum.engageable)} j après cérémonies et focus</td>
        <td class="num">${n(capSprint.disponible)} j</td></tr></tbody></table></div>`;
  },

  // Vélocité : saisie des points engagés / terminés des sprints précédents et du sprint affiché
  carteVelocite(d) {
    const esc = C.esc, n = Calculs.nombre, { p, sprint, precedents, capSprint, v, modifiable } = d;
    const champ = (s, champ, valeur) => `<input type="number" min="0" step="0.5" class="champ saisie-points" value="${valeur ?? ''}" placeholder="—"
      ${modifiable ? '' : 'disabled'}
      data-action-change="saisirPoints" data-projet="${p.id}" data-numero="${s.numero}" data-champ="${champ}">`;
    const lignes = [...precedents, { s: sprint, capacite: capSprint.disponible, ...this.saisieSprint(p.id, sprint.numero) }].map(h => {
      const sayDo = h.pointsEngages && h.pointsTermines != null ? Math.round(h.pointsTermines / h.pointsEngages * 100) + ' %' : '—';
      return `<tr${h.s.numero === sprint.numero ? ' class="ligne-courante"' : ''}><td class="nowrap">${esc(nomSprint(h.s))}</td>
        <td class="num">${n(h.capacite)} j</td>
        <td class="num">${champ(h.s, 'pointsEngages', h.pointsEngages)}</td><td class="num">${champ(h.s, 'pointsTermines', h.pointsTermines)}</td>
          <td class="num">${sayDo}</td></tr>`;
    }).join('');
    return `<div class="carte"><div class="carte-titre"><h2>Vélocité · points par sprint</h2><span class="discret">à saisir</span></div>
      <table class="tableau"><thead><tr><th>Sprint</th><th class="num">Capacité</th><th class="num">Points engagés</th>
        <th class="num">Points terminés</th><th class="num">Say / do</th></tr></thead>
      <tbody>${lignes}<tr class="groupe"><td colspan="3">Vélocité moyenne (${CONFIG.SPRINTS_MOYENNE_VELOCITE} sprints précédents)</td>
        <td class="num">${v ? n(v.velocite) + ' pts' : '—'}</td><td class="num">${v ? '≈ ' + n(v.prevision) + ' pts prévus' : ''}</td></tr></tbody></table></div>`;
  },

  // Répartition du sprint : idéal calculé (REPARTITION_SPRINT), jours réels saisis par catégorie, écart
  carteRepartition(d) {
    const esc = C.esc, n = Calculs.nombre, { p, sprint, capSprint, modifiable } = d;
    const lignes = Calculs.repartitionSprint(capSprint.disponible).map(c => {
      const reel = this.joursReels(p.id, sprint.numero, c.categorie);
      const ecart = reel == null ? ''
        : `<span class="${reel - c.jours > 0.5 ? 'reste-negatif' : 'discret'}">${reel - c.jours > 0 ? '+' : ''}${n(reel - c.jours)} j</span>`;
      return `<tr><td><span class="ligne-flex">${C.pastille(c.couleur)}${esc(c.categorie)}</span></td><td class="num">${c.part} %</td>
        <td class="num">${n(c.jours)} j</td>
        <td class="num"><input type="number" min="0" step="0.5" class="champ saisie-points" value="${reel ?? ''}" placeholder="—" ${modifiable ? '' : 'disabled'}
          data-action-change="saisirRepartition" data-projet="${p.id}" data-numero="${sprint.numero}" data-categorie="${esc(c.categorie)}"></td>
        <td class="num">${ecart}</td></tr>`;
    }).join('');
    const totalReel = REPARTITION_SPRINT.reduce((s, c) => s + (this.joursReels(p.id, sprint.numero, c.categorie) || 0), 0);
    return `<div class="carte"><div class="carte-titre"><h2>Répartition · ${esc(nomSprint(sprint))}</h2>
      <span class="discret">idéal calculé · réel à saisir (jours)</span></div>
      <table class="tableau"><thead><tr><th>Catégorie</th><th class="num">Idéal</th><th class="num">Idéal (j)</th>
        <th class="num">Réel (j)</th><th class="num">Écart</th></tr></thead>
      <tbody>${lignes}<tr class="groupe"><td>Total</td><td class="num">100 %</td><td class="num">${n(capSprint.disponible)} j</td>
        <td class="num">${n(totalReel)} j</td><td></td></tr></tbody></table></div>`;
  },

  // Onglet Capacité : sans projet ou sans sprint, un message ; sinon en-tête, indicateurs et les trois cartes
  rendre() {
    const p = this.projetChoisi();
    if (!p) {
      return `<div class="carte"><div class="carte-titre"><h2>Capacité</h2>
        <button class="btn" data-action="ouvrirMethodeCapacite">Méthode de calcul Scrum</button></div>${C.vide('Aucun projet avec des membres.')}</div>`;
    }
    const sprints = sprintsDuProjet(p.id);
    if (!sprints.length) {
      return `${this.bandeau(p)}
      <div class="carte">${C.vide(`Aucun sprint saisi pour ${p.nom} : ouvrez « Sprints du projet » (Administration › Sprints)
        pour saisir la version, la date de début et la date de fin de chaque sprint.`)}</div>`;
    }
    const d = this.donnees(p, sprints);
    return `${this.bandeau(p, this.navigationSprints(d))}${this.indicateurs(d)}<div class="deux-colonnes">${this.carteMembres(d)}${this.carteVelocite(d)}</div>
      ${this.carteRepartition(d)}`;
  }
};

Object.assign(Actions, {
  projetCapaciteSaisie: (_, el) => majUi('capacite', { projetId: el.value, numero: null }),
  sprintCapacite: d => majUi('capacite', { numero: Number(d.numero) }),
  // Retour au sprint en cours (choix par défaut de sprintChoisi)
  capaciteAujourdhui: () => majUi('capacite', { numero: null }),

  /* Saisie des points d'un sprint (engagés ou terminés) : mise à jour du sprint existant ;
     un champ vidé enregistre « non saisi » (null). Jamais de création ici : les sprints sont
     créés à la main par le chef de projet (Administration › Sprints, porteur 2026-10-12). */
  saisirPoints(d, el) {
    const valeur = el.value === '' ? null : Number(el.value);
    if (valeur !== null && !(valeur >= 0)) return notifier('Nombre de points invalide', 'erreur');
    modifierSprint(d.projet, d.numero, { [d.champ]: valeur });
  },
  /* Jours réels d'une catégorie pour un sprint : upsert ; un champ vidé supprime la saisie */
  saisirRepartition(d, el) {
    const cle = { projetId: d.projet, numero: Number(d.numero), categorie: d.categorie };
    if (el.value === '') {
      const filtre = { projet_id: 'eq.' + cle.projetId, numero: 'eq.' + cle.numero, categorie: 'eq.' + cle.categorie };
      return executer(() => Api.supprimer('repartitions_sprint', filtre), 'repartitionsSprint');
    }
    const jours = Number(el.value);
    if (!(jours >= 0)) return notifier('Nombre de jours invalide', 'erreur');
    executer(() => Api.creer('repartitions_sprint', { ...cle, jours }, 'projet_id,numero,categorie'), 'repartitionsSprint');
  }
});
