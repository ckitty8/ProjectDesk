/* ============================================================
   Migration 038 — Un droit par onglet de chaque page
   ------------------------------------------------------------
   Porteur (2026-10-18, « ok » sur la maquette docs/maquettes/matrice-par-onglet/) : dans la matrice des
   droits, chaque onglet a son propre réglage (ex. Daily des équipes : « Fil des dailys » et « Synthèse »).
   20 nouveaux droits (liste DROITS, app/js/config.js, propriété onglet). Ils règlent l'AFFICHAGE des
   onglets : aucune règle d'écriture n'en dépend (ce qu'on peut modifier reste réglé par les droits existants).
   Migration ADDITIVE (règle n°8) :
   - la liste des droits autorisés est élargie (contrainte CHECK remplacée par une liste plus large) ;
   - chaque droit d'onglet reçoit, pour chaque rôle, le niveau actuel de son droit de départ (colonne
     « depart » ci-dessous = propriété repli de DROITS), soit le comportement d'aujourd'hui : rien ne change
     pour les utilisateurs tant qu'on ne modifie pas la matrice ;
   - aucune ligne existante n'est modifiée (on conflict do nothing).
   ============================================================ */

alter table public.droits_roles drop constraint if exists droits_roles_droit_check;
alter table public.droits_roles add constraint droits_roles_droit_check check (droit in (
  'general', 'mon_dashboard', 'daily_equipes', 'conges_equipe', 'valider_timesheet', 'fiches_ressources', 'affecter',
  'projets', 'piloter', 'administration', 'comptes', 'roles', 'nommer_admin',
  'suivi_dashboard', 'suivi_projets', 'suivi_ressources', 'suivi_timesheet', 'suivi_administration',
  'onglet_daily_fil', 'onglet_daily_synthese', 'onglet_ressources_calendrier', 'onglet_ressources_liste',
  'onglet_suivi_equipes', 'onglet_suivi_referentiels', 'onglet_suivi_roles',
  'onglet_conges_grille', 'onglet_conges_recap', 'onglet_conges_capacite', 'onglet_charge_prevision', 'onglet_charge_reel',
  'onglet_admin_equipes', 'onglet_admin_referentiels', 'onglet_admin_feries', 'onglet_admin_envoi_daily', 'onglet_admin_sprints',
  'onglet_astuces_agile', 'onglet_astuces_roadmap', 'onglet_astuces_test_learn'));

-- Droit d'onglet → droit dont il reprend le niveau (Synthèse et Équipes : administrateurs, direction et
-- responsables, comme « fiches_ressources » ; Rôles et accès : administrateurs, comme « roles »)
insert into public.droits_roles (role, droit, niveau)
select d.role, o.droit, d.niveau
from (values
  ('onglet_daily_fil', 'daily_equipes'), ('onglet_daily_synthese', 'fiches_ressources'),
  ('onglet_ressources_calendrier', 'suivi_ressources'), ('onglet_ressources_liste', 'suivi_ressources'),
  ('onglet_suivi_equipes', 'suivi_administration'), ('onglet_suivi_referentiels', 'suivi_administration'), ('onglet_suivi_roles', 'roles'),
  ('onglet_conges_grille', 'mon_dashboard'), ('onglet_conges_recap', 'mon_dashboard'), ('onglet_conges_capacite', 'mon_dashboard'),
  ('onglet_charge_prevision', 'piloter'), ('onglet_charge_reel', 'piloter'),
  ('onglet_admin_equipes', 'fiches_ressources'), ('onglet_admin_referentiels', 'administration'), ('onglet_admin_feries', 'administration'),
  ('onglet_admin_envoi_daily', 'piloter'), ('onglet_admin_sprints', 'mon_dashboard'),
  ('onglet_astuces_agile', 'general'), ('onglet_astuces_roadmap', 'general'), ('onglet_astuces_test_learn', 'general')
) as o(droit, depart)
join public.droits_roles d on d.droit = o.depart
on conflict (role, droit) do nothing;
