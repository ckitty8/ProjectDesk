/* ============================================================
   Racine de la nouvelle application
   Phase 5 : tous les écrans de l'application actuelle sont migrés (vagues A à D).
   Adresses : routes.ts (une par écran). Sans session, la connexion s'affiche quelle que soit l'adresse, puis on y revient.
   ============================================================ */
import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Page } from './Coquille';
import { Bouton } from './composants/Bouton';
import { Catalogue } from './ecrans/Catalogue';
import { ChoixEquipe } from './ecrans/ChoixEquipe';
import { Connexion, VerifierMonEmail } from './ecrans/Connexion';
import { ECRANS } from './ecrans';
import { PorteeEquipe, SessionProvider, useSession } from './donnees/SessionProvider';
import { ecranDArrivee } from './donnees/compte';
import { ROUTES, cheminDe, titrePage } from './routes';

/** Adresse « / » : l'écran d'arrivée du compte (tableau de bord, choix d'équipe, administration…) */
function Racine() {
  const { ctx, equipeCourante } = useSession();
  if (!ctx) return null;
  return <Navigate to={cheminDe(ecranDArrivee(ctx, equipeCourante))} replace />;
}

/* Écrans qui suivent l'équipe active (porteur, 2026-10-31) : tout Suivi de mes équipes et les écrans de saisie de Mon dashboard ;
   Administration, Liste des ressources et Trucs et astuces gardent leur portée habituelle */
const ECRANS_DE_L_EQUIPE = ['dashboard', 'dailyEquipes', 'projets', 'ressources', 'timesheet', 'daily', 'mesProjets', 'mesSprints', 'conges', 'monTimesheet'];

/** Écrans de l'application, selon l'état de la session : chargement, erreur, connexion, ou les adresses de routes.ts */
function Contenu() {
  const { etat, erreur, recharger } = useSession();
  if (etat === 'chargement') return <main className="boite-socle"><p>Chargement…</p></main>;
  if (etat === 'erreur') {
    return (
      <main className="boite-socle">
        <p role="alert" className="erreur-socle">Chargement impossible : {erreur}</p>
        <Bouton onClick={() => window.location.reload()}>Réessayer</Bouton>{' '}
        <Bouton onClick={() => void recharger()}>Relire les données</Bouton>
      </main>
    );
  }
  if (etat === 'deconnecte') return <Connexion />;
  return (
    <Routes>
      <Route path="/" element={<Racine />} />
      <Route path="/verifier-email" element={<VerifierMonEmail />} />
      <Route path="/choix-equipe" element={<ChoixEquipe />} />
      <Route path="/composants" element={<Catalogue />} />
      {ROUTES.filter(r => r.section !== 'plein').map(r => {
        const Ecran = ECRANS[r.id];
                if (!Ecran) return null;
        const contenu = ECRANS_DE_L_EQUIPE.includes(r.id) ? <PorteeEquipe><Ecran /></PorteeEquipe> : <Ecran />;
        return <Route key={r.id} path={r.chemin} element={<Page route={r}>{contenu}</Page>} />;
      })}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  const { pathname } = useLocation();
  useEffect(() => { document.title = titrePage(pathname); }, [pathname]);
  return <SessionProvider><Contenu /></SessionProvider>;
}
