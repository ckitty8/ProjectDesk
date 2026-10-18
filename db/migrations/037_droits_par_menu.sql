/* ============================================================
   Migration 037 — Un droit par menu de « Suivi de mes équipes »
   ------------------------------------------------------------
   Porteur (2026-10-18, option B, maquette docs/maquettes/matrice-par-menu/) : dans la matrice des
   droits, chaque menu de Suivi de mes équipes a son propre réglage. Nouveaux droits :
     suivi_dashboard, suivi_projets, suivi_ressources, suivi_timesheet, suivi_administration
   (Daily des équipes et la validation des timesheets ont déjà leurs droits : daily_equipes,
   valider_timesheet). Ces droits règlent l'AFFICHAGE des menus (section en lecture seule ; aucune
   règle d'écriture n'en dépend, comme l'ancien droit commun « general », qui n'en avait pas).
   Migration ADDITIVE (règle n°8) :
   - la liste des droits autorisés est élargie (contrainte CHECK remplacée par une liste plus large) ;
   - chaque nouveau droit reçoit, pour chaque rôle, le niveau actuel de « general » (rien ne change
     pour les utilisateurs tant qu'on ne modifie pas la matrice) ;
   - « general » est conservé (lignes existantes intactes) ; l'application ne l'utilise plus que comme
     repli tant que la migration n'est pas appliquée.
   ============================================================ */

alter table public.droits_roles drop constraint if exists droits_roles_droit_check;
alter table public.droits_roles add constraint droits_roles_droit_check check (droit in (
  'general', 'mon_dashboard', 'daily_equipes', 'conges_equipe', 'valider_timesheet', 'fiches_ressources', 'affecter',
  'projets', 'piloter', 'administration', 'comptes', 'roles', 'nommer_admin',
  'suivi_dashboard', 'suivi_projets', 'suivi_ressources', 'suivi_timesheet', 'suivi_administration'));

insert into public.droits_roles (role, droit, niveau)
select g.role, n.droit, g.niveau
from public.droits_roles g
cross join (values ('suivi_dashboard'), ('suivi_projets'), ('suivi_ressources'), ('suivi_timesheet'), ('suivi_administration')) as n(droit)
where g.droit = 'general'
on conflict (role, droit) do nothing;
