/* ============================================================
   Migration 062 — Un rôle par équipe (porteur, 2026-11-13 : « on peut avoir un rôle différent par équipe » ; maquette role-par-equipe/)
   ------------------------------------------------------------
   Une personne a une équipe principale (sa fiche : rôle de roles_acces, inchangé) et peut être rattachée à d'autres équipes (membres_equipe,
   migration 033), désormais avec un rôle par équipe.
   - membres_equipe.role (nullable : un rattachement existant sans rôle reprend le rôle de l'équipe principale) ;
   - affecter_role_equipe(personne, équipe, rôle) : administrateur (droit « Rôles ») ; équipe principale → affecter_role ; autre équipe → rattache si
     besoin et enregistre le rôle ; Responsable / Direction → responsable de cette équipe (responsables_equipe) ;
   - retirer_de_equipe(personne, équipe) : retire le rattachement et la responsabilité (jamais l'équipe principale) ;
   - appliquer_role : ne supprime plus que les responsabilités de l'équipe principale et de sa direction (celles des autres équipes sont conservées) ;
   - mon_role : le rôle le plus élevé parmi ceux de la fiche et des rattachements (les droits de la base sont donc ceux du rôle le plus élevé ; l'application
     masque boutons et menus selon le rôle de l'équipe active). Limite connue : la validation des timesheets d'une autre équipe suit l'organisation Neon Auth.
   Migration ADDITIVE (règle n°8) : une colonne nullable, aucune donnée existante modifiée. Comptages attendus : tous identiques.
   ============================================================ */

alter table public.membres_equipe
  add column role text check (role is null or role in ('direction', 'responsable', 'chef', 'membre', 'utilisateur', 'lecture'));

-- 1. appliquer_role : responsabilités des autres équipes conservées (reste inchangé par ailleurs : copie de la migration 054)
create or replace function public.appliquer_role(p_ressource uuid, p_role text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_user      text;
  v_equipe    uuid;
  v_parent    uuid;
  v_verifie   boolean;
  v_membre    boolean;
  v_privilege boolean := p_role in ('admin', 'direction', 'responsable', 'chef', 'membre');
begin
  select r.user_id, r.equipe_id, e.parent_id into v_user, v_equipe, v_parent
    from public.ressources r join public.equipes e on e.id = r.equipe_id where r.id = p_ressource;
  if not found then raise exception 'Fiche introuvable'; end if;
  select u."emailVerified" into v_verifie from neon_auth."user" u where u.id::text = v_user;

  -- Rôle qui donne des droits : seulement à un compte relié, email vérifié
  if v_privilege and (v_user is null or v_verifie is not true) then
    insert into public.roles_prevus (ressource_id, role) values (p_ressource, p_role)
      on conflict (ressource_id) do update set role = excluded.role, cree_par = auth.user_id(), cree_le = now();
    return 'prevu';
  end if;

  -- Responsabilités : un seul rôle à la fois (équipe pour Responsable, direction pour Direction)
  -- Seulement les responsabilités de l'équipe principale et de sa direction : celles des autres équipes (rôle par équipe, migration 062) sont conservées
  delete from public.responsables_equipe where ressource_id = p_ressource and equipe_id in (v_equipe, coalesce(v_parent, v_equipe));
  if p_role = 'responsable' then
    insert into public.responsables_equipe (equipe_id, ressource_id) values (v_equipe, p_ressource);
  elsif p_role = 'direction' then
    insert into public.responsables_equipe (equipe_id, ressource_id) values (coalesce(v_parent, v_equipe), p_ressource);
  end if;

  if v_user is not null then
    -- Ancien rôle « admin » : ajoute encore le statut d'administrateur ; les autres rôles n'y touchent plus (cumul, migration 046)
    if p_role = 'admin' then
      insert into public.administrateurs (user_id) select v_user
        where not exists (select 1 from public.administrateurs a where a.user_id = v_user);
    end if;
    -- Rôle dans l'organisation de son équipe : admin (valide les timesheets) pour Responsable et Direction
    select exists (select 1 from neon_auth.member m where m."organizationId" = v_equipe and m."userId"::text = v_user) into v_membre;
    update neon_auth.member m set role = case when p_role in ('responsable', 'direction') then 'admin' else 'member' end
      where m."organizationId" = v_equipe and m."userId"::text = v_user and m.role <> 'owner';
  end if;

  insert into public.roles_acces (ressource_id, role) values (p_ressource, p_role)
    on conflict (ressource_id) do update set role = excluded.role, cree_par = auth.user_id(), cree_le = now();

  if p_role in ('responsable', 'direction') and v_user is not null and not v_membre then
    insert into public.roles_prevus (ressource_id, role) values (p_ressource, p_role)
      on conflict (ressource_id) do update set role = excluded.role, cree_le = now();
    return 'prevu';
  end if;
  delete from public.roles_prevus where ressource_id = p_ressource;
  return 'applique';
end;
$$;

-- 2. Rôle d'une personne dans une équipe
create or replace function public.affecter_role_equipe(p_ressource uuid, p_equipe uuid, p_role text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_principale uuid;
begin
  if not (public.est_admin() and public.a_droit('roles')) then
    raise exception 'Réservé aux administrateurs (droit « Rôles »)' using errcode = '42501';
  end if;
  if p_role not in ('direction', 'responsable', 'chef', 'membre', 'utilisateur', 'lecture') then
    raise exception 'Rôle inconnu : %', p_role;
  end if;
  select equipe_id into v_principale from public.ressources where id = p_ressource;
  if not found then raise exception 'Fiche introuvable'; end if;
  if p_equipe = v_principale then
    return public.affecter_role(p_ressource, p_role);
  end if;
  insert into public.membres_equipe (equipe_id, ressource_id, role) values (p_equipe, p_ressource, p_role)
    on conflict (equipe_id, ressource_id) do update set role = excluded.role;
  delete from public.responsables_equipe where equipe_id = p_equipe and ressource_id = p_ressource;
  if p_role in ('responsable', 'direction') then
    insert into public.responsables_equipe (equipe_id, ressource_id) values (p_equipe, p_ressource);
  end if;
  return 'applique';
end;
$$;
revoke all on function public.affecter_role_equipe(uuid, uuid, text) from public;
grant execute on function public.affecter_role_equipe(uuid, uuid, text) to authenticated;

-- 3. Retrait d'une équipe (rattachement et responsabilité) ; l'équipe principale ne se retire pas
create or replace function public.retirer_de_equipe(p_ressource uuid, p_equipe uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (public.est_admin() and public.a_droit('roles')) then
    raise exception 'Réservé aux administrateurs (droit « Rôles »)' using errcode = '42501';
  end if;
  if exists (select 1 from public.ressources where id = p_ressource and equipe_id = p_equipe) then
    raise exception 'C''est l''équipe principale de la personne : on change son équipe depuis sa ligne';
  end if;
  delete from public.responsables_equipe where equipe_id = p_equipe and ressource_id = p_ressource;
  delete from public.membres_equipe where equipe_id = p_equipe and ressource_id = p_ressource;
end;
$$;
revoke all on function public.retirer_de_equipe(uuid, uuid) from public;
grant execute on function public.retirer_de_equipe(uuid, uuid) to authenticated;

-- 4. mon_role : le plus élevé des rôles de la fiche et des rattachements (même ordre que la migration 055)
create or replace function public.mon_role()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select x.role from (
        select ra.role from public.roles_acces ra join public.ressources r on r.id = ra.ressource_id where r.user_id = auth.user_id()
        union all
        select m.role from public.membres_equipe m join public.ressources r on r.id = m.ressource_id where r.user_id = auth.user_id() and m.role is not null
      ) x
      order by array_position(array['admin', 'direction', 'responsable', 'chef', 'membre', 'utilisateur', 'lecture'], x.role) limit 1),
    case
      when exists (select 1 from public.administrateurs a where a.user_id = auth.user_id()) then 'admin'
      when exists (select 1 from public.responsables_equipe x join public.ressources r on r.id = x.ressource_id
                   where r.user_id = auth.user_id())
        or exists (select 1 from neon_auth.member m join public.equipes e on e.id = m."organizationId"
                   where m."userId"::text = auth.user_id() and m.role in ('owner', 'admin')) then 'responsable'
      else 'utilisateur'
    end)
$$;

notify pgrst, 'reload schema';
