/* ============================================================
   Session et données de l'application (remplace `demarrer`, `chargerDonnees` et `recharger` de app/js/etat.js)
   (phase 3 de la migration)
   ------------------------------------------------------------
   TanStack Query porte quatre lectures dépendantes :
     compte (session + équipes) → données (23 tables) → rôles dans les équipes ; + comptes en attente (administrateurs).
   Le chargement est tolérant (chargement.ts) : on ne vide jamais l'écran si une lecture échoue.
   La simulation de rôle (créateur seul) est un état local : elle ne relit rien, elle filtre les données déjà lues.
   ============================================================ */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { activerOrganisation, connecter, deconnecter, definirSimulationActive } from './api';
import { chargerComptesEnAttente, chargerRoles, equipeAOuvrir, lireEquipeMemorisee, memoriserEquipe, ouvrirCompte } from './compte';
import type { Compte, CompteEnAttente, RolesEquipes } from './compte';
import { chargerDonnees } from './chargement';
import { lireTable } from './chargement';
import type { ResultatChargement } from './chargement';
import { construireVue, identiteReelle } from './contexte';
import { mesEquipes } from '../domaine/droits';
import type { ContexteDroits, Simulation } from '../domaine/droits';
import { choixSimulation } from './simulation';
import type { CleTable, Donnees } from './tables';

export type EtatSession = 'chargement' | 'deconnecte' | 'erreur' | 'pret';

export interface ValeurSession {
  etat: EtatSession;
  /** Message de l'erreur de démarrage (état « erreur ») */
  erreur: string | null;
  compte: Compte | null;
  /** Droits du compte connecté (ou de la personne simulée) ; null tant que les données ne sont pas là */
  ctx: ContexteDroits | null;
  /** Données à afficher (filtrées par le périmètre pendant une simulation) */
  donnees: Donnees | null;
  /** Tables dont la dernière lecture a échoué (données précédentes conservées) */
  tablesEnEchec: string[];
  comptesEnAttente: CompteEnAttente[];
  equipeCourante: string | null;
  choisirEquipe: (id: string) => void;
  simulation: Simulation | null;
  /** Rôles et personnes proposés pour changer de simulation (calculés sur toutes les fiches, pas sur le périmètre simulé) */
  choixSimulation: { valeur: string; libelle: string }[];
  demarrerSimulation: (simulation: Simulation) => void;
  arreterSimulation: () => void;
  seConnecter: (email: string, motDePasse: string) => Promise<void>;
  seDeconnecter: () => Promise<void>;
  /** Relit les données (après une écriture, ou sur demande) */
  recharger: () => Promise<void>;
  /** Relit seulement certaines tables (après une écriture) et met à jour l'affichage ; une table illisible garde ses données */
  rechargerTables: (...cles: CleTable[]) => Promise<void>;
  /** Message temporaire en bas d'écran (4,5 s) : « erreur » en rouge */
  notifier: (message: string, type?: 'info' | 'erreur') => void;
  /** Exécute une écriture, relit les tables touchées et affiche l'erreur éventuelle (ex. refus de la base : droits). Renvoie true si l'écriture a réussi. */
  executer: (action: () => Promise<unknown>, ...tables: CleTable[]) => Promise<boolean>;
  /** Relit tout : compte, équipes, invitations, données (après une connexion, une invitation acceptée…) */
  actualiser: () => Promise<void>;
}

const Contexte = createContext<ValeurSession | null>(null);

export function useSession(): ValeurSession {
  const valeur = useContext(Contexte);
  if (!valeur) throw new Error('useSession doit être utilisé sous <SessionProvider>');
  return valeur;
}

/** Client TanStack Query : pas de relecture automatique au retour sur l'onglet (les relectures sont explicites, comme avant) */
export const creerClientRequetes = (): QueryClient =>
  new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: Infinity } } });

function Interne({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [equipeChoisie, setEquipeChoisie] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'info' | 'erreur' } | null>(null);
  const notifier = useCallback((message: string, type: 'info' | 'erreur' = 'info') => setNotification({ message, type }), []);
  useEffect(() => {
    if (!notification) return undefined;
    const minuteur = setTimeout(() => setNotification(null), 4500);
    return () => clearTimeout(minuteur);
  }, [notification]);

  const compteQ = useQuery({ queryKey: ['compte'], queryFn: ouvrirCompte });
  const compte = compteQ.data ?? null;

  const donneesQ = useQuery({
    queryKey: ['donnees'],
    enabled: !!compte,
    queryFn: () => chargerDonnees(client.getQueryData<ResultatChargement>(['donnees'])?.donnees)
  });
  const brutes = compte ? donneesQ.data?.donnees ?? null : null;

  // Identité réelle (avant simulation) : sert aussi à savoir quelles équipes interroger pour les rôles
  const userId = compte?.session.user.id ?? null;
  const identite = useMemo(() => (brutes ? identiteReelle(userId, brutes, compte?.organisations ?? [], {}) : null), [userId, brutes, compte]);
  const idsEquipes = useMemo(() => (brutes && identite
    ? mesEquipes({ ...identite, simulation: null, membresEquipe: {}, ...brutes }).map(e => e.id) : []), [brutes, identite]);

  const rolesQ = useQuery({
    queryKey: ['roles', userId, idsEquipes],
    enabled: !!userId && !!brutes,
    queryFn: (): Promise<RolesEquipes> => chargerRoles(userId as string, idsEquipes)
  });
  const comptesQ = useQuery({
    queryKey: ['comptesEnAttente', identite?.estAdmin],
    enabled: !!identite?.estAdmin,
    queryFn: chargerComptesEnAttente
  });

  const rolesEquipe = useMemo(() => rolesQ.data?.rolesEquipe ?? {}, [rolesQ.data]);
  const membresEquipe = useMemo(() => rolesQ.data?.membresEquipe ?? {}, [rolesQ.data]);

  const vue = useMemo(() => {
    if (!brutes || !identite) return null;
    return construireVue({ ...identite, rolesEquipe }, brutes, membresEquipe, simulation);
  }, [brutes, identite, rolesEquipe, membresEquipe, simulation]);

  // Lecture seule pendant une simulation : le client API refuse alors toute écriture
  useEffect(() => { definirSimulationActive(!!simulation); }, [simulation]);

  // Équipe ouverte : choix explicite, sinon règle de démarrage (équipe mémorisée, seule équipe, première équipe d'un administrateur)
  const equipeCourante = useMemo(() => {
    if (!vue) return null;
    const equipes = mesEquipes(vue.ctx);
    if (equipeChoisie && equipes.some(e => e.id === equipeChoisie)) return equipeChoisie;
    return equipeAOuvrir(equipes, lireEquipeMemorisee(), vue.ctx.estAdmin)?.id ?? null;
  }, [vue, equipeChoisie]);

  const etat: EtatSession = compteQ.isPending || (!!compte && donneesQ.isPending) ? 'chargement'
    : compteQ.isError || donneesQ.isError ? 'erreur'
    : !compte ? 'deconnecte' : 'pret';
  const erreurBrute = compteQ.error ?? donneesQ.error;

  const choixPourBandeau = useMemo(() => (brutes ? choixSimulation(brutes.ressources) : []), [brutes]);

  // Relit certaines tables et met à jour le cache : une table illisible garde ses données
  const rechargerTables = useCallback(async (...cles: CleTable[]) => {
    const lues = await Promise.all(cles.map(async cle => ({ cle, lignes: await lireTable(cle) })));
    client.setQueryData<ResultatChargement>(['donnees'], ancien => (ancien
      ? { ...ancien, donnees: { ...ancien.donnees, ...Object.fromEntries(lues.map(l => [l.cle, l.lignes])) } as unknown as Donnees }
      : ancien));
  }, [client]);

  const valeur: ValeurSession = {
    etat,
    erreur: erreurBrute ? (erreurBrute as Error).message : null,
    compte,
    ctx: vue?.ctx ?? null,
    donnees: vue?.donnees ?? null,
    tablesEnEchec: donneesQ.data?.echecs ?? [],
    comptesEnAttente: simulation && !vue?.ctx.estAdmin ? [] : comptesQ.data ?? [],
    equipeCourante,
    // Équipe mémorisée sur ce poste et déclarée « active » côté Neon Auth (sans attendre la réponse)
    choisirEquipe: id => { memoriserEquipe(id); setEquipeChoisie(id); activerOrganisation(id).catch(() => undefined); },
    simulation,
    choixSimulation: choixPourBandeau,
    demarrerSimulation: setSimulation,
    arreterSimulation: () => setSimulation(null),
    seConnecter: async (email, motDePasse) => {
      await connecter(email, motDePasse);
      await client.invalidateQueries();
    },
    seDeconnecter: async () => {
      setSimulation(null);
      definirSimulationActive(false);
      await deconnecter();
      client.setQueryData(['compte'], null);
      client.removeQueries({ queryKey: ['donnees'] });
      client.removeQueries({ queryKey: ['roles'] });
      client.removeQueries({ queryKey: ['comptesEnAttente'] });
      navigate('/', { replace: true });      // la prochaine connexion repart de l'écran d'arrivée, pas de l'écran quitté
    },
    recharger: async () => { await client.invalidateQueries({ queryKey: ['donnees'] }); },
    notifier,
    executer: async (action, ...tables) => {
      let reussi = true;
      try { await action(); } catch (e) { reussi = false; notifier((e as Error).message, 'erreur'); }
      if (tables.length) await rechargerTables(...tables).catch(() => undefined);
      return reussi;
    },
    rechargerTables,
    actualiser: async () => { await client.invalidateQueries(); }
  };

  return (
    <Contexte.Provider value={valeur}>
      {children}
      <div className={'notification' + (notification ? ' visible' : '') + (notification?.type === 'erreur' ? ' erreur' : '')} role="status">{notification?.message}</div>
    </Contexte.Provider>
  );
}

/** Fournisseur à placer à la racine de l'application (sous le routeur) */
export function SessionProvider({ children, client }: { children: ReactNode; client?: QueryClient }) {
  const [clientParDefaut] = useState(creerClientRequetes);
  return (
    <QueryClientProvider client={client ?? clientParDefaut}>
      <Interne>{children}</Interne>
    </QueryClientProvider>
  );
}
