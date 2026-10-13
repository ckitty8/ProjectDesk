/* ============================================================
   Migration 029 — Affecter le rôle d'accès depuis Administration › Rôles
   ------------------------------------------------------------
   Demande du porteur (2026-10-13, maquette docs/maquettes/affecter-roles/) :
   « il faut que l'administrateur puisse affecter un rôle aux utilisateurs » ; les rôles se
   font dans Administration, les postes dans Liste des ressources. Décisions :
   - TOUT administrateur peut nommer ou retirer un administrateur (jusqu'ici : le créateur,
     migration 025). Le créateur garde ses droits (table createur, non concernée) ;
   - une personne pas encore connectée reçoit un RÔLE PRÉVU, appliqué à sa première connexion.
   Rôles d'accès (ROLES_ACCES, config.js) : admin, responsable, membre. Un seul par personne :
   - admin       → ligne dans administrateurs ;
   - responsable → ligne dans responsables_equipe (migration 027) + rôle « admin » dans
                   l'organisation Neon Auth de son équipe (valide les feuilles de temps) ;
   - membre      → ni l'un ni l'autre (rôle « member » dans l'organisation).
   Le propriétaire (« owner ») d'une organisation le reste.
   Sécurité : un rôle prévu n'est appliqué qu'à un compte dont l'email est VÉRIFIÉ — la fiche
   est reliée au compte par son email (lier_ma_ressource) ; sans vérification, quelqu'un
   pourrait créer un compte avec l'email d'une autre personne et prendre son rôle.
   Migration additive : une table, trois fonctions, une règle de sécurité remplacée.
   Aucune donnée existante modifiée (règle n°8).
   ============================================================ */

-- Rôles prévus : en attente de la première connexion (email vérifié) de la personne
create table public.roles_prevus (
  ressource_id  uuid primary key references public.ressources(id) on delete cascade,
  role          text not null check (role in ('admin', 'responsable', 'membre')),
  cree_par      text default auth.user_id(),
  cree_le       timestamptz not null default now()
);
-- Lecture par les administrateurs ; écriture uniquement par les fonctions ci-dessous
grant select on public.roles_prevus to authenticated;
revoke all on public.roles_prevus from anonymous;
alter table public.roles_prevus enable row level security;
create policy "Lecture : administrateurs" on public.roles_prevus for select to authenticated using (public.est_admin());

-- Administrateurs : nommés ou retirés par tout administrateur (et non plus par le créateur seul)
drop policy "Écriture : créateur" on public.administrateurs;
create policy "Écriture : administrateurs" on public.administrateurs
  for all to authenticated using (public.est_admin()) with check (public.est_admin());

/* Applique un rôle à une fiche (fonction interne, non appelable depuis l'application).
   Renvoie 'applique', ou 'prevu' si une partie attend la connexion de la personne
   (pas de compte, email non vérifié, ou pas encore membre de l'organisation de son équipe). */
create or replace function public.appliquer_role(p_ressource uuid, p_role text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user     text;
  v_equipe   uuid;
  v_verifie  boolean;
  v_membre   boolean;
begin
  select r.user_id, r.equipe_id into v_user, v_equipe from public.ressources r where r.id = p_ressource;
  if not found then raise exception 'Fiche introuvable'; end if;

  -- Responsable : la liste des responsables de l'équipe porte sur la fiche (compte ou non)
  if p_role = 'responsable' then
    insert into public.responsables_equipe (equipe_id, ressource_id) values (v_equipe, p_ressource) on conflict do nothing;
  else
    delete from public.responsables_equipe where equipe_id = v_equipe and ressource_id = p_ressource;
  end if;

  -- Compte relié et email vérifié ? Sinon le reste du rôle attend sa connexion
  select u."emailVerified" into v_verifie from neon_auth."user" u where u.id::text = v_user;
  if v_user is null or v_verifie is not true then
    insert into public.roles_prevus (ressource_id, role) values (p_ressource, p_role)
      on conflict (ressource_id) do update set role = excluded.role, cree_par = auth.user_id(), cree_le = now();
    return 'prevu';
  end if;

  -- Administrateur
  if p_role = 'admin' then
    insert into public.administrateurs (user_id) select v_user
      where not exists (select 1 from public.administrateurs a where a.user_id = v_user);
  else
    delete from public.administrateurs where user_id = v_user;
  end if;

  -- Rôle dans l'organisation de son équipe : admin pour un responsable, member sinon (owner inchangé)
  select exists (select 1 from neon_auth.member m where m."organizationId" = v_equipe and m."userId"::text = v_user) into v_membre;
  update neon_auth.member m set role = case when p_role = 'responsable' then 'admin' else 'member' end
    where m."organizationId" = v_equipe and m."userId"::text = v_user and m.role <> 'owner';

  -- Responsable pas encore membre de l'organisation : appliqué quand il y entrera
  if p_role = 'responsable' and not v_membre then
    insert into public.roles_prevus (ressource_id, role) values (p_ressource, p_role)
      on conflict (ressource_id) do update set role = excluded.role, cree_le = now();
    return 'prevu';
  end if;
  delete from public.roles_prevus where ressource_id = p_ressource;
  return 'applique';
end;
$$;
revoke all on function public.appliquer_role(uuid, text) from public;

-- Administration › Rôles : un administrateur affecte le rôle d'accès d'une fiche
create or replace function public.affecter_role(p_ressource uuid, p_role text)
returns text language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.est_admin() then raise exception 'Réservé aux administrateurs' using errcode = '42501'; end if;
  if p_role not in ('admin', 'responsable', 'membre') then raise exception 'Rôle inconnu : %', p_role; end if;
  return public.appliquer_role(p_ressource, p_role);
end;
$$;
revoke all on function public.affecter_role(uuid, text) from public;
grant execute on function public.affecter_role(uuid, text) to authenticated;

-- À la connexion : applique les rôles prévus des fiches du compte connecté (nombre appliqué)
create or replace function public.appliquer_mes_roles_prevus()
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare
  v_fiche  record;
  v_nb     integer := 0;
begin
  for v_fiche in select p.ressource_id, p.role from public.roles_prevus p
                 join public.ressources r on r.id = p.ressource_id where r.user_id = auth.user_id() loop
    if public.appliquer_role(v_fiche.ressource_id, v_fiche.role) = 'applique' then v_nb := v_nb + 1; end if;
  end loop;
  return v_nb;
end;
$$;
revoke all on function public.appliquer_mes_roles_prevus() from public;
grant execute on function public.appliquer_mes_roles_prevus() to authenticated;

notify pgrst, 'reload schema';
