/* ============================================================
   Accès aux services Neon (sans dépendance, fetch natif)
   ------------------------------------------------------------
   1. Authentification : Neon Auth (Better Auth), session par cookie
      (d'où credentials: 'include' sur tous les appels).
   2. Organisations = équipes (plugin « organization » de Better Auth).
   3. Données : Neon Data API (REST façon PostgREST), avec le jeton
      JWT de l'utilisateur ; la base applique ses règles RLS.
   Les colonnes SQL sont en snake_case, l'application en camelCase :
   la conversion est faite ici, une seule fois.
   ============================================================ */
'use strict';

const Api = (() => {

  /* ---------- Outils ---------- */

  // Appel HTTP commun : lève une erreur lisible si la réponse n'est pas OK
  async function appeler(url, options = {}) {
    const reponse = await fetch(url, { credentials: 'include', ...options });
    const texte = await reponse.text();
    const corps = texte ? JSON.parse(texte) : null;
    if (!reponse.ok) {
      const message = (corps && (corps.message || corps.error || corps.hint)) || `Erreur ${reponse.status}`;
      throw new Error(message);
    }
    return corps;
  }
  const json = (methode, corps) => ({
    method: methode,
    headers: { 'Content-Type': 'application/json' },
    body: corps === undefined ? undefined : JSON.stringify(corps)
  });

  // camelCase <-> snake_case (ex. equipeId <-> equipe_id)
  const versSnake = cle => cle.replace(/[A-Z]/g, l => '_' + l.toLowerCase());
  const versCamel = cle => cle.replace(/_([a-z])/g, (_, l) => l.toUpperCase());

  // Objet app -> ligne SQL. Les chaînes vides deviennent null (dates, nombres).
  function versBdd(objet) {
    const ligne = {};
    Object.entries(objet).forEach(([cle, valeur]) => { ligne[versSnake(cle)] = valeur === '' ? null : valeur; });
    return ligne;
  }
  // Ligne SQL -> objet app. Les champs numeric arrivent parfois en texte : conversion.
  function depuisBdd(ligne) {
    const objet = {};
    Object.entries(ligne).forEach(([cle, valeur]) => { objet[versCamel(cle)] = valeur; });
    ['heures', 'budget'].forEach(c => { if (typeof objet[c] === 'string') objet[c] = Number(objet[c]); });
    return objet;
  }

  /* ---------- 1. Authentification (Better Auth) ---------- */
  const auth = chemin => CONFIG.NEON_AUTH_URL + chemin;

  const inscrire = (nom, email, motDePasse) =>
    appeler(auth('/sign-up/email'), json('POST', { name: nom, email, password: motDePasse }));
  const connecter = (email, motDePasse) =>
    appeler(auth('/sign-in/email'), json('POST', { email, password: motDePasse }));

  // Adresse de retour après Google : la page de l'application, sans paramètres
  const adresseRetour = () => location.origin + location.pathname;

  // Connexion Google : Better Auth renvoie l'URL de Google, on y redirige le navigateur.
  // Au retour, Neon Auth ajoute ?neon_auth_session_verifier=… (succès) ou ?error=… (échec).
  async function connecterGoogle() {
    const retour = adresseRetour();
    const r = await appeler(auth('/sign-in/social'), json('POST',
      { provider: 'google', callbackURL: retour, newUserCallbackURL: retour, errorCallbackURL: retour }));
    if (r && r.url) location.href = r.url;
  }

  async function deconnecter() {
    jetonEnCache = null;
    await appeler(auth('/sign-out'), json('POST', {}));
  }

  /* Session : même mécanisme que le kit officiel @neondatabase/neon-js.
     - Retour de Google : le « vérificateur de session » présent dans l'adresse est
       transmis à /get-session, qui ouvre la session ; on le retire ensuite de l'adresse.
     - La réponse de /get-session porte le jeton JWT dans l'en-tête « set-auth-jwt » :
       on le garde pour la Data API (évite un appel /token). */
  const PARAM_VERIFICATEUR = 'neon_auth_session_verifier';
  async function lireSession() {
    const verificateur = new URLSearchParams(location.search).get(PARAM_VERIFICATEUR);
    const url = auth('/get-session') + (verificateur ? `?${PARAM_VERIFICATEUR}=${encodeURIComponent(verificateur)}` : '');
    try {
      const reponse = await fetch(url, { credentials: 'include' });
      const texte = await reponse.text();
      const session = reponse.ok && texte ? JSON.parse(texte) : null;
      memoriserJeton(reponse.headers.get('set-auth-jwt'));
      if (verificateur) {                      // nettoie l'adresse (évite une réutilisation au rechargement)
        const propre = new URL(location.href); propre.searchParams.delete(PARAM_VERIFICATEUR);
        history.replaceState(history.state, '', propre.href);
      }
      return session;
    } catch (e) { return null; }
  }

  // Erreur renvoyée par Neon Auth dans l'adresse après un échec Google (?error=…), puis retirée
  function lireErreurRetour() {
    const adresse = new URL(location.href), erreur = adresse.searchParams.get('error');
    if (!erreur) return null;
    adresse.searchParams.delete('error'); adresse.searchParams.delete('error_description');
    history.replaceState(history.state, '', adresse.href);
    return erreur;
  }

  // Jeton JWT pour la Data API : valable 15 min, gardé en mémoire et renouvelé 1 min avant la fin
  let jetonEnCache = null;
  function memoriserJeton(jeton) {
    if (!jeton) return;
    const charge = JSON.parse(atob(jeton.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    jetonEnCache = { valeur: jeton, expiration: charge.exp || Date.now() / 1000 + 600 };
  }
  async function obtenirJeton() {
    const maintenant = Date.now() / 1000;
    if (jetonEnCache && jetonEnCache.expiration - 60 > maintenant) return jetonEnCache.valeur;
    const r = await appeler(auth('/token'));
    memoriserJeton(r.token);
    return r.token;
  }

  /* ---------- 2. Équipes = organisations Neon Auth ---------- */
  const listerOrganisations = () => appeler(auth('/organization/list'));
  const creerOrganisation = (nom, slug) =>
    appeler(auth('/organization/create'), json('POST', { name: nom, slug, keepCurrentActiveOrganization: true }));
  const activerOrganisation = organizationId =>
    appeler(auth('/organization/set-active'), json('POST', { organizationId }));
  // Détail d'une équipe : membres (avec rôle owner/admin/member et utilisateur) et invitations
  const lireOrganisation = organizationId =>
    appeler(auth('/organization/get-full-organization?organizationId=' + encodeURIComponent(organizationId)));
  const inviterMembre = (organizationId, email, role) =>
    appeler(auth('/organization/invite-member'), json('POST', { organizationId, email, role }));
  const listerMesInvitations = () => appeler(auth('/organization/list-user-invitations'));
  // Suppression d'une équipe côté Neon Auth (réservée au propriétaire de l'organisation)
  const supprimerOrganisation = organizationId =>
    appeler(auth('/organization/delete'), json('POST', { organizationId }));
  const accepterInvitation = invitationId =>
    appeler(auth('/organization/accept-invitation'), json('POST', { invitationId }));
  const refuserInvitation = invitationId =>
    appeler(auth('/organization/reject-invitation'), json('POST', { invitationId }));

  /* ---------- 3. Données (Neon Data API) ---------- */

  // En-têtes communs : jeton de l'utilisateur ; « Prefer » pour récupérer les lignes écrites
  async function entetes(supplement = {}) {
    return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await obtenirJeton(), ...supplement };
  }
  // filtres : { colonne: 'eq.valeur' } (syntaxe PostgREST) -> chaîne de requête
  function requete(filtres = {}) {
    const p = new URLSearchParams();
    Object.entries(filtres).forEach(([cle, valeur]) => p.append(cle, valeur));
    return p.toString();
  }
  const urlTable = (table, filtres) => `${CONFIG.DATA_API_URL}/${table}?${requete(filtres)}`;

  // Lecture : renvoie des objets en camelCase
  async function lire(table, filtres = {}) {
    const lignes = await appeler(urlTable(table, { select: '*', ...filtres }),
      { credentials: 'omit', headers: await entetes() });
    return lignes.map(depuisBdd);
  }

  // Création d'une ou plusieurs lignes. « conflit » = colonnes d'unicité pour un upsert.
  async function creer(table, lignes, conflit) {
    const liste = (Array.isArray(lignes) ? lignes : [lignes]).map(versBdd);
    const prefer = conflit ? 'return=representation,resolution=merge-duplicates' : 'return=representation';
    const filtres = conflit ? { on_conflict: conflit } : {};
    const resultat = await appeler(urlTable(table, filtres), {
      method: 'POST', credentials: 'omit', headers: await entetes({ Prefer: prefer }), body: JSON.stringify(liste)
    });
    return resultat.map(depuisBdd);
  }

  async function modifier(table, filtres, modifications) {
    const resultat = await appeler(urlTable(table, filtres), {
      method: 'PATCH', credentials: 'omit', headers: await entetes({ Prefer: 'return=representation' }),
      body: JSON.stringify(versBdd(modifications))
    });
    return resultat.map(depuisBdd);
  }

  async function supprimer(table, filtres) {
    await appeler(urlTable(table, filtres), { method: 'DELETE', credentials: 'omit', headers: await entetes() });
  }

  // Appel d'une fonction SQL exposée (ex. lier_ma_ressource)
  async function executer(fonction, args = {}) {
    return appeler(`${CONFIG.DATA_API_URL}/rpc/${fonction}`, {
      method: 'POST', credentials: 'omit', headers: await entetes(), body: JSON.stringify(args)
    });
  }

  return {
    inscrire, connecter, connecterGoogle, deconnecter, lireSession, lireErreurRetour, obtenirJeton,
    listerOrganisations, creerOrganisation, activerOrganisation, lireOrganisation, inviterMembre,
    listerMesInvitations, accepterInvitation, refuserInvitation, supprimerOrganisation,
    lire, creer, modifier, supprimer, executer
  };
})();
