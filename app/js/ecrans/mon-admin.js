/* ============================================================
   Mon dashboard › Administration (maquette 10-mAdmin.png)
   (Demandes entrantes et formulaire de demande retirés le 2026-10-05 : les
   demandes sont gérées dans Azure DevOps ; tables supprimées par la migration 020.)
   - Sprints : déplacés dans Mon dashboard › Projets et Roadmap › Sprints (sprints.js, 2026-10-23).
   - Jours fériés (administrateurs globaux) : ajout, date, libellé,
     suppression ; ils s'affichent dans les calendriers et sont exclus
     des jours ouvrés (capacité, timesheet).
   - Équipes et Référentiels (administrateurs globaux, et responsables
     d'équipe pour « Modifier » leur équipe) : c'est ici, et non dans la
     section Suivi de mes équipes (lecture seule), que l'administration se modifie.
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
    // Onglet par défaut : les comptes en attente s'il y en a (administrateur), sinon le premier onglet permis
    const enAttente = etat.comptesEnAttente.filter(c => !c.invite).length;
    const u = ui('monAdmin', { onglet: etat.estAdmin && enAttente ? 'comptes' : '' });
    const gereEquipes = etat.estAdmin || mesEquipes().some(e => estResponsableDe(e.id));
    const regleEnvois = etat.d.projets.some(p => projetEnCours(p) && peutPiloterProjet(p));   // onglet Envoi du daily
    const modifieReferentiels = etat.estAdmin && aDroit('administration');   // référentiels et jours fériés : sinon consultation
    /* Onglets : d'abord le périmètre (comptes et rôles : administrateurs ; équipes : administrateurs et responsables ;
       envoi du daily : projets que je pilote), puis le droit de chaque onglet (matrice, migration 038) */
    const liste = ongletsPermis('monAdmin', [
      ...(etat.estAdmin ? [{ id: 'comptes', libelle: 'Comptes en attente', compte: enAttente }] : []),
      ...(gereEquipes ? [{ id: 'equipes', libelle: 'Équipes', compte: etat.d.equipes.length }] : []),
      Administration.ongletReferentiels(),
      { id: 'feries', libelle: 'Jours fériés', compte: etat.d.joursFeries.length },
      ...(regleEnvois ? [{ id: 'envoiDaily', libelle: 'Envoi du daily', compte: (etat.d.envoisDaily || []).filter(x => x.mode !== 'aucun').length }] : []),
      ...(etat.estAdmin ? [{ id: 'roles', libelle: 'Rôles', compte: ressourcesActives().length }] : [])
    ]);
    const onglet = ongletAffiche(liste, u.onglet);
    const corps = {
      comptes: () => this.comptes(), roles: () => Roles.onglet(),
      equipes: () => Administration.equipes(), referentiels: () => Administration.referentiels(modifieReferentiels),
      feries: () => this.feries(modifieReferentiels), envoiDaily: () => this.envoiDaily()
    }[onglet];
    return `
    <div class="ecran ecran-large">
      ${C.entete('Administration', 'Réglages de vos équipes, de vos projets et des accès')}
      ${corps ? C.onglets(liste, onglet, 'ongletMonAdmin') + corps() : C.aucunOnglet()}
    </div>`;
  },

  /* ---------- Onglet Comptes en attente (administrateurs ; maquette docs/maquettes/comptes-en-attente/) ----------
     Personnes inscrites sans équipe (fonction comptes_en_attente, migration 024). Pour chacune :
     équipe, fiche ressource (existante sans compte, proposée si l'email ou le prénom correspond,
     ou nouvelle fiche), rôle dans l'équipe ; « Donner l'accès » (donnerAcces) ; « Ignorer »
     écarte un compte (doublon, inconnu). Choix en cours gardés dans ui('comptes')[compte]. */
  // Fiche proposée pour un compte : même email, sinon même prénom, parmi les fiches sans compte
  ficheProposee(compte) {
    const libres = ressourcesActives().filter(r => !r.userId);
    const prenom = (compte.nom || '').trim().split(/\s+/)[0].toLowerCase();
    return libres.find(r => (r.email || '').toLowerCase() === (compte.email || '').toLowerCase())
      || (prenom ? libres.find(r => r.nom.toLowerCase().split(/\s+/)[0] === prenom) : null) || null;
  },
  choixCompte(compte) {
    const proposee = this.ficheProposee(compte);
    const defaut = { equipe: proposee ? proposee.equipeId : '', fiche: proposee ? proposee.id : '', role: 'member' };
    return { ...defaut, ...(ui('comptes')[compte.userId] || {}) };
  },
  // Onglet Comptes en attente : une ligne par inscrit sans équipe, choix de l'équipe, de la fiche et du rôle, puis « Donner l'accès »
  comptes() {
    const esc = C.esc, comptes = etat.comptesEnAttente;
    if (!comptes.length) return `<div class="carte">${C.vide('Aucun compte en attente : toutes les personnes inscrites ont accès à une équipe.')}</div>`;
    const equipes = etat.d.equipes.filter(e => e.actif !== false).map(e => ({ valeur: e.id, libelle: e.nom }));
    // Une ligne par compte : équipe, fiche ressource (proposée si l'email ou le prénom correspond), rôle, boutons
    const ligne = c => {
      const choix = this.choixCompte(c), attr = champ => `class="champ largeur-auto" data-action-change="choisirCompte" data-compte="${c.userId}" data-champ="${champ}"`;
      const fiches = ressourcesActives().filter(r => !r.userId && r.equipeId === choix.equipe).map(r => ({ valeur: r.id, libelle: r.nom + (r.email ? '' : ' (sans email)') }));
      const actions = c.invite
        ? `${C.badgeTon('Accès donné · en attente de sa connexion', 'succes')}`
        : `<button class="btn petit primaire" data-action="donnerAcces" data-compte="${c.userId}">Donner l’accès</button>`;
      return `<tr><td><span class="ligne-flex">${C.avatar(c.nom || c.email)}<span><b>${esc(c.nom || '—')}</b>
          <div class="discret texte-12">${esc(c.email)}</div></span></span></td>
        <td>${Calculs.formatAvecAnnee((c.inscritLe || '').slice(0, 10))}</td>
        <td>${C.liste([{ valeur: '', libelle: '— choisir —' }, ...equipes], choix.equipe, attr('equipe'))}</td>
        <td>${C.liste([{ valeur: '', libelle: '— choisir —' }, ...fiches, { valeur: 'nouvelle', libelle: '+ Créer sa fiche' }], choix.fiche, attr('fiche'))}</td>
        <td>${C.liste([{ valeur: 'member', libelle: 'Membre' }, { valeur: 'admin', libelle: 'Admin d’équipe' }], choix.role, attr('role'))}</td>
        <td class="num sans-retour"><button class="btn petit" data-action="ignorerCompte" data-compte="${c.userId}">Ignorer</button> ${actions}</td></tr>`;
    };
    const enAttente = comptes.filter(c => !c.invite).length;
    return `${enAttente ? `<div class="carte encart-compact encart-alerte">
        <b>${enAttente} personne${enAttente > 1 ? 's se sont inscrites et attendent' : ' s’est inscrite et attend'} un accès.</b>
        Choisissez l’équipe et la fiche ressource, puis « Donner l’accès » : la personne entre dans l’application à sa prochaine
        connexion (ou en cliquant « Actualiser »), sans autre démarche.</div>` : ''}
      <div class="carte"><table class="tableau"><thead><tr><th>Compte inscrit</th><th>Inscrit le</th><th>Équipe</th><th>Fiche ressource</th>
        <th>Rôle dans l’équipe</th><th></th></tr></thead><tbody>${comptes.map(ligne).join('')}</tbody></table>
      <div class="discret" style="font-size:12px;padding:8px 16px">Fiche ressource : la fiche existante de la personne (proposée si l’email ou le prénom
        correspond) reçoit l’email du compte et s’y relie à sa connexion ; sinon une fiche est créée. Une personne inscrite deux fois
        (email personnel et professionnel) : donner l’accès au compte utilisé, « Ignorer » l’autre.</div></div>`;
  },

  /* Jours fériés (table jours_feries, clé = la date), par année */
  /* ---------- Onglet Envoi du daily : réglage PAR PROJET ----------
     Demande du porteur (2026-10-07, maquette envoi-daily-projet/) : chaque projet en cours choisit
     son mode d'envoi (MODES_ENVOI_DAILY), l'heure, les jours, l'exclusion des fériés et les
     destinataires ; une ligne par projet dans envois_daily_projet (migration 019). Modifiable par
     un administrateur, le chef du projet ou un responsable de son unité (peutPiloterProjet). */
  envoiDaily() {
    const esc = C.esc;
    const projets = etat.d.projets.filter(p => projetEnCours(p) && peutPiloterProjet(p)).sort(parCode);
    const JOURS = [[1, 'L'], [2, 'M'], [3, 'M'], [4, 'J'], [5, 'V']];
    // Une ligne par projet en cours : mode d'envoi, heure, jours, sauf fériés, destinataires
    const ligne = p => {
      const r = { ...ENVOI_DAILY_DEFAUT, ...((etat.d.envoisDaily || []).find(x => x.projetId === p.id) || {}) };
      const attr = champ => `data-action-change="majEnvoiDaily" data-projet="${p.id}" data-champ="${champ}"`;
      const actif = r.mode !== 'aucun', jours = String(r.jours || '').split(',');
      const detail = r.mode === 'power_automate'
        ? `<button class="btn petit" data-action="configurerPowerAutomate" data-projet="${p.id}">Configurer le flux</button>
           <div class="discret" style="font-size:12px;margin-top:4px">votre flux lit le daily puis l’envoie depuis votre boîte</div>`
        : r.mode === 'direct'
          ? '<span class="discret texte-12">L’application enverra l’e-mail à l’heure choisie — <b>à venir</b> (étape 2 : service d’envoi à créer)</span>'
        : '<span class="pale">—</span>';
      return `<tr><td><span class="ligne-flex">${C.pastille(equipe(p.equipeId).couleur)}<b>${esc(p.nom)}</b></span></td>
        <td>${C.liste(MODES_ENVOI_DAILY, r.mode, `class="champ" style="height:30px;width:150px" ${attr('mode')}`)}</td>
        <td><input class="champ" type="time" style="height:30px;width:120px" value="${esc(r.heure)}" ${actif ? '' : 'disabled'} ${attr('heure')}></td>
        <td><div class="puces" style="flex-wrap:nowrap;gap:4px">
          ${JOURS.map(([n, l]) => `<button class="puce${jours.includes(String(n)) ? ' active' : ''}" ${actif ? '' : 'disabled'}
          data-action="basculerJourEnvoi" data-projet="${p.id}" data-jour="${n}" style="width:28px;justify-content:center;padding:0">${l}</button>`).join('')}</div></td>
        <td class="sans-retour"><label class="ligne-flex">
          <input type="checkbox" ${r.sansFeries ? 'checked' : ''} ${actif ? '' : 'disabled'} ${attr('sansFeries')}> sauf fériés</label></td>
        <td><input class="champ" style="height:30px" placeholder="email1@…, email2@…" value="${esc(r.destinataires || '')}"
          ${actif ? '' : 'disabled'} ${attr('destinataires')}></td>
        <td>${detail}</td></tr>`;
    };
    return `<div class="carte"><div class="carte-titre"><h2>Envoi du daily par e-mail ${C.aide('envoiDaily')}</h2>
        <span class="discret">contenu : le daily du projet du jour — blocages en tête, puis Hier / Aujourd’hui / Blocages de chacun, sans note, absents</span></div>
      <table class="tableau"><thead><tr><th>Projet</th><th>Mode</th><th>Heure</th><th>Jours</th><th>Fériés</th>
        <th style="width:22%">Destinataires</th><th style="width:20%">Mise en place</th></tr></thead>
      <tbody>${projets.map(ligne).join('') || `<tr><td colspan="7">${C.vide('Aucun projet en cours dont vous réglez l’envoi.')}</td></tr>`}</tbody></table></div>`;
  },

  // Onglet Jours fériés : liste par année, ajout (date, libellé) et suppression
  // Onglet Jours fériés ; modifiable : administrateur avec le droit « administration » (sinon consultation)
  feries(modifiable) {
    const esc = C.esc, annees = [...new Set(etat.d.joursFeries.map(f => f.jour.slice(0, 4)))].sort();
    const annee = ui('feries', { annee: Calculs.aujourdhui().slice(0, 4) }).annee;
    const lignes = etat.d.joursFeries.filter(f => f.jour.startsWith(annee)).map(f => !modifiable
      ? `<tr><td>${Calculs.formatAvecAnnee(f.jour)}</td><td>${esc(f.libelle)}</td><td></td></tr>` : `<tr>
        <td><input type="date" class="champ largeur-auto" value="${f.jour}" data-action-change="dateFerie" data-jour="${f.jour}"></td>
        <td><input class="champ" value="${esc(f.libelle)}" data-action-change="libelleFerie" data-jour="${f.jour}"></td>
        <td class="num">${C.boutonIcone('supprimer', 'supprimerFerie', `data-jour="${f.jour}"`, 'Supprimer ce jour férié')}</td></tr>`).join('');
    const puces = [...new Set([...annees, annee])].sort().map(a =>
      `<button class="puce${a === annee ? ' active' : ''}" data-action="anneeFeries" data-annee="${a}">${a}</button>`).join('');
    return `<div class="carte"><div class="carte-titre"><h2>Jours fériés ${C.aide('joursFeries')}</h2><div class="puces">${puces}</div></div>
      <table class="tableau"><thead><tr><th>Date</th><th>Libellé</th><th class="num"></th></tr></thead>
        <tbody>${lignes || `<tr><td colspan="3">${C.vide('Aucun jour férié pour ' + annee + '.')}</td></tr>`}</tbody></table>
      ${modifiable ? `<form class="ligne-flex encart-compact" data-action-envoi="ajouterFerie">
        <input type="date" class="champ largeur-auto" name="jour" required><input class="champ" name="libelle" placeholder="Libellé (ex. Lundi de Pentecôte)" required>
        <button class="btn">Ajouter</button></form>` : ''}
      <div class="discret" style="font-size:12px;padding:0 16px 14px">Affichés dans les calendriers avec le type « ${esc(ABSENCES.FERIE)} » ;
        non comptés comme jours ouvrés (capacité, timesheet).</div></div>`;
  },

};

/* Fenêtre « Power Automate » d'un projet : lit (ou crée, ou renouvelle) la clé du projet,
   puis l'aperçu du daily du jour avec cette clé (fonctions de la migration 019). */
async function ouvrirPowerAutomate(projetId, renouveler) {
  try {
    const cle = await Api.executer('cle_envoi_daily_projet', { p_projet: projetId, p_renouveler: renouveler });
    const apercu = await Api.executer('daily_projet', { p_projet: projetId, p_cle: cle }).catch(() => null);
    majEtat({ modale: { type: 'envoiPowerAutomate', projetId, cle, apercu } });
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
  // Comptes en attente : choix de l'équipe, de la fiche ou du rôle (changer d'équipe vide la fiche)
  choisirCompte(d, el) {
    const choix = Ecrans.monAdmin.choixCompte(etat.comptesEnAttente.find(c => c.userId === d.compte));
    const nouveau = { ...choix, [d.champ]: el.value, ...(d.champ === 'equipe' ? { fiche: '' } : {}) };
    majUi('comptes', { [d.compte]: nouveau });
  },
  /* Donner l'accès : la fiche choisie reçoit l'email du compte (lier_ma_ressource la relie à la
     connexion) ou une fiche est créée, puis invitation dans l'équipe (Neon Auth), acceptée d'office
     à la connexion de la personne (fonction SQL accepter_mes_invitations, migration 026). */
  async donnerAcces(d) {
    const compte = etat.comptesEnAttente.find(c => c.userId === d.compte), choix = Ecrans.monAdmin.choixCompte(compte);
    if (!choix.equipe || !choix.fiche) return notifier('Choisissez l’équipe et la fiche ressource', 'erreur');
    const reussi = await executer(async () => {
      if (choix.fiche === 'nouvelle') await Api.creer('ressources', { nom: compte.nom || compte.email, email: compte.email, equipeId: choix.equipe });
      else await Api.modifier('ressources', { id: 'eq.' + choix.fiche }, { email: compte.email });
      await Api.inviterMembre(choix.equipe, compte.email, choix.role);
    }, 'ressources');
    if (reussi) { await chargerComptesEnAttente(); notifier(`Accès donné à ${compte.nom || compte.email}`); rendre(); }
  },
  async ignorerCompte(d) {
    if (!confirm('Écarter ce compte de la liste ? Il n’aura pas accès à l’application.')) return;
    const reussi = await executer(() => Api.creer('comptes_ignores', { userId: d.compte }));
    if (reussi) { await chargerComptesEnAttente(); rendre(); }
  },
  // Envoi du daily : écrit le réglage complet du projet (valeurs par défaut si première saisie)
  majEnvoiDaily(d, el) {
    const actuel = { ...ENVOI_DAILY_DEFAUT, ...((etat.d.envoisDaily || []).find(x => x.projetId === d.projet) || {}) };
    const valeur = el.type === 'checkbox' ? el.checked : el.value.trim();
    const ligne = { projetId: d.projet, mode: actuel.mode, heure: actuel.heure, jours: actuel.jours, sansFeries: actuel.sansFeries,
      destinataires: actuel.destinataires, [d.champ]: valeur };
    // destinataires et jours peuvent être vides (aucun destinataire, aucun jour) : on garde ''
    executer(() => Api.creer('envois_daily_projet', ligne, 'projet_id', ['destinataires', 'jours']), 'envoisDaily');
  },
  // Fenêtre de mise en place Power Automate (voir ouvrirPowerAutomate)
  configurerPowerAutomate: d => ouvrirPowerAutomate(d.projet, false),
  renouvelerCleDaily(d) {
    if (confirm('Renouveler la clé ? Le flux actuel cessera de fonctionner tant qu’il n’est pas mis à jour.')) ouvrirPowerAutomate(d.projet, true);
  },
  copierTexte(d) {
    navigator.clipboard.writeText(d.texte).then(() => notifier('Copié'), () => notifier('Copie impossible : sélectionnez le texte', 'erreur'));
  },
  basculerJourEnvoi(d) {
    const actuel = (etat.d.envoisDaily || []).find(x => x.projetId === d.projet) || ENVOI_DAILY_DEFAUT;
    const jours = new Set(String(actuel.jours || '').split(',').filter(Boolean));
    jours.has(d.jour) ? jours.delete(d.jour) : jours.add(d.jour);
    Actions.majEnvoiDaily({ projet: d.projet, champ: 'jours' }, { value: [...jours].sort().join(',') });
  },
  // Fiche personne › « Modifier dans Administration › Rôles » : fiche fermée, onglet Rôles ouvert
  ouvrirRoles: () => { etat.modale = null; majUi('monAdmin', { onglet: 'roles' }, { rendre: false }); allerA('monAdmin'); }
});
