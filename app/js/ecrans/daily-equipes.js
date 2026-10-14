/* ============================================================
   Suivi de mes équipes › Daily des équipes — daily PAR PROJET (maquette docs/maquettes/daily-par-projet/)
   Pour la semaine choisie (lundi → vendredi ouvrés, 2026-10-14), les dailies des projets que je peux lire (peutLireDailyProjet, même
   règle qu'en base) : les projets où je suis affecté(e) ; le responsable d'une unité voit
   tous les projets de son unité et des unités rattachées (ex. Anne, Applications) ; un
   administrateur voit tout. Filtre par projet, « Blocages de la semaine » en tête, puis par
   projet un tableau membre × jour (affecté hors Lecteur, présent) : sa note, ou le motif
   (absence de Congés & capacité, pas de daily, sans compte). Lecture seule.
   Export Excel (maquette docs/maquettes/export-daily-excel/) : fenêtre Modale.exportDaily,
   fichier fabriqué par Excel (excel.js) ; mêmes projets et mêmes règles qu'à l'écran.
   ============================================================ */
'use strict';

Ecrans.dailyEquipes = {
  titre: 'Daily des équipes',
  section: 'general',
  jour: () => ui('dailyEquipes', { jour: Calculs.aujourdhui() }).jour,
  auChargement: () => recharger('notesProjet'),

  /* Semaine affichée (porteur, 2026-10-14 : « affiche uniquement les daily de la semaine ») : les jours
     ouvrés (hors week-end et fériés) de la semaine du jour choisi, du lundi au vendredi */
  joursSemaine() {
    const lundi = Calculs.lundi(this.jour());
    return Calculs.joursOuvresEntre(lundi, Calculs.ajouterJours(lundi, 4), feries());
  },
  // Membres d'un projet attendus au daily ce jour-là : affectés hors Lecteur et présents (arrivée / fin)
  membres(p, jour) {
    return etat.d.affectations.filter(a => a.projetId === p.id && a.role !== ROLES_PROJET.LECTEUR && estPresenteSur(a.ressourceId, jour))
      .map(a => ressource(a.ressourceId)).sort((x, y) => x.nom.localeCompare(y.nom));
  },
  // Membres présents au moins un jour de la semaine
  membresSemaine(p, jours) {
    const vus = new Map();
    jours.forEach(j => this.membres(p, j).forEach(r => vus.set(r.id, r)));
    return [...vus.values()].sort((x, y) => x.nom.localeCompare(y.nom));
  },

  // Note affichée : rubriques en gras, rubrique « Blocages » en rouge (sauf « Aucun »)
  note(texte) {
    const esc = C.esc;
    return Calculs.rubriquesDaily(texte).map(r => {
      const bloquante = Calculs.estRubriqueBlocages(r.titre) && Calculs.blocagesDaily(texte).length;
      const style = bloquante ? ' style="color:var(--danger)"' : '';
      return (r.titre ? `<b${style}>${esc(r.titre)}</b><br>` : '') + r.lignes.map(l => `<span${style}>- ${esc(l)}</span><br>`).join('');
    }).join('');
  },
  // Note d'un membre sur un projet un jour donné (vide = pas de daily)
  noteDe(r, p, jour) {
    const n = noteProjet(auteurDaily(r), p.id, jour);
    return n && n.texte.trim() ? n : null;
  },

  rendre() {
    const esc = C.esc, jours = this.joursSemaine(), lundi = Calculs.lundi(this.jour());
    const libelle = `Semaine du ${Calculs.formatCourt(lundi)} au ${Calculs.formatAvecAnnee(Calculs.ajouterJours(lundi, 4))}`;
    const entete = C.entete('Daily des équipes', 'Daily de la semaine, par projet, des membres de vos projets · lecture seule', `
      ${projetsDailyVisibles().length ? '<button class="btn primaire" data-action="ouvrirExportDaily">⬇ Exporter en Excel</button>' : ''}
      <button class="btn" data-action="dailyEquipesAujourdhui">Cette semaine</button>
      <button class="btn" data-action="dailyEquipesDecaler" data-sens="-1" title="Semaine précédente">‹</button>
      <b style="min-width:240px;text-align:center">${libelle}</b>
      <button class="btn" data-action="dailyEquipesDecaler" data-sens="1" title="Semaine suivante">›</button>`);
    const visibles = projetsDailyVisibles();
    if (!visibles.length) return `<div class="ecran">${entete}<div class="carte">${C.vide('Aucun projet en cours dont vous pouvez lire le daily.')}</div></div>`;

    const filtre = ui('dailyEquipes', { projet: 'tous' }).projet;
    const projets = visibles.filter(p => filtre === 'tous' || p.id === filtre);
    const blocages = this.blocagesSemaine(projets, jours);
    const puce = (id, nom) => `<button class="puce${filtre === id ? ' active' : ''}" data-action="filtrerDailyEquipes" data-id="${id}">${esc(nom)}</button>`;
    const puces = (visibles.length > 1 ? puce('tous', 'Tous mes projets') : '') + visibles.map(p => puce(p.id, `${p.code} · ${p.nom}`)).join('');
    return `
    <div class="ecran">
      ${entete}
      <div class="ligne-flex" style="flex-wrap:wrap"><div class="puces">${puces}</div><span class="extensible"></span>
        <span class="discret">${blocages.length} blocage${blocages.length > 1 ? 's' : ''} cette semaine</span></div>
      ${blocages.length ? `<div class="carte encart-compact encart-blocages"><b class="texte-danger">Blocages de la semaine</b>
        <div style="margin-top:6px;display:grid;grid-template-columns:70px 240px 1fr;gap:4px 12px">${blocages.map(b => `
          <span class="discret">${Calculs.formatCourt(b.jour)}</span><span>${C.code(b.code)} ${esc(b.nom)}</span><span>${esc(b.texte)}</span>`).join('')}</div></div>` : ''}
      ${projets.map(p => this.sectionProjet(p, jours)).join('')}
      <div class="discret texte-12">Notes conservées à l’affichage sur ${JOURS_DAILY} jours (au-delà : export Excel). Vous voyez le daily de vos projets ;
        le responsable d’une unité voit tous les projets de son unité.</div>
    </div>`;
  },
  // Blocages des notes de la semaine, tous projets affichés, du plus récent au plus ancien
  blocagesSemaine(projets, jours) {
    return [...jours].reverse().flatMap(jour => projets.flatMap(p => this.membres(p, jour).flatMap(r => {
      const n = this.noteDe(r, p, jour);
      return n ? Calculs.blocagesDaily(n.texte).map(texte => ({ jour, code: p.code, nom: r.nom, texte })) : [];
    })));
  },
  /* Un projet : une ligne par membre, une colonne par jour ouvré de la semaine. Case : sa note, ou
     le motif de l'absence de daily (absent(e), pas de daily, fiche sans compte) ; rien les jours à venir ou hors présence */
  sectionProjet(p, jours) {
    const esc = C.esc, membres = this.membresSemaine(p, jours), JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];
    const nbNotes = membres.reduce((n, r) => n + jours.filter(j => this.noteDe(r, p, j)).length, 0);
    const caseDe = (r, jour) => {
      const n = this.noteDe(r, p, jour);
      if (n) return `<td>${this.note(n.texte)}</td>`;
      const absence = absenceDe(r.id, jour);
      const aVenir = jour > Calculs.aujourdhui() && !absence;
      const motif = aVenir || !estPresenteSur(r.id, jour) ? '' : absence ? `absent(e) · ${esc(absence.type)}` : r.userId ? '—' : 'sans compte';
      return `<td class="pale texte-12">${motif}</td>`;
    };
    const entetes = jours.map(j => `<th>${JOURS[(Calculs.depuisIso(j).getDay() + 6) % 7]} ${Calculs.formatCourt(j)}</th>`).join('');
    const lignes = membres.map(r => `<tr><td class="nowrap"><span class="ligne-flex">${C.avatar(r.nom)}<b>${esc(r.nom)}</b></span></td>
      ${jours.map(j => caseDe(r, j)).join('')}</tr>`).join('');
    return `<div class="carte-titre" style="padding:6px 2px;border:0"><span class="ligne-flex">${C.code(p.code)}<h2 style="font-size:15px">${esc(p.nom)}</h2></span>
        <span class="discret">${nbNotes} daily cette semaine</span></div>
      <div class="carte defilement-x" style="margin-bottom:14px;padding:0"><table class="tableau tableau-daily-semaine">
        <thead><tr><th>Membre</th>${entetes}</tr></thead>
        <tbody>${lignes || `<tr><td colspan="${jours.length + 1}">${C.vide('Aucun membre présent cette semaine.')}</td></tr>`}</tbody></table></div>`;
  }
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

  filtrerDailyEquipes: d => majUi('dailyEquipes', { projet: d.id }),
  dailyEquipesAujourdhui: () => majUi('dailyEquipes', { jour: Calculs.aujourdhui() }),
  // Semaine précédente / suivante
  dailyEquipesDecaler: d => majUi('dailyEquipes', { jour: Calculs.ajouterJours(Ecrans.dailyEquipes.jour(), 7 * Number(d.sens)) })
});
