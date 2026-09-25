/* ============================================================
   Serveur simulé pour les tests (Node.js, sans dépendance)
   ------------------------------------------------------------
   Imite, en mémoire, les services Neon utilisés par l'application :
   - /auth/*     : Neon Auth (Better Auth) — session par cookie, jeton,
                   organisations (= équipes), invitations ;
   - /rest/v1/*  : Neon Data API (sous-ensemble PostgREST : select,
                   filtres eq., order, insert/upsert, patch, delete, rpc) ;
   - /app/*      : fichiers de l'application.
   Les règles RLS ne sont PAS simulées (elles sont testées en base) ;
   seules les notes daily sont filtrées par auteur.
   Données : celles de la maquette Pilotage_Projet.dc.html.
   Usage : node tests/serveur-simule.js [port]  (défaut 8123)
   ============================================================ */
'use strict';

const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const RACINE = path.resolve(__dirname, '..');
const PORT = Number(process.argv[2] || process.env.PORT || 8123);
const uuid = () => crypto.randomUUID();
const maintenant = () => new Date().toISOString();

/* ---------- Données de démonstration (maquette) ---------- */
const bd = {};
const utilisateurs = [];      // { id, name, email, password }
const membres = [];           // { id, organizationId, userId, role }
const organisations = [];     // { id, name, slug }
const invitations = [];       // { id, organizationId, email, role, status }
const sessions = {};          // jeton de cookie -> userId
const verificateurs = {};     // vérificateur de session (retour Google) -> userId
// Jeton JWT simulé (non signé) : sub, email, expiration à 15 min
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const jetonPour = u => `${b64({ alg: 'none' })}.${b64({ sub: u.id, email: u.email, exp: Math.floor(Date.now() / 1000) + 900 })}.sim`;

function amorcer() {
  const u = (name, email) => { const x = { id: uuid(), name, email, password: 'motdepasse' }; utilisateurs.push(x); return x; };
  const camille = u('Camille Laurent', 'camille@test.fr'), thomas = u('Thomas Bernard', 'thomas@test.fr'), elodie = u('Élodie Charpentier', 'elodie@test.fr');

  const EQUIPES = [['pf', 'Plateforme', 'PF', '#003CC8'], ['da', 'Data', 'DA', '#0F8A6B'], ['mo', 'Mobile', 'MO', '#B25E09'], ['pr', 'Produit', 'PR', '#7A3FC2']];
  const idEq = {};
  bd.equipes = EQUIPES.map(([cle, nom, prefixe, couleur]) => {
    const id = uuid(); idEq[cle] = id; organisations.push({ id, name: nom, slug: cle });
    return { id, nom, prefixe, couleur, responsable_id: null };
  });
  membres.push({ id: uuid(), organizationId: idEq.pf, userId: camille.id, role: 'owner' });
  membres.push({ id: uuid(), organizationId: idEq.pf, userId: thomas.id, role: 'member' });
  invitations.push({ id: uuid(), organizationId: idEq.pr, email: 'camille@test.fr', role: 'member', status: 'pending' });
  const admin = u('Christelle Admin', 'admin@test.fr');        // administratrice sans équipe
  bd.administrateurs = [{ user_id: camille.id }, { user_id: admin.id }];

  const PERS = [['cl', 'Camille Laurent', 'pf', 'Chef de projet', 100, camille.id], ['tb', 'Thomas Bernard', 'pf', 'Dév. back-end', 100, thomas.id],
    ['lm', 'Léa Moreau', 'pf', 'Dév. front-end', 80], ['jd', 'Julien Dubois', 'pf', 'DevOps', 100], ['hm', 'Hugo Martin', 'da', 'Lead data', 100],
    ['sp', 'Sarah Petit', 'da', 'Data engineer', 100], ['ag', 'Antoine Garcia', 'da', 'Data analyst', 60], ['ir', 'Inès Roux', 'mo', 'Lead mobile', 100],
    ['mf', 'Maxime Fournier', 'mo', 'Dév. iOS', 100], ['cg', 'Chloé Girard', 'mo', 'Dév. Android', 90], ['nb', 'Nadia Benali', 'pr', 'Product manager', 100],
    ['pl', 'Paul Lefèvre', 'pr', 'Product designer', 100]];
  const idP = {};
  bd.ressources = PERS.map(([cle, nom, eq, poste, capacite, userId]) => { const id = uuid(); idP[cle] = id;
    return { id, equipe_id: idEq[eq], nom, poste, capacite, email: cle + '@test.fr', user_id: userId || null }; });
  bd.equipes.forEach((e, i) => { e.responsable_id = idP[['cl', 'hm', 'ir', 'nb'][i]]; });

  const OBJ = [['pf', 'O1', 'Fiabiliser la plateforme', 'haute', [['KR1.1', 'Disponibilité 99,9 %', 80], ['KR1.2', 'Temps de rétablissement < 30 min', 62], ['KR1.3', 'Onboarding dév. < 1 jour', 20]]],
    ['pf', 'O2', 'Sécuriser les accès', 'moyenne', [['KR2.1', '100 % des apps en SSO', 45], ['KR2.2', 'Revue trimestrielle des droits', 50]]],
    ['da', 'O3', 'Décider avec la donnée', 'haute', [['KR3.1', '12 sources connectées', 64], ['KR3.2', '5 rapports automatisés', 88]]],
    ['mo', 'O4', 'Équiper les équipes terrain', 'faible', [['KR4.1', '300 utilisateurs actifs', 38], ['KR4.2', 'Taux d’ouverture push 40 %', 100]]],
    ['pr', 'O5', 'Simplifier les demandes internes', 'moyenne', [['KR5.1', 'Délai de traitement < 5 jours', 55], ['KR5.2', 'Satisfaction demandeurs > 4/5', 40]]],
    ['pr', 'O6', 'Unifier l’expérience des outils', 'moyenne', [['KR6.1', 'Design system adopté par 4 équipes', 30], ['KR6.2', '20 composants documentés', 35]]]];
  bd.objectifs = []; bd.resultats_cles = []; const idKr = {};
  OBJ.forEach(([eq, code, titre, confiance, krs]) => {
    const id = uuid(); bd.objectifs.push({ id, equipe_id: idEq[eq], annee: 2026, trimestre: 4, code, titre, confiance });
    krs.forEach(([c, libelle, progression]) => { const k = uuid(); idKr[c] = k; bd.resultats_cles.push({ id: k, objectif_id: id, code: c, libelle, progression }); });
  });
  // Historique des trimestres passés (progression par trimestre)
  const Q = { pf: [82, 76, 71], da: [70, 78, 85], mo: [64, 58, 49], pr: [75, 80, 68] };
  Object.entries(Q).forEach(([eq, vals]) => vals.forEach((v, i) => { const id = uuid();
    bd.objectifs.push({ id, equipe_id: idEq[eq], annee: 2026, trimestre: i + 1, code: 'O' + (i + 1), titre: 'Objectif T' + (i + 1), confiance: 'moyenne' });
    bd.resultats_cles.push({ id: uuid(), objectif_id: id, code: 'KR', libelle: 'Résultat', progression: v }); }));

  const PROJ = [['PF-12', 'Migration Kubernetes', 'pf', 'KR1.1', 'jd', 72, '2026-07-01', '2026-11-15', 'En cours', 'Migration des 22 services applicatifs vers le cluster Kubernetes managé.', ['Conteneuriser les services batch', 'Configurer l’autoscaling du cluster', 'Migrer la base de sessions', 'Plan de bascule et rollback']],
    ['PF-14', 'SSO & gestion des droits', 'pf', 'KR2.1', 'cl', 45, '2026-08-15', '2026-11-30', 'À risque', 'Généraliser l’authentification unique sur les applications internes.', ['Connecteur annuaire LDAP', 'Mapping des rôles applicatifs', 'Migration de l’outil RH vers le SSO', 'Recette sécurité']],
    ['PF-17', 'Portail développeurs', 'pf', 'KR1.3', 'lm', 20, '2026-09-15', '2026-12-20', 'En cours', 'Point d’entrée unique pour la documentation et l’onboarding.', ['Maquettes du portail', 'Catalogue des API', 'Guide d’onboarding', 'Génération des clés d’API']],
    ['DA-05', 'Entrepôt de données v2', 'da', 'KR3.1', 'hm', 64, '2026-07-15', '2026-12-10', 'En cours', 'Nouvel entrepôt de données centralisant les sources métiers.', ['Connecteur CRM', 'Modèle de données ventes', 'Historisation des référentiels', 'Contrôles de qualité']],
    ['DA-08', 'Tableaux de bord finance', 'da', 'KR3.2', 'ag', 88, '2026-07-01', '2026-10-18', 'En cours', 'Automatisation des rapports mensuels de la direction financière.', ['Rapport de trésorerie', 'Rapport budget vs réalisé', 'Alertes de dépassement', 'Recette avec la DAF']],
    ['MO-21', 'App terrain hors-ligne', 'mo', 'KR4.1', 'ir', 38, '2026-07-10', '2026-11-05', 'En retard', 'Application mobile utilisable sans réseau.', ['Synchronisation différée', 'Stockage chiffré local', 'Gestion des conflits', 'Tests terrain pilote']],
    ['MO-23', 'Notifications push', 'mo', 'KR4.2', 'mf', 100, '2026-07-01', '2026-09-30', 'Terminé', 'Service de notifications push.', ['Service d’envoi', 'Préférences utilisateur', 'Suivi des ouvertures']],
    ['PR-03', 'Refonte du parcours de demande', 'pr', 'KR5.1', 'nb', 55, '2026-08-01', '2026-11-28', 'En cours', 'Nouveau formulaire et circuit de validation des demandes.', ['Entretiens demandeurs', 'Nouveau formulaire', 'Circuit de validation', 'Notifications de suivi']],
    ['PR-06', 'Design system interne', 'pr', 'KR6.1', 'pl', 30, '2026-10-01', '2027-01-15', 'Planifié', 'Bibliothèque de composants partagée.', ['Inventaire des composants', 'Tokens de couleur', 'Documentation', 'Kit Figma']]];
  const idPr = {}; bd.projets = []; bd.tickets = [];
  PROJ.forEach(([code, nom, eq, kr, chef, avancement, debut, fin, statut, description, tickets]) => {
    const id = uuid(); idPr[code] = id;
    bd.projets.push({ id, equipe_id: idEq[eq], code, nom, description, resultat_cle_id: idKr[kr], chef_id: idP[chef], debut, fin, statut, avancement });
    const faits = Math.round(avancement / 100 * tickets.length);
    tickets.forEach((titre, i) => bd.tickets.push({ id: uuid(), projet_id: id, numero: `${code}.${i + 1}`, titre,
      statut: i < faits ? 'Terminé' : i === faits ? 'En revue' : i === faits + 1 ? 'En cours' : 'À faire',
      priorite: ['Haute', 'Moyenne', 'Critique', 'Basse'][i % 4], assigne_id: idP[chef] }));
  });
  const AFF = [['PF-12', 'jd', 'Chef de projet'], ['PF-12', 'tb', 'Membre'], ['PF-12', 'cl', 'Lecteur'], ['PF-14', 'cl', 'Chef de projet'], ['PF-14', 'tb', 'Membre'], ['PF-14', 'lm', 'Membre'],
    ['PF-17', 'lm', 'Chef de projet'], ['PF-17', 'cl', 'Membre'], ['PF-17', 'jd', 'Membre'], ['DA-05', 'hm', 'Chef de projet'], ['DA-05', 'sp', 'Membre'], ['DA-05', 'cl', 'Lecteur'],
    ['DA-08', 'ag', 'Chef de projet'], ['DA-08', 'sp', 'Membre'], ['MO-21', 'ir', 'Chef de projet'], ['MO-21', 'mf', 'Membre'], ['MO-21', 'cg', 'Membre'], ['MO-23', 'mf', 'Chef de projet'],
    ['MO-23', 'cg', 'Membre'], ['PR-03', 'nb', 'Chef de projet'], ['PR-03', 'pl', 'Membre'], ['PR-03', 'cl', 'Membre'], ['PR-06', 'pl', 'Chef de projet'], ['PR-06', 'nb', 'Lecteur'], ['PR-06', 'lm', 'Membre']];
  bd.affectations = AFF.map(([code, p, role]) => ({ id: uuid(), projet_id: idPr[code], ressource_id: idP[p], role }));

  // Absences d'octobre 2026 (proches de la maquette) et heures de la semaine du 21 septembre
  const ABS = [['tb', '2026-10-19', 'Maladie'], ['tb', '2026-10-20', 'Maladie'], ['lm', '2026-10-06', 'Congés payés'], ['lm', '2026-10-07', 'Congés payés'], ['lm', '2026-10-08', 'Congés payés'],
    ['lm', '2026-10-09', 'Congés payés'], ['hm', '2026-10-16', 'Formation'], ['sp', '2026-10-05', 'Congés payés'], ['sp', '2026-10-06', 'Congés payés'], ['ir', '2026-10-14', 'Congés payés'],
    ['ir', '2026-10-22', 'RTT'], ['cg', '2026-10-20', 'RTT'], ['nb', '2026-10-12', 'RTT'], ['nb', '2026-10-13', 'RTT'], ['nb', '2026-10-14', 'RTT'], ['nb', '2026-10-15', 'RTT'],
    ['pl', '2026-10-23', 'RTT'], ['tb', '2026-09-23', 'RTT'], ['cl', '2026-09-24', 'RTT'], ['cl', '2026-03-10', 'Congés payés'], ['cl', '2026-08-10', 'Congés payés']];
  bd.absences = ABS.map(([p, jour, type]) => ({ ressource_id: idP[p], jour, type }));
  bd.temps_saisis = []; bd.feuilles_temps = [];
  const jours = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25'];
  bd.ressources.forEach((r, i) => {
    const sesProjets = bd.affectations.filter(a => a.ressource_id === r.id && a.role !== 'Lecteur').map(a => a.projet_id);
    if (!sesProjets.length) return;
    jours.forEach((jour, j) => {
      if (bd.absences.some(a => a.ressource_id === r.id && a.jour === jour)) return;
      if (i % 5 === 2 && j >= 3) return;                              // quelques feuilles incomplètes
      bd.temps_saisis.push({ id: uuid(), ressource_id: r.id, projet_id: sesProjets[j % sesProjets.length], jour, heures: [7, 7.5, 8, 7, 7.5][(i + j) % 5] * r.capacite / 100 });
    });
    if (i % 3 === 1) bd.feuilles_temps.push({ ressource_id: r.id, semaine: '2026-09-21', statut: 'soumise', commentaire: null });
  });

  // Référentiels et champs : identiques à la migration 002
  bd.referentiels = [['type', 'Types de demande', 1], ['prio', 'Priorités', 2], ['stp', 'Statuts projet', 3], ['stt', 'Statuts ticket', 4], ['role', 'Rôles projet', 5], ['abs', 'Types d’absence', 6]]
    .map(([id, nom, ordre]) => ({ id, nom, ordre }));
  const V = { type: [['Nouveau projet', '#003CC8'], ['Évolution', '#0F8A6B'], ['Anomalie', '#A32020'], ['Accès / droits', '#7A3FC2'], ['Donnée / rapport', '#B25E09']],
    prio: [['Critique', '#A32020'], ['Haute', '#B25E09'], ['Moyenne', '#4A5363'], ['Basse', '#8A93A3']],
    stp: [['Planifié', '#8A93A3', 1], ['En cours', '#003CC8', 1], ['À risque', '#D98A1C', 1], ['En retard', '#D14343', 1], ['Terminé', '#0F8A6B', 1]],
    stt: [['À faire', '#4A5363', 1], ['En cours', '#003CC8', 1], ['En revue', '#5E2CA5', 1], ['Terminé', '#0F8A6B', 1]],
    role: [['Chef de projet', '#003CC8', 1], ['Membre', '#4A5363', 1], ['Lecteur', '#8A93A3', 1]],
    abs: [['Congés payés', '#003CC8', 1, 'CP'], ['RTT', '#0F8A6B', 0, 'RTT'], ['Maladie', '#A32020', 0, 'MA'], ['Formation', '#B25E09', 0, 'FO']] };
  bd.valeurs_referentiel = [];
  Object.entries(V).forEach(([ref, vals]) => vals.forEach(([libelle, couleur, systeme, abrege], i) =>
    bd.valeurs_referentiel.push({ id: uuid(), referentiel_id: ref, libelle, abrege: abrege || null, couleur, actif: true, systeme: !!systeme, ordre: i + 1 })));
  bd.champs_formulaire = [['Titre de la demande', 'Texte court', true, null, 'titre', true], ['Type de demande', 'Liste', true, 'type', 'type', true],
    ['Description du besoin', 'Texte long', true, null, 'description', false], ['Équipe concernée', 'Liste', true, 'equipes', 'equipe_id', true],
    ['Priorité souhaitée', 'Liste', false, 'prio', 'priorite', false], ['Date de livraison souhaitée', 'Date', false, null, 'date_souhaitee', false],
    ['Budget estimé (k€)', 'Nombre', false, null, 'budget', false], ['Pièces jointes', 'Fichier', false, null, null, false]]
    .map(([libelle, type, obligatoire, referentiel_id, cle, systeme], i) => ({ id: uuid(), ordre: i + 1, libelle, type, obligatoire, referentiel_id, cle, systeme }));
  bd.jours_feries = [['2026-11-01', 'Toussaint'], ['2026-11-11', 'Armistice'], ['2026-12-25', 'Noël'], ['2026-08-15', 'Assomption'], ['2026-07-14', 'Fête nationale']].map(([jour, libelle]) => ({ jour, libelle }));


  const DEM = [['Assistant conversationnel RH', 'Nouveau projet', 'pr', 'Basse', 'refusee', 'Élodie Charpentier', 'RH', 'Répondre automatiquement aux questions fréquentes.', 'Hors périmètre 2026, à reproposer au cadrage budgétaire 2027.', elodie.id],
    ['Note de frais sur mobile', 'Évolution', 'pf', 'Basse', 'acceptee', 'Sophie Mercier', 'Exploitation', 'Photographier et soumettre un justificatif.', null, uuid()],
    ['Doublons clients dans le CRM', 'Anomalie', 'pf', 'Haute', 'acceptee', 'Marc Lambert', 'Finance', 'Environ 4 % des fiches clients sont en double.', null, uuid()],
    ['Export comptable automatique', 'Évolution', 'pf', 'Haute', 'analyse', 'Karim Haddad', 'Comptabilité', 'Générer chaque nuit l’export des écritures.', null, uuid()],
    ['Application de relevé de compteurs', 'Nouveau projet', 'pf', 'Moyenne', 'analyse', 'Sophie Mercier', 'Exploitation', 'Saisie des relevés sur tablette.', null, uuid()],
    ['Accès SSO pour l’outil de paie', 'Accès / droits', 'pf', 'Critique', 'nouvelle', 'Marc Lambert', 'Finance', 'Intégrer l’outil de paie au SSO.', null, uuid()],
    ['Tableau de bord absentéisme RH', 'Donnée / rapport', 'pf', 'Haute', 'nouvelle', 'Élodie Charpentier', 'RH', 'Suivi mensuel du taux d’absentéisme par service.', null, elodie.id]];
  bd.demandes = DEM.map(([titre, type, eq, priorite, statut, demandeur_nom, service, description, commentaire, demandeur_id], i) => ({
    id: uuid(), numero: 38 + i, titre, type, description, equipe_id: idEq[eq], priorite, date_souhaitee: '2026-12-15', budget: 12, valeurs: {},
    statut, commentaire, demandeur_id, demandeur_nom, service, projet_id: null, cree_le: `2026-09-${String(10 + i * 2).padStart(2, '0')}T09:00:00Z` }));
  const jourJ = new Date().toISOString().slice(0, 10);   // notes « du jour » pour les tests
  bd.notes_daily = [{ user_id: thomas.id, jour: jourJ, texte: 'Hier\n- Connecteur LDAP : corrections de revue\n\nAujourd’hui\n- Mapping des rôles applicatifs\n\nBlocages\n- Identifiants de recette expirés' },
    { user_id: camille.id, jour: jourJ, texte: 'Hier\n- Revue de la PR connecteur LDAP avec Thomas\n- Point budget T4 avec Nadia\n\nAujourd’hui\n- Finaliser le plan de migration SSO\n- Préparer la démo du sprint 20\n\nBlocages\n- Accès annuaire côté DSI toujours en attente' },
    { user_id: camille.id, jour: '2026-09-24', texte: 'Hier\n- Atelier mapping des rôles\n\nAujourd’hui\n- Revue de la PR LDAP\n- Point budget T4' }];
}
amorcer();

/* ---------- Outils HTTP ---------- */
function envoyer(res, statut, corps, entetes = {}) {
  res.writeHead(statut, { 'Content-Type': 'application/json', ...entetes });
  res.end(corps === undefined ? '' : JSON.stringify(corps));
}
const lireCorps = req => new Promise(r => { let d = ''; req.on('data', c => { d += c; }); req.on('end', () => r(d ? JSON.parse(d) : null)); });
function utilisateurCourant(req) {
  const m = /sim_session=([^;]+)/.exec(req.headers.cookie || '');
  const id = m && sessions[m[1]]; return utilisateurs.find(u => u.id === id) || null;
}
function utilisateurDuJeton(req) {
  const m = /Bearer (.+)/.exec(req.headers.authorization || ''); if (!m) return null;
  try { const charge = JSON.parse(Buffer.from(m[1].split('.')[1], 'base64url').toString()); return utilisateurs.find(u => u.id === charge.sub) || null; } catch (e) { return null; }
}
function ouvrirSession(res, u) {
  const jeton = uuid(); sessions[jeton] = u.id;
  return { 'Set-Cookie': `sim_session=${jeton}; Path=/; HttpOnly` };
}
const vueUtilisateur = u => ({ id: u.id, name: u.name, email: u.email });

/* ---------- Neon Auth simulé ---------- */
async function auth(req, res, chemin, url) {
  const corps = req.method === 'POST' ? await lireCorps(req) : null;
  const moi = utilisateurCourant(req);
  switch (chemin) {
    case '/sign-in/email': {
      const u = utilisateurs.find(x => x.email === corps.email && x.password === corps.password);
      if (!u) return envoyer(res, 401, { message: 'Invalid email or password' });
      return envoyer(res, 200, { user: vueUtilisateur(u) }, ouvrirSession(res, u));
    }
    case '/sign-up/email': {
      if (utilisateurs.some(x => x.email === corps.email)) return envoyer(res, 422, { message: 'Email déjà utilisé' });
      const u = { id: uuid(), name: corps.name, email: corps.email, password: corps.password }; utilisateurs.push(u);
      return envoyer(res, 200, { user: vueUtilisateur(u) }, ouvrirSession(res, u));
    }
    case '/sign-out': return envoyer(res, 200, { success: true }, { 'Set-Cookie': 'sim_session=; Path=/; Max-Age=0' });
    // Google simulé : /sign-in/social renvoie l'adresse du « fournisseur », qui redirige vers
    // callbackURL?neon_auth_session_verifier=… ; /get-session échange ce vérificateur contre la session.
    case '/sign-in/social':
      return envoyer(res, 200, { url: `/auth/google-simule?retour=${encodeURIComponent(corps.callbackURL)}`, redirect: true });
    case '/google-simule': {
      let u = utilisateurs.find(x => x.email === 'google@test.fr');
      if (!u) { u = { id: uuid(), name: 'Gaëlle Google', email: 'google@test.fr', password: null }; utilisateurs.push(u); }
      const verificateur = uuid(); verificateurs[verificateur] = u.id;
      const retour = new URL(url.searchParams.get('retour')); retour.searchParams.set('neon_auth_session_verifier', verificateur);
      res.writeHead(302, { Location: retour.href }); return res.end();
    }
    case '/get-session': {
      const v = url.searchParams.get('neon_auth_session_verifier');
      const u = v && verificateurs[v] ? utilisateurs.find(x => x.id === verificateurs[v]) : moi;
      if (v) delete verificateurs[v];
      if (!u) return envoyer(res, 200, null);
      const entetes = { 'set-auth-jwt': jetonPour(u) };
      if (v) Object.assign(entetes, ouvrirSession(res, u));
      return envoyer(res, 200, { user: vueUtilisateur(u), session: { id: 's' } }, entetes);
    }
    case '/token': {
      if (!moi) return envoyer(res, 401, { message: 'Non connecté' });
      return envoyer(res, 200, { token: jetonPour(moi) });
    }
  }
  if (!moi) return envoyer(res, 401, { message: 'Non connecté' });
  switch (chemin) {
    case '/organization/list':
      return envoyer(res, 200, organisations.filter(o => membres.some(m => m.organizationId === o.id && m.userId === moi.id)));
    case '/organization/create': {
      const o = { id: uuid(), name: corps.name, slug: corps.slug }; organisations.push(o);
      membres.push({ id: uuid(), organizationId: o.id, userId: moi.id, role: 'owner' }); return envoyer(res, 200, o);
    }
    case '/organization/set-active': return envoyer(res, 200, {});
    case '/organization/get-full-organization': {
      const id = url.searchParams.get('organizationId'), o = organisations.find(x => x.id === id);
      return envoyer(res, 200, { ...o, members: membres.filter(m => m.organizationId === id).map(m => ({ ...m, user: vueUtilisateur(utilisateurs.find(u => u.id === m.userId)) })),
        invitations: invitations.filter(i => i.organizationId === id) });
    }
    case '/organization/invite-member': {
      invitations.push({ id: uuid(), organizationId: corps.organizationId, email: corps.email, role: corps.role, status: 'pending' }); return envoyer(res, 200, {});
    }
    case '/organization/list-user-invitations':
      return envoyer(res, 200, invitations.filter(i => i.email === moi.email).map(i => ({ ...i, organizationName: organisations.find(o => o.id === i.organizationId).name })));
    case '/organization/accept-invitation': case '/organization/reject-invitation': {
      const i = invitations.find(x => x.id === corps.invitationId);
      i.status = chemin.includes('accept') ? 'accepted' : 'rejected';
      if (i.status === 'accepted') membres.push({ id: uuid(), organizationId: i.organizationId, userId: moi.id, role: i.role });
      return envoyer(res, 200, {});
    }
  }
  envoyer(res, 404, { message: 'Route auth inconnue : ' + chemin });
}

/* ---------- Data API simulée (sous-ensemble PostgREST) ---------- */
const CLES = { absences: ['ressource_id', 'jour'], feuilles_temps: ['ressource_id', 'semaine'], notes_daily: ['user_id', 'jour'], administrateurs: ['user_id'], jours_feries: ['jour'] };
function filtrer(lignes, params) {
  let r = lignes;
  params.forEach((v, k) => { if (['select', 'order', 'on_conflict'].includes(k)) return;
    if (v.startsWith('eq.')) r = r.filter(l => String(l[k]) === v.slice(3));
    if (v.startsWith('gte.')) r = r.filter(l => String(l[k]) >= v.slice(4)); });
  const ordre = params.get('order');
  if (ordre) { const [col, sens] = ordre.split('.'); r = [...r].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (sens === 'desc' ? -1 : 1)); }
  return r;
}
async function donnees(req, res, table, url) {
  const moi = utilisateurDuJeton(req);
  if (!moi) return envoyer(res, 401, { message: 'JWT manquant' });
  if (table.startsWith('rpc/')) {
    if (table === 'rpc/lier_ma_ressource') bd.ressources.filter(r => !r.user_id && r.email === moi.email).forEach(r => { r.user_id = moi.id; });
    return envoyer(res, 200, null);
  }
  if (!bd[table]) return envoyer(res, 404, { message: 'Table inconnue : ' + table });
  const p = url.searchParams;
  // Notes de daily : l'auteur et ses coéquipiers (même organisation), comme la règle RLS
  const partage = autre => membres.some(m1 => m1.userId === moi.id && membres.some(m2 => m2.userId === autre && m2.organizationId === m1.organizationId));
  const visibles = () => table === 'notes_daily' ? bd[table].filter(n => n.user_id === moi.id || partage(n.user_id)) : bd[table];
  if (req.method === 'GET') return envoyer(res, 200, filtrer(visibles(), p));
  if (req.method === 'DELETE') { const cibles = new Set(filtrer(bd[table], p)); bd[table] = bd[table].filter(l => !cibles.has(l)); return envoyer(res, 204); }
  const corps = await lireCorps(req);
  if (req.method === 'PATCH') { const cibles = filtrer(bd[table], p); cibles.forEach(l => Object.assign(l, corps, { modifie_le: maintenant() })); return envoyer(res, 200, cibles); }
  if (req.method === 'POST') {
    const conflit = p.get('on_conflict') ? p.get('on_conflict').split(',') : null;
    const resultat = corps.map(ligne => {
      const l = { ...ligne };
      if (table === 'notes_daily' && !l.user_id) l.user_id = moi.id;
      if (table === 'demandes') { l.numero = Math.max(0, ...bd.demandes.map(x => x.numero)) + 1; l.statut = l.statut || 'nouvelle'; l.demandeur_id = moi.id; l.cree_le = maintenant(); l.valeurs = l.valeurs || {}; }
      if (!CLES[table] && !l.id) l.id = uuid();
      if (table === 'valeurs_referentiel') { l.actif = l.actif ?? true; l.systeme = l.systeme ?? false; }   // valeurs par défaut SQL
      const cle = conflit || CLES[table];
      const existante = conflit && bd[table].find(x => cle.every(c => String(x[c]) === String(l[c])));
      if (existante) { Object.assign(existante, l); return existante; }
      bd[table].push(l); return l;
    });
    return envoyer(res, 201, resultat);
  }
  envoyer(res, 405, { message: 'Méthode non gérée' });
}

/* ---------- Fichiers statiques ---------- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' };
function statique(res, chemin) {
  const fichier = path.join(RACINE, chemin.endsWith('/') ? chemin + 'index.html' : chemin);
  if (!fichier.startsWith(RACINE) || !fs.existsSync(fichier)) { res.writeHead(404); return res.end('Introuvable'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(fichier)] || 'application/octet-stream' }); fs.createReadStream(fichier).pipe(res);
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname.startsWith('/auth/')) return await auth(req, res, url.pathname.slice(5), url);
    if (url.pathname.startsWith('/rest/v1/')) return await donnees(req, res, url.pathname.slice(9), url);
    if (url.pathname === '/') { res.writeHead(302, { Location: '/app/' }); return res.end(); }
    return statique(res, url.pathname);
  } catch (e) { envoyer(res, 500, { message: e.message }); }
}).listen(PORT, () => console.log(`Serveur simulé : http://localhost:${PORT}/app/  (comptes : camille@test.fr, thomas@test.fr, elodie@test.fr / motdepasse)`));
