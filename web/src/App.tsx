/* ============================================================
   Racine de la nouvelle application (phase 1 « socle » de la migration)
   Page d'accueil provisoire : confirme que la chaîne React + TypeScript + Vite est en place sur /v2/.
   Les écrans réels arrivent aux phases 3 à 5.
   ============================================================ */
import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { titrePage } from './routes';

function Accueil() {
  return (
    <main className="boite-socle">
      <h1>ProjectDesk · nouvelle application</h1>
      <p>
        Socle React + TypeScript en place. Les écrans sont migrés par étapes ; l’application actuelle reste
        disponible et inchangée en attendant la bascule.
      </p>
      <p><a href="/app/">Ouvrir l’application actuelle</a></p>
    </main>
  );
}

export function App() {
  const { pathname } = useLocation();
  useEffect(() => { document.title = titrePage(pathname); }, [pathname]);

  return (
    <Routes>
      <Route path="/" element={<Accueil />} />
      <Route path="*" element={<Accueil />} />
    </Routes>
  );
}
