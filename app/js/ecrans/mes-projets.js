/* ============================================================
   Mon dashboard › Projets et Roadmap (maquette menu-projets-roadmap/, porteur 2026-10-23) :
   sous-menu de la barre latérale, comme Gestion des ressources — Mises en production :
   saisie des MEP des projets que l'utilisateur peut modifier (table mises_en_production,
   migration 039), affichées dans Suivi de mes équipes › Projets et Roadmap › Planning projet.
   Le sous-menu « Gantt » a été retiré (porteur : le planning projet est dans Suivi de mes équipes).
   ============================================================ */
'use strict';

Ecrans.mesProjets = {
  titre: 'Projets et Roadmap',
  section: 'moi',
  rendre() {
    const actions = `<button class="btn" data-action="ouvrirObjectifs">Objectifs de l’équipe</button>
      <button class="btn primaire" data-action="nouveauProjet">+ Nouveau projet</button>`;
    return `<div class="ecran">${C.entete('Mises en production',
      'MEP des projets que vous pouvez modifier · affichées dans Suivi de mes équipes › Projets et Roadmap › Planning projet', actions)}${this.mep()}</div>`;
  },

  /* Formulaire d'ajout puis liste modifiable des MEP des projets que je peux modifier
     (peutEditerProjet, miroir de la règle RLS de mises_en_production) */
  mep() {
    const projets = etat.d.projets.filter(peutEditerProjet).sort(parCode);
    if (!projets.length) return `<div class="carte">${C.vide('Vous ne pouvez modifier aucun projet : pas de mise en production à saisir.')}</div>`;
    const choixProjets = projets.map(p => ({ valeur: p.id, libelle: p.nom }));
    const formulaire = `<form class="ligne-flex formulaire-mep" data-action-envoi="ajouterMep">
        ${C.liste(choixProjets, projets[0].id, 'class="champ champ-compact" name="projet"')}
        <input class="champ champ-date" type="date" name="jour" required>
        <input class="champ champ-version" name="version" placeholder="Version" maxlength="40">
        <input class="champ champ-contenu" name="contenu" placeholder="Contenu" maxlength="500">
        ${C.liste(STATUTS_MEP, 'prevue', 'class="champ champ-compact" name="statut"')}
        <button class="btn primaire">Ajouter</button></form>`;
    const lignes = misesEnProductionDe(projets).map(m => this.ligneMep(m)).join('');
    return `<div class="carte"><div class="carte-titre"><h2>Mises en production de mes projets</h2></div>${formulaire}
        <table class="tableau tableau-sprints"><thead><tr><th>Date</th><th>Projet</th><th>Version</th><th>Contenu</th><th>Statut</th><th></th></tr></thead>
          <tbody>${lignes || `<tr><td colspan="6" class="pale">Aucune mise en production saisie.</td></tr>`}</tbody></table></div>
      <div class="discret texte-12">Chaque chef de projet saisit les MEP de ses projets ; tout le monde les consulte dans
        Suivi de mes équipes › Projets et Roadmap › Planning projet.</div>`;
  },
  // Ligne modifiable d'une MEP : chaque champ s'enregistre dès qu'il change (majMep)
  ligneMep(m) {
    const p = projet(m.projetId), attr = champ => `data-action-change="majMep" data-id="${m.id}" data-champ="${champ}"`;
    return `<tr><td><input class="champ champ-date" type="date" value="${m.jour}" ${attr('jour')}></td>
      <td>${C.esc(p.nom)}</td>
      <td><input class="champ champ-version" value="${C.esc(m.version || '')}" maxlength="40" ${attr('version')}></td>
      <td><input class="champ champ-contenu" value="${C.esc(m.contenu || '')}" maxlength="500" ${attr('contenu')}></td>
      <td>${C.liste(STATUTS_MEP, m.statut, `class="champ champ-compact" ${attr('statut')}`)}</td>
      <td>${C.boutonIcone('supprimer', 'supprimerMep', `data-id="${m.id}"`, 'Supprimer cette mise en production')}</td></tr>`;
  }
};

Object.assign(Actions, {
  nouveauProjet: d => majEtat({ panneau: { type: 'nouveauProjet', equipeId: (d && d.equipe) || null } }),
  ouvrirObjectifs: () => majEtat({ modale: { type: 'objectifs' } }),
  /* Mises en production (table mises_en_production, migration 039) */
  ajouterMep(d, form) {
    const f = Object.fromEntries(new FormData(form));
    executer(() => Api.creer('mises_en_production', { projetId: f.projet, jour: f.jour, version: f.version.trim() || null,
      contenu: f.contenu.trim() || null, statut: f.statut }), 'misesEnProduction');
  },
  // Modification d'un champ ; la date est obligatoire (on remet l'ancienne valeur si elle est vidée)
  majMep(d, el) {
    const valeur = el.value.trim() || null;
    if (d.champ === 'jour' && !valeur) {
      el.value = etat.d.misesEnProduction.find(m => m.id === d.id).jour;
      return notifier('La date de la MEP est obligatoire', 'erreur');
    }
    executer(() => Api.modifier('mises_en_production', { id: 'eq.' + d.id }, { [d.champ]: valeur }), 'misesEnProduction');
  },
  supprimerMep(d) {
    if (!confirm('Supprimer cette mise en production ?')) return;
    executer(() => Api.supprimer('mises_en_production', { id: 'eq.' + d.id }), 'misesEnProduction');
  }
});
