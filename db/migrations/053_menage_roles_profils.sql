/* ============================================================
   Migration 053 — Ménage de la base après les changements sur les rôles et les profils (revue qualité du 2026-11-02)
   ------------------------------------------------------------
   PROPOSÉE AU PORTEUR, NON APPLIQUÉE : chaque point écrit ou supprime des données (règle n°8) et attend un « ok » explicite.
   Origine : audit db/audit/verifier-bdd.sql et comparaison code ↔ base.

   1. Absences « Congés payés » (2 lignes, Christelle LABBE, 1er et 2 octobre 2026) : le type système « cp » a été renommé « Congés validé » ; l'écran
      Congés posait encore l'ancien libellé par défaut (bug corrigé dans le code, version 2.94 : le type est retrouvé par sa clé). Ces deux jours ne
      s'affichaient donc pas et n'étaient pas comptés. Ils prennent le libellé actuel du type « cp ».
   2. Profil « Directeur » (Paul SHERRAT) : la valeur est absente de la liste Profil (ex-Postes). Elle est recréée (ordre 3, libre dans la liste).
   3. Matrice des droits : les 8 lignes du droit « suivi_projets » (6 rôles + chef + membre) ne servent plus depuis la version 2.92 (le menu Projet est ouvert à
      tous). La contrainte de valeurs de droits_roles.droit ne garde que les droits que le code connaît (huit valeurs historiques jamais utilisées retirées).
   Comptages attendus : absences 157 → 157 (2 modifiées) ; valeurs du Profil 9 → 10 ; droits_roles 248 → 240.
   ============================================================ */

-- 1. Absences posées avec l'ancien libellé du type « cp »
update public.absences
   set type = (select v.libelle from public.valeurs_referentiel v where v.referentiel_id = 'abs' and v.cle = 'cp')
 where type = 'Congés payés';

-- 2. Valeur de Profil manquante
insert into public.valeurs_referentiel (referentiel_id, libelle, ordre)
  select 'poste', 'Directeur', 3
   where not exists (select 1 from public.valeurs_referentiel where referentiel_id = 'poste' and libelle = 'Directeur');

-- 3. Droit « suivi_projets » retiré de la matrice
delete from public.droits_roles where droit = 'suivi_projets';
alter table public.droits_roles drop constraint droits_roles_droit_check;
alter table public.droits_roles add constraint droits_roles_droit_check check (droit in (
  'general', 'mon_dashboard', 'daily_equipes', 'conges_equipe', 'valider_timesheet', 'fiches_ressources', 'affecter', 'projets', 'piloter',
  'administration', 'comptes', 'roles', 'nommer_admin', 'suivi_dashboard', 'suivi_ressources', 'suivi_timesheet',
  'onglet_daily_fil', 'onglet_daily_synthese', 'onglet_ressources_calendrier', 'onglet_ressources_liste', 'onglet_conges_grille', 'onglet_conges_recap',
  'onglet_admin_equipes', 'onglet_admin_referentiels', 'onglet_admin_feries', 'onglet_admin_envoi_daily', 'onglet_admin_sprints',
  'onglet_astuces_agile', 'onglet_astuces_roadmap', 'onglet_astuces_test_learn'));
