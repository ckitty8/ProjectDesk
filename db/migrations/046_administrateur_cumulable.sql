/* ============================================================
   Migration 046 — Administrateur cumulable avec un autre rôle
   ------------------------------------------------------------
   Demande du porteur (2026-11-01) : « le rôle administrateur peut être cumulé avec un autre rôle ».
   - Nouvelle fonction affecter_administrateur(fiche, actif) : coche ou décoche le statut d'administrateur (table administrateurs) sans toucher
     au rôle d'accès de la fiche (roles_acces). Réservée au créateur (qui nomme les administrateurs depuis la migration 025).
   - appliquer_role (migrations 030-031) retirait le statut d'administrateur dès qu'un autre rôle était choisi : ce retrait est supprimé, le rôle
     d'accès et le statut d'administrateur sont désormais indépendants. Le reste de la fonction est inchangé.
   L'affichage « mode administrateur » est une affaire de l'application ; la base continue d'appliquer les droits d'un administrateur à tout compte
   présent dans administrateurs. Aucune donnée existante modifiée (règle n°8) : seul le créateur est administrateur aujourd'hui.
   ============================================================ */
create or replace function public.affecter_administrateur(p_ressource uuid, p_actif boolean)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user text;
begin
  if not public.est_createur() then raise exception 'Réservé au créateur' using errcode = '42501'; end if;
  select r.user_id into v_user from public.ressources r where r.id = p_ressource;
  if not found then raise exception 'Fiche introuvable'; end if;
  if v_user is null then raise exception 'Cette personne n''a pas encore de compte'; end if;
  if p_actif then
    insert into public.administrateurs (user_id) select v_user
      where not exists (select 1 from public.administrateurs a where a.user_id = v_user);
    return 'ajoute';
  end if;
  -- Le créateur reste administrateur
  if exists (select 1 from public.createur c where c.user_id = v_user) then raise exception 'Le créateur reste administrateur'; end if;
  delete from public.administrateurs where user_id = v_user;
  return 'retire';
end;
$$;

revoke all on function public.affecter_administrateur(uuid, boolean) from public;
grant execute on function public.affecter_administrateur(uuid, boolean) to authenticated;

create or replace function public.appliquer_role(p_ressource uuid, p_role text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user      text;
  v_equipe    uuid;
  v_parent    uuid;
  v_verifie   boolean;
  v_membre    boolean;
  v_privilege boolean := p_role in ('admin', 'direction', 'responsable', 'projet');
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
  delete from public.responsables_equipe where ressource_id = p_ressource;
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

notify pgrst, 'reload schema';
