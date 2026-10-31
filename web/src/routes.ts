/* ============================================================
   Table des écrans de la nouvelle application : une adresse par écran (React Router)
   ------------------------------------------------------------
   « id » est l'identifiant d'écran de l'application actuelle (celui des menus, des droits et du DAT) : il relie les menus de
   domaine/menus.ts aux adresses et au registre des écrans (ecrans/index.ts). Tous les écrans sont migrés (phase 5, vagues A à D).
   « section » : general = Suivi de mes équipes (lecture), moi = Mon dashboard (édition), plein = écran sans menu.
   ============================================================ */
export type SectionEcran = 'general' | 'moi' | 'plein';

export interface Route {
  id: string;
  chemin: string;
  titre: string;
  section: SectionEcran;
}

export const ROUTES: readonly Route[] = [
  { id: 'dashboard', chemin: '/dashboard', titre: 'Dashboard général', section: 'general' },
  { id: 'dailyEquipes', chemin: '/daily-des-equipes', titre: 'Daily des équipes', section: 'general' },
  { id: 'projets', chemin: '/projets', titre: 'Projets et Roadmap', section: 'general' },
  { id: 'ressources', chemin: '/ressources', titre: 'Gestion des ressources', section: 'general' },
  { id: 'timesheet', chemin: '/timesheet', titre: 'Timesheet', section: 'general' },
  { id: 'daily', chemin: '/daily', titre: 'Daily', section: 'moi' },
  { id: 'mesProjets', chemin: '/mes-projets', titre: 'Projets et Roadmap', section: 'moi' },
  { id: 'mesSprints', chemin: '/sprints', titre: 'Projets et Roadmap', section: 'moi' },
  { id: 'conges', chemin: '/conges', titre: 'Gestion des ressources · Congés', section: 'moi' },
  { id: 'listeRessources', chemin: '/liste-des-ressources', titre: 'Gestion des ressources · Liste des ressources', section: 'moi' },
  { id: 'monTimesheet', chemin: '/saisir-mes-heures', titre: 'Saisir mes heures', section: 'moi' },
  { id: 'astuces', chemin: '/trucs-et-astuces', titre: 'Trucs et astuces', section: 'moi' },
  { id: 'monAdmin', chemin: '/administration', titre: 'Administration', section: 'moi' },
  { id: 'adminCreateur', chemin: '/administration-createur', titre: 'Administration créateur', section: 'moi' },
  { id: 'choixEquipe', chemin: '/choix-equipe', titre: 'Choix de l’équipe', section: 'plein' },
  { id: 'composants', chemin: '/composants', titre: 'Catalogue des composants', section: 'plein' },
  { id: 'session', chemin: '/session', titre: 'Session', section: 'plein' }
];

export const routeDe = (id: string): Route | undefined => ROUTES.find(r => r.id === id);

/** Adresse d'un écran, à partir de son identifiant (menus, redirections) */
export function cheminDe(id: string): string {
  return routeDe(id)?.chemin ?? '/';
}

/** Route d'une adresse (le début de l'adresse suffit : « /sprints/2 » → Sprints) */
export const routePour = (chemin: string): Route | undefined => ROUTES.find(r => chemin === r.chemin || chemin.startsWith(r.chemin + '/'));

// Titre de l'onglet du navigateur pour une adresse (« ProjectDesk » si l'écran est inconnu)
export function titrePage(chemin: string): string {
  const route = routePour(chemin);
  return route ? `${route.titre} · ProjectDesk` : 'ProjectDesk';
}
