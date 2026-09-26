/* ============================================================
   Mon dashboard › Administration (maquette 10-mAdmin.png)
   - Demandes entrantes de mon équipe : colonnes par statut + fiche
     de traitement (analyse, acceptation/refus, création du projet).
   - Formulaire de demande : champs, ordre, obligatoire, aperçu.
     (Modification des champs réservée aux administrateurs globaux.)
   - Trucs et astuces (tous) : KPI Agile Scrum et Kanban, avec exemples
     calculés sur un projet (par défaut CDO).
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
        { id: 'feries', libelle: 'Jours fériés', compte: etat.d.joursFeries.length }] : []),
      { id: 'astuces', libelle: 'Trucs et astuces' }
    ], u.onglet, 'ongletMonAdmin');
    let corps;
    if (u.onglet === 'equipes') corps = Administration.equipes(true);
    else if (u.onglet === 'referentiels') corps = Administration.referentiels(etat.estAdmin);
    else if (u.onglet === 'formulaire') corps = this.formulaire();
    else if (u.onglet === 'feries' && etat.estAdmin) corps = this.feries();
    else if (u.onglet === 'astuces') corps = this.astuces();
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

  /* ---------- Trucs et astuces : KPI Agile (Scrum, Kanban) avec exemples chiffrés ----------
     Textes : KPI_AGILE (config.js). Exemples : calculés sur le projet choisi (par défaut CDO) —
     équipe, capacité et absences du sprint en cours sont réels ; les KPI qui reposent sur des
     tickets passent sur les chiffres du projet dès qu'il en a, sinon l'exemple est illustratif
     (signalé comme tel) et dimensionné sur la taille de l'équipe. */
  astuces() {
    const esc = C.esc, n = Calculs.nombre;
    const projets = etat.d.projets.filter(p => etat.d.affectations.some(a => a.projetId === p.id));
    const choisi = parId('projets', ui('astuces', {}).projetId) || projets.find(p => p.nom === 'CDO') || projets[0];
    if (!choisi) return `<div class="carte">${C.vide('Aucun projet avec des membres : les exemples ont besoin d’un projet.')}</div>`;
    const ex = this.exemplesKpi(choisi);
    const selecteur = C.liste(projets.map(p => ({ valeur: p.id, libelle: `${p.code} · ${p.nom}` })), choisi.id,
      'class="champ" style="width:auto" data-action-change="projetAstuces"');
    const sections = KPI_AGILE.map(sec => `<div class="carte"><div class="carte-titre"><h2>${esc(sec.titre)}</h2></div>
      <table class="tableau tableau-kpi"><thead><tr><th>Indicateur</th><th>Définition / formule</th><th>Comment le lire</th><th>Exemple · ${esc(choisi.nom)}</th></tr></thead>
      <tbody>${sec.kpi.map(([cle, nom, def, lecture]) => `<tr><td><b>${esc(nom)}</b></td><td>${esc(def)}</td><td class="discret">${esc(lecture)}</td>
        <td>${ex[cle] || ''}</td></tr>`).join('')}</tbody></table></div>`).join('');
    return `<div class="carte" style="padding:14px 16px"><div class="ligne-flex" style="justify-content:space-between">
        <div><b>KPI Agile — Scrum et Kanban</b><div class="discret" style="font-size:12.5px">Les exemples sont calculés sur le projet choisi.
          <span class="badge-reel">réel</span> = données du projet ; <span class="badge-illustratif">illustratif</span> = exemple à défaut de données (tickets, sprints passés).</div></div>
        <div class="ligne-flex"><span class="discret">Projet d’exemple</span>${selecteur}</div></div></div>${sections}`;
  },

  // Exemples chiffrés par KPI (clé de KPI_AGILE → HTML) pour un projet
  exemplesKpi(p) {
    const n = Calculs.nombre, esc = C.esc, fer = feries();
    const reel = t => `<span class="badge-reel">réel</span> ${t}`, illu = t => `<span class="badge-illustratif">illustratif</span> ${t}`;
    const membres = etat.d.affectations.filter(a => a.projetId === p.id).map(a => ressource(a.ressourceId)).filter(Boolean);
    const nb = membres.length, noms = membres.map(r => esc(r.nom.split(' ')[0])).join(', ');
    const sprint = Calculs.sprintDe(Calculs.aujourdhui());
    const cap = Calculs.capacitePeriode(membres, sprint.debut, sprint.fin, etat.d.absences, fer);
    const scrum = Calculs.capaciteScrum(membres, cap.disponible);
    const absents = n(cap.theorique - cap.disponible);
    const t = Calculs.statsTickets(etat.d.tickets.filter(x => x.projetId === p.id));
    const velo = Math.round(nb * 6.5);                       // hypothèse illustrative : ~6,5 points par personne et par sprint
    return {
      velocite: t.termines ? reel(`${t.termines} ticket(s) terminé(s) sur ${t.total} depuis le début du projet.`)
        : illu(`${nb} personnes (${noms}) terminent ${velo - 3}, ${velo + 2} puis ${velo + 1} points sur 3 sprints → vélocité ≈ ${velo} points.`),
      capacite: reel(`Sprint ${sprint.numero} : ${n(cap.theorique)} j théoriques pour ${nb} personnes, ${absents} j d’absence → <b>${n(cap.disponible)} j</b> disponibles.`),
      engagement: illu(`L’équipe engage ${velo} points et en termine ${velo - 2} → say/do = ${Math.round((velo - 2) / velo * 100)} %.`),
      burndown: illu(`${velo} points sur 10 jours ouvrés → pente idéale ${n(velo / 10)} point/jour ; au jour 5, il devrait rester ≈ ${n(velo / 2)} points.`),
      burnup: illu(`Release de 120 points, ${velo * 3} livrés en 3 sprints ; si 10 points s’ajoutent au périmètre, la ligne cible monte à 130.`),
      objectif: illu('4 objectifs de sprint atteints sur les 5 derniers sprints → 80 %.'),
      focus: reel(`Capacité engageable ce sprint : (${n(cap.disponible)} − ${n(scrum.ceremonies)} j de cérémonies) × ${Math.round(CONFIG.FACTEUR_FOCUS * 100)} % = <b>${n(scrum.engageable)} j</b>`)
        + `<br>${illu(`vélocité ${velo} points ÷ ${n(cap.disponible)} j = ${n(cap.disponible ? velo / cap.disponible : 0)} point/jour-homme.`)}`,
      debordement: illu(`3 points non terminés sur ${velo} engagés → ${Math.round(3 / velo * 100)} % de débordement.`),
      defauts: illu('2 anomalies remontées en recette après la livraison du sprint.'),
      imprevus: illu(`${n(cap.disponible * 0.15)} j de support sur ${n(cap.disponible)} j disponibles → 15 % d’imprévus.`),
      bonheur: illu(`Notes de rétrospective de ${noms} : 4, 3 et 4 → 3,7 / 5.`),
      leadTime: t.delaiMoyen !== null ? reel(`Délai moyen des tickets terminés : ${n(t.delaiMoyen)} j (création → dernière modification).`)
        : illu('Demande déposée le 1er septembre, livrée le 19 → lead time = 18 jours.'),
      cycleTime: illu('Travail commencé le 12 septembre, livré le 19 → cycle time = 7 jours.'),
      debit: t.termines ? reel(`${t.termines} ticket(s) terminé(s) au total sur le projet.`) : illu(`${nb} personnes livrent 4 éléments par semaine.`),
      wip: t.total ? reel(`${t.enCours} ticket(s) en cours aujourd’hui sur ${t.total}.`) + `<br>${illu(`WIP 6 ÷ débit 4 / semaine → cycle time moyen ≈ 1,5 semaine (loi de Little).`)}`
        : illu(`WIP 6 ÷ débit 4 / semaine → cycle time moyen ≈ 1,5 semaine (loi de Little) ; limite conseillée ≈ ${nb * 2} (2 par personne).`),
      cfd: illu('La bande « En revue » passe de 2 à 6 éléments en 2 semaines → goulet d’étranglement en revue.'),
      age: illu('Un ticket « En cours » depuis 12 jours alors que 85 % sont livrés en 10 jours → à regarder au daily.'),
      efficacite: illu('3 jours de travail actif sur 12 jours de lead time → 25 % d’efficacité de flux.'),
      bloque: illu('2 blocages cette semaine (identifiants de recette, attente d’arbitrage), 3 jours bloqués au total.'),
      sle: illu('Sur les 20 derniers éléments, 17 livrés en moins de 10 jours → « 85 % en moins de 10 jours ».')
    };
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
  projetAstuces: (_, el) => majUi('astuces', { projetId: el.value }),
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
