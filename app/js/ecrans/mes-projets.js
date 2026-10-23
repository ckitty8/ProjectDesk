/* ============================================================
   Mon dashboard › Projets et Roadmap (maquette 07-mProjets.png)
   Onglets (porteur 2026-10-23, maquette roadmap-mep-sprints/4-saisie-mon-dashboard.png) :
   - Gantt : diagramme des projets où l'utilisateur est affecté. Barre claire = durée
     planifiée, barre pleine = avancement. Clic sur une barre : panneau projet ;
   - MEP : saisie des mises en production des projets que l'utilisateur peut modifier
     (table mises_en_production, migration 039), consultées dans Suivi de mes équipes ›
     Projets et Roadmap › Planning des MEP.
   ============================================================ */
'use strict';

Ecrans.mesProjets = {
  titre: 'Projets et Roadmap',
  section: 'moi',
  rendre() {
    const moi = maRessource(), onglet = ui('mesProjets', { onglet: 'gantt' }).onglet;
    const mesAffectations = moi ? etat.d.affectations.filter(a => a.ressourceId === moi.id) : [];
    const lignes = mesAffectations.map(a => ({ p: projet(a.projetId), role: a.role })).filter(x => x.p && x.p.debut && x.p.fin)
      .sort((x, y) => x.p.debut.localeCompare(y.p.debut));
    const nbChef = lignes.filter(x => x.role === ROLES_PROJET.CHEF).length;

    const actions = `<button class="btn" data-action="ouvrirObjectifs">Objectifs de l’équipe</button>
      <button class="btn primaire" data-action="nouveauProjet">+ Nouveau projet</button>`;
    const avertissement = !moi ? `<div class="carte encart-moyen">Votre compte n’est lié à aucune fiche ressource.
      Demandez à votre équipe de créer votre fiche (Liste des ressources) avec votre email : le lien se fait à la connexion.</div>` : '';
    const onglets = C.onglets([{ id: 'gantt', libelle: 'Gantt' }, { id: 'mep', libelle: 'MEP' }], onglet, 'ongletMesProjets');

    return `
    <div class="ecran">
      ${C.entete('Mes projets et Roadmap', `${lignes.length} projets dont ${nbChef} en tant que chef de projet · cliquez sur une barre pour ouvrir le projet`, actions)}
      ${avertissement}${onglets}
      ${onglet === 'mep' ? this.mep() : this.gantt(lignes)}
    </div>`;
  },

  // Onglet Gantt : échelle du 1er du mois du début le plus tôt à la fin du mois de l'échéance la plus tardive
  gantt(lignes) {
    const esc = C.esc, jour = Calculs.aujourdhui();
    let frise = '';
    if (lignes.length) {
      const debut = lignes.reduce((m, x) => x.p.debut < m ? x.p.debut : m, jour).slice(0, 8) + '01';
      const finMax = lignes.reduce((m, x) => x.p.fin > m ? x.p.fin : m, jour);
      const dFin = Calculs.depuisIso(finMax); const fin = Calculs.versIso(new Date(dFin.getFullYear(), dFin.getMonth() + 1, 0));
      const total = Calculs.ecartJours(debut, fin) + 1;
      const position = iso => Math.max(0, Math.min(100, Calculs.ecartJours(debut, iso) / total * 100));
      const mois = []; for (let d = Calculs.depuisIso(debut); Calculs.versIso(d) <= fin; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
        const nbJours = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        mois.push(`<div style="width:${nbJours / total * 100}%">${Calculs.MOIS_COURTS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}</div>`);
      }
      frise = `<div class="gantt-mois"><div class="libelle gantt-titre-col">Projet</div><div class="mois">${mois.join('')}</div></div>` +
        lignes.map(({ p, role }) => {
          const eq = equipe(p.equipeId), g = position(p.debut), l = position(p.fin) - g;
          return `<div class="gantt-ligne"><div><div>${C.code(p.code)} ${esc(p.nom)}</div>
              <div class="ligne-flex discret">${C.pastille(eq.couleur)}${esc(eq.nom)} ${C.badgeRef('role', role)}</div></div>
            <div class="gantt-piste"><div class="gantt-jour" style="left:${position(jour)}%"></div>
              <div class="gantt-barre" style="left:${g}%;width:${l}%;background:${C.teinte(eq.couleur, .12)}" data-action="ouvrirProjet" data-id="${p.id}"
                title="${Calculs.formatCourt(p.debut)} → ${Calculs.formatCourt(p.fin)}">
                <div class="gantt-plein" style="width:${Math.max(p.avancement, 8)}%;background:${eq.couleur}">${p.avancement}%</div></div></div></div>`;
        }).join('');
    }
    return `<div class="carte">${frise || C.vide('Aucun projet daté où vous êtes affecté(e).')}</div>
      <div class="discret"><span class="couleur-primaire">—</span> Aujourd’hui, ${Calculs.formatCourt(jour)} &nbsp;
        Barre claire : durée planifiée · barre pleine : avancement</div>`;
  },

  /* Onglet MEP : formulaire d'ajout puis liste modifiable des MEP des projets que je peux modifier
     (peutEditerProjet, miroir de la règle RLS de mises_en_production) */
  mep() {
    const projets = etat.d.projets.filter(peutEditerProjet).sort(parCode);
    if (!projets.length) return `<div class="carte">${C.vide('Vous ne pouvez modifier aucun projet : pas de mise en production à saisir.')}</div>`;
    const choixProjets = projets.map(p => ({ valeur: p.id, libelle: `${p.code} · ${p.nom}` }));
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
        Suivi de mes équipes › Projets et Roadmap › Planning des MEP.</div>`;
  },
  // Ligne modifiable d'une MEP : chaque champ s'enregistre dès qu'il change (majMep)
  ligneMep(m) {
    const p = projet(m.projetId), attr = champ => `data-action-change="majMep" data-id="${m.id}" data-champ="${champ}"`;
    return `<tr><td><input class="champ champ-date" type="date" value="${m.jour}" ${attr('jour')}></td>
      <td>${C.code(p.code)} ${C.esc(p.nom)}</td>
      <td><input class="champ champ-version" value="${C.esc(m.version || '')}" maxlength="40" ${attr('version')}></td>
      <td><input class="champ champ-contenu" value="${C.esc(m.contenu || '')}" maxlength="500" ${attr('contenu')}></td>
      <td>${C.liste(STATUTS_MEP, m.statut, `class="champ champ-compact" ${attr('statut')}`)}</td>
      <td>${C.boutonIcone('supprimer', 'supprimerMep', `data-id="${m.id}"`, 'Supprimer cette mise en production')}</td></tr>`;
  }
};

Object.assign(Actions, {
  nouveauProjet: d => majEtat({ panneau: { type: 'nouveauProjet', equipeId: (d && d.equipe) || null } }),
  ouvrirObjectifs: () => majEtat({ modale: { type: 'objectifs' } }),
  ongletMesProjets: d => majUi('mesProjets', { onglet: d.id }),
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
