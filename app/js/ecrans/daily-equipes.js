/* ============================================================
   Suivi de mes équipes › Daily des équipes (maquettes docs/maquettes/daily-equipes-design/retenu/, 2026-10-15)
   Semaine choisie (lundi → vendredi ouvrés), projets dont je peux lire le daily (peutLireDailyProjet,
   même règle qu'en base : projets où je suis affecté(e) ; responsable d'une unité : tous ses projets ;
   administrateur : tout).
   - Onglet « Fil des dailys » (tout le monde) : les dailys du plus récent au plus ancien, groupés par
     jour ; filtres projets / personnes à gauche ; blocages ouverts et résumé du jour à droite.
   - Onglet « Synthèse de l'équipe » (droit « onglet_daily_synthese » de la matrice) : chiffres clés,
     carte membre × jour (✓ daily, ⚠ blocage, — manquant, 🌴 absent) ; un clic ouvre le daily à droite.
   Lecture seule. Export Excel : fenêtre Modale.exportDaily, fichier fabriqué par excel.js.
   ============================================================ */
'use strict';

Ecrans.dailyEquipes = {
  titre: 'Daily des équipes',
  section: 'general',
  jour: () => ui('dailyEquipes', { jour: Calculs.aujourdhui() }).jour,
  filtres: () => ui('dailyEquipes', { projet: 'tous', personne: 'tous', onglet: 'fil', caseChoisie: null }),
  auChargement: () => recharger('notesProjet'),
  /* Onglets « Fil des dailys » et « Synthèse de l'équipe », chacun selon son droit (matrice, migration 038 ;
     la synthèse était réservée aux administrateurs et responsables, valeur de départ de son droit) */
  onglets: () => ongletsPermis('dailyEquipes', [{ id: 'fil', libelle: 'Fil des dailys' }, { id: 'synthese', libelle: 'Synthèse de l’équipe' }]),

  // Jours ouvrés (hors week-end et fériés) de la semaine du jour choisi, du lundi au vendredi
  joursSemaine() {
    const lundi = Calculs.lundi(this.jour());
    return Calculs.joursOuvresEntre(lundi, Calculs.ajouterJours(lundi, 4), feries());
  },
  // Membres d'un projet attendus au daily ce jour-là : affectés hors Lecteur et présents (arrivée / fin)
  membres(p, jour) {
    return etat.d.affectations.filter(a => a.projetId === p.id && a.role !== ROLES_PROJET.LECTEUR && estPresenteSur(a.ressourceId, jour))
      .map(a => ressource(a.ressourceId)).sort((x, y) => x.nom.localeCompare(y.nom));
  },
  // Note non vide d'un membre sur un projet un jour donné, sinon null
  noteDe(r, p, jour) {
    const n = noteProjet(auteurDaily(r), p.id, jour);
    return n && n.texte.trim() ? n : null;
  },
  // Projets affichés (filtre projet appliqué)
  projets() {
    const filtre = this.filtres().projet;
    return projetsDailyVisibles().filter(p => filtre === 'tous' || p.id === filtre);
  },
  // Personnes des projets donnés, présentes au moins un jour de la semaine, triées par nom
  personnes(projets, jours) {
    const vus = new Map();
    projets.forEach(p => jours.forEach(j => this.membres(p, j).forEach(r => vus.set(r.id, r))));
    return [...vus.values()].sort((x, y) => x.nom.localeCompare(y.nom));
  },
  /* Dailys de la semaine : { jour, p, r, note }, du jour le plus récent au plus ancien, puis par heure
     d'enregistrement (la plus récente d'abord) ; filtre personne appliqué si « personne » est vrai */
  entrees(projets, jours, avecFiltrePersonne = true) {
    const personne = this.filtres().personne, liste = [];
    jours.forEach(jour => projets.forEach(p => this.membres(p, jour).forEach(r => {
      const note = this.noteDe(r, p, jour);
      if (note && (!avecFiltrePersonne || personne === 'tous' || personne === r.id)) liste.push({ jour, p, r, note });
    })));
    return liste.sort((a, b) => b.jour.localeCompare(a.jour) || String(b.note.modifieLe || '').localeCompare(String(a.note.modifieLe || '')));
  },

  rendre() {
    const jours = this.joursSemaine(), lundi = Calculs.lundi(this.jour()), f = this.filtres();
    const libelle = `Semaine du ${Calculs.formatCourt(lundi)} au ${Calculs.formatAvecAnnee(Calculs.ajouterJours(lundi, 4))}`;
    const entete = C.entete('Daily des équipes', 'Daily de la semaine des membres de vos projets · lecture seule', `
      ${projetsDailyVisibles().length ? '<button class="btn primaire" data-action="ouvrirExportDaily">⬇ Exporter en Excel</button>' : ''}
      <button class="btn" data-action="dailyEquipesAujourdhui">Cette semaine</button>
      <button class="btn" data-action="dailyEquipesDecaler" data-sens="-1" title="Semaine précédente">‹</button>
      <b class="libelle-semaine">${libelle}</b>
      <button class="btn" data-action="dailyEquipesDecaler" data-sens="1" title="Semaine suivante">›</button>`);
    if (!projetsDailyVisibles().length) return `<div class="ecran">${entete}<div class="carte">${C.vide('Aucun projet en cours dont vous pouvez lire le daily.')}</div></div>`;
    const liste = this.onglets(), onglet = ongletAffiche(liste, f.onglet);
    if (!onglet) return `<div class="ecran">${entete}${C.aucunOnglet()}</div>`;
    // Barre d'onglets seulement s'il y a le choix
    const onglets = liste.length > 1 ? C.onglets(liste, onglet, 'ongletDailyEquipes') : '';
    return `<div class="ecran">${entete}${onglets}
      ${onglet === 'synthese' ? Synthese.rendre(this.projets(), jours) : this.fil(jours)}
      <div class="discret texte-12">Notes conservées à l’affichage sur ${JOURS_DAILY} jours (au-delà : export Excel). Vous voyez le daily de vos projets ;
        le responsable d’une unité voit tous les projets de son unité.</div></div>`;
  },

  /* ---------- Onglet « Fil des dailys » ---------- */
  fil(jours) {
    const projets = this.projets(), entrees = this.entrees(projets, jours);
    const parJour = [...new Set(entrees.map(e => e.jour))].map(jour => `<div class="carte fil-jour">
        <div class="fil-jour-titre">${Calculs.formatLong(jour)}</div>${entrees.filter(e => e.jour === jour).map(e => this.entreeFil(e)).join('')}</div>`).join('');
    return `<div class="grille-fil">${this.filtresFil(jours)}
      <div>${parJour || `<div class="carte">${C.vide('Aucun daily cette semaine pour ces filtres.')}</div>`}</div>
      <div>${this.blocagesOuverts(projets, jours)}${this.resumeJour(projets, jours)}</div></div>`;
  },
  // Un daily du fil : qui, projet, heure d'enregistrement, ses rubriques, puis ses blocages en pastilles rouges
  entreeFil({ p, r, note }) {
    const esc = C.esc, heure = note.modifieLe ? new Date(note.modifieLe).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
    const rubriques = Calculs.rubriquesDaily(note.texte).filter(x => !Calculs.estRubriqueBlocages(x.titre)).map(x =>
      (x.titre ? `<b>${esc(x.titre)}</b><br>` : '') + x.lignes.map(l => `• ${esc(l)}<br>`).join('')).join('');
    const blocages = Calculs.blocagesDaily(note.texte).map(b => `<span class="pastille-blocage">⚠ ${esc(b)}</span>`).join('');
    return `<div class="fil-entree">${C.avatar(r.nom)}<div class="extensible">
      <div class="ligne-flex"><b>${esc(r.nom)}</b>${C.code(p.code)}<span class="pale texte-12">${heure}</span></div>
      <div class="fil-texte">${rubriques}</div>${blocages}</div></div>`;
  },
  // Filtres de gauche : projets puis personnes, avec le nombre de dailys de la semaine
  filtresFil(jours) {
    const esc = C.esc, f = this.filtres(), tous = projetsDailyVisibles();
    const nbProjet = id => this.entrees(tous.filter(p => id === 'tous' || p.id === id), jours, false).length;
    const nbPersonne = id => this.entrees(this.projets(), jours, false).filter(e => id === 'tous' || e.r.id === id).length;
    const ligne = (action, id, nom, n, actif) => `<a class="filtre-fil${actif ? ' actif' : ''}" data-action="${action}" data-id="${id}">${esc(nom)}<span>${n}</span></a>`;
    return `<div class="carte filtres-fil"><div class="libelle-filtres">Projets</div>
      ${ligne('filtrerDailyEquipes', 'tous', 'Tous', nbProjet('tous'), f.projet === 'tous')}
      ${tous.map(p => ligne('filtrerDailyEquipes', p.id, p.nom, nbProjet(p.id), f.projet === p.id)).join('')}
      <div class="libelle-filtres">Personnes</div>
      ${ligne('filtrerPersonneDaily', 'tous', 'Toutes', nbPersonne('tous'), f.personne === 'tous')}
      ${this.personnes(this.projets(), jours).map(r => ligne('filtrerPersonneDaily', r.id, r.nom, nbPersonne(r.id), f.personne === r.id)).join('')}</div>`;
  },
  /* Blocages ouverts : ceux du dernier daily de la semaine de chaque membre × projet ; « depuis N j » =
     jours écoulés depuis le premier daily de la semaine qui porte ce même blocage */
  blocagesOuverts(projets, jours) {
    const esc = C.esc, ouverts = [], vus = new Set();
    this.entrees(projets, jours, false).forEach(e => {
      const cle = e.r.id + e.p.id;
      if (vus.has(cle)) return;
      vus.add(cle);
      Calculs.blocagesDaily(e.note.texte).forEach(texte => {
        const premier = jours.find(j => { const n = this.noteDe(e.r, e.p, j); return n && Calculs.blocagesDaily(n.texte).includes(texte); });
        ouverts.push({ r: e.r, texte, age: Calculs.ecartJours(premier, Calculs.aujourdhui()) });
      });
    });
    return `<div class="carte encart-blocages bloc-droite"><b class="texte-danger">Blocages ouverts · ${ouverts.length}</b>
      ${ouverts.map(o => `<div class="ligne-flex ligne-droite">${C.avatar(o.r.nom)}<span class="extensible">${esc(o.texte)}</span>
        <span class="pale texte-12">${o.age > 0 ? o.age + ' j' : 'auj.'}</span></div>`).join('') || '<div class="pale texte-12">Aucun blocage.</div>'}</div>`;
  },
  // Résumé du jour (aujourd'hui s'il est dans la semaine, sinon le dernier jour ouvré affiché)
  resumeJour(projets, jours) {
    const esc = C.esc, jour = jours.includes(Calculs.aujourdhui()) ? Calculs.aujourdhui() : jours[jours.length - 1];
    if (!jour) return '';
    const etats = this.personnes(projets, [jour]).map(r => ({ r, etat: Synthese.etatCase(r, projets, jour) }));
    const noms = e => etats.filter(x => x.etat === e).map(x => esc(x.r.nom)).join(', ');
    const nbOk = etats.filter(x => ['ok', 'bloc'].includes(x.etat)).length;
    return `<div class="carte bloc-droite"><b>${jour === Calculs.aujourdhui() ? 'Aujourd’hui' : Calculs.formatLong(jour)}</b>
      <div class="ligne-droite">✅ ${nbOk} daily${nbOk > 1 ? 's' : ''} renseigné${nbOk > 1 ? 's' : ''}</div>
      ${noms('abs') ? `<div class="ligne-droite">🌴 Absent(e) : ${noms('abs')}</div>` : ''}
      ${noms('manque') ? `<div class="ligne-droite">⏳ Pas encore de daily : ${noms('manque')}</div>` : ''}</div>`;
  }
};

/* ---------- Onglet « Synthèse de l'équipe » (selon son droit, matrice des droits) ---------- */
const Synthese = {
  SYMBOLES: { ok: '✓', bloc: '⚠', manque: '—', abs: '🌴', avenir: '', hors: '' },
  CLASSES: { ok: 'case-ok', bloc: 'case-bloc', manque: 'case-manque', abs: 'case-abs', avenir: '', hors: '' },

  /* État d'une personne un jour donné, tous projets affichés : à venir, hors présence, daily (avec ou sans
     blocage), absent(e) (Congés & capacité) ou manquant. « Sans compte » compte comme manquant. */
  etatCase(r, projets, jour) {
    if (jour > Calculs.aujourdhui()) return 'avenir';
    if (!estPresenteSur(r.id, jour)) return 'hors';
    const notes = projets.map(p => Ecrans.dailyEquipes.noteDe(r, p, jour)).filter(Boolean);
    if (notes.length) return notes.some(n => Calculs.blocagesDaily(n.texte).length) ? 'bloc' : 'ok';
    return absenceDe(r.id, jour) ? 'abs' : 'manque';
  },

  rendre(projets, jours) {
    const personnes = Ecrans.dailyEquipes.personnes(projets, jours);
    const grille = personnes.map(r => ({ r, etats: jours.map(j => this.etatCase(r, projets, j)) }));
    const compte = e => grille.reduce((n, l) => n + l.etats.filter(x => x === e).length, 0);
    const renseignes = compte('ok') + compte('bloc'), attendus = renseignes + compte('manque');
    const taux = attendus ? Math.round(100 * renseignes / attendus) : 0;
    return `<div class="grille-kpi q4">
        ${C.kpi('Dailys renseignés', `${taux} %`, `${renseignes} / ${attendus} attendus`)}
        ${C.kpi('Jours avec blocage', compte('bloc'))}${C.kpi('Dailys manquants', compte('manque'))}${C.kpi('Jours d’absence', compte('abs'))}</div>
      <div class="grille-synthese"><div class="carte defilement-x">${this.tableau(grille, jours)}
        <div class="discret texte-12 legende-synthese">✓ daily · ⚠ blocage signalé · — manquant · 🌴 absent · case vide : à venir ou hors présence</div></div>
        ${this.panneau(projets)}</div>`;
  },
  // Carte de chaleur membre × jour ; une case de daily est cliquable (ouvre le panneau de lecture)
  tableau(grille, jours) {
    const esc = C.esc, choisie = Ecrans.dailyEquipes.filtres().caseChoisie || {};
    const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];
    const entetes = jours.map(j => `<th class="centre">${JOURS[(Calculs.depuisIso(j).getDay() + 6) % 7]} ${Calculs.formatCourt(j)}</th>`).join('');
    const lignes = grille.map(({ r, etats }) => {
      const faits = etats.filter(e => e === 'ok' || e === 'bloc').length, attendus = faits + etats.filter(e => e === 'manque').length;
      const cases = etats.map((e, i) => {
        const active = choisie.ressource === r.id && choisie.jour === jours[i] ? ' active' : '';
        const action = ['ok', 'bloc'].includes(e) ? ` data-action="choisirCaseDaily" data-ressource="${r.id}" data-jour="${jours[i]}"` : '';
        return `<td><div class="case-synthese ${this.CLASSES[e]}${active}"${action}>${this.SYMBOLES[e]}</div></td>`;
      }).join('');
      return `<tr><td class="nowrap"><span class="ligne-flex">${C.avatar(r.nom)}<b>${esc(r.nom)}</b></span></td>${cases}<td class="num"><b>${faits}/${attendus}</b></td></tr>`;
    }).join('');
    return `<table class="tableau tableau-synthese"><thead><tr><th>Membre</th>${entetes}<th class="num">Taux</th></tr></thead>
      <tbody>${lignes || `<tr><td colspan="${jours.length + 2}">${C.vide('Aucun membre cette semaine.')}</td></tr>`}</tbody></table>`;
  },
  // Panneau de lecture : dailys de la personne choisie ce jour-là (tous projets affichés), ‹ › jour précédent / suivant
  panneau(projets) {
    const esc = C.esc, choisie = Ecrans.dailyEquipes.filtres().caseChoisie;
    if (!choisie) return `<div class="carte panneau-lecture">${C.vide('Cliquez sur une case ✓ ou ⚠ pour lire le daily.')}</div>`;
    const r = ressource(choisie.ressource);
    const notes = projets.map(p => ({ p, n: Ecrans.dailyEquipes.noteDe(r, p, choisie.jour) })).filter(x => x.n);
    return `<div class="carte panneau-lecture actif"><div class="ligne-flex">${C.avatar(r.nom)}<div class="extensible"><b>${esc(r.nom)}</b>
        <div class="discret texte-12">${Calculs.formatLong(choisie.jour)}</div></div>
        <button class="lien-btn" data-action="fermerCaseDaily" title="Fermer">✕</button></div>
      ${notes.map(x => `<div class="lecture-note">${C.code(x.p.code)}<div class="fil-texte">${Ecrans.dailyEquipes.noteHtml(x.n.texte)}</div></div>`).join('')
        || C.vide('Pas de daily ce jour-là.')}
      <div class="ligne-flex"><button class="btn" data-action="decalerCaseDaily" data-sens="-1">‹ Jour précédent</button>
        <button class="btn" data-action="decalerCaseDaily" data-sens="1">Jour suivant ›</button></div></div>`;
  }
};

// Note complète (rubriques en gras, « Blocages » en rouge sauf « Aucun ») : panneau de lecture de la Synthèse
Ecrans.dailyEquipes.noteHtml = function (texte) {
  const esc = C.esc;
  return Calculs.rubriquesDaily(texte).map(r => {
    const bloquante = Calculs.estRubriqueBlocages(r.titre) && Calculs.blocagesDaily(texte).length;
    const classe = bloquante ? ' class="texte-danger"' : '';
    return (r.titre ? `<b${classe}>${esc(r.titre)}</b><br>` : '') + r.lignes.map(l => `<span${classe}>• ${esc(l)}</span><br>`).join('');
  }).join('');
};

/* ---------- Export du daily en Excel ---------- */
const ExportDaily = {
  // Période d'un raccourci de la fenêtre d'export : { debut, fin } (dates ISO, fin = aujourd'hui au plus tard)
  periode(cle) {
    const jour = Calculs.aujourdhui(), d = Calculs.depuisIso(jour);
    const debutMois = Calculs.debutMois(d.getFullYear(), d.getMonth());
    if (cle === 'semaine') return { debut: Calculs.lundi(jour), fin: jour };
    if (cle === 'mois') return { debut: debutMois, fin: jour };
    if (cle === 'moisPrecedent') {
      const finPrecedent = Calculs.ajouterJours(debutMois, -1), p = Calculs.depuisIso(finPrecedent);
      return { debut: Calculs.debutMois(p.getFullYear(), p.getMonth()), fin: finPrecedent };
    }
    return { debut: jour, fin: jour };
  },

  /* Lignes du fichier, du jour le plus récent au plus ancien, puis par projet et par nom.
     Pour chaque jour ouvré (hors week-ends et fériés) et chaque projet : les membres attendus
     au daily ce jour-là (mêmes règles qu'à l'écran : affectés hors Lecteur, présents) avec
     un statut : Renseigné, Absent(e) (Congés & capacité), Sans compte (fiche non reliée) ou
     Manquant. « notes » = notes_daily_projet de la période (lues par telechargerDailyExcel). */
  lignes(debut, fin, projets, notes, avecManquants) {
    const lignes = [], jours = Calculs.joursOuvresEntre(debut, fin, feries()).reverse();
    const noteDe = (r, p, jour) => notes.find(n => n.userId === auteurDaily(r) && n.projetId === p.id && n.jour === jour);
    jours.forEach(jour => projets.forEach(p => Ecrans.dailyEquipes.membres(p, jour).forEach(r => {
      const note = noteDe(r, p, jour), absence = absenceDe(r.id, jour);
      const remplie = !!note && !!note.texte.trim();
      if (!remplie && !avecManquants) return;
      const statut = remplie ? 'Renseigné' : absence ? 'Absent(e)' : r.userId ? 'Manquant' : 'Sans compte';
      lignes.push({ jour, projet: p, personne: r.nom, statut, absence: absence ? absence.type : '',
        champs: Calculs.decouperDaily(remplie ? note.texte : ''), blocages: remplie ? Calculs.blocagesDaily(note.texte) : [] });
    })));
    return lignes;
  },

  // Onglets du classeur : « Daily » (une ligne par membre, projet et jour) et, en option, « Blocages »
  feuilles(lignes, avecBlocages) {
    const date = jour => jour.split('-').reverse().join('/');
    const STYLE_STATUT = { 'Renseigné': 'vert', 'Absent(e)': 'gris', 'Sans compte': 'gris', 'Manquant': 'orange' };
    // Quatre premières colonnes communes aux deux onglets : qui, quand, sur quel projet
    const COLONNES_COMMUNES = [{ titre: 'Date', largeur: 12 }, { titre: 'Code projet', largeur: 11 }, { titre: 'Projet', largeur: 28 }, { titre: 'Personne', largeur: 22 }];
    const daily = {
      nom: 'Daily',
      colonnes: [...COLONNES_COMMUNES, { titre: 'Statut', largeur: 13 }, { titre: 'Hier', largeur: 45 },
        { titre: 'Aujourd’hui', largeur: 45 }, { titre: 'Blocages', largeur: 40 }, { titre: 'Absence', largeur: 18 }],
      lignes: lignes.map(l => [date(l.jour), l.projet.code, l.projet.nom, l.personne,
        { texte: l.statut, style: STYLE_STATUT[l.statut] }, l.champs.hier, l.champs.aujourdhui,
        { texte: l.blocages.join('\n'), style: 'rouge' }, l.absence])
    };
    if (!avecBlocages) return [daily];
    const blocages = {
      nom: 'Blocages',
      colonnes: [...COLONNES_COMMUNES, { titre: 'Blocage', largeur: 70 }],
      lignes: lignes.flatMap(l => l.blocages.map(b => [date(l.jour), l.projet.code, l.projet.nom, l.personne, { texte: b, style: 'rouge' }]))
    };
    return [daily, blocages];
  }
};

Object.assign(Actions, {
  // Ouverture : période « Ce mois », projets cochés = celui filtré à l'écran, sinon tous
  ouvrirExportDaily() {
    const filtre = ui('dailyEquipes', { projet: 'tous' }).projet;
    const projets = projetsDailyVisibles().map(p => p.id).filter(id => filtre === 'tous' || id === filtre);
    majEtat({ modale: { type: 'exportDaily', periode: 'mois', ...ExportDaily.periode('mois'), projets } });
  },
  // Raccourci de période : on remplit les dates sans redessiner (les cases cochées restent telles quelles)
  periodeExportDaily(d, element) {
    const p = ExportDaily.periode(d.periode), form = element.closest('form');
    form.elements.debut.value = p.debut;
    form.elements.fin.value = p.fin;
    form.querySelectorAll('.puce').forEach(b => b.classList.toggle('active', b === element));
  },
  // Lit les notes de la période en base (la base ne renvoie que celles que je peux lire), puis télécharge
  async telechargerDailyExcel(d, form) {
    const debut = form.elements.debut.value, fin = form.elements.fin.value;
    const ids = [...form.querySelectorAll('input[name=projet]:checked')].map(c => c.value);
    if (debut > fin) return notifier('La date de début doit précéder la date de fin', 'erreur');
    if (Calculs.ecartJours(debut, fin) > 366) return notifier('Période limitée à un an', 'erreur');
    if (!ids.length) return notifier('Cochez au moins un projet', 'erreur');
    try {
      const notes = await Api.lire('notes_daily_projet', { order: 'jour,projet_id,user_id', and: `(jour.gte.${debut},jour.lte.${fin})` });
      const projets = projetsDailyVisibles().filter(p => ids.includes(p.id));
      const lignes = ExportDaily.lignes(debut, fin, projets, notes, form.elements.manquants.checked);
      Excel.telecharger(`Daily_${debut}_au_${fin}.xlsx`, ExportDaily.feuilles(lignes, form.elements.blocages.checked));
      majEtat({ modale: null });
      notifier(`Fichier Excel téléchargé : ${lignes.length} ligne${lignes.length > 1 ? 's' : ''}`);
    } catch (e) { notifier(e.message, 'erreur'); }
  },

  filtrerDailyEquipes: d => majUi('dailyEquipes', { projet: d.id, personne: 'tous', caseChoisie: null }),
  filtrerPersonneDaily: d => majUi('dailyEquipes', { personne: d.id }),
  ongletDailyEquipes: d => majUi('dailyEquipes', { onglet: d.id }),
  choisirCaseDaily: d => majUi('dailyEquipes', { caseChoisie: { ressource: d.ressource, jour: d.jour } }),
  fermerCaseDaily: () => majUi('dailyEquipes', { caseChoisie: null }),
  // Panneau de lecture : jour ouvré précédent / suivant (la semaine affichée suit)
  decalerCaseDaily(d) {
    const c = Ecrans.dailyEquipes.filtres().caseChoisie, jour = Ecrans.daily.decaler(c.jour, Number(d.sens));
    majUi('dailyEquipes', { jour, caseChoisie: { ...c, jour } });
  },
  dailyEquipesAujourdhui: () => majUi('dailyEquipes', { jour: Calculs.aujourdhui(), caseChoisie: null }),
  // Semaine précédente / suivante
  dailyEquipesDecaler: d => majUi('dailyEquipes', { jour: Calculs.ajouterJours(Ecrans.dailyEquipes.jour(), 7 * Number(d.sens)), caseChoisie: null })
});
