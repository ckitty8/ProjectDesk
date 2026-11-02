/* ============================================================
   Migration 047 — Administrateur « prévu » avant la première connexion
   ------------------------------------------------------------
   Demande du porteur (2026-11-02) : « le rôle administrateur est grisé pour tout le monde, alors que je veux pouvoir affecter ce rôle à qui je veux ».
   La case « Administrateur » (migration 046) n'était cochable que pour une fiche déjà reliée à un compte : l'administrateur est un compte
   (table administrateurs, clé user_id). Pour une fiche sans compte, le statut est désormais « prévu », comme les autres rôles (roles_prevus,
   migration 029) :
   - nouvelle table administrateurs_prevus (une ligne par fiche) ;
   - affecter_administrateur (migration 046) : fiche sans compte → statut prévu (ajouté ou retiré) ; fiche avec compte → comme avant
     (et le statut prévu éventuel est supprimé). Toujours réservée au créateur ;
   - nouvelle fonction appliquer_mes_admins_prevus, appelée à chaque connexion (comme appliquer_mes_roles_prevus) : promeut administrateur le
     compte connecté dont la fiche a un statut prévu, à condition que son email soit vérifié (comme les autres rôles à privilège).
   Aucune donnée existante modifiée (règle n°8) : la nouvelle table est vide.
   ============================================================ */
create table public.administrateurs_prevus (
  ressource_id  uuid primary key references public.ressources(id) on delete cascade,
  cree_par      text default auth.user_id(),
  cree_le       timestamptz not null default now()
);
-- Lecture par les administrateurs ; écriture uniquement par les fonctions ci-dessous
grant select on public.administrateurs_prevus to authenticated;
revoke all on public.administrateurs_prevus from anonymous;
alter table public.administrateurs_prevus enable row level security;
create policy "Lecture : administrateurs" on public.administrateurs_prevus for select to authenticated using (public.est_admin());

create or replace function public.affecter_administrateur(p_ressource uuid, p_actif boolean)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user text;
begin
  if not public.est_createur() then raise exception 'Réservé au créateur' using errcode = '42501'; end if;
  select r.user_id into v_user from public.ressources r where r.id = p_ressource;
  if not found then raise exception 'Fiche introuvable'; end if;

  -- Fiche sans compte : le statut est prévu, il s'appliquera à la première connexion (email vérifié)
  if v_user is null then
    if p_actif then
      insert into public.administrateurs_prevus (ressource_id) values (p_ressource) on conflict (ressource_id) do nothing;
      return 'prevu';
    end if;
    delete from public.administrateurs_prevus where ressource_id = p_ressource;
    return 'retire';
  end if;

  -- Fiche avec compte : statut immédiat (le statut prévu devient sans objet)
  delete from public.administrateurs_prevus where ressource_id = p_ressource;
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

-- À la connexion : promeut administrateur le compte connecté dont une fiche a un statut prévu et dont l'email est vérifié (nombre promu)
create or replace function public.appliquer_mes_admins_prevus()
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare
  v_fiche   record;
  v_verifie boolean;
  v_nb      integer := 0;
begin
  select u."emailVerified" into v_verifie from neon_auth."user" u where u.id::text = auth.user_id();
  if v_verifie is not true then return 0; end if;
  for v_fiche in select p.ressource_id from public.administrateurs_prevus p
                 join public.ressources r on r.id = p.ressource_id where r.user_id = auth.user_id() loop
    insert into public.administrateurs (user_id) select auth.user_id()
      where not exists (select 1 from public.administrateurs a where a.user_id = auth.user_id());
    delete from public.administrateurs_prevus where ressource_id = v_fiche.ressource_id;
    v_nb := v_nb + 1;
  end loop;
  return v_nb;
end;
$$;
revoke all on function public.appliquer_mes_admins_prevus() from public;
grant execute on function public.appliquer_mes_admins_prevus() to authenticated;

notify pgrst, 'reload schema';
