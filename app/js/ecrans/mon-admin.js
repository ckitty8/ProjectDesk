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
      { id: 'sprints', libelle: 'Sprints', compte: (etat.d.sprintsProjet || []).filter(x => x.debut).length }
    ], u.onglet, 'ongletMonAdmin');
    let corps;
    if (u.onglet === 'equipes') corps = Administration.equipes(true);
    else if (u.onglet === 'referentiels') corps = Administration.referentiels(etat.estAdmin);
    else if (u.onglet === 'feries' && etat.estAdmin) corps = this.feries();
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
    return `<div class="carte"><div class="carte-titre"><div class="ligne-flex"><h2>Sprints</h2>${selecteur}</div>
        <span class="discret">chaque projet a ses propres sprints</span></div>
      <div style="padding:0 16px 14px">${this.tableSprints(p, peutEditerProjet(p))}</div></div>`;
  },
  // Sprints d'un projet : une ligne par sprint (version, début, fin), puis une ligne d'ajout
  tableSprints(p, editable) {
    const esc = C.esc, f = Calculs.formatAvecAnnee, sprints = sprintsDuProjet(p.id), jour = Calculs.aujourdhui();
    const attr = (s, champ) => `data-action-change="majSprint" data-projet="${p.id}" data-numero="${s.numero}" data-champ="${champ}"`;
    const ligne = s => {
      const enCours = s.debut <= jour && jour <= s.fin ? ' <span class="discret" style="font-size:11px">en cours</span>' : '';
      return editable
        ? `<tr><td><input class="champ" value="${esc(s.nom || '')}" placeholder="Sprint ${s.numero}" ${attr(s, 'nom')}></td>
            <td><input class="champ champ-date" type="date" value="${s.debut}" ${attr(s, 'debut')}></td>
            <td><input class="champ champ-date" type="date" value="${s.fin}" ${attr(s, 'fin')}></td>
            <td>${C.boutonIcone('supprimer', 'supprimerSprint', `data-projet="${p.id}" data-numero="${s.numero}"`, 'Supprimer ce sprint')}</td></tr>`
        : `<tr><td>${esc(nomSprint(s))}${enCours}</td><td>${f(s.debut)}</td><td>${f(s.fin)}</td><td></td></tr>`;
    };
    const ajout = editable ? `<tr class="ligne-ajout"><td><input class="champ" name="nom" form="ajout-sprint" placeholder="Version (ex. V3.2)" required></td>
        <td><input class="champ champ-date" type="date" name="debut" form="ajout-sprint" required></td>
        <td><input class="champ champ-date" type="date" name="fin" form="ajout-sprint" required></td>
        <td><button class="btn primaire" form="ajout-sprint" title="Ajouter le sprint">+</button></td></tr>` : '';
    return `<div><div class="discret" style="margin:4px 0 8px">${editable ? 'Saisissez le nom de la version, la date de début et la date de fin de chaque sprint.' : 'Lecture seule : vous ne pouvez pas modifier ce projet.'} ${C.aide('sprintsProjet')}</div>
      ${editable ? `<form id="ajout-sprint" data-action-envoi="ajouterSprint" data-projet="${p.id}"></form>` : ''}
      <table class="tableau tableau-sprints"><thead><tr><th>Version</th><th>Début</th><th>Fin</th><th></th></tr></thead>
        <tbody>${sprints.map(ligne).join('') || (editable ? '' : '<tr><td colspan="4" class="pale">Aucun sprint saisi.</td></tr>')}${ajout}</tbody></table></div>`;
  },

  /* Jours fériés (table jours_feries, clé = la date), par année */
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
  projetSprints: (_, el) => majUi('monAdmin', { projetSprints: el.value }),
  // Depuis l'onglet Capacité : ouvre Administration › Sprints sur le projet affiché
  allerSprints: d => { majUi('monAdmin', { onglet: 'sprints', projetSprints: d.id }, { rendre: false }); allerA('monAdmin'); },
  /* Sprints du projet (table sprints_projet ; clé projet + numéro, attribué à l'ajout) */
  ajouterSprint(d, form) {
    const f = Object.fromEntries(new FormData(form));
    if (f.fin < f.debut) return notifier('La date de fin précède la date de début', 'erreur');
    // Numéro : après tous ceux déjà utilisés pour ce projet (points et répartitions compris), pour
    // qu'un nouveau sprint ne récupère jamais des saisies existantes
    const utilises = [...(etat.d.sprintsProjet || []), ...(etat.d.repartitionsSprint || [])].filter(s => s.projetId === d.projet).map(s => s.numero);
    const numero = Math.max(0, ...utilises) + 1;
    executer(async () => { await Api.creer('sprints_projet', { projetId: d.projet, numero, nom: f.nom.trim(), debut: f.debut, fin: f.fin }); form.reset(); }, 'sprintsProjet');
  },
  majSprint(d, el) {
    const s = (etat.d.sprintsProjet || []).find(x => x.projetId === d.projet && x.numero === Number(d.numero));
    const valeur = el.value.trim() || null;
    if (d.champ !== 'nom' && !valeur) { el.value = s[d.champ]; return notifier('Les dates du sprint sont obligatoires', 'erreur'); }
    const debut = d.champ === 'debut' ? valeur : s.debut, fin = d.champ === 'fin' ? valeur : s.fin;
    if (fin < debut) { el.value = s[d.champ]; return notifier('La date de fin précède la date de début', 'erreur'); }
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
