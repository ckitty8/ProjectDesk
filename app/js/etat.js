/* ============================================================
   État global, chargement des données, navigation, événements
   ------------------------------------------------------------
   - Un seul objet « etat » ; on le modifie avec majEtat(), qui
     redessine la page (sauf { rendre: false }, pour la saisie).
   - Toutes les tables sont chargées à l'ouverture d'une équipe
     (volumétrie d'équipes projet : quelques milliers de lignes max).
   - Événements : un seul écouteur par type sur le document ; tout
     élément portant data-action="nom" déclenche Actions.nom(dataset, élément, événement).
   ============================================================ */
'use strict';

// Registre des écrans (rempli par js/ecrans/*.js) et des actions
const Ecrans = {};
const Actions = {};

const etat = {
  chargement: true,
  erreur: null,
  session: null,            // { user, session } Neon Auth
  organisations: [],        // équipes Neon Auth de l'utilisateur
  invitations: [],          // invitations reçues
  rolesEquipe: {},          // { equipeId: 'owner' | 'admin' | 'member' }
  membresEquipe: {},        // { equipeId: [{ userId, nom, role }] } (comptes Neon Auth des équipes)
  equipeCourante: null,     // id de l'équipe ouverte
  estAdmin: false,          // administrateur global (ou créateur)
  estCreateur: false,       // rôle Créateur : unique, tous les droits sur toutes les équipes (migration 025)
  comptesEnAttente: [],     // inscrits sans accès (administrateurs, Administration › Comptes en attente)
  ecran: 'dashboard',
  panneau: null,            // { type: 'projet', id } | { type: 'nouveauProjet', ... }
  modale: null,             // { type: 'affectation', ... }
  simulation: null,         // { cle, ressourceId } : rôle simulé par le créateur (simulation.js)
  reel: null,               // identité réelle mise de côté pendant une simulation
  ui: {},                   // états d'affichage propres à chaque écran (onglets, filtres, mois...)
  d: {}                     // données chargées (voir TABLES)
};

// Tables chargées et nom de la clé dans etat.d
const TABLES = {
  equipes: 'equipes', ressources: 'ressources', projets: 'projets', affectations: 'affectations',
  objectifs: 'objectifs', resultatsCles: 'resultats_cles', referentiels: 'referentiels',
  valeurs: 'valeurs_referentiel', joursFeries: 'jours_feries',
  absences: 'absences', objectifsTravail: 'objectifs_jours_travail', sprintsProjet: 'sprints_projet', repartitionsSprint: 'repartitions_sprint',
  temps: 'temps_saisis', feuilles: 'feuilles_temps',
  notesProjet: 'notes_daily_projet', administrateurs: 'administrateurs', envoisDaily: 'envois_daily_projet',
  previsionsTemps: 'previsions_temps', typesTache: 'types_tache_projet', createur: 'createur',
  responsablesEquipe: 'responsables_equipe', rolesPrevus: 'roles_prevus', rolesAcces: 'roles_acces', droitsRoles: 'droits_roles',
  rattachements: 'membres_equipe'
};
const TRIS = { joursFeries: 'jour', equipes: 'nom', valeurs: 'ordre', referentiels: 'ordre', projets: 'code', typesTache: 'projet_id,ordre' };
// Filtres de chargement : les notes de daily (celles que je peux lire, voir peut_lire_daily_projet)
// sont limitées aux JOURS_DAILY derniers jours pour garder un chargement léger.
const JOURS_DAILY = 90;
const FILTRES = { notesProjet: () => ({ jour: 'gte.' + Calculs.ajouterJours(Calculs.aujourdhui(), -JOURS_DAILY) }) };

/* ---------- Mise à jour et rendu ---------- */
function majEtat(modifications, options = {}) {
  Object.assign(etat, typeof modifications === 'function' ? modifications(etat) : modifications);
  if (options.rendre !== false) rendre();
}
// Mise à jour d'un sous-état d'écran : majUi('conges', { mois: 3 })
function majUi(ecran, modifications, options) {
  majEtat({ ui: { ...etat.ui, [ecran]: { ...(etat.ui[ecran] || {}), ...modifications } } }, options);
}
const ui = (ecran, defaut = {}) => ({ ...defaut, ...(etat.ui[ecran] || {}) });

function rendre() {
  const racine = document.getElementById('app');
  const zone = racine.querySelector('.contenu');
  const defilement = zone ? zone.scrollTop : 0;          // conserve le défilement entre deux rendus
  racine.innerHTML = Coquille.rendre();
  const nouvelleZone = racine.querySelector('.contenu');
  if (nouvelleZone) nouvelleZone.scrollTop = defilement;
}

/* ---------- Chargement ---------- */
// Couleur sûre : les couleurs viennent de la base et sont insérées dans des attributs style ;
// toute valeur autre qu'un code hexadécimal #RRGGBB est remplacée (protection contre l'injection).
const couleurSure = c => /^#[0-9a-fA-F]{6}$/.test(c || '') ? c : COULEURS.pale;

// Clé unique de chaque table (défaut : id) : ajoutée à l'ordre de tri pour une pagination stable
const CLES_UNIQUES = {
  envoisDaily: 'projet_id', absences: 'ressource_id,jour', objectifsTravail: 'equipe_id,annee', sprintsProjet: 'projet_id,numero',
  repartitionsSprint: 'projet_id,numero,categorie', joursFeries: 'jour', feuilles: 'ressource_id,semaine',
  notesProjet: 'user_id,jour,projet_id', administrateurs: 'user_id', previsionsTemps: 'projet_id,ressource_id', createur: 'user_id',
  responsablesEquipe: 'equipe_id,ressource_id', rolesPrevus: 'ressource_id', rolesAcces: 'ressource_id', droitsRoles: 'role,droit',
  rattachements: 'equipe_id,ressource_id' };
const ordreDe = cle => [TRIS[cle], CLES_UNIQUES[cle] || 'id'].filter(Boolean).join(',');

// Lit une table sans toucher à etat.d (l'application des lignes est faite par appliquerTable)
async function lireTable(cle) {
  const filtres = { order: ordreDe(cle), ...(FILTRES[cle] ? FILTRES[cle]() : {}) };
  const lignes = await Api.lire(TABLES[cle], filtres);
  lignes.forEach(l => { if ('couleur' in l) l.couleur = couleurSure(l.couleur); });
  return lignes;
}
function appliquerTable(cle, lignes) {
  etat.d[cle] = lignes;
  if (cle === 'valeurs') synchroniserLibellesSysteme();
}
async function chargerTable(cle) { appliquerTable(cle, await lireTable(cle)); }
// Libellés système (config.js) = libellés actuels en base, retrouvés par leur clé technique
function synchroniserLibellesSysteme() {
  etat.d.valeurs.filter(v => v.cle && LIBELLES_SYSTEME[v.referentielId]).forEach(v => {
    LIBELLES_SYSTEME[v.referentielId][v.cle.toUpperCase()] = v.libelle;
  });
}
/* Chargement de toutes les tables, sans jamais effacer ce qui est affiché.
   Incident du 2026-09-26 (« les congés ont disparu », alors que la base était intacte) :
   une seule lecture en échec (ex. table ajoutée mais pas encore connue de la Data API, jeton
   expiré) ne doit ni bloquer les autres tables ni vider l'écran. Règles :
   - chaque table est lue indépendamment ; une table en échec garde ses données précédentes
     (ou une liste vide au premier chargement) et un message prévient l'utilisateur ;
   - si la lecture renvoie tout vide alors que des équipes étaient chargées, c'est une session
     ou des droits momentanément perdus (la base filtre les lignes sans erreur) : on garde tout. */
async function chargerDonnees() {
  const cles = Object.keys(TABLES);
  const resultats = await Promise.allSettled(cles.map(lireTable));
  const echecs = cles.filter((cle, i) => resultats[i].status === 'rejected');
  if (echecs.length === cles.length) throw resultats[0].reason;      // rien de lisible : réseau ou session
  const lu = cle => resultats[cles.indexOf(cle)];
  const toutVide = cles.every((cle, i) => resultats[i].status === 'rejected' || !resultats[i].value.length);
  if (toutVide && (etat.d.equipes || []).length) return;              // lecture suspecte : on garde l'affichage
  cles.forEach(cle => {
    if (lu(cle).status === 'fulfilled') appliquerTable(cle, lu(cle).value);
    else if (!etat.d[cle]) appliquerTable(cle, []);
  });
  if (echecs.length) {
    console.warn('Tables non lues :', echecs.map(c => TABLES[c]).join(', '), lu(echecs[0]).reason);
    notifier('Certaines données n’ont pas pu être relues (' + echecs.map(c => TABLES[c]).join(', ') + ') : affichage précédent conservé.', 'erreur');
  }
}
// Recharge des tables après une écriture, puis redessine
async function recharger(...cles) {
  await Promise.all(cles.map(chargerTable));
  rendre();
}

// Exécute une écriture, recharge les tables touchées et affiche l'erreur éventuelle
// (ex. refus de la base : droits). Renvoie true si l'écriture a réussi.
async function executer(action, ...tablesARecharger) {
  let reussi = true;
  try { await action(); }
  catch (e) { reussi = false; notifier(e.message, 'erreur'); }
  if (tablesARecharger.length) await recharger(...tablesARecharger);
  return reussi;
}

// Message temporaire en bas d'écran
function notifier(message, type = 'info') {
  const zone = document.getElementById('notification');
  zone.textContent = message; zone.className = 'notification visible ' + type;
  clearTimeout(notifier.minuteur);
  notifier.minuteur = setTimeout(() => { zone.className = 'notification'; }, 4500);
}

/* ---------- Démarrage : session, équipes, données ---------- */
// Écran de connexion, sans session (pas connecté, ou retour d'un lien « Mot de passe oublié »)
const versConnexion = () => majEtat({ chargement: false, session: null, ecran: 'connexion' });
async function demarrer() {
  // Redémarrage complet (Actualiser, Réessayer) : une simulation en cours prend fin
  if (etat.reel) Object.assign(etat, etat.reel, { reel: null, simulation: null });
  majEtat({ chargement: true, erreur: null });
  try {
    // Retour du lien « Mot de passe oublié » (?token=…) : choix du nouveau mot de passe
    const jeton = Api.lireJetonReinitialisation();
    if (jeton) {
      etat.ui.connexion = { onglet: 'nouveau', jeton, erreur: null, envoye: false };
      return versConnexion();
    }
    const erreurRetour = Api.lireErreurRetour();          // échec de la connexion Google (?error=…)
    const session = await Api.lireSession();
    if (!session || !session.user) {
      if (erreurRetour) etat.ui.connexion = { ...(etat.ui.connexion || {}), erreur: messageConnexion({ message: erreurRetour }) };
      return versConnexion();
    }
    etat.session = session;
    await Api.executer('lier_ma_ressource').catch(() => {});      // lie le compte à sa fiche ressource (même email)
    /* Invitations acceptées d'office par la base (migration 026), avant de lister les équipes :
       - compte sans équipe : l'accès a été donné par un administrateur (Administration › Comptes en
         attente ; maquette docs/maquettes/comptes-en-attente/) ;
       - créateur : invité dans chaque équipe créée par un autre administrateur (inviterCreateur), pour
         pouvoir y inviter des personnes (Neon Auth exige d'être membre de l'équipe pour inviter). */
    await Api.executer('accepter_mes_invitations').catch(() => {});
    // Rôle prévu par un administrateur avant ma première connexion (migration 029 ; email vérifié)
    await Api.executer('appliquer_mes_roles_prevus').catch(() => {});
    const [organisations, invitations] = await Promise.all([
      Api.listerOrganisations(), Api.listerMesInvitations().catch(() => [])
    ]);
    etat.organisations = organisations || [];
    etat.invitations = (invitations || []).filter(i => i.status === 'pending');
    await chargerDonnees();
    etat.estCreateur = etat.d.createur.some(c => c.userId === session.user.id);
    etat.estAdmin = etat.estCreateur || etat.d.administrateurs.some(a => a.userId === session.user.id);
    await chargerComptesEnAttente();
    await chargerRoles();
    const equipesReconnues = mesEquipes();
    const memorisee = lireMemoire('equipe');
    // Écran d'arrivée : on reste sur l'écran courant s'il y en avait un (ex. rechargement)
    const ecranArrivee = defaut => (['connexion', 'choixEquipe'].includes(etat.ecran) ? (defaut === 'dashboard' ? ecranAccueil() : defaut) : etat.ecran);
    if (!equipesReconnues.length) {
      // Sans équipe : l'administrateur entre dans l'outil (Administration s'il faut créer la
      // première équipe, sinon le dashboard) ; les autres comptes attendent une invitation (écran Choix d'équipe).
      if (!etat.estAdmin) return majEtat({ chargement: false, equipeCourante: null, ecran: 'choixEquipe' });
      return majEtat({ chargement: false, equipeCourante: null,
        ecran: ecranArrivee(etat.d.equipes.length ? 'dashboard' : 'monAdmin') });
    }
    // Équipe ouverte : celle mémorisée sur ce poste, ou la seule équipe de l'utilisateur
    // Un administrateur voit tout : il n'a pas à choisir une équipe à l'ouverture (demande du porteur,
    // 2026-10-05). On ouvre l'équipe mémorisée, sinon sa première équipe (de préférence une équipe,
    // pas une direction) ; « Changer » reste disponible en bas de la barre latérale.
    const parDefautAdmin = etat.estAdmin ? (equipesReconnues.find(e => e.type !== 'direction') || equipesReconnues[0]) : null;
    const choix = equipesReconnues.find(e => e.id === memorisee) || (equipesReconnues.length === 1 ? equipesReconnues[0] : parDefautAdmin);
    if (choix) ecrireMemoire('equipe', choix.id);
    majEtat({ chargement: false, equipeCourante: choix ? choix.id : null, ecran: choix ? ecranArrivee('dashboard') : 'choixEquipe' });
  } catch (e) {
    majEtat({ chargement: false, erreur: e.message });
  }
}

// Inscrits sans accès (administrateurs seulement ; liste vide pour les autres, voir comptes_en_attente)
async function chargerComptesEnAttente() {
  const lignes = etat.estAdmin ? (await Api.executer('comptes_en_attente').catch(() => null)) || [] : [];
  // Colonnes SQL → noms de l'application (user_id → userId, inscrit_le → inscritLe)
  etat.comptesEnAttente = lignes.map(c => ({ userId: c.user_id, nom: c.nom, email: c.email, inscritLe: c.inscrit_le, invite: c.invite }));
}

// Rôle Neon Auth (owner / admin / member) de l'utilisateur dans chacune de ses équipes
// et liste des membres de chaque équipe (utilisée par « Daily des équipes »)
async function chargerRoles() {
  const roles = {}, membres = {};
  await Promise.all(mesEquipes().map(async e => {
    try {
      const org = await Api.lireOrganisation(e.id);
      const moi = (org.members || []).find(m => m.userId === etat.session.user.id);
      if (moi) roles[e.id] = moi.role;
      membres[e.id] = (org.members || []).map(m => ({ id: m.id, userId: m.userId, nom: m.user ? m.user.name || m.user.email : '?', role: m.role }));
    } catch (err) { /* équipe illisible : rôle inconnu */ }
  }));
  etat.rolesEquipe = roles;
  etat.membresEquipe = membres;
}

/* ---------- Droits (miroir des règles RLS, pour l'affichage uniquement) ----------
   La base reste le seul juge : ces fonctions servent à masquer les boutons inutiles. */
// Équipes de l'utilisateur : celles dont il est membre ; le créateur les a toutes (comme mes_equipes en base)
function mesEquipes() {
  if (etat.estCreateur) return etat.d.equipes || [];
  const ids = new Set(etat.organisations.map(o => o.id));
  return (etat.d.equipes || []).filter(e => ids.has(e.id));
}
const estMembreDe = equipeId => mesEquipes().some(e => e.id === equipeId);
const estResponsableDe = equipeId => etat.estCreateur || ['owner', 'admin'].includes(etat.rolesEquipe[equipeId]);
// Gérer une équipe (membres, invitations, objectif de jours, rôle d'accès) : administrateur ou responsable de l'équipe
const peutGererEquipe = equipeId => (etat.estAdmin || estResponsableDe(equipeId)) && aDroit('fiches_ressources');
// Valider / renvoyer les feuilles de temps d'une équipe : responsable de l'équipe et droit de la matrice
const peutValiderEquipe = equipeId => estResponsableDe(equipeId) && aDroit('valider_timesheet');
// Ma fiche ressource : celle de mon compte, ou celle de la personne simulée (simulation.js)
const maRessource = () => etat.simulation ? ressource(etat.simulation.ressourceId)
  : (etat.d.ressources || []).find(r => r.userId === etat.session.user.id) || null;
// Personne qui agit sur le projet : administrateur (périmètre « Tout », migration 032), membre de son équipe,
// ou affectée Chef de projet / Membre (comme peut_editer_projet)
function travailleSurLeProjet(projet) {
  if (!projet) return false;
  if (etat.estAdmin || estMembreDe(projet.equipeId)) return true;
  const moi = maRessource();
  return !!moi && etat.d.affectations.some(a => a.projetId === projet.id && a.ressourceId === moi.id &&
    [ROLES_PROJET.CHEF, ROLES_PROJET.MEMBRE].includes(a.role));
}
// Modifier le projet (fiche, roadmap, sprints, capacité) / y affecter des personnes : selon la matrice
const peutEditerProjet = projet => travailleSurLeProjet(projet) && aDroit('projets');
const peutAffecterSur = projet => travailleSurLeProjet(projet) && aDroit('affecter');
// Modifier la fiche d'une personne (Liste des ressources) : son équipe ou administrateur, et droit de la matrice
const peutModifierFiche = r => (estMembreDe(r.equipeId) || etat.estAdmin) && aDroit('fiches_ressources');

/* ---------- Matrice des droits (migration 031 ; même règle que mon_role / niveau_droit en base) ---------- */
// Mon rôle d'accès : déclaré sur ma fiche, sinon administrateur, responsable, utilisateur (la simulation est prise en compte)
function monRole() {
  const moi = maRessource();
  if (moi && roleDeclare(moi)) return roleDeclare(moi);
  if (etat.estAdmin) return 'admin';
  const responsable = (moi && estResponsableEquipe(moi)) || Object.values(etat.rolesEquipe).some(r => ['owner', 'admin'].includes(r));
  return responsable ? 'responsable' : 'utilisateur';
}
// Écran d'arrivée : le dashboard général, ou le daily si le rôle n'a pas accès au dashboard (matrice)
const ecranAccueil = () => niveauDroit('suivi_dashboard') === 'non' ? 'daily' : 'dashboard';
// Le droit existe-t-il dans la table droits_roles ? (droits par menu : après la migration 037)
const droitEnBase = droit => (etat.d.droitsRoles || []).some(d => d.droit === droit);
/* Niveau d'un droit pour un rôle, d'après la matrice (« non » s'il manque). Un droit pas encore créé en
   base (migration à appliquer) reprend le niveau de son droit de repli (DROITS, config.js), pour que
   les menus restent visibles comme avant. */
function niveauDuRole(role, droit) {
  const ligne = (etat.d.droitsRoles || []).find(d => d.role === role && d.droit === droit);
  if (ligne) return ligne.niveau;
  const def = DROITS.find(d => d.cle === droit);
  return def && def.repli && !droitEnBase(droit) ? niveauDuRole(role, def.repli) : 'non';
}
// Niveau d'un droit pour moi : « oui » pour le créateur, sinon celui de mon rôle dans la matrice
const niveauDroit = droit => etat.estCreateur ? 'oui' : niveauDuRole(monRole(), droit);
const aDroit = droit => niveauDroit(droit) === 'oui';

/* ---------- Accès pratiques aux données ---------- */
const parId = (cle, id) => (etat.d[cle] || []).find(x => x.id === id) || null;
const equipe = id => parId('equipes', id) || { nom: '—', couleur: COULEURS.pale, prefixe: '??' };
const ressource = id => parId('ressources', id);
const projet = id => parId('projets', id);
// Valeurs actives d'un référentiel (ex. 'stp'), triées
const valeursDe = (refId, avecInactives = false) =>
  (etat.d.valeurs || []).filter(v => v.referentielId === refId && (avecInactives || v.actif));
// Couleur associée à un libellé de référentiel
function couleurDe(refId, libelle) { const v = valeursDe(refId, true).find(x => x.libelle === libelle); return v ? v.couleur : COULEURS.neutre; }
// Ressource inactive : une date de fin (date_depart) est saisie (règle du porteur, 2026-10-05)
const estInactive = r => !!r.dateDepart;
/* Date de naissance disponible : la colonne ressources.date_naissance (migration 036) existe en base.
   Tant qu'elle n'est pas appliquée, le champ de la fiche est masqué et rien n'est envoyé (pas d'erreur). */
// Options d'un filtre par équipe (Rôles, Gestion des ressources) : « Toutes les équipes » puis chaque unité
const optionsEquipes = () => [{ valeur: '', libelle: 'Toutes les équipes' }, ...etat.d.equipes.map(e => ({ valeur: e.id, libelle: e.nom }))];
const naissanceDisponible = () => etat.d.ressources.some(r => 'dateNaissance' in r);
/* Listes de personnes de tous les écrans (menus liés, règle du porteur 2026-10-06) : une personne
   apparaît sur une période si elle y est PRÉSENTE (entre sa date d'arrivée et sa date de fin) :
   - écran sur une période (mois de la grille, année du récap, mois du timesheet, sprint, jour du
     daily) → ressourcesPresentes(debut, fin) / estPresenteSur(id, debut, fin) ;
   - écran « maintenant » (annuaire, sélecteurs, compteurs) → ressourcesActives() / estActive(id).
   Une personne partie le 30/09 reste donc visible en septembre et disparaît à partir d'octobre.
   Ses données restent en base. Liste des ressources garde son bouton « Afficher les inactifs ». */
const ressourcesPresentes = (debut, fin = debut) => (etat.d.ressources || []).filter(r => Calculs.estPresentSur(r, debut, fin));
const estPresenteSur = (id, debut, fin = debut) => { const r = ressource(id); return !!r && Calculs.estPresentSur(r, debut, fin); };
const ressourcesActives = () => ressourcesPresentes(Calculs.aujourdhui());
/* Personnes proposées pour un projet de l'équipe equipeId (chef de projet, membre, lecteur) : TOUTES
   les personnes présentes — une personne travaille sur des projets de plusieurs équipes (porteur,
   2026-10-13 : « les chefs de projet ne sont pas dans la liste » d'un nouveau projet). Les personnes de
   l'équipe d'abord ; libellé « Nom — Équipe · Poste » pour retrouver un chef de projet par son poste.
   Liste unique des écrans Nouveau projet, panneau projet et affectation. */
function personnesProposees(equipeId) {
  const deLEquipe = r => (r.equipeId === equipeId ? 0 : 1);
  return ressourcesActives().sort((a, b) => deLEquipe(a) - deLEquipe(b) || a.nom.localeCompare(b.nom))
    .map(r => ({ valeur: r.id, libelle: `${r.nom} — ${equipe(r.equipeId).nom}${r.poste ? ' · ' + r.poste : ''}` }));
}
/* Personnes rattachées à une équipe depuis une autre (membres_equipe, migration 033) : affichées dans
   ses membres, sans changer leur équipe d'origine ni leurs droits ; triées par nom */
const rattachesA = equipeId => (etat.d.rattachements || []).filter(x => x.equipeId === equipeId)
  .map(x => ({ r: ressource(x.ressourceId), depuis: x.creeLe })).filter(x => x.r).sort((a, b) => a.r.nom.localeCompare(b.r.nom));
// Rattacher ou retirer quelqu'un : administrateur ou responsable de l'équipe, avec le droit « affecter » (même règle que la base)
const peutRattacherA = equipeId => (etat.estAdmin || estResponsableDe(equipeId)) && aDroit('affecter');
const estActive = id => estPresenteSur(id, Calculs.aujourdhui());

/* ---------- Rôle d'accès d'une personne (maquette role-acces/, 2026-10-12) ---------- */
// Son compte dans l'organisation Neon Auth de son équipe ({ id, role }), connu pour mes équipes
const membreOrganisation = r => (etat.membresEquipe[r.equipeId] || []).find(m => r.userId && m.userId === r.userId) || null;
const estAdministrateur = r => !!r.userId && [...(etat.d.administrateurs || []), ...(etat.d.createur || [])].some(a => a.userId === r.userId);
// Responsables d'une équipe (fiches) : ceux de responsables_equipe, puis l'ancien responsable désigné s'il n'y est pas
function responsablesDe(equipeId) {
  const ids = (etat.d.responsablesEquipe || []).filter(x => x.equipeId === equipeId).map(x => x.ressourceId);
  const designe = equipe(equipeId).responsableId;
  if (designe && !ids.includes(designe)) ids.push(designe);
  return ids.map(ressource).filter(Boolean);
}
/* Responsable d'une équipe : inscrit dans responsables_equipe (migration 027 ; plusieurs par équipe,
   affecté dans Administration › Rôles), ou ancien responsable désigné de la fiche équipe (responsable_id),
   ou owner / admin de l'organisation de son équipe */
const estResponsableDesigne = r => etat.d.equipes.some(e => e.responsableId === r.id)
  || (etat.d.responsablesEquipe || []).some(x => x.ressourceId === r.id);
const estResponsableEquipe = r => estResponsableDesigne(r) || ['owner', 'admin'].includes((membreOrganisation(r) || {}).role);
/* Rôle d'accès affiché (clé de ROLES_ACCES) : le plus large qu'elle a. Sans compte de connexion,
   la personne n'a aucun accès, quel que soit le rôle prévu. Un rôle inconnu de l'écran (ex.
   liste des administrateurs illisible pour un non-administrateur) se lit comme le suivant. */
// Rôle prévu d'une fiche (Administration › Rôles), en attente de la connexion de la personne, ou null
const rolePrevu = r => ((etat.d.rolesPrevus || []).find(x => x.ressourceId === r.id) || {}).role || null;
// Rôle d'accès déclaré et appliqué d'une fiche (roles_acces, migration 030), ou null s'il est déduit
const roleDeclare = r => ((etat.d.rolesAcces || []).find(x => x.ressourceId === r.id) || {}).role || null;
// Rôle d'accès d'une fiche, compte relié ou non : déclaré, sinon déduit (administrateur, responsable, utilisateur)
function roleDeLaFiche(r) {
  if (roleDeclare(r)) return roleDeclare(r);
  if (estAdministrateur(r)) return 'admin';
  return estResponsableEquipe(r) ? 'responsable' : 'utilisateur';
}
function roleAcces(r) {
  if (!r.userId) return 'sansCompte';
  const role = roleDeLaFiche(r);
  if (role !== 'utilisateur') return role;
  const chef = etat.d.projets.some(p => p.chefId === r.id)
    || etat.d.affectations.some(a => a.ressourceId === r.id && a.role === ROLES_PROJET.CHEF);
  return chef ? 'chef' : 'utilisateur';
}
// Suis-je en « Lecture seule » ? (comme est_lecture_seule en base : Mon dashboard masqué, aucune écriture)
const estLectureSeule = () => !etat.estCreateur && !!maRessource() && roleDeclare(maRessource()) === 'lecture';

/* ---------- Daily par projet (migration 018) ---------- */
// Absence d'une personne un jour donné (Congés & capacité), ou null
const absenceDe = (ressourceId, jour) => (etat.d.absences || []).find(a => a.ressourceId === ressourceId && a.jour === jour) || null;
// Projet en cours (non terminé) : seul un projet en cours attend un daily
const projetEnCours = p => !!p && !Calculs.estTermine(p);
const parCode = (a, b) => a.code.localeCompare(b.code);
// Projets où je saisis un daily : affecté(e) Chef de projet ou Membre, projet en cours
const mesProjetsDaily = () => {
  const moi = maRessource(); if (!moi) return [];
  return etat.d.affectations.filter(a => a.ressourceId === moi.id && a.role !== ROLES_PROJET.LECTEUR)
    .map(a => projet(a.projetId)).filter(projetEnCours).sort(parCode);
};

/* Suis-je responsable de l'unité du projet ou d'une unité au-dessus (ex. Anne, responsable
   d'Applications) ? Responsable = responsablesDe(unité), ou owner/admin de son
   organisation. On remonte les unités parentes (10 niveaux au plus, garde-fou contre une boucle). */
function suisResponsableDuProjet(p) {
  const moi = maRessource();
  let e = equipe(p.equipeId);
  for (let niveau = 0; e.id && niveau < 10; niveau++) {
    if ((moi && responsablesDe(e.id).includes(moi)) || estResponsableDe(e.id)) return true;
    e = equipe(e.parentId);
  }
  return false;
}
// Mon affectation sur un projet (ou null)
const monAffectation = p => { const moi = maRessource(); return moi ? etat.d.affectations.find(a => a.projetId === p.id && a.ressourceId === moi.id) || null : null; };

/* Projets dont je peux lire le daily (même règle que peut_lire_daily_projet en base) :
   administrateur, affecté(e) au projet, ou responsable de son unité ou d'une unité parente. */
const peutLireDailyProjet = p => etat.estAdmin || !!monAffectation(p) || suisResponsableDuProjet(p);

/* Chef du projet : fiche « chef » du projet ou affectation « Chef de projet » */
// Chef du projet : fiche projet, affectation « Chef de projet », ou rôle « Projet » affecté (hors Lecteur)
function suisChefDuProjet(p) {
  const moi = maRessource(), aff = monAffectation(p);
  if (estLectureSeule()) return false;
  return (!!moi && p.chefId === moi.id) || (!!aff && aff.role === ROLES_PROJET.CHEF)
    || (!!aff && aff.role !== ROLES_PROJET.LECTEUR && roleDeclare(moi) === 'projet');
}
/* Qui pilote un projet — règle l'envoi de son daily et son plan de charge (même règle
   que peut_gerer_envoi_projet en base, migrations 019 et 021) : administrateur, chef du projet,
   ou responsable de son unité ou d'une unité parente. */
const peutPiloterProjet = p => (etat.estAdmin || suisChefDuProjet(p) || suisResponsableDuProjet(p)) && aDroit('piloter');
const projetsDailyVisibles = () => etat.d.projets.filter(p => projetEnCours(p) && peutLireDailyProjet(p)).sort(parCode);
/* Auteur des dailys d'une personne : son compte, ou « fiche:<id> » pour un daily importé d'une personne
   sans compte (CR Daily Excel, migration 034 ; ils passent sur son compte quand elle le relie à sa fiche) */
const auteurDaily = r => r.userId || 'fiche:' + r.id;
// Note d'une personne (compte) pour un projet et un jour
const noteProjet = (userId, projetId, jour) =>
  (etat.d.notesProjet || []).find(n => n.userId === userId && n.projetId === projetId && n.jour === jour) || null;
// Sprints d'un projet saisis par le porteur (version, début, fin), du plus ancien au plus récent
const sprintsDuProjet = projetId => (etat.d.sprintsProjet || []).filter(s => s.projetId === projetId && s.debut && s.fin)
  .sort((a, b) => a.debut.localeCompare(b.debut));
// Affectations d'une personne à des projets existants
const affectationsDe = ressourceId => etat.d.affectations.filter(a => a.ressourceId === ressourceId && projet(a.projetId));
// Badges « Projet · rôle » d'une personne (fiche, Administration › Rôles), ou le texte « vide »
const badgesProjetsDe = (ressourceId, vide) => affectationsDe(ressourceId)
  .map(a => C.badgeRef('role', `${projet(a.projetId).nom} · ${a.role}`)).join(' ') || `<span class="pale">${vide}</span>`;
/* Projets d'une personne avec son rôle : ses affectations, plus les projets dont elle est le chef inscrit sur
   la fiche projet (projets.chef_id, lu tant qu'un chef n'y figure que là — migration 028) → rôle « Chef de projet ».
   Liste des ressources (Mon dashboard) et Gestion des ressources › Liste des ressources. */
function projetsAvecRoleDe(ressourceId) {
  const liste = affectationsDe(ressourceId).map(a => ({ projet: projet(a.projetId), role: a.role }));
  etat.d.projets.filter(p => p.chefId === ressourceId && !liste.some(x => x.projet.id === p.id))
    .forEach(p => liste.push({ projet: p, role: ROLES_PROJET.CHEF }));
  return liste;
}
// Projets d'une personne, un par ligne : « VISTA · PO », « CDO · Membre »… ou « hors projet »
const lignesProjetsDe = ressourceId => projetsAvecRoleDe(ressourceId)
  .map(x => `<div>${C.esc(x.projet.nom)} · ${C.esc(x.role === ROLES_PROJET.CHEF ? 'PO' : x.role)}</div>`).join('')
  || '<span class="pale">hors projet</span>';
// Codes des projets où la personne est affectée (badges « DA-08 MO-21 »), vide si aucun
const codesProjetsDe = ressourceId => etat.d.affectations.filter(a => a.ressourceId === ressourceId)
  .map(a => projet(a.projetId)).filter(Boolean).map(p => C.code(p.code)).join(' ');
/* Unités du haut de l'arborescence (sans parent, ou parent introuvable) : directions d'abord,
   puis équipes isolées — ordre des arbres de Congés & capacité et de la Gestion des ressources */
function unitesRacines() {
  const racines = etat.d.equipes.filter(e => !e.parentId || !parId('equipes', e.parentId));
  return [...racines.filter(e => e.type === 'direction'), ...racines.filter(e => e.type !== 'direction')];
}
// Modifie des champs d'un sprint existant (Capacité : points ; Administration › Sprints : dates, numéro…)
const modifierSprint = (projetId, numero, valeurs) =>
  executer(() => Api.modifier('sprints_projet', { projet_id: 'eq.' + projetId, numero: 'eq.' + numero }, valeurs), 'sprintsProjet');
// Un projet n'a qu'un « Sprint N » par année (règle aussi garantie en base, migration 015)
const sprintDejaPris = (projetId, annee, numeroSprint, saufNumero = null) => (etat.d.sprintsProjet || [])
  .some(s => s.projetId === projetId && s.numero !== saufNumero && Number(s.numeroSprint) === numeroSprint && anneeSprint(s) === annee);
// Année d'un sprint : saisie (migration 015), sinon celle de sa date de début
const anneeSprint = s => Number(s.annee) || Number((s.debut || '').slice(0, 4));
// Libellé d'un sprint : « Sprint 3 · V3.2 » (numéro saisi et version), à défaut l'un des deux
const nomSprint = s => [s.numeroSprint ? 'Sprint ' + s.numeroSprint : '', s.nom || ''].filter(Boolean).join(' · ') || 'Sprint ' + s.numero;
const feries = () => new Set((etat.d.joursFeries || []).map(j => j.jour));
// Jours de travail attendus par le client pour une équipe et une année (défaut : config.js)
const objectifJoursTravail = (equipeId, annee) => {
  const o = (etat.d.objectifsTravail || []).find(x => x.equipeId === equipeId && Number(x.annee) === annee);
  return o ? Number(o.jours) : CONFIG.JOURS_TRAVAIL_CLIENT_DEFAUT;
};

/* ---------- Mémoire locale (préférences du poste uniquement) ---------- */
function lireMemoire(cle) { try { return localStorage.getItem('pp_' + cle); } catch (e) { return null; } }
function ecrireMemoire(cle, valeur) { try { localStorage.setItem('pp_' + cle, valeur); } catch (e) { /* navigation privée */ } }

/* ---------- Navigation ---------- */
// Un écran peut déclarer auChargement() : données à rafraîchir à son ouverture
// (ex. Daily des équipes recharge les notes saisies entre-temps par les coéquipiers).
function allerA(ecran) {
  // Sur écran étroit (Z Fold déplié, tablette), le menu latéral se referme après le choix d'un écran
  majEtat({ ecran, panneau: null, modale: null, ui: { ...etat.ui, menuLateral: { ouvert: false } } });
  if (Ecrans[ecran] && Ecrans[ecran].auChargement) Ecrans[ecran].auChargement();
  rafraichirDonnees();
}

/* Rafraîchissement des données en arrière-plan : à chaque changement d'écran et au retour
   sur l'onglet du navigateur. Sans lui, les changements faits ailleurs (autre utilisateur,
   import direct en base) n'apparaissaient qu'après F5. On ne redessine pas pendant une
   saisie (fenêtre, panneau ou champ actif) pour ne pas perdre ce qui est en cours. */
let rafraichissementEnCours = false;
async function rafraichirDonnees() {
  if (rafraichissementEnCours || !etat.session || !etat.d.valeurs) return;
  rafraichissementEnCours = true;
  try {
    await chargerDonnees();
    const saisieEnCours = etat.modale || etat.panneau || ['INPUT', 'TEXTAREA', 'SELECT'].includes((document.activeElement || {}).tagName);
    if (!saisieEnCours) rendre();
  } catch (e) { /* réseau indisponible : on garde les données affichées */ }
  finally { rafraichissementEnCours = false; }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') rafraichirDonnees(); });

/* ---------- Événements (délégation) ----------
   data-action="nom"            → clic
   data-action-change="nom"     → changement de liste / case / date
   data-action-saisie="nom"     → frappe dans un champ (sans redessiner) */
function declencher(nom, element, evenement) {
  if (!nom) return;
  if (!Actions[nom]) { console.warn('Action inconnue :', nom); return; }
  Actions[nom](element.dataset, element, evenement);
}
document.addEventListener('click', e => {
  // Menu Aide ouvert : un clic en dehors le referme
  if ((etat.ui.menuAide || {}).ouvert && !e.target.closest('.menu-aide')) majUi('menuAide', { ouvert: false });
  const el = e.target.closest('[data-action]');
  if (el) { e.preventDefault(); declencher(el.dataset.action, el, e); }
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-action-change]');
  if (el) declencher(el.dataset.actionChange, el, e);
});
document.addEventListener('input', e => {
  const el = e.target.closest('[data-action-saisie]');
  if (el) declencher(el.dataset.actionSaisie, el, e);
});
document.addEventListener('submit', e => {
  const form = e.target.closest('form[data-action-envoi]');
  if (form) { e.preventDefault(); declencher(form.dataset.actionEnvoi, form, e); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && (etat.panneau || etat.modale)) majEtat({ panneau: null, modale: null }); });

// Actions communes à toute l'application
Object.assign(Actions, {
  aller: d => allerA(d.ecran),
  fermer: () => majEtat({ panneau: null, modale: null }),
  ouvrirProjet: d => majEtat({ panneau: { type: 'projet', id: d.id } })
});

window.addEventListener('DOMContentLoaded', demarrer);
