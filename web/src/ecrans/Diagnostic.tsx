/* ============================================================
   Diagnostic de session (provisoire, phase 3 de la migration)
   ------------------------------------------------------------
   Page technique qui prouve la chaîne connexion → jeton → chargement des tables → droits → simulation de rôle sur /v2/.
   Elle disparaît quand les écrans réels prennent la place (phase 5).
   ============================================================ */
import { useState } from 'react';
import { useSession } from '../donnees/SessionProvider';
import { CLES_TABLES, TABLES } from '../donnees/tables';
import { ROLE_SANS_EQUIPE } from '../donnees/simulation';
import { LIBELLES_ROLES, ROLES_CHOISISSABLES } from '../domaine/config';
import { mesEquipes, monRole } from '../domaine/droits';

/** Choix d'un rôle et d'une personne à simuler (créateur seul) */
function Simulation() {
  const { donnees, simulation, demarrerSimulation, arreterSimulation } = useSession();
  const [role, setRole] = useState<string>(ROLES_CHOISISSABLES[0] ?? '');
  const [personne, setPersonne] = useState('');
  if (!donnees) return null;
  const personnes = [...donnees.ressources].sort((a, b) => a.nom.localeCompare(b.nom));
  return (
    <section aria-label="Simulation de rôle">
      <h2>Simulation de rôle</h2>
      {simulation && <p data-testid="simulation-en-cours">Simulation : {simulation.cle} · lecture seule</p>}
      <select aria-label="Rôle simulé" value={role} onChange={e => setRole(e.target.value)}>
        {ROLES_CHOISISSABLES.map(r => <option key={r} value={r}>{LIBELLES_ROLES[r]}</option>)}
        <option value={ROLE_SANS_EQUIPE}>Compte en attente</option>
      </select>
      <select aria-label="Personne simulée" value={personne} onChange={e => setPersonne(e.target.value)}>
        <option value="">— choisir —</option>
        {personnes.map(p => <option key={p.id} value={p.id}>{p.nom}{p.userId ? '' : ' (sans compte)'}</option>)}
      </select>
      <button className="btn" disabled={!personne} onClick={() => demarrerSimulation({ cle: role, ressourceId: personne })}>Simuler</button>
      {simulation && <button className="btn" onClick={arreterSimulation}>Arrêter la simulation</button>}
    </section>
  );
}

export function Diagnostic() {
  const session = useSession();
  const { compte, ctx, donnees, tablesEnEchec, equipeCourante, choisirEquipe, comptesEnAttente, seDeconnecter, recharger } = session;
  if (!compte || !ctx || !donnees) return null;
  const equipes = mesEquipes(ctx);
  return (
    <main className="boite-socle">
      <h1>ProjectDesk · session</h1>
      <p data-testid="compte">Connecté : <b>{compte.session.user.name}</b> ({compte.session.user.email})</p>
      <p data-testid="role">Rôle : <b>{ctx.estCreateur ? 'Créateur' : LIBELLES_ROLES[monRole(ctx) as keyof typeof LIBELLES_ROLES] ?? monRole(ctx)}</b></p>
      {tablesEnEchec.length > 0 && <p role="alert" className="erreur-socle">Tables non lues : {tablesEnEchec.join(', ')} (affichage précédent conservé)</p>}

      <label>Équipe ouverte{' '}
        <select value={equipeCourante ?? ''} onChange={e => choisirEquipe(e.target.value)} aria-label="Équipe ouverte">
          {!equipeCourante && <option value="">Aucune</option>}
          {equipes.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
        </select>
      </label>
      <p>Comptes en attente : <span data-testid="comptes-en-attente">{comptesEnAttente.length}</span></p>

      <h2>Tables chargées</h2>
      <table className="tableau-socle" data-testid="tables">
        <tbody>
          {CLES_TABLES.map(cle => <tr key={cle}><th scope="row">{TABLES[cle]}</th><td>{donnees[cle].length}</td></tr>)}
        </tbody>
      </table>

      {ctx.estCreateur || session.simulation ? <Simulation /> : null}
      <p>
        <button className="btn" onClick={() => void recharger()}>Recharger les données</button>{' '}
        <button className="btn" onClick={() => void seDeconnecter()}>Se déconnecter</button>
      </p>
      <p><a href="/app/">Ouvrir l’application actuelle</a></p>
    </main>
  );
}
