/* ============================================================
   Mon dashboard › Administration (maquette 10-mAdmin.png)
   (Demandes entrantes et formulaire de demande retirés le 2026-10-05 : les
   demandes sont gérées dans Azure DevOps ; tables conservées en base.)
   - Sprints (tous ; modification selon peutEditerProjet) : sprints de chaque
     projet — version, début, fin.
   - Jours fériés (administrateurs globaux) : ajout, date, libellé,
     suppression ; ils s'affichent dans les calendriers et sont exclus
     des jours ouvrés (capacité, timesheet).
   - Équipes et Référentiels (administrateurs globaux, et responsables
     d'équipe pour « Modifier » leur équipe) : c'est ici, et non dans la
     section Général (lecture seule), que l'administration se modifie.
   Accessible sans équipe ouverte pour un administrateur (création de
   la première équipe).
   ============================================================ */
'use strict';

// Jour férié d'une date (null si aucun)
const parJour = jour => etat.d.joursFeries.find(f => f.jour === jour) || null;

Ecrans.monAdmin = {
  titre: 'Administration',
  section: 'moi',
  sansEquipePermis: () => etat.estAdmin,        // voir coquille.js : écran ouvert sans équipe
  rendre() {
    const u = ui('monAdmin', { onglet: 'sprints' });
    const gereEquipes = etat.estAdmin || mesEquipes().some(e => estResponsableDe(e.id));
    const onglets = C.onglets([
      ...(gereEquipes ? [{ id: 'equipes', libelle: 'Équipes', compte: etat.d.equipes.length }] : []),
      ...(etat.estAdmin ? [{ id: 'referentiels', libelle: 'Référentiels', compte: referentielsVisibles().length },
        { id: 'feries', libelle: 'Jours fériés', compte: etat.d.joursFeries.length }] : []),
      ...(gereEquipes ? [{ id: 'envoiDaily', libelle: 'Envoi du daily', compte: (etat.d.envoisDaily || []).filter(x => x.mode !== 'aucun').length }] : []),
      { id: 'sprints', libelle: 'Sprints', compte: (etat.d.sprintsProjet || []).filter(x => x.debut).length }
    ], u.onglet, 'ongletMonAdmin');
    let corps;
    if (u.onglet === 'equipes') corps = Administration.equipes(true);
    else if (u.onglet === 'referentiels') corps = Administration.referentiels(etat.estAdmin);
    else if (u.onglet === 'feries' && etat.estAdmin) corps = this.feries();
    else if (u.onglet === 'envoiDaily' && gereEquipes) corps = this.envoiDaily();
    else corps = this.sprints();
    const sousTitre = `Sprints des projets${gereEquipes ? ', équipes' : ''}${etat.estAdmin ? ', référentiels et jours fériés' : ''}`;
    return `
    <div class="ecran" style="max-width:1500px">
      ${C.entete('Administration', sousTitre)}
      ${onglets}${corps}
    </div>`;
  },

  /* ---------- Onglet Sprints : sprints de chaque projet ----------
     Saisis par le porteur pour chaque projet (demande du 2026-10-05) : nom de la version, date de
     début, date de fin (table sprints_projet, migration 014). Un seul endroit pour la liste des
     sprints : l'onglet Capacité et, demain, la roadmap (liste déroulante) l'utilisent
     (docs/specifications/roadmap.md § 2). Modifiable par ceux qui peuvent modifier le projet. */
  sprints() {
    const projets = etat.d.projets;
    const p = parId('projets', ui('monAdmin', {}).projetSprints) || projets.find(x => x.nom === 'CDO') || projets[0];
    if (!p) return `<div class="carte">${C.vide('Aucun projet.')}</div>`;
    const selecteur = C.liste(projets.map(x => ({ valeur: x.id, libelle: `${x.code} · ${x.nom}` })), p.id,
      'class="champ" style="width:auto;height:30px" data-action-change="projetSprints"');
    // Affichage par année (demande du porteur, 2026-10-05) : années des sprints du projet + année en cours
    const annee = Number(ui('monAdmin', {}).anneeSprints) || Number(Calculs.aujourdhui().slice(0, 4));
    const annees = [...new Set([...sprintsDuProjet(p.id).map(anneeSprint), annee, Number(Calculs.aujourdhui().slice(0, 4))])].sort();
    const puces = annees.map(a => `<button class="puce${a === annee ? ' active' : ''}" data-action="anneeSprints" data-annee="${a}">${a}</button>`).join('');
    return `<div class="carte"><div class="carte-titre"><div class="ligne-flex"><h2>Sprints</h2>${selecteur}<div class="puces">${puces}</div></div>
        <span class="discret">chaque projet a ses propres sprints</span></div>
      <div style="padding:0 16px 14px">${this.tableSprints(p, peutEditerProjet(p), annee)}</div></div>`;
  },
  // Sprints d'un projet pour une année : une ligne par sprint (n°, année, version, début, fin), puis une ligne d'ajout
  tableSprints(p, editable, annee) {
    const esc = C.esc, f = Calculs.formatAvecAnnee, jour = Calculs.aujourdhui();
    const sprints = sprintsDuProjet(p.id).filter(s => anneeSprint(s) === annee);
    const attr = (s, champ) => `data-action-change="majSprint" data-projet="${p.id}" data-numero="${s.numero}" data-champ="${champ}"`;
    const numeroSuivant = Math.max(0, ...sprints.map(s => Number(s.numeroSprint) || 0)) + 1;
    const ligne = s => {
      const enCours = s.debut <= jour && jour <= s.fin ? ' <span class="discret" style="font-size:11px">en cours</span>' : '';
      return editable
        ? `<tr><td><span class="ligne-flex">Sprint<input class="champ champ-numero" type="number" min="1" value="${s.numeroSprint || ''}" ${attr(s, 'numeroSprint')}></span></td>
            <td><input class="champ champ-numero" type="number" min="2000" max="2100" value="${anneeSprint(s)}" ${attr(s, 'annee')}></td>
            <td><input class="champ" value="${esc(s.nom || '')}" placeholder="Version" ${attr(s, 'nom')}></td>
            <td><input class="champ champ-date" type="date" value="${s.debut}" ${attr(s, 'debut')}></td>
            <td><input class="champ champ-date" type="date" value="${s.fin}" ${attr(s, 'fin')}>${enCours}</td>
            <td>${C.boutonIcone('supprimer', 'supprimerSprint', `data-projet="${p.id}" data-numero="${s.numero}"`, 'Supprimer ce sprint')}</td></tr>`
        : `<tr><td>${s.numeroSprint ? 'Sprint ' + s.numeroSprint : '<span class="pale">—</span>'}${enCours}</td><td>${anneeSprint(s)}</td>
            <td>${esc(s.nom || '')}</td><td>${f(s.debut)}</td><td>${f(s.fin)}</td><td></td></tr>`;
    };
    const ajout = editable ? `<tr class="ligne-ajout"><td><span class="ligne-flex">Sprint<input class="champ champ-numero" type="number" min="1" name="numeroSprint" form="ajout-sprint" value="${numeroSuivant}" required></span></td>
        <td><input class="champ champ-numero" type="number" min="2000" max="2100" name="annee" form="ajout-sprint" value="${annee}" required></td>
        <td><input class="champ" name="nom" form="ajout-sprint" placeholder="Version (ex. V3.2)"></td>
        <td><input class="champ champ-date" type="date" name="debut" form="ajout-sprint" required></td>
        <td><input class="champ champ-date" type="date" name="fin" form="ajout-sprint" required></td>
        <td><button class="btn primaire" form="ajout-sprint" title="Ajouter le sprint">+</button></td></tr>` : '';
    return `<div><div class="discret" style="margin:4px 0 8px">${editable ? 'Saisissez le numéro du sprint, son année, le nom de la version, la date de début et la date de fin.' : 'Lecture seule : vous ne pouvez pas modifier ce projet.'} ${C.aide('sprintsProjet')}</div>
      ${editable ? `<form id="ajout-sprint" data-action-envoi="ajouterSprint" data-projet="${p.id}"></form>` : ''}
      <table class="tableau tableau-sprints"><thead><tr><th>Sprint</th><th>Année</th><th>Version</th><th>Début</th><th>Fin</th><th></th></tr></thead>
        <tbody>${sprints.map(ligne).join('') || (editable ? '' : `<tr><td colspan="6" class="pale">Aucun sprint en ${annee}.</td></tr>`)}${ajout}</tbody></table></div>`;
  },

  /* Jours fériés (table jours_feries, clé = la date), par année */
  /* ---------- Onglet Envoi du daily : réglage par équipe ----------
     Demande du porteur (2026-10-06) : chaque équipe choisit son mode d'envoi (MODES_ENVOI_DAILY),
     l'heure, les jours, l'exclusion des jours fériés et les destinataires. Modifiable par un
     administrateur ou le responsable de l'équipe ; une ligne par équipe dans envois_daily. */
  envoiDaily() {
    const esc = C.esc;
    // Équipes seulement : une direction (ex. DSI) est un service qui regroupe des équipes, sans daily propre
    const equipes = etat.d.equipes.filter(e => e.type !== 'direction' && (etat.estAdmin || estResponsableDe(e.id)));
    const JOURS = [[1, 'L'], [2, 'M'], [3, 'M'], [4, 'J'], [5, 'V']];
    const ligne = e => {
      const r = { ...ENVOI_DAILY_DEFAUT, ...((etat.d.envoisDaily || []).find(x => x.equipeId === e.id) || {}) };
      const attr = champ => `data-action-change="majEnvoiDaily" data-equipe="${e.id}" data-champ="${champ}"`;
      const actif = r.mode !== 'aucun', jours = String(r.jours || '').split(',');
      const detail = r.mode === 'power_automate'
        ? `<button class="btn petit" data-action="configurerPowerAutomate" data-equipe="${e.id}">Configurer le flux</button>
           <div class="discret" style="font-size:12px;margin-top:4px">votre flux lit le daily puis l’envoie depuis votre boîte</div>`
        : r.mode === 'direct' ? '<span class="discret" style="font-size:12px">L’application enverra l’e-mail à l’heure choisie — <b>à venir</b> (étape 2 : service d’envoi à créer)</span>'
        : '<span class="pale">—</span>';
      return `<tr><td><span class="ligne-flex">${C.pastille(e.couleur)}<b>${esc(e.nom)}</b></span></td>
        <td>${C.liste(MODES_ENVOI_DAILY, r.mode, `class="champ" style="height:30px;width:150px" ${attr('mode')}`)}</td>
        <td><input class="champ" type="time" style="height:30px;width:120px" value="${esc(r.heure)}" ${actif ? '' : 'disabled'} ${attr('heure')}></td>
        <td><div class="puces" style="flex-wrap:nowrap;gap:4px">${JOURS.map(([n, l]) => `<button class="puce${jours.includes(String(n)) ? ' active' : ''}" ${actif ? '' : 'disabled'}
          data-action="basculerJourEnvoi" data-equipe="${e.id}" data-jour="${n}" style="width:28px;justify-content:center;padding:0">${l}</button>`).join('')}</div></td>
        <td style="white-space:nowrap"><label class="ligne-flex"><input type="checkbox" ${r.sansFeries ? 'checked' : ''} ${actif ? '' : 'disabled'} ${attr('sansFeries')}> sauf fériés</label></td>
        <td><input class="champ" style="height:30px" placeholder="email1@…, email2@…" value="${esc(r.destinataires || '')}" ${actif ? '' : 'disabled'} ${attr('destinataires')}></td>
        <td>${detail}</td></tr>`;
    };
    return `<div class="carte"><div class="carte-titre"><h2>Envoi du daily par e-mail ${C.aide('envoiDaily')}</h2>
        <span class="discret">contenu : le daily de l’équipe du jour — blocages en tête, puis Hier / Aujourd’hui / Blocages de chacun, sans note, absents</span></div>
      <table class="tableau"><thead><tr><th>Équipe</th><th>Mode</th><th>Heure</th><th>Jours</th><th>Fériés</th><th style="width:22%">Destinataires</th><th style="width:20%">Mise en place</th></tr></thead>
      <tbody>${equipes.map(ligne).join('') || `<tr><td colspan="7">${C.vide('Aucune équipe.')}</td></tr>`}</tbody></table></div>`;
  },

  feries() {
    const esc = C.esc, annees = [...new Set(etat.d.joursFeries.map(f => f.jour.slice(0, 4)))].sort();
    const annee = ui('feries', { annee: Calculs.aujourdhui().slice(0, 4) }).annee;
    const lignes = etat.d.joursFeries.filter(f => f.jour.startsWith(annee)).map(f => `<tr>
        <td><input type="date" class="champ" style="width:auto" value="${f.jour}" data-action-change="dateFerie" data-jour="${f.jour}"></td>
        <td><input class="champ" value="${esc(f.libelle)}" data-action-change="libelleFerie" data-jour="${f.jour}"></td>
        <td class="num">${C.boutonIcone('supprimer', 'supprimerFerie', `data-jour="${f.jour}"`, 'Supprimer ce jour férié')}</td></tr>`).join('');
    const puces = [...new Set([...annees, annee])].sort().map(a =>
      `<button class="puce${a === annee ? ' active' : ''}" data-action="anneeFeries" data-annee="${a}">${a}</button>`).join('');
    return `<div class="carte"><div class="carte-titre"><h2>Jours fériés ${C.aide('joursFeries')}</h2><div class="puces">${puces}</div></div>
      <table class="tableau"><thead><tr><th>Date</th><th>Libellé</th><th class="num"></th></tr></thead>
        <tbody>${lignes || `<tr><td colspan="3">${C.vide('Aucun jour férié pour ' + annee + '.')}</td></tr>`}</tbody></table>
      <form class="ligne-flex" style="padding:12px 16px" data-action-envoi="ajouterFerie">
        <input type="date" class="champ" name="jour" required style="width:auto"><input class="champ" name="libelle" placeholder="Libellé (ex. Lundi de Pentecôte)" required>
        <button class="btn">Ajouter</button></form>
      <div class="discret" style="font-size:12px;padding:0 16px 14px">Affichés dans les calendriers avec le type « ${esc(ABSENCES.FERIE)} » ; non comptés comme jours ouvrés (capacité, timesheet).</div></div>`;
  },

};

/* Fenêtre « Power Automate » d'une équipe : lit (ou crée, ou renouvelle) la clé de l'équipe,
   puis l'aperçu du daily du jour avec cette clé (fonctions de la migration 017). */
async function ouvrirPowerAutomate(equipeId, renouveler) {
  try {
    const cle = await Api.executer('cle_envoi_daily', { p_equipe: equipeId, p_renouveler: renouveler });
    const apercu = await Api.executer('daily_equipe', { p_equipe: equipeId, p_cle: cle }).catch(() => null);
    majEtat({ modale: { type: 'envoiPowerAutomate', equipeId, cle, apercu } });
    if (renouveler) notifier('Nouvelle clé créée : mettez à jour le corps de l’action HTTP du flux');
  } catch (e) { notifier(e.message, 'erreur'); }
}

Object.assign(Actions, {
  /* Jours fériés (administrateurs) */
  anneeFeries: d => majUi('feries', { annee: d.annee }),
  ajouterFerie(_, form) {
    const f = Object.fromEntries(new FormData(form));
    if (parJour(f.jour)) return notifier('Ce jour est déjà férié', 'erreur');
    executer(() => Api.creer('jours_feries', { jour: f.jour, libelle: f.libelle.trim() }), 'joursFeries');
  },
  libelleFerie: (d, el) => el.value.trim() && executer(() => Api.modifier('jours_feries', { jour: 'eq.' + d.jour }, { libelle: el.value.trim() }), 'joursFeries'),
  dateFerie(d, el) {
    if (!el.value || el.value === d.jour) return;
    if (parJour(el.value)) { el.value = d.jour; return notifier('Ce jour est déjà férié', 'erreur'); }
    executer(() => Api.modifier('jours_feries', { jour: 'eq.' + d.jour }, { jour: el.value }), 'joursFeries');
  },
  supprimerFerie(d) {
    if (confirm('Supprimer ce jour férié ?')) executer(() => Api.supprimer('jours_feries', { jour: 'eq.' + d.jour }), 'joursFeries');
  },

  ongletMonAdmin: d => majUi('monAdmin', { onglet: d.id }),
  // Envoi du daily : écrit le réglage complet de l'équipe (valeurs par défaut si première saisie)
  majEnvoiDaily(d, el) {
    const actuel = { ...ENVOI_DAILY_DEFAUT, ...((etat.d.envoisDaily || []).find(x => x.equipeId === d.equipe) || {}) };
    const valeur = el.type === 'checkbox' ? el.checked : el.value.trim();
    const ligne = { equipeId: d.equipe, mode: actuel.mode, heure: actuel.heure, jours: actuel.jours, sansFeries: actuel.sansFeries, destinataires: actuel.destinataires, [d.champ]: valeur };
    // destinataires et jours peuvent être vides (aucun destinataire, aucun jour) : on garde ''
    executer(() => Api.creer('envois_daily', ligne, 'equipe_id', ['destinataires', 'jours']), 'envoisDaily');
  },
  // Fenêtre de mise en place Power Automate (voir ouvrirPowerAutomate)
  configurerPowerAutomate: d => ouvrirPowerAutomate(d.equipe, false),
  renouvelerCleDaily(d) {
    if (confirm('Renouveler la clé ? Le flux actuel cessera de fonctionner tant qu’il n’est pas mis à jour.')) ouvrirPowerAutomate(d.equipe, true);
  },
  copierTexte(d) {
    navigator.clipboard.writeText(d.texte).then(() => notifier('Copié'), () => notifier('Copie impossible : sélectionnez le texte', 'erreur'));
  },
  basculerJourEnvoi(d) {
    const actuel = (etat.d.envoisDaily || []).find(x => x.equipeId === d.equipe) || ENVOI_DAILY_DEFAUT;
    const jours = new Set(String(actuel.jours || '').split(',').filter(Boolean));
    jours.has(d.jour) ? jours.delete(d.jour) : jours.add(d.jour);
    Actions.majEnvoiDaily({ equipe: d.equipe, champ: 'jours' }, { value: [...jours].sort().join(',') });
  },
  projetSprints: (_, el) => majUi('monAdmin', { projetSprints: el.value }),
  // Depuis l'onglet Capacité : ouvre Administration › Sprints sur le projet affiché
  allerSprints: d => { majUi('monAdmin', { onglet: 'sprints', projetSprints: d.id }, { rendre: false }); allerA('monAdmin'); },
  /* Sprints du projet (table sprints_projet ; clé projet + numéro, attribué à l'ajout) */
  anneeSprints: d => majUi('monAdmin', { anneeSprints: Number(d.annee) }),
  ajouterSprint(d, form) {
    const f = Object.fromEntries(new FormData(form));
    const numeroSprint = Number(f.numeroSprint), annee = Number(f.annee);
    if (f.fin < f.debut) return notifier('La date de fin précède la date de début', 'erreur');
    if (sprintDejaPris(d.projet, annee, numeroSprint)) return notifier(`Le sprint ${numeroSprint} existe déjà en ${annee} pour ce projet`, 'erreur');
    // Clé technique : après tous les numéros déjà utilisés pour ce projet (points et répartitions
    // compris), pour qu'un nouveau sprint ne récupère jamais des saisies existantes
    const utilises = [...(etat.d.sprintsProjet || []), ...(etat.d.repartitionsSprint || [])].filter(s => s.projetId === d.projet).map(s => s.numero);
    const numero = Math.max(0, ...utilises) + 1;
    executer(async () => {
      await Api.creer('sprints_projet', { projetId: d.projet, numero, numeroSprint, annee, nom: f.nom.trim() || null, debut: f.debut, fin: f.fin });
      form.reset(); majUi('monAdmin', { anneeSprints: annee }, { rendre: false });
    }, 'sprintsProjet');
  },
  majSprint(d, el) {
    const s = (etat.d.sprintsProjet || []).find(x => x.projetId === d.projet && x.numero === Number(d.numero));
    const brut = el.value.trim(), entier = ['numeroSprint', 'annee'].includes(d.champ);
    const valeur = brut === '' ? null : entier ? Number(brut) : brut;
    const annuler = message => { el.value = s[d.champ] ?? ''; notifier(message, 'erreur'); };
    if (['debut', 'fin'].includes(d.champ) && !valeur) return annuler('Les dates du sprint sont obligatoires');
    const debut = d.champ === 'debut' ? valeur : s.debut, fin = d.champ === 'fin' ? valeur : s.fin;
    if (fin < debut) return annuler('La date de fin précède la date de début');
    const numeroSprint = d.champ === 'numeroSprint' ? valeur : s.numeroSprint, annee = d.champ === 'annee' ? valeur : anneeSprint(s);
    if (numeroSprint && sprintDejaPris(d.projet, annee, numeroSprint, s.numero)) return annuler(`Le sprint ${numeroSprint} existe déjà en ${annee} pour ce projet`);
    executer(() => Api.modifier('sprints_projet', { projet_id: 'eq.' + d.projet, numero: 'eq.' + d.numero }, { [d.champ]: valeur }), 'sprintsProjet');
  },
  supprimerSprint(d) {
    if (!confirm('Supprimer ce sprint ? Ses points et sa répartition saisis seront supprimés.')) return;
    executer(async () => {
      await Api.supprimer('repartitions_sprint', { projet_id: 'eq.' + d.projet, numero: 'eq.' + d.numero });
      await Api.supprimer('sprints_projet', { projet_id: 'eq.' + d.projet, numero: 'eq.' + d.numero });
    }, 'sprintsProjet', 'repartitionsSprint');
  }
});
