/* ============================================================
   Racine de la nouvelle application
   Phase 3 : la session (connexion, jeton, tables, droits) est en place ; la page d'accueil est un diagnostic provisoire.
   Les écrans réels arrivent aux phases 4 et 5.
   ============================================================ */
import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Connexion } from './ecrans/Connexion';
import { Diagnostic } from './ecrans/Diagnostic';
import { SessionProvider, useSession } from './donnees/SessionProvider';
import { titrePage } from './routes';

/** Écran selon l'état de la session : chargement, erreur, connexion, ou page de l'application */
function Contenu() {
  const { etat, erreur, recharger } = useSession();
  if (etat === 'chargement') return <main className="boite-socle"><p>Chargement…</p></main>;
  if (etat === 'erreur') {
    return (
      <main className="boite-socle">
        <p role="alert" className="erreur-socle">Chargement impossible : {erreur}</p>
        <button className="btn" onClick={() => window.location.reload()}>Réessayer</button>
        <button className="btn" onClick={() => void recharger()}>Relire les données</button>
      </main>
    );
  }
  if (etat === 'deconnecte') return <Connexion />;
  return (
    <Routes>
      <Route path="*" element={<Diagnostic />} />
    </Routes>
  );
}

export function App() {
  const { pathname } = useLocation();
  useEffect(() => { document.title = titrePage(pathname); }, [pathname]);
  return <SessionProvider><Contenu /></SessionProvider>;
}
