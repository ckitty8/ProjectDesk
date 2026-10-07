/* ============================================================
   Général › Daily des équipes — daily PAR PROJET (maquette docs/maquettes/daily-par-projet/)
   Pour le jour choisi, les dailies des projets que je peux lire (peutLireDailyProjet, même
   règle qu'en base) : les projets où je suis affecté(e) ; le responsable d'une unité voit
   tous les projets de son unité et des unités rattachées (ex. Anne, Applications) ; un
   administrateur voit tout. Filtre par projet, « Blocages du jour » en tête, puis une carte
   par membre (affecté hors Lecteur, présent ce jour-là) : sa note du projet, ou « pas de
   daily » avec son absence éventuelle (Congés & capacité). Lecture seule.
   Export Excel (maquette docs/maquettes/export-daily-excel/) : fenêtre Modale.exportDaily,
   fichier fabriqué par Excel (excel.js) ; mêmes projets et mêmes règles qu'à l'écran.
   ============================================================ */
'use strict';

Ecrans.dailyEquipes = {
  titre: 'Daily des équipes',
  section: 'general',
  jour: () => ui('dailyEquipes', { jour: Calculs.aujourdhui() }).jour,
  auChargement: () => recharger('notesProjet'),

  // Membres d'un projet attendus au daily ce jour-là : affectés hors Lecteur et présents (arrivée / fin)
  membres(p, jour) {
    return etat.d.affectations.filter(a => a.projetId === p.id && a.role !== ROLES_PROJET.LECTEUR && estPresenteSur(a.ressourceId, jour))
      .map(a => ressource(a.ressourceId)).sort((x, y) => x.nom.localeCompare(y.nom));
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

  rendre() {
    const esc = C.esc, jour = this.jour();
    const entete = C.entete('Daily des équipes', 'Daily par projet des membres de vos projets · lecture seule', `
      ${projetsDailyVisibles().length ? '<button class="btn primaire" data-action="ouvrirExportDaily">⬇ Exporter en Excel</button>' : ''}
      <button class="btn" data-action="dailyEquipesAujourdhui">Aujourd’hui</button>
      <button class="btn" data-action="dailyEquipesDecaler" data-sens="-1" title="Jour précédent">‹</button>
      <b style="min-width:210px;text-align:center">${Calculs.formatLong(jour)}</b>
      <button class="btn" data-action="dailyEquipesDecaler" data-sens="1" title="Jour suivant">›</button>`);
    const visibles = projetsDailyVisibles();
    if (!visibles.length) return `<div class="ecran">${entete}<div class="carte">${C.vide('Aucun projet en cours dont vous pouvez lire le daily.')}</div></div>`;

    const filtre = ui('dailyEquipes', { projet: 'tous' }).projet;
    const projets = visibles.filter(p => filtre === 'tous' || p.id === filtre);
    const noteDe = (r, p) => r.userId ? noteProjet(r.userId, p.id, jour) : null;
    const remplie = n => !!n && !!n.texte.trim();

    // Blocages du jour, tous projets affichés
    const blocages = projets.flatMap(p => this.membres(p, jour).filter(r => remplie(noteDe(r, p)))
      .flatMap(r => Calculs.blocagesDaily(noteDe(r, p).texte).map(texte => ({ code: p.code, nom: r.nom, texte }))));

    const puce = (id, libelle) => `<button class="puce${filtre === id ? ' active' : ''}" data-action="filtrerDailyEquipes" data-id="${id}">${esc(libelle)}</button>`;
    const puces = (visibles.length > 1 ? puce('tous', 'Tous mes projets') : '') + visibles.map(p => puce(p.id, `${p.code} · ${p.nom}`)).join('');

    // Carte d'un membre : sa note du projet, ou « pas de daily » (avec son absence du jour si elle est posée)
    const carte = (r, p) => {
      const n = noteDe(r, p);
      if (remplie(n)) return `<div class="carte" style="padding:14px 16px">
        <div class="ligne-flex" style="margin-bottom:8px">${C.avatar(r.nom)}<b style="flex:1">${esc(r.nom)}</b>${C.code(p.code)}</div>
        <div style="line-height:1.55">${this.note(n.texte)}</div></div>`;
      const absence = absenceDe(r.id, jour);
      const motif = absence ? `Pas de daily · absent(e) (${esc(absence.type)})` : r.userId ? 'Pas encore de daily sur ce projet' : 'Pas de compte relié à sa fiche';
      return `<div class="carte" style="padding:14px 16px;background:var(--fond-entete)"><div class="ligne-flex">${C.avatar(r.nom)}
        <b style="flex:1;color:var(--discret)">${esc(r.nom)}</b><span class="discret">${motif}</span></div></div>`;
    };
    const section = p => {
      const membres = this.membres(p, jour), avec = membres.filter(r => remplie(noteDe(r, p)));
      return `<div class="carte-titre" style="padding:6px 2px;border:0"><span class="ligne-flex">${C.code(p.code)}<h2 style="font-size:15px">${esc(p.nom)}</h2></span>
          <span class="discret">${avec.length} / ${membres.length} daily</span></div>
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;align-items:start;margin-bottom:14px">
          ${[...avec, ...membres.filter(r => !avec.includes(r))].map(r => carte(r, p)).join('') || C.vide('Aucun membre présent ce jour.')}</div>`;
    };

    return `
    <div class="ecran">
      ${entete}
      <div class="ligne-flex" style="flex-wrap:wrap"><div class="puces">${puces}</div><span style="flex:1"></span>
        <span class="discret">${blocages.length} blocage${blocages.length > 1 ? 's' : ''} signalé${blocages.length > 1 ? 's' : ''}</span></div>
      ${blocages.length ? `<div class="carte" style="border-color:#F3C1C1;background:#FFF5F5;padding:12px 16px"><b style="color:var(--danger)">Blocages du jour</b>
        <div style="margin-top:6px;display:grid;grid-template-columns:240px 1fr;gap:4px 12px">${blocages.map(b => `<span>${C.code(b.code)} ${esc(b.nom)}</span><span>${esc(b.texte)}</span>`).join('')}</div></div>` : ''}
      ${projets.map(section).join('')}
      <div class="discret" style="font-size:12px">Notes conservées à l’affichage sur ${JOURS_DAILY} jours. Vous voyez le daily de vos projets ; le responsable d’une unité voit tous les projets de son unité.</div>
    </div>`;
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
    const noteDe = (r, p, jour) => notes.find(n => n.userId === r.userId && n.projetId === p.id && n.jour === jour);
    jours.forEach(jour => projets.forEach(p => Ecrans.dailyEquipes.membres(p, jour).forEach(r => {
      const note = r.userId ? noteDe(r, p, jour) : null, absence = absenceDe(r.id, jour);
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
    const daily = {
      nom: 'Daily',
      colonnes: [{ titre: 'Date', largeur: 12 }, { titre: 'Code projet', largeur: 11 }, { titre: 'Projet', largeur: 28 },
        { titre: 'Personne', largeur: 22 }, { titre: 'Statut', largeur: 13 }, { titre: 'Hier', largeur: 45 },
        { titre: 'Aujourd’hui', largeur: 45 }, { titre: 'Blocages', largeur: 40 }, { titre: 'Absence', largeur: 18 }],
      lignes: lignes.map(l => [date(l.jour), l.projet.code, l.projet.nom, l.personne,
        { texte: l.statut, style: STYLE_STATUT[l.statut] }, l.champs.hier, l.champs.aujourdhui,
        { texte: l.blocages.join('\n'), style: 'rouge' }, l.absence])
    };
    if (!avecBlocages) return [daily];
    const blocages = {
      nom: 'Blocages',
      colonnes: [{ titre: 'Date', largeur: 12 }, { titre: 'Code projet', largeur: 11 }, { titre: 'Projet', largeur: 28 },
        { titre: 'Personne', largeur: 22 }, { titre: 'Blocage', largeur: 70 }],
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
  dailyEquipesDecaler: d => majUi('dailyEquipes', { jour: Ecrans.daily.decaler(Ecrans.dailyEquipes.jour(), Number(d.sens)) })
});
