/* ============================================================
   Client des services Neon (fetch natif, sans dépendance)
   (portage TypeScript de app/js/api.js — phase 3 de la migration)
   ------------------------------------------------------------
   1. Authentification : Neon Auth (Better Auth), session par cookie (credentials: 'include').
   2. Organisations = équipes (plugin « organization » de Better Auth).
   3. Données : Neon Data API (REST façon PostgREST) avec le jeton JWT de l'utilisateur ; la base applique ses règles RLS.
   Les colonnes SQL sont en snake_case, l'application en camelCase : la conversion est faite ici, une seule fois.
   ============================================================ */
import { adresses } from './adresses';

/** Ligne de base de données (camelCase) ; les types précis sont posés par donnees.ts */
export type Ligne = Record<string, unknown>;

/** Erreur lisible renvoyée par les services ; « code » est le code technique de Neon Auth (ex. EMAIL_NOT_VERIFIED) */
export class ErreurApi extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

/* ---------- Simulation de rôle : lecture seule ---------- */

/* Pendant une simulation, toute écriture est refusée ici, à un seul endroit (la base appliquerait les droits réels du
   créateur). Exceptions : appels POST qui ne font que lire (fonctions SQL de lecture) et la déconnexion. */
const POST_SANS_ECRITURE = ['/rpc/comptes_en_attente', '/rpc/daily_projet', '/sign-out'];
let simulationActive = false;
export const definirSimulationActive = (active: boolean): void => { simulationActive = active; };

function refuserEnSimulation(url: string, methode?: string): void {
  if (!simulationActive || !methode || methode === 'GET') return;
  if (POST_SANS_ECRITURE.some(fin => url.split('?')[0]?.endsWith(fin))) return;
  throw new ErreurApi('Simulation : lecture seule, rien n’est enregistré');
}

/* ---------- Outils ---------- */

/** Appel HTTP commun : renvoie le corps JSON, ou lève une erreur lisible si la réponse n'est pas OK */
export async function appeler<T = unknown>(url: string, options: RequestInit = {}): Promise<T> {
  refuserEnSimulation(url, options.method);
  const reponse = await fetch(url, { credentials: 'include', ...options });
  const texte = await reponse.text();
  const corps = texte ? JSON.parse(texte) : null;
  if (!reponse.ok) {
    const message = corps?.message || corps?.error || corps?.hint || `Erreur ${reponse.status}`;
    throw new ErreurApi(message, corps?.code);
  }
  return corps as T;
}

const json = (methode: string, corps?: unknown): RequestInit => ({
  method: methode,
  headers: { 'Content-Type': 'application/json' },
  body: corps === undefined ? undefined : JSON.stringify(corps)
});

// camelCase <-> snake_case (ex. equipeId <-> equipe_id)
export const versSnake = (cle: string): string => cle.replace(/[A-Z]/g, l => '_' + l.toLowerCase());
export const versCamel = (cle: string): string => cle.replace(/_([a-z])/g, (_, l: string) => l.toUpperCase());

/** Objet application -> ligne SQL. Les chaînes vides deviennent null (dates, nombres), sauf les champs listés dans « garderVides » */
export function versBdd(objet: Ligne, garderVides: string[] = []): Ligne {
  const ligne: Ligne = {};
  Object.entries(objet).forEach(([cle, valeur]) => {
    ligne[versSnake(cle)] = valeur === '' && !garderVides.includes(cle) ? null : valeur;
  });
  return ligne;
}

// Colonnes numeric que la Data API renvoie parfois en texte
const COLONNES_NOMBRES = ['heures', 'budget', 'duree'];

/** Ligne SQL -> objet application (camelCase, nombres convertis) */
export function depuisBdd(ligne: Ligne): Ligne {
  const objet: Ligne = {};
  Object.entries(ligne).forEach(([cle, valeur]) => { objet[versCamel(cle)] = valeur; });
  COLONNES_NOMBRES.forEach(c => { if (typeof objet[c] === 'string') objet[c] = Number(objet[c]); });
  return objet;
}

/* ---------- 1. Authentification (Better Auth) ---------- */
const auth = (chemin: string): string => adresses().NEON_AUTH_URL + chemin;

/** Utilisateur et session renvoyés par Neon Auth */
export interface SessionAuth {
  user: { id: string; name: string; email: string; emailVerified?: boolean };
  session?: Ligne;
}

export const inscrire = (nom: string, email: string, motDePasse: string) =>
  appeler(auth('/sign-up/email'), json('POST', { name: nom, email, password: motDePasse }));
export const connecter = (email: string, motDePasse: string) =>
  appeler(auth('/sign-in/email'), json('POST', { email, password: motDePasse }));

/* Vérification de l'adresse email par code à 6 chiffres (Neon Auth, méthode « otp ») : envoi du code, puis vérification — qui ouvre
   la session (réglage « connexion automatique après vérification »). */
export const envoyerCodeVerification = (email: string) =>
  appeler(auth('/email-otp/send-verification-otp'), json('POST', { email, type: 'email-verification' }));
export const verifierEmail = (email: string, code: string) =>
  appeler(auth('/email-otp/verify-email'), json('POST', { email, otp: code }));

/* Mot de passe oublié (Better Auth) : Neon Auth envoie un email avec un lien qui revient sur l'application avec ?token=… ;
   l'utilisateur y choisit son nouveau mot de passe. Personne d'autre (ni l'administrateur) ne le voit ni ne le choisit. */
const adresseRetour = (): string => location.origin + location.pathname;

export async function demanderReinitialisation(email: string): Promise<void> {
  const corps = { email, redirectTo: adresseRetour() };
  try { await appeler(auth('/request-password-reset'), json('POST', corps)); }
  catch (e) {
    if (!/404|not found/i.test((e as Error).message || '')) throw e;
    await appeler(auth('/forget-password'), json('POST', corps));      // ancienne route Better Auth
  }
}
export const reinitialiserMotDePasse = (token: string, motDePasse: string) =>
  appeler(auth('/reset-password'), json('POST', { token, newPassword: motDePasse }));

export async function deconnecter(): Promise<void> {
  jetonEnCache = null;
  await appeler(auth('/sign-out'), json('POST', {}));
}

/* Jeton JWT pour la Data API : valable 15 min, gardé en mémoire et renouvelé 1 min avant la fin. */
interface JetonMemorise { valeur: string; expiration: number }
let jetonEnCache: JetonMemorise | null = null;

function memoriserJeton(jeton: string | null): void {
  const charge = jeton?.split('.')[1];
  if (!jeton || !charge) return;
  const contenu = JSON.parse(atob(charge.replace(/-/g, '+').replace(/_/g, '/')));
  jetonEnCache = { valeur: jeton, expiration: contenu.exp || Date.now() / 1000 + 600 };
}

/** Session en cours, ou null. La réponse de /get-session porte le jeton JWT dans l'en-tête « set-auth-jwt » (comme le
 *  kit officiel @neondatabase/neon-js) : on le garde pour la Data API, ce qui évite un appel /token. */
export async function lireSession(): Promise<SessionAuth | null> {
  try {
    const reponse = await fetch(auth('/get-session'), { credentials: 'include' });
    const texte = await reponse.text();
    const session = reponse.ok && texte ? JSON.parse(texte) : null;
    memoriserJeton(reponse.headers.get('set-auth-jwt'));
    return session;
  } catch {
    return null;
  }
}

export async function obtenirJeton(): Promise<string> {
  const maintenant = Date.now() / 1000;
  if (jetonEnCache && jetonEnCache.expiration - 60 > maintenant) return jetonEnCache.valeur;
  const r = await appeler<{ token: string }>(auth('/token'));
  memoriserJeton(r.token);
  return r.token;
}

/* ---------- 2. Équipes = organisations Neon Auth ---------- */
export interface Organisation { id: string; name: string; slug?: string }
export interface MembreOrganisation { id: string; userId: string; role: string; user?: { name?: string; email?: string } }
export interface OrganisationDetaillee extends Organisation { members?: MembreOrganisation[] }
export interface Invitation { id: string; status: string; organizationId?: string; organizationName?: string; role?: string; email?: string }

export const listerOrganisations = () => appeler<Organisation[] | null>(auth('/organization/list'));
export const lireOrganisation = (organizationId: string) =>
  appeler<OrganisationDetaillee>(auth('/organization/get-full-organization?organizationId=' + encodeURIComponent(organizationId)));
export const activerOrganisation = (organizationId: string) => appeler(auth('/organization/set-active'), json('POST', { organizationId }));
export const accepterInvitation = (invitationId: string) => appeler(auth('/organization/accept-invitation'), json('POST', { invitationId }));
export const refuserInvitation = (invitationId: string) => appeler(auth('/organization/reject-invitation'), json('POST', { invitationId }));
export const listerMesInvitations = () => appeler<Invitation[] | null>(auth('/organization/list-user-invitations'));

/* ---------- 3. Données (Neon Data API) ---------- */

/** En-têtes communs : jeton de l'utilisateur ; « Prefer » pour récupérer les lignes écrites */
async function entetes(supplement: Record<string, string> = {}): Promise<Record<string, string>> {
  return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await obtenirJeton(), ...supplement };
}

/** filtres : { colonne: 'eq.valeur' } (syntaxe PostgREST) -> adresse de la table */
function urlTable(table: string, filtres: Record<string, string | number> = {}): string {
  const p = new URLSearchParams();
  Object.entries(filtres).forEach(([cle, valeur]) => p.append(cle, String(valeur)));
  return `${adresses().DATA_API_URL}/${table}?${p.toString()}`;
}

const TAILLE_PAGE = 1000;

/* Lecture, en camelCase. La Data API limite le nombre de lignes par réponse : on lit page après page (limit / offset)
   jusqu'à une page vide. filtres.order doit donner un ordre stable (clé unique en dernier, voir tables.ts), sinon des lignes
   seraient sautées. cache: 'no-store' : sans lui, le navigateur peut resservir une ancienne réponse de la même adresse. */
export async function lire(table: string, filtres: Record<string, string | number> = {}): Promise<Ligne[]> {
  let lignes: Ligne[] = [];
  for (let offset = 0; ; ) {
    const page = await appeler<Ligne[]>(urlTable(table, { select: '*', ...filtres, limit: TAILLE_PAGE, offset }),
      { credentials: 'omit', cache: 'no-store', headers: await entetes() });
    if (!page.length) break;
    lignes = lignes.concat(page);
    offset += page.length;
  }
  return lignes.map(depuisBdd);
}

/** Création d'une ou plusieurs lignes. « conflit » = colonnes d'unicité pour un upsert. */
export async function creer(table: string, lignes: Ligne | Ligne[], conflit?: string, garderVides: string[] = []): Promise<Ligne[]> {
  const liste = (Array.isArray(lignes) ? lignes : [lignes]).map(l => versBdd(l, garderVides));
  const prefer = conflit ? 'return=representation,resolution=merge-duplicates' : 'return=representation';
  const resultat = await appeler<Ligne[]>(urlTable(table, conflit ? { on_conflict: conflit } : {}), {
    method: 'POST', credentials: 'omit', headers: await entetes({ Prefer: prefer }), body: JSON.stringify(liste)
  });
  return resultat.map(depuisBdd);
}

export async function modifier(table: string, filtres: Record<string, string>, modifications: Ligne): Promise<Ligne[]> {
  const resultat = await appeler<Ligne[]>(urlTable(table, filtres), {
    method: 'PATCH', credentials: 'omit', headers: await entetes({ Prefer: 'return=representation' }),
    body: JSON.stringify(versBdd(modifications))
  });
  return resultat.map(depuisBdd);
}

export async function supprimer(table: string, filtres: Record<string, string>): Promise<void> {
  await appeler(urlTable(table, filtres), { method: 'DELETE', credentials: 'omit', headers: await entetes() });
}

/** Appel d'une fonction SQL exposée (ex. lier_ma_ressource) */
export async function executer<T = unknown>(fonction: string, args: Ligne = {}): Promise<T> {
  return appeler<T>(`${adresses().DATA_API_URL}/rpc/${fonction}`, {
    method: 'POST', credentials: 'omit', headers: await entetes(), body: JSON.stringify(args)
  });
}
