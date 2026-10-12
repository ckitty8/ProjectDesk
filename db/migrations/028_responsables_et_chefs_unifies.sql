/* ============================================================
   Migration 028 — Responsables et chefs de projet : une seule source
   ------------------------------------------------------------
   Décision du porteur (2026-10-12, DAT 2.02) : supprimer les doublons laissés par l'ancien
   fonctionnement.
   - Responsables d'une équipe : seulement la table responsables_equipe (migration 027 ; plusieurs
     par équipe). Le champ « Responsable » unique (equipes.responsable_id) n'est plus modifiable dans
     l'application ; il a été recopié dans responsables_equipe par la migration 027.
   - Chefs d'un projet : les affectations « Chef de projet » (Product Owners, plusieurs). Le champ
     « Chef de projet » de la fiche projet (projets.chef_id) n'est plus modifiable ; il reste lu
     tant qu'un chef n'y figure que là (aucune donnée n'est modifiée ni supprimée).
   Les deux fonctions de droits qui lisaient equipes.responsable_id lisent désormais
   responsables_equipe. Colonnes conservées (règle n°8 : migration de structure, aucune donnée touchée).
   ============================================================ */

-- Lecture du daily d'un projet : administrateur, personne affectée au projet, ou responsable
-- (responsables_equipe, ou owner/admin de l'organisation) de l'unité du projet ou d'une unité parente
create or replace function public.peut_lire_daily_projet(p_projet uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.est_admin()
    or exists (select 1 from public.affectations a
               where a.projet_id = p_projet and a.ressource_id in (select public.mes_ressources()))
    or exists (
      with recursive chaine as (
        select e.id, e.parent_id
          from public.equipes e join public.projets p on p.equipe_id = e.id where p.id = p_projet
        union
        select e.id, e.parent_id
          from public.equipes e join chaine c on e.id = c.parent_id)
      select 1 from chaine
      where exists (select 1 from public.responsables_equipe x
                    where x.equipe_id = chaine.id and x.ressource_id in (select public.mes_ressources()))
         or public.est_responsable_equipe(chaine.id))
$$;

-- Qui règle l'envoi du daily d'un projet : administrateur, chef du projet (affectation « Chef de
-- projet », ou ancien chef de la fiche), responsable de l'unité du projet ou d'une unité parente
create or replace function public.peut_gerer_envoi_projet(p_projet uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.est_admin()
    or exists (select 1 from public.projets p where p.id = p_projet and p.chef_id in (select public.mes_ressources()))
    or exists (select 1 from public.affectations a join public.valeurs_referentiel v on v.referentiel_id = 'role' and v.cle = 'chef'
               where a.projet_id = p_projet and a.role = v.libelle and a.ressource_id in (select public.mes_ressources()))
    or exists (
      with recursive chaine as (
        select e.id, e.parent_id
          from public.equipes e join public.projets p on p.equipe_id = e.id where p.id = p_projet
        union
        select e.id, e.parent_id
          from public.equipes e join chaine c on e.id = c.parent_id)
      select 1 from chaine
      where exists (select 1 from public.responsables_equipe x
                    where x.equipe_id = chaine.id and x.ressource_id in (select public.mes_ressources()))
         or public.est_responsable_equipe(chaine.id))
$$;

notify pgrst, 'reload schema';
