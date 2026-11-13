/* ============================================================
   Migration 063 — Correctif de mon_role (migration 062) : un rôle d'une autre équipe ne peut pas faire perdre des droits
   ------------------------------------------------------------
   Bug (porteur, 2026-11-13) : après avoir donné à Christelle (administratrice, sans rôle enregistré sur sa fiche : mon_role = « admin » par repli) le
   rôle « Chef de projet » dans l'équipe CDO, mon_role renvoyait « chef » : la base lui retirait ses droits d'administrateur et les projets disparaissaient
   des écrans. Désormais : mon_role = le plus élevé entre le rôle d'avant (fiche, sinon repli administrateur / responsable / utilisateur : inchangé)
   et les rôles des autres équipes. Un rôle d'une autre équipe ne peut donc qu'ajouter des droits, jamais en retirer.
   Migration sans effet sur les données (fonction seule).
   ============================================================ */

create or replace function public.mon_role()
returns text language sql stable security definer set search_path = '' as $$
  with base as (
    select coalesce(
      (select ra.role from public.roles_acces ra join public.ressources r on r.id = ra.ressource_id
        where r.user_id = auth.user_id()
        order by array_position(array['admin', 'direction', 'responsable', 'chef', 'membre', 'utilisateur', 'lecture'], ra.role) limit 1),
      case
        when exists (select 1 from public.administrateurs a where a.user_id = auth.user_id()) then 'admin'
        when exists (select 1 from public.responsables_equipe x join public.ressources r on r.id = x.ressource_id
                     where r.user_id = auth.user_id())
          or exists (select 1 from neon_auth.member m join public.equipes e on e.id = m."organizationId"
                     where m."userId"::text = auth.user_id() and m.role in ('owner', 'admin')) then 'responsable'
        else 'utilisateur'
      end) as role
  )
  select x.role from (
      select role from base
      union all
      select m.role from public.membres_equipe m join public.ressources r on r.id = m.ressource_id where r.user_id = auth.user_id() and m.role is not null
    ) x
  order by array_position(array['admin', 'direction', 'responsable', 'chef', 'membre', 'utilisateur', 'lecture'], x.role) limit 1
$$;

notify pgrst, 'reload schema';
