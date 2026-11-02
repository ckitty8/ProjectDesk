/* ============================================================
   Migration 052 — Rôle unique, étape A (additive) — docs/specifications/role-unique.md § 4
   ------------------------------------------------------------
   Demande du porteur (2026-11-02) : fusionner « rôle d'accès » et « rôle projet » en un seul « Rôle » (Direction, Responsable d'équipe, Chef de projet,
   Membre, Utilisateur, Lecture seule). Cette étape ne change AUCUN comportement : personne n'a encore les nouvelles valeurs.
   - Les trois contraintes de valeurs (roles_acces, roles_prevus, droits_roles) acceptent aussi « chef » et « membre » (« projet » est conservé le temps
     de la conversion, étape suivante, qui demande l'accord du porteur personne par personne).
   - Matrice des droits : lignes ajoutées pour « chef » (copie des droits de « projet ») et « membre » (idem, sans affecter, sans envoi du daily :
     décision du porteur « Chef de projet > Membre > Utilisateur »). 62 lignes nouvelles, aucune ligne existante modifiée.
   - mon_role() : l'ordre de priorité connaît les nouvelles valeurs (admin, direction, responsable, chef, membre, projet, utilisateur, lecture) ;
     même résultat qu'avant pour les six valeurs existantes.
   - Nouvelles fonctions, pas encore utilisées par les règles (elles le seront à l'étape B) :
       peut_saisir_projet(projet)  : saisir sprints et MEP — administrateur, gestionnaire de l'unité du projet, Chef de projet ou Membre affecté ;
       peut_gerer_projet(projet)   : modifier le projet, affecter, envoi du daily — administrateur, gestionnaire de l'unité, Chef de projet affecté
                                      ou chef désigné du projet (projets.chef_id).
   Aucune donnée existante modifiée (règle n°8).
   ============================================================ */

-- 1. Valeurs acceptées
alter table public.roles_acces drop constraint roles_acces_role_check;
alter table public.roles_acces add constraint roles_acces_role_check
  check (role in ('admin', 'direction', 'responsable', 'chef', 'membre', 'projet', 'utilisateur', 'lecture'));
alter table public.roles_prevus drop constraint roles_prevus_role_check;
alter table public.roles_prevus add constraint roles_prevus_role_check
  check (role in ('admin', 'direction', 'responsable', 'chef', 'membre', 'projet', 'utilisateur', 'lecture'));
alter table public.droits_roles drop constraint droits_roles_role_check;
alter table public.droits_roles add constraint droits_roles_role_check
  check (role in ('admin', 'direction', 'responsable', 'chef', 'membre', 'projet', 'utilisateur', 'lecture'));

-- 2. Matrice : « chef » = « projet » ; « membre » = « projet » sans affecter, sans envoi du daily
insert into public.droits_roles (role, droit, niveau)
  select 'chef', droit, niveau from public.droits_roles where role = 'projet'
  on conflict (role, droit) do nothing;
insert into public.droits_roles (role, droit, niveau)
  select 'membre', droit,
         case when droit in ('affecter', 'piloter', 'onglet_admin_envoi_daily') then 'non' else niveau end
    from public.droits_roles where role = 'projet'
  on conflict (role, droit) do nothing;

-- 3. mon_role : priorité étendue
create or replace function public.mon_role()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select ra.role from public.roles_acces ra join public.ressources r on r.id = ra.ressource_id
      where r.user_id = auth.user_id()
      order by array_position(array['admin', 'direction', 'responsable', 'chef', 'membre', 'projet', 'utilisateur', 'lecture'], ra.role) limit 1),
    case
      when exists (select 1 from public.administrateurs a where a.user_id = auth.user_id()) then 'admin'
      when exists (select 1 from public.responsables_equipe x join public.ressources r on r.id = x.ressource_id
                   where r.user_id = auth.user_id())
        or exists (select 1 from neon_auth.member m join public.equipes e on e.id = m."organizationId"
                   where m."userId"::text = auth.user_id() and m.role in ('owner', 'admin')) then 'responsable'
      else 'utilisateur'
    end)
$$;

-- 4. Nouvelles règles (non branchées)
create or replace function public.peut_saisir_projet(p_projet uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.est_admin()
      or (not public.est_lecture_seule()
          and exists (select 1 from public.projets p where p.id = p_projet and p.equipe_id in (select public.mes_unites_gerees())))
      or (public.mon_role() in ('chef', 'membre')
          and exists (select 1 from public.affectations a where a.projet_id = p_projet and a.ressource_id in (select public.mes_ressources())))
$$;

create or replace function public.peut_gerer_projet(p_projet uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.est_admin()
      or (not public.est_lecture_seule()
          and exists (select 1 from public.projets p where p.id = p_projet and p.equipe_id in (select public.mes_unites_gerees())))
      or (public.mon_role() = 'chef'
          and (exists (select 1 from public.affectations a where a.projet_id = p_projet and a.ressource_id in (select public.mes_ressources()))
               or exists (select 1 from public.projets p where p.id = p_projet and p.chef_id in (select public.mes_ressources()))))
$$;
revoke all on function public.peut_saisir_projet(uuid), public.peut_gerer_projet(uuid) from public;
grant execute on function public.peut_saisir_projet(uuid), public.peut_gerer_projet(uuid) to authenticated;

notify pgrst, 'reload schema';
