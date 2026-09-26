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
  estAdmin: false,
  ecran: 'dashboard',
  panneau: null,            // { type: 'projet', id } | { type: 'nouveauProjet', ... }
  modale: null,             // { type: 'affectation', ... }
  ui: {},                   // états d'affichage propres à chaque écran (onglets, filtres, mois...)
  d: {}                     // données chargées (voir TABLES)
};

// Tables chargées et nom de la clé dans etat.d
const TABLES = {
  equipes: 'equipes', ressources: 'ressources', projets: 'projets', affectations: 'affectations',
  tickets: 'tickets', objectifs: 'objectifs', resultatsCles: 'resultats_cles', referentiels: 'referentiels',
  valeurs: 'valeurs_referentiel', champs: 'champs_formulaire', joursFeries: 'jours_feries',
  absences: 'absences', objectifsTravail: 'objectifs_jours_travail', temps: 'temps_saisis', feuilles: 'feuilles_temps', demandes: 'demandes',
  notes: 'notes_daily', administrateurs: 'administrateurs'
};
const TRIS = { joursFeries: 'jour', equipes: 'nom', valeurs: 'ordre', champs: 'ordre', referentiels: 'ordre', demandes: 'numero.desc', projets: 'code' };
// Filtres de chargement : les notes de daily (les miennes et celles de mes coéquipiers)
// sont limitées aux JOURS_DAILY derniers jours pour garder un chargement léger.
const JOURS_DAILY = 90;
const FILTRES = { notes: () => ({ jour: 'gte.' + Calculs.ajouterJours(Calculs.aujourdhui(), -JOURS_DAILY) }) };

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
const couleurSure = c => /^#[0-9a-fA-F]{6}$/.test(c || '') ? c : '#8A93A3';

// Clé unique de chaque table (défaut : id) : ajoutée à l'ordre de tri pour une pagination stable
const CLES_UNIQUES = { absences: 'ressource_id,jour', objectifsTravail: 'equipe_id,annee', joursFeries: 'jour', feuilles: 'ressource_id,semaine',
  notes: 'user_id,jour', administrateurs: 'user_id' };
const ordreDe = cle => [TRIS[cle], CLES_UNIQUES[cle] || 'id'].filter(Boolean).join(',');

async function chargerTable(cle) {
  const filtres = { order: ordreDe(cle), ...(FILTRES[cle] ? FILTRES[cle]() : {}) };
  const lignes = await Api.lire(TABLES[cle], filtres);
  lignes.forEach(l => { if ('couleur' in l) l.couleur = couleurSure(l.couleur); });
  etat.d[cle] = lignes;
  if (cle === 'valeurs') synchroniserLibellesSysteme();
}
// Libellés système (config.js) = libellés actuels en base, retrouvés par leur clé technique
function synchroniserLibellesSysteme() {
  etat.d.valeurs.filter(v => v.cle && LIBELLES_SYSTEME[v.referentielId]).forEach(v => {
    LIBELLES_SYSTEME[v.referentielId][v.cle.toUpperCase()] = v.libelle;
  });
}
async function chargerDonnees() {
  await Promise.all(Object.keys(TABLES).map(chargerTable));
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
async function demarrer() {
  majEtat({ chargement: true, erreur: null });
  try {
    const erreurRetour = Api.lireErreurRetour();          // échec de la connexion Google (?error=…)
    const session = await Api.lireSession();
    if (!session || !session.user) {
      if (erreurRetour) etat.ui.connexion = { ...(etat.ui.connexion || {}), erreur: messageConnexion({ message: erreurRetour }) };
      return majEtat({ chargement: false, session: null, ecran: 'connexion' });
    }
    etat.session = session;
    await Api.executer('lier_ma_ressource').catch(() => {});      // lie le compte à sa fiche ressource (même email)
    const [organisations, invitations] = await Promise.all([
      Api.listerOrganisations(), Api.listerMesInvitations().catch(() => [])
    ]);
    etat.organisations = organisations || [];
    etat.invitations = (invitations || []).filter(i => i.status === 'pending');
    await chargerDonnees();
    etat.estAdmin = etat.d.administrateurs.some(a => a.userId === session.user.id);
    await chargerRoles();
    const equipesReconnues = mesEquipes();
    const memorisee = lireMemoire('equipe');
    // Écran d'arrivée : on reste sur l'écran courant s'il y en avait un (ex. rechargement)
    const ecranArrivee = defaut => (['connexion', 'choixEquipe', 'demandeur'].includes(etat.ecran) ? defaut : etat.ecran);
    if (!equipesReconnues.length) {
      // Sans équipe : l'administrateur entre dans l'outil (Administration s'il faut créer la
      // première équipe, sinon le dashboard) ; les autres comptes sont des demandeurs.
      if (!etat.estAdmin) return majEtat({ chargement: false, equipeCourante: null, ecran: 'demandeur' });
      return majEtat({ chargement: false, equipeCourante: null,
        ecran: ecranArrivee(etat.d.equipes.length ? 'dashboard' : 'monAdmin') });
    }
    // Équipe ouverte : celle mémorisée sur ce poste, ou la seule équipe de l'utilisateur
    const choix = equipesReconnues.find(e => e.id === memorisee) || (equipesReconnues.length === 1 ? equipesReconnues[0] : null);
    if (choix) ecrireMemoire('equipe', choix.id);
    majEtat({ chargement: false, equipeCourante: choix ? choix.id : null, ecran: choix ? ecranArrivee('dashboard') : 'choixEquipe' });
  } catch (e) {
    majEtat({ chargement: false, erreur: e.message });
  }
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
      membres[e.id] = (org.members || []).map(m => ({ userId: m.userId, nom: m.user ? m.user.name || m.user.email : '?', role: m.role }));
    } catch (err) { /* équipe illisible : rôle inconnu */ }
  }));
  etat.rolesEquipe = roles;
  etat.membresEquipe = membres;
}

/* ---------- Droits (miroir des règles RLS, pour l'affichage uniquement) ----------
   La base reste le seul juge : ces fonctions servent à masquer les boutons inutiles. */
function mesEquipes() {
  const ids = new Set(etat.organisations.map(o => o.id));
  return (etat.d.equipes || []).filter(e => ids.has(e.id));
}
const estMembreDe = equipeId => mesEquipes().some(e => e.id === equipeId);
const estResponsableDe = equipeId => ['owner', 'admin'].includes(etat.rolesEquipe[equipeId]);
const maRessource = () => (etat.d.ressources || []).find(r => r.userId === etat.session.user.id) || null;
function peutEditerProjet(projet) {
  if (!projet) return false;
  if (estMembreDe(projet.equipeId)) return true;
  const moi = maRessource();
  return !!moi && etat.d.affectations.some(a => a.projetId === projet.id && a.ressourceId === moi.id &&
    [ROLES_PROJET.CHEF, ROLES_PROJET.MEMBRE].includes(a.role));
}

/* ---------- Accès pratiques aux données ---------- */
const parId = (cle, id) => (etat.d[cle] || []).find(x => x.id === id) || null;
const equipe = id => parId('equipes', id) || { nom: '—', couleur: '#8A93A3', prefixe: '??' };
const ressource = id => parId('ressources', id);
const projet = id => parId('projets', id);
// Valeurs actives d'un référentiel (ex. 'stp'), triées
const valeursDe = (refId, avecInactives = false) =>
  (etat.d.valeurs || []).filter(v => v.referentielId === refId && (avecInactives || v.actif));
// Couleur associée à un libellé de référentiel
function couleurDe(refId, libelle) { const v = valeursDe(refId, true).find(x => x.libelle === libelle); return v ? v.couleur : '#4A5363'; }
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
  majEtat({ ecran, panneau: null, modale: null });
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
  ouvrirProjet: d => majEtat({ panneau: { type: 'projet', id: d.id } }),
  rien: () => {}
});

window.addEventListener('DOMContentLoaded', demarrer);
