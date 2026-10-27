/* ============================================================
   Table des écrans de la nouvelle application : une adresse par écran (React Router)
   ------------------------------------------------------------
   « id » est l'identifiant d'écran de l'application actuelle (celui des menus, des droits et du DAT) : il relie les menus de
   domaine/menus.ts aux adresses. « migre » passe à vrai quand l'écran existe en React (vagues A à D de la phase 5) ; en
   attendant, la nouvelle application affiche une page qui renvoie vers l'écran de l'ancienne.
   « section » : general = Suivi de mes équipes (lecture), moi = Mon dashboard (édition), plein = écran sans menu.
   ============================================================ */
export type SectionEcran = 'general' | 'moi' | 'plein';

export interface Route {
  id: string;
  chemin: string;
  titre: string;
  section: SectionEcran;
  migre: boolean;
}

export const ROUTES: readonly Route[] = [
  { id: 'dashboard', chemin: '/dashboard', titre: 'Dashboard général', section: 'general', migre: true },
  { id: 'dailyEquipes', chemin: '/daily-des-equipes', titre: 'Daily des équipes', section: 'general', migre: false },
  { id: 'projets', chemin: '/projets', titre: 'Projets et Roadmap', section: 'general', migre: false },
  { id: 'ressources', chemin: '/ressources', titre: 'Gestion des ressources', section: 'general', migre: false },
  { id: 'timesheet', chemin: '/timesheet', titre: 'Timesheet', section: 'general', migre: false },
  { id: 'daily', chemin: '/daily', titre: 'Daily', section: 'moi', migre: false },
  { id: 'mesProjets', chemin: '/mes-projets', titre: 'Projets et Roadmap', section: 'moi', migre: false },
  { id: 'mesSprints', chemin: '/sprints', titre: 'Projets et Roadmap', section: 'moi', migre: false },
  { id: 'conges', chemin: '/conges', titre: 'Gestion des ressources · Congés', section: 'moi', migre: false },
  { id: 'listeRessources', chemin: '/liste-des-ressources', titre: 'Gestion des ressources · Liste des ressources', section: 'moi', migre: false },
  { id: 'monTimesheet', chemin: '/saisir-mes-heures', titre: 'Saisir mes heures', section: 'moi', migre: false },
  { id: 'astuces', chemin: '/trucs-et-astuces', titre: 'Trucs et astuces', section: 'moi', migre: true },
  { id: 'monAdmin', chemin: '/administration', titre: 'Administration', section: 'moi', migre: false },
  { id: 'adminCreateur', chemin: '/administration-createur', titre: 'Administration créateur', section: 'moi', migre: false },
  { id: 'choixEquipe', chemin: '/choix-equipe', titre: 'Choix de l’équipe', section: 'plein', migre: true },
  { id: 'composants', chemin: '/composants', titre: 'Catalogue des composants', section: 'plein', migre: true },
  { id: 'session', chemin: '/session', titre: 'Session', section: 'plein', migre: true }
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
