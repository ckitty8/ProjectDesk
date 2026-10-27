/* ============================================================
   Matrice des droits de PRODUCTION au 2026-10-27 (31 droits × 6 rôles), relevée dans la table droits_roles.
   Sert de jeu d'essai réaliste aux tests des droits et des menus : si la matrice de production change, mettre ce fichier à jour.
   Colonnes : admin, direction, responsable, projet, utilisateur, lecture.
   ============================================================ */
import type { LigneDroit } from '../types';

const NIVEAUX: Record<string, readonly [string, string, string, string, string, string]> = {
  administration: ['oui', 'non', 'non', 'non', 'non', 'non'],
  affecter: ['oui', 'oui', 'oui', 'oui', 'non', 'non'],
  comptes: ['oui', 'non', 'non', 'non', 'non', 'non'],
  conges_equipe: ['oui', 'non', 'oui', 'lecture', 'non', 'non'],
  daily_equipes: ['oui', 'oui', 'oui', 'oui', 'oui', 'non'],
  fiches_ressources: ['oui', 'oui', 'oui', 'non', 'non', 'non'],
  general: ['oui', 'oui', 'oui', 'oui', 'oui', 'lecture'],
  mon_dashboard: ['oui', 'non', 'non', 'oui', 'oui', 'non'],
  nommer_admin: ['oui', 'non', 'non', 'non', 'non', 'non'],
  onglet_admin_envoi_daily: ['oui', 'non', 'oui', 'oui', 'non', 'non'],
  onglet_admin_equipes: ['oui', 'oui', 'oui', 'non', 'non', 'non'],
  onglet_admin_feries: ['oui', 'non', 'non', 'non', 'non', 'non'],
  onglet_admin_referentiels: ['oui', 'non', 'non', 'non', 'non', 'non'],
  onglet_admin_sprints: ['oui', 'non', 'oui', 'oui', 'non', 'non'],
  onglet_astuces_agile: ['oui', 'oui', 'oui', 'oui', 'oui', 'lecture'],
  onglet_astuces_roadmap: ['oui', 'oui', 'oui', 'oui', 'oui', 'lecture'],
  onglet_astuces_test_learn: ['oui', 'oui', 'oui', 'oui', 'oui', 'lecture'],
  onglet_conges_grille: ['oui', 'non', 'oui', 'oui', 'oui', 'non'],
  onglet_conges_recap: ['oui', 'non', 'oui', 'oui', 'oui', 'non'],
  onglet_daily_fil: ['oui', 'oui', 'oui', 'oui', 'oui', 'non'],
  onglet_daily_synthese: ['oui', 'oui', 'oui', 'non', 'non', 'non'],
  onglet_ressources_calendrier: ['oui', 'oui', 'oui', 'oui', 'oui', 'lecture'],
  onglet_ressources_liste: ['oui', 'oui', 'oui', 'oui', 'oui', 'lecture'],
  piloter: ['oui', 'non', 'oui', 'oui', 'non', 'non'],
  projets: ['oui', 'non', 'oui', 'oui', 'non', 'lecture'],
  roles: ['oui', 'non', 'non', 'non', 'non', 'non'],
  suivi_dashboard: ['oui', 'oui', 'oui', 'oui', 'oui', 'lecture'],
  suivi_projets: ['oui', 'oui', 'oui', 'oui', 'non', 'lecture'],
  suivi_ressources: ['oui', 'oui', 'oui', 'oui', 'oui', 'lecture'],
  suivi_timesheet: ['oui', 'oui', 'oui', 'oui', 'non', 'non'],
  valider_timesheet: ['oui', 'oui', 'oui', 'non', 'non', 'non'],
};

const ROLES = ['admin', 'direction', 'responsable', 'projet', 'utilisateur', 'lecture'] as const;

/** Les lignes de la table droits_roles (186 lignes) */
export const MATRICE_PRODUCTION: LigneDroit[] = Object.entries(NIVEAUX)
  .flatMap(([droit, niveaux]) => niveaux.map((niveau, i) => ({ role: ROLES[i] ?? '', droit, niveau })));
