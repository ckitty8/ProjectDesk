/* ============================================================
   Mon dashboard › Administration (maquette 10-mAdmin.png)
   - Demandes entrantes de mon équipe : colonnes par statut + fiche
     de traitement (analyse, acceptation/refus, création du projet).
   - Formulaire de demande : champs, ordre, obligatoire, aperçu.
     (Modification des champs réservée aux administrateurs globaux.)
   - Jours fériés (administrateurs globaux) : ajout, date, libellé,
     suppression ; ils s'affichent dans les calendriers et sont exclus
     des jours ouvrés (capacité, timesheet).
   - Équipes et Référentiels (administrateurs globaux, et responsables
     d'équipe pour « Modifier » leur équipe) : c'est ici, et non dans la
     section Général (lecture seule), que l'administration se modifie.
   Accessible sans équipe ouverte pour un administrateur (création de
   la première équipe) ; l'onglet Demandes demande alors une équipe.
   ============================================================ */
'use strict';

// Jour férié d'une date (null si aucun)
const parJour = jour => etat.d.joursFeries.find(f => f.jour === jour) || null;

Ecrans.monAdmin = {
  titre: 'Administration',
  section: 'moi',
  sansEquipePermis: () => etat.estAdmin,        // voir coquille.js : écran ouvert sans équipe
  rendre() {
    const u = ui('monAdmin', { onglet: etat.equipeCourante ? 'demandes' : 'equipes' });
    const miennes = etat.d.demandes.filter(dm => dm.equipeId === etat.equipeCourante);
    const gereEquipes = etat.estAdmin || mesEquipes().some(e => estResponsableDe(e.id));
    const onglets = C.onglets([
      { id: 'demandes', libelle: 'Demandes entrantes', compte: miennes.filter(dm => ['nouvelle', 'analyse'].includes(dm.statut)).length },
      { id: 'formulaire', libelle: 'Formulaire de demande', compte: etat.d.champs.length },
      ...(gereEquipes ? [{ id: 'equipes', libelle: 'Équipes', compte: etat.d.equipes.length }] : []),
      ...(etat.estAdmin ? [{ id: 'referentiels', libelle: 'Référentiels', compte: etat.d.referentiels.length },
        { id: 'feries', libelle: 'Jours fériés', compte: etat.d.joursFeries.length }] : [])
    ], u.onglet, 'ongletMonAdmin');
    let corps;
    if (u.onglet === 'equipes') corps = Administration.equipes(true);
    else if (u.onglet === 'referentiels') corps = Administration.referentiels(etat.estAdmin);
    else if (u.onglet === 'formulaire') corps = this.formulaire();
    else if (u.onglet === 'feries' && etat.estAdmin) corps = this.feries();
    else corps = etat.equipeCourante ? this.demandes(miennes, u.selection)
      : `<div class="carte">${C.vide('Ouvrez ou créez une équipe (onglet Équipes) pour traiter ses demandes.')}</div>`;
    const sousTitre = etat.equipeCourante ? `Demandes adressées à l’équipe ${C.esc(equipe(etat.equipeCourante).nom)}, formulaire${gereEquipes ? ', équipes' : ''}${etat.estAdmin ? ' et référentiels' : ''}`
      : 'Création des équipes, référentiels et formulaire de demande';
    return `
    <div class="ecran" style="max-width:1500px">
      ${C.entete('Administration', sousTitre)}
      ${onglets}${corps}
    </div>`;
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

  demandes(liste, selectionId) {
    const esc = C.esc;
    const selection = liste.find(dm => dm.id === selectionId) || liste[0];
    const colonnes = Object.entries(STATUTS_DEMANDE).map(([statut, s]) => {
      const fiches = liste.filter(dm => dm.statut === statut);
      return `<div class="colonne"><div class="colonne-titre"><span class="pastille" style="background:${s.point};border-radius:50%"></span>${s.libelle}
          <span class="pale" style="font-weight:400">${fiches.length}</span></div>
        ${fiches.map(dm => `<div class="fiche${selection && dm.id === selection.id ? ' selection' : ''}" data-action="choisirDemande" data-id="${dm.id}">
          <div class="ligne-flex" style="justify-content:space-between">${C.code(Calculs.numeroDemande(dm.numero))}
            <span style="color:${couleurDe('prio', dm.priorite)};font-size:11.5px;font-weight:500">${esc(dm.priorite || '')}</span></div>
          <div>${esc(dm.titre)}</div><div class="discret" style="font-size:12px">${esc(dm.type || '')}</div>
          <div class="ligne-flex discret" style="justify-content:space-between;font-size:12px;white-space:nowrap">
            <span class="ligne-flex">${C.pastille(equipe(dm.equipeId).couleur)}${esc(equipe(dm.equipeId).nom)}</span>
            <span>${Calculs.formatCourt(dm.creeLe.slice(0, 10))}</span></div></div>`).join('')}</div>`;
    }).join('');
    return `<div style="display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:16px;align-items:start">
      <div class="kanban">${colonnes}</div>${selection ? this.fiche(selection) : `<div class="carte">${C.vide('Aucune demande adressée à votre équipe.')}</div>`}</div>`;
  },

  // Fiche de traitement d'une demande
  fiche(dm) {
    const esc = C.esc, s = STATUTS_DEMANDE[dm.statut];
    const etapes = [['Reçue', true], ['En analyse', dm.statut !== 'nouvelle'], ['Décision', ['acceptee', 'refusee'].includes(dm.statut)]]
      .map(([l, fait]) => `<div class="etape${fait ? ' faite' : ''}"><span class="rond"></span>${l}</div>`).join('');
    // Champs ajoutés par l'administration (stockés dans « valeurs »)
    const extras = etat.d.champs.filter(c => !c.cle && dm.valeurs && dm.valeurs[c.id] !== undefined)
      .map(c => `<span>${esc(c.libelle)}</span><span>${esc(dm.valeurs[c.id])}</span>`).join('');
    const projetCree = projet(dm.projetId);
    let boutons = '';
    if (dm.statut === 'nouvelle') boutons = `<button class="btn primaire" data-action="statutDemande" data-id="${dm.id}" data-statut="analyse">Démarrer l’analyse</button>`;
    if (dm.statut === 'analyse') boutons = `<button class="btn" data-action="statutDemande" data-id="${dm.id}" data-statut="refusee">Refuser</button>
      <button class="btn succes" data-action="statutDemande" data-id="${dm.id}" data-statut="acceptee">Accepter</button>`;
    if (['acceptee', 'refusee'].includes(dm.statut)) boutons = `<button class="btn" data-action="statutDemande" data-id="${dm.id}" data-statut="analyse">Rouvrir l’analyse</button>`
      + (dm.statut === 'acceptee' && !projetCree ? `<button class="btn primaire" data-action="projetDepuisDemande" data-id="${dm.id}">Créer le projet</button>` : '');
    return `<div class="carte">
      <div style="padding:16px;border-bottom:1px solid var(--bordure-fine)">
        <div class="ligne-flex" style="justify-content:space-between">${C.code(Calculs.numeroDemande(dm.numero))}${C.badge(s.libelle, s.texte, s.fond)}</div>
        <h2 style="margin-top:6px">${esc(dm.titre)}</h2>
        <div class="discret">${esc(dm.demandeurNom || '')}${dm.service ? ' · ' + esc(dm.service) : ''} · reçue le ${Calculs.formatCourt(dm.creeLe.slice(0, 10))}</div></div>
      <div style="padding:14px 16px;border-bottom:1px solid var(--bordure-fine)" class="etapes">${etapes}</div>
      <div style="padding:14px 16px;border-bottom:1px solid var(--bordure-fine)" class="infos">
        <span>Type</span><span>${esc(dm.type || '—')}</span>
        <span>Équipe</span><span class="ligne-flex">${C.pastille(equipe(dm.equipeId).couleur)}${esc(equipe(dm.equipeId).nom)}</span>
        <span>Priorité</span><span style="color:${couleurDe('prio', dm.priorite)}">${esc(dm.priorite || '—')}</span>
        <span>Date souhaitée</span><span>${Calculs.formatAvecAnnee(dm.dateSouhaitee)}</span>
        <span>Budget estimé</span><span>${dm.budget != null ? Calculs.nombre(dm.budget) + ' k€' : '—'}</span>
        ${extras}${projetCree ? `<span>Projet créé</span><span><a data-action="ouvrirProjet" data-id="${projetCree.id}">${esc(projetCree.code)} · ${esc(projetCree.nom)}</a></span>` : ''}
      </div>
      <div style="padding:14px 16px;border-bottom:1px solid var(--bordure-fine)"><div class="libelle">Description du besoin</div>${esc(dm.description || '—').replace(/\n/g, '<br>')}</div>
      <div style="padding:14px 16px;border-bottom:1px solid var(--bordure-fine)"><div class="libelle">Commentaire d’analyse</div>
        <textarea class="champ" rows="3" placeholder="Estimation, dépendances, motif de refus…" data-action-change="commenterDemande" data-id="${dm.id}">${esc(dm.commentaire || '')}</textarea></div>
      <div style="padding:12px 16px;display:flex;justify-content:flex-end;gap:8px">${boutons}</div>
    </div>`;
  },

  formulaire() {
    const esc = C.esc, admin = etat.estAdmin, champs = etat.d.champs;
    const typeNouveau = ui('monAdmin', { typeNouveau: 'Texte court' }).typeNouveau;
    const lignes = champs.map((c, i) => `<tr>
      <td class="pale">${admin ? `<button class="lien-btn" data-action="deplacerChamp" data-id="${c.id}" data-sens="-1" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button class="lien-btn" data-action="deplacerChamp" data-id="${c.id}" data-sens="1" ${i === champs.length - 1 ? 'disabled' : ''}>▼</button>` : i + 1}</td>
      <td>${admin ? `<input class="champ" value="${esc(c.libelle)}" data-action-change="renommerChamp" data-id="${c.id}">` : esc(c.libelle)}
        ${c.type === 'Liste' ? `<div class="discret" style="font-size:12px;margin-top:3px">Référentiel : ${esc(c.referentielId === 'equipes' ? 'Équipes' : (parId('referentiels', c.referentielId) || {}).nom || '—')}</div>` : ''}</td>
      <td>${esc(c.type)}</td>
      <td><button class="interrupteur${c.obligatoire ? ' actif' : ''}" ${admin ? `data-action="basculerObligatoire" data-id="${c.id}"` : 'disabled'}></button></td>
      <td class="num">${admin && !c.systeme ? `<a class="discret" data-action="supprimerChamp" data-id="${c.id}">Supprimer</a>` : c.systeme ? '<span class="pale">système</span>' : ''}</td></tr>`).join('');
    const ajout = admin ? `<div style="padding:12px 16px;border-top:1px solid var(--bordure-fine)" class="pile">
      <div class="libelle" style="margin:0">Ajouter un champ</div>
      <div class="puces">${TYPES_CHAMP.map(t => `<button class="puce${t === typeNouveau ? ' active' : ''}" data-action="choisirTypeChamp" data-type="${t}">${t}</button>`).join('')}
        <button class="btn primaire" data-action="ajouterChamp">+ Ajouter</button></div></div>`
      : `<div class="discret" style="padding:12px 16px">Seuls les administrateurs globaux modifient le formulaire.</div>`;
    return `<div style="display:grid;grid-template-columns:minmax(0,1fr) 420px;gap:16px;align-items:start">
      <div class="carte"><div class="carte-titre"><h2>Champs</h2></div>
        <table class="tableau"><thead><tr><th>Ordre</th><th>Libellé</th><th>Type</th><th>Requis</th><th></th></tr></thead><tbody>${lignes}</tbody></table>${ajout}</div>
      <div class="carte"><div class="carte-titre"><h2>Aperçu demandeur</h2><span class="discret">Nouvelle demande</span></div>
        <div class="pile" style="padding:16px">${FormulaireDemande.rendre(true)}<div style="text-align:right"><button class="btn primaire" disabled>Envoyer la demande</button></div></div></div>
    </div>`;
  }
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
  choisirDemande: d => majUi('monAdmin', { selection: d.id }),
  statutDemande: d => executer(() => Api.modifier('demandes', { id: 'eq.' + d.id }, { statut: d.statut }), 'demandes'),
  commenterDemande: (d, el) => executer(() => Api.modifier('demandes', { id: 'eq.' + d.id }, { commentaire: el.value }), 'demandes'),
  // Ouvre le panneau « nouveau projet » pré-rempli avec la demande
  projetDepuisDemande(d) {
    const dm = parId('demandes', d.id);
    majEtat({ panneau: { type: 'nouveauProjet', demandeId: dm.id, nom: dm.titre, description: dm.description } });
  },

  choisirTypeChamp: d => majUi('monAdmin', { typeNouveau: d.type }),
  ajouterChamp() {
    const type = ui('monAdmin', { typeNouveau: 'Texte court' }).typeNouveau;
    const ordre = Math.max(0, ...etat.d.champs.map(c => c.ordre)) + 1;
    executer(() => Api.creer('champs_formulaire', { libelle: 'Nouveau champ', type, ordre, obligatoire: false, referentielId: type === 'Liste' ? 'prio' : null }), 'champs');
  },
  renommerChamp: (d, el) => executer(() => Api.modifier('champs_formulaire', { id: 'eq.' + d.id }, { libelle: el.value.trim() }), 'champs'),
  basculerObligatoire(d) { const c = parId('champs', d.id); executer(() => Api.modifier('champs_formulaire', { id: 'eq.' + d.id }, { obligatoire: !c.obligatoire }), 'champs'); },
  supprimerChamp(d) { if (confirm('Supprimer ce champ du formulaire ?')) executer(() => Api.supprimer('champs_formulaire', { id: 'eq.' + d.id }), 'champs'); },
  // Échange l'ordre avec le champ voisin
  deplacerChamp(d) {
    const champs = etat.d.champs, i = champs.findIndex(c => c.id === d.id), j = i + Number(d.sens);
    if (j < 0 || j >= champs.length) return;
    const a = champs[i], b = champs[j];
    executer(async () => {
      await Api.modifier('champs_formulaire', { id: 'eq.' + a.id }, { ordre: b.ordre });
      await Api.modifier('champs_formulaire', { id: 'eq.' + b.id }, { ordre: a.ordre });
    }, 'champs');
  }
});
