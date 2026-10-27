/* ============================================================
   Compte connecté : session, équipes (organisations Neon Auth), rôles dans les équipes, choix de l'équipe ouverte
   (portage du démarrage `demarrer()`, de chargerRoles et de chargerComptesEnAttente de app/js/etat.js — phase 3 de la migration)
   ============================================================ */
import { executer, lireOrganisation, lireSession, listerMesInvitations, listerOrganisations } from './api';
import type { Invitation, Organisation, SessionAuth } from './api';
import type { Equipe } from '../domaine/types';

/** Ce que Neon Auth sait du compte connecté */
export interface Compte {
  session: SessionAuth;
  organisations: Organisation[];
  invitations: Invitation[];
}

/* Ouvre le compte : session, puis les trois fonctions SQL de rattachement, puis les équipes. Renvoie null si personne
   n'est connecté. Les fonctions SQL sont tolérantes (une erreur ne bloque pas la connexion) :
   - lier_ma_ressource : lie le compte à sa fiche ressource (même email) ;
   - accepter_mes_invitations (migration 026) : invitations acceptées d'office, avant de lister les équipes ;
   - appliquer_mes_roles_prevus (migration 029) : rôle prévu par un administrateur avant ma première connexion. */
export async function ouvrirCompte(): Promise<Compte | null> {
  const session = await lireSession();
  if (!session?.user) return null;
  for (const fonction of ['lier_ma_ressource', 'accepter_mes_invitations', 'appliquer_mes_roles_prevus']) {
    await executer(fonction).catch(() => undefined);
  }
  const [organisations, invitations] = await Promise.all([listerOrganisations(), listerMesInvitations().catch(() => [])]);
  return {
    session,
    organisations: organisations || [],
    invitations: (invitations || []).filter(i => i.status === 'pending')
  };
}

/** Rôle du compte (owner / admin / member) dans chaque équipe, et membres de chaque équipe (utilisés par « Daily des équipes ») */
export interface RolesEquipes {
  rolesEquipe: Record<string, string>;
  membresEquipe: Record<string, { userId: string; role: string; nom: string }[]>;
}

export async function chargerRoles(userId: string, equipeIds: readonly string[]): Promise<RolesEquipes> {
  const resultat: RolesEquipes = { rolesEquipe: {}, membresEquipe: {} };
  await Promise.all(equipeIds.map(async id => {
    try {
      const organisation = await lireOrganisation(id);
      const membres = organisation.members || [];
      const moi = membres.find(m => m.userId === userId);
      if (moi) resultat.rolesEquipe[id] = moi.role;
      resultat.membresEquipe[id] = membres.map(m => ({ userId: m.userId, role: m.role, nom: m.user?.name || m.user?.email || '?' }));
    } catch { /* équipe illisible : rôle inconnu */ }
  }));
  return resultat;
}

/** Compte inscrit sans accès (visible des administrateurs seulement, Administration › Comptes en attente) */
export interface CompteEnAttente { userId: string; nom: string; email: string; inscritLe: string; invite: boolean }

export async function chargerComptesEnAttente(): Promise<CompteEnAttente[]> {
  const lignes = await executer<{ user_id: string; nom: string; email: string; inscrit_le: string; invite: boolean }[] | null>('comptes_en_attente')
    .catch(() => null);
  return (lignes || []).map(c => ({ userId: c.user_id, nom: c.nom, email: c.email, inscritLe: c.inscrit_le, invite: c.invite }));
}

/* ---------- Équipe ouverte ---------- */

const CLE_MEMOIRE = 'pp_equipe';
export function lireEquipeMemorisee(): string | null {
  try { return localStorage.getItem(CLE_MEMOIRE); } catch { return null; }
}
export function memoriserEquipe(id: string): void {
  try { localStorage.setItem(CLE_MEMOIRE, id); } catch { /* navigation privée */ }
}

/* Équipe à ouvrir au démarrage : celle mémorisée sur ce poste, sinon la seule équipe du compte. Un administrateur voit
   tout : il n'a pas à choisir (porteur, 2026-10-05) ; on ouvre sa première équipe, de préférence une équipe plutôt qu'une
   direction. Sinon null : l'écran « Choix d'équipe » prend le relais. */
export function equipeAOuvrir(equipes: readonly Equipe[], memorisee: string | null, estAdmin: boolean): Equipe | null {
  const parDefautAdmin = estAdmin ? (equipes.find(e => e.type !== 'direction') ?? equipes[0] ?? null) : null;
  return equipes.find(e => e.id === memorisee) ?? (equipes.length === 1 ? equipes[0] ?? null : parDefautAdmin);
}
