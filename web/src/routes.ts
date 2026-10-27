/* ============================================================
   Table des écrans de la nouvelle application : une adresse par écran (React Router).
   Elle se remplit au fil des vagues de migration (phase 5 du plan) ; pour l'instant, seul l'accueil existe.
   ============================================================ */
export interface Route {
  chemin: string;
  titre: string;
}

export const ROUTES: readonly Route[] = [
  { chemin: '/', titre: 'Session' },
  { chemin: '/composants', titre: 'Catalogue des composants' }
];

// Titre de l'onglet du navigateur pour une adresse (« ProjectDesk » si l'écran est inconnu)
export function titrePage(chemin: string): string {
  const route = ROUTES.find(r => r.chemin === chemin);
  return route ? `${route.titre} · ProjectDesk` : 'ProjectDesk';
}
