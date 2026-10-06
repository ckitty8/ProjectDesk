/* ============================================================
   Général › Administration (maquette 04-gAdmin.png) — LECTURE SEULE
   Onglets Équipes, Référentiels (champs du formulaire de demande retirés le 2026-10-05 :
   demandes gérées dans Azure DevOps).
   Règle : la section « Général » ne modifie jamais rien. Les
   modifications se font dans Mon dashboard › Administration
   (administrateurs globaux ; contrôlé aussi par la base).
   Les tableaux « Équipes » et « Référentiels » sont partagés avec
   Mon admin via le paramètre « modifiable ».
   ============================================================ */
'use strict';

const Administration = {
  // Tableau des équipes ; modifiable = boutons « Nouvelle équipe » / « Modifier »
  equipes(modifiable) {
    const esc = C.esc;
    const lignes = etat.d.equipes.map(e => {
      const resp = ressource(e.responsableId);
      const peutModifier = modifiable && (etat.estAdmin || estResponsableDe(e.id));
      return `<tr><td><span class="ligne-flex">${C.pastille(e.couleur)}${esc(e.nom)} ${C.code(e.prefixe)}</span></td><td>${resp ? esc(resp.nom) : '<span class="pale">—</span>'}</td>
        <td>${ressourcesActives().filter(r => r.equipeId === e.id).length}</td><td>${etat.d.projets.filter(p => p.equipeId === e.id).length}</td>
        <td class="num">${peutModifier ? `<a data-action="modifierEquipe" data-id="${e.id}">Modifier</a>` : ''}</td></tr>`;
    }).join('');
    return `<div class="carte"><div class="carte-titre"><h2>Équipes ${C.aide('rolesEquipe')}</h2>
        ${modifiable && etat.estAdmin ? '<button class="btn primaire" data-action="nouvelleEquipe">+ Nouvelle équipe</button>' : ''}</div>
      <table class="tableau"><thead><tr><th>Équipe</th><th>Responsable</th><th>Membres</th><th>Projets</th><th></th></tr></thead>
      <tbody>${lignes || `<tr><td colspan="5">${C.vide('Aucune équipe. Un administrateur crée la première équipe (Mon dashboard › Administration).')}</td></tr>`}</tbody></table></div>`;
  },

  // Référentiels et leurs valeurs ; modifiable = renommer, recolorer, activer, ajouter
  referentiels(modifiable) {
    const esc = C.esc, refId = ui('referentiels', { id: 'stp' }).id;
    const ref = referentielsVisibles().find(r => r.id === refId) || referentielsVisibles()[0];
    const gauche = referentielsVisibles().map(r => `<a class="menu-lien" style="color:var(--texte);justify-content:space-between;${r.id === ref.id ? 'background:#F3F6FF' : ''}"
      data-action="choisirReferentiel" data-id="${r.id}"><span>${esc(r.nom)}</span><span class="pale">${valeursDe(r.id, true).length}</span></a>`).join('');
    const valeurs = valeursDe(ref.id, true).map((v, i) => `
      <tr><td class="pale">${i + 1}</td>
        <td>${modifiable ? `<input class="champ" value="${esc(v.libelle)}" data-action-change="renommerValeur" data-id="${v.id}">` : esc(v.libelle)}
          ${v.systeme ? '<span class="pale" title="Utilisée par les calculs : renommable (les données suivent), non supprimable"> · système</span>' : ''}</td>
        <td>${modifiable ? `<input type="color" class="couleur-choix" value="${v.couleur}" data-action-change="colorerValeur" data-id="${v.id}">` : C.pastille(v.couleur)}</td>
        <td>${modifiable ? `<button class="interrupteur${v.actif ? ' actif' : ''}" data-action="basculerValeur" data-id="${v.id}"></button>` : (v.actif ? 'Oui' : '<span class="pale">Non</span>')}</td></tr>`).join('');
    return `<div style="display:grid;grid-template-columns:240px minmax(0,1fr);gap:16px;align-items:start">
      <div class="carte" style="padding:8px">${gauche}</div>
      <div class="carte"><div class="carte-titre"><h2>${esc(ref.nom)} ${valeursDe(ref.id, true).some(v => v.systeme) ? C.aide('referentielSysteme') : ''}</h2></div>
        <table class="tableau"><thead><tr><th>#</th><th>Valeur</th><th>Couleur</th><th>Active</th></tr></thead><tbody>${valeurs}</tbody></table>
        ${modifiable ? `<form class="ligne-flex" style="padding:12px 16px" data-action-envoi="ajouterValeur" data-ref="${ref.id}">
          <input class="champ" name="libelle" placeholder="Nouvelle valeur" required><button class="btn">Ajouter</button></form>` : ''}</div></div>`;
  }
};

Ecrans.administration = {
  titre: 'Administration',
  section: 'general',
  rendre() {
    const onglet = ui('administration', { onglet: 'equipes' }).onglet;
    const onglets = C.onglets([
      { id: 'equipes', libelle: 'Équipes', compte: etat.d.equipes.length },
      { id: 'referentiels', libelle: 'Référentiels', compte: referentielsVisibles().length }
    ], onglet, 'ongletAdministration');
    const corps = onglet === 'referentiels' ? Administration.referentiels(false) : Administration.equipes(false);
    const lienEdition = etat.estAdmin ? `<button class="btn" data-action="aller" data-ecran="monAdmin">Modifier (Mon dashboard › Administration)</button>` : '';
    return `
    <div class="ecran">
      ${C.entete('Administration', 'Équipes et référentiels · consultation', lienEdition)}
      ${onglets}${corps}
    </div>`;
  }
};

Object.assign(Actions, {
  ongletAdministration: d => majUi('administration', { onglet: d.id }),
  choisirReferentiel: d => majUi('referentiels', { id: d.id }),
  nouvelleEquipe: () => majEtat({ modale: { type: 'equipe', id: null } }),
  // (modifierEquipe est défini dans modale.js : il charge aussi les membres de l'équipe)

  // Renommer : la base propage le nouveau libellé aux données (projets, affectations…)
  renommerValeur: (d, el) => executer(() => Api.modifier('valeurs_referentiel', { id: 'eq.' + d.id }, { libelle: el.value.trim() }),
    'valeurs', 'projets', 'affectations', 'absences', 'ressources'),
  colorerValeur: (d, el) => executer(() => Api.modifier('valeurs_referentiel', { id: 'eq.' + d.id }, { couleur: el.value }), 'valeurs'),
  basculerValeur(d) {
    const v = parId('valeurs', d.id);
    executer(() => Api.modifier('valeurs_referentiel', { id: 'eq.' + d.id }, { actif: !v.actif }), 'valeurs');
  },
  ajouterValeur(d, form) {
    const libelle = new FormData(form).get('libelle').trim();
    const ordre = valeursDe(d.ref, true).length + 1;
    executer(() => Api.creer('valeurs_referentiel', { referentielId: d.ref, libelle, ordre, couleur: '#4A5363' }), 'valeurs');
  }
});
