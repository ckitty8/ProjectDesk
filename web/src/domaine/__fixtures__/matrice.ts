/* ============================================================
   Matrice des droits de PRODUCTION au 2026-11-02 (30 droits × 7 rôles ; « suivi_projets » retiré par la migration 053),
   relevée dans la table droits_roles avant le Rôle unique (054) ; « Chef de projet » = l'ancienne colonne « Projet »,
   Sert de jeu d'essai réaliste aux tests des droits et des menus : si la matrice de production change, mettre ce fichier à jour.
   Colonnes de NIVEAUX : admin, direction, responsable, projet (devenu Chef de projet), utilisateur, lecture.
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
  suivi_ressources: ['oui', 'oui', 'oui', 'oui', 'oui', 'lecture'],
  suivi_timesheet: ['oui', 'oui', 'oui', 'oui', 'non', 'non'],
  valider_timesheet: ['oui', 'oui', 'oui', 'non', 'non', 'non'],
};

const ROLES = ['admin', 'direction', 'responsable', 'chef', 'membre', 'utilisateur', 'lecture'] as const;

/** Droits que le Membre n'a pas (le Chef de projet les a) : affecter, envoyer le daily (migration 052, décision du porteur « Chef de projet > Membre ») */
const DROITS_DU_CHEF_SEUL = ['affecter', 'piloter', 'onglet_admin_envoi_daily'];

/** Les lignes de la table droits_roles : les 6 colonnes ci-dessus donnent l'ancienne colonne « Projet », devenue Chef de projet, dont le Membre
 *  se déduit (migration 052) */
export const MATRICE_PRODUCTION: LigneDroit[] = Object.entries(NIVEAUX).flatMap(([droit, [admin, direction, responsable, projet, utilisateur, lecture]]) => {
  const membre = DROITS_DU_CHEF_SEUL.includes(droit) ? 'non' : projet;
  return [admin, direction, responsable, projet, membre, utilisateur, lecture].map((niveau, i) => ({ role: ROLES[i] ?? '', droit, niveau: niveau ?? 'non' }));
});
