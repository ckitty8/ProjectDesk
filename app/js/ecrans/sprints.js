/* ============================================================
   Mon dashboard › Projets et Roadmap › Sprints (maquette sprints-mon-dashboard/, porteur 2026-10-23 ;
   auparavant onglet Sprints de Mon dashboard › Administration)
   Création et modification des sprints de chaque projet (table sprints_projet) : numéro, année,
   version, début, fin. Modifiable par ceux qui peuvent modifier le projet (peutEditerProjet).
   Les sprints s'affichent dans Suivi de mes équipes › Projets et Roadmap › Planning projet et
   servent à Capacité (bouton « Sprints du projet » → allerSprints).
   ============================================================ */
'use strict';

Ecrans.mesSprints = {
  titre: 'Projets et Roadmap',
  section: 'moi',
  rendre() {
    return `<div class="ecran">${C.entete('Sprints',
      'Sprints de vos projets · affichés dans Suivi de mes équipes › Projets et Roadmap › Planning projet et utilisés par Capacité')}${this.sprints()}</div>`;
  },

  /* ---------- Sprints de chaque projet ----------
     Saisis par le porteur pour chaque projet (demande du 2026-10-05) : nom de la version, date de
     début, date de fin (table sprints_projet, migration 014). Un seul endroit pour la liste des
     sprints : l'onglet Capacité et, demain, la roadmap (liste déroulante) l'utilisent
     (docs/specifications/roadmap.md § 2). Modifiable par ceux qui peuvent modifier le projet. */
  sprints() {
    const projets = etat.d.projets;
    const p = parId('projets', ui('sprints', {}).projetSprints) || projets.find(x => x.nom === 'CDO') || projets[0];
    if (!p) return `<div class="carte">${C.vide('Aucun projet.')}</div>`;
    const selecteur = C.liste(projets.map(x => ({ valeur: x.id, libelle: `${x.code} · ${x.nom}` })), p.id,
      'class="champ champ-compact" data-action-change="projetSprints"');
    // Affichage par année (demande du porteur, 2026-10-05) : années des sprints du projet + année en cours
    const annee = Number(ui('sprints', {}).anneeSprints) || Number(Calculs.aujourdhui().slice(0, 4));
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
    // Une ligne par sprint : champs modifiables (ou texte en lecture), « en cours », suppression
    const ligne = s => {
      const enCours = s.debut <= jour && jour <= s.fin ? ' <span class="discret texte-11">en cours</span>' : '';
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
    const ajout = editable ? `<tr class="ligne-ajout"><td><span class="ligne-flex">Sprint<input class="champ champ-numero" type="number" min="1"
        name="numeroSprint" form="ajout-sprint" value="${numeroSuivant}" required></span></td>
        <td><input class="champ champ-numero" type="number" min="2000" max="2100" name="annee" form="ajout-sprint" value="${annee}" required></td>
        <td><input class="champ" name="nom" form="ajout-sprint" placeholder="Version (ex. V3.2)"></td>
        <td><input class="champ champ-date" type="date" name="debut" form="ajout-sprint" required></td>
        <td><input class="champ champ-date" type="date" name="fin" form="ajout-sprint" required></td>
        <td><button class="btn primaire" form="ajout-sprint" title="Ajouter le sprint">+</button></td></tr>` : '';
    return `<div><div class="discret" style="margin:4px 0 8px">
      ${editable ? 'Saisissez le numéro du sprint, son année, le nom de la version, la date de début et la date de fin.'
        : 'Lecture seule : vous ne pouvez pas modifier ce projet.'} ${C.aide('sprintsProjet')}</div>
      ${editable ? `<form id="ajout-sprint" data-action-envoi="ajouterSprint" data-projet="${p.id}"></form>` : ''}
      <table class="tableau tableau-sprints"><thead><tr><th>Sprint</th><th>Année</th><th>Version</th><th>Début</th><th>Fin</th><th></th></tr></thead>
        <tbody>${sprints.map(ligne).join('') || (editable ? '' : `<tr><td colspan="6" class="pale">Aucun sprint en ${annee}.</td></tr>`)}${ajout}</tbody></table></div>`;
  },
};

Object.assign(Actions, {
  projetSprints: (_, el) => majUi('sprints', { projetSprints: el.value }),
  // Depuis Capacité : ouvre Projets et Roadmap › Sprints sur le projet affiché
  allerSprints: d => { majUi('sprints', { projetSprints: d.id }, { rendre: false }); allerA('mesSprints'); },
  /* Sprints du projet (table sprints_projet ; clé projet + numéro, attribué à l'ajout) */
  anneeSprints: d => majUi('sprints', { anneeSprints: Number(d.annee) }),
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
      form.reset(); majUi('sprints', { anneeSprints: annee }, { rendre: false });
    }, 'sprintsProjet');
  },
  // Modification d'un champ d'un sprint (numéro, année, version, dates) avec ses contrôles : dates obligatoires, fin après début, « Sprint N » unique par année
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
    modifierSprint(d.projet, d.numero, { [d.champ]: valeur });
  },
  supprimerSprint(d) {
    if (!confirm('Supprimer ce sprint ? Ses points et sa répartition saisis seront supprimés.')) return;
    executer(async () => {
      await Api.supprimer('repartitions_sprint', { projet_id: 'eq.' + d.projet, numero: 'eq.' + d.numero });
      await Api.supprimer('sprints_projet', { projet_id: 'eq.' + d.projet, numero: 'eq.' + d.numero });
    }, 'sprintsProjet', 'repartitionsSprint');
  }
});
