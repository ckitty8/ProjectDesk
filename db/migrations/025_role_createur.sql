/* ============================================================
   Migration 025 — Rôle « Créateur » (porteur du projet)
   ------------------------------------------------------------
   Besoin (porteur du projet, 2026-10-08, « ok 2 » ; maquette
   docs/maquettes/roles-droits/administration-roles-droits.png) : un rôle Créateur,
   unique, réservé à la créatrice de l'application :
   - tous les droits d'un administrateur, sur TOUTES les équipes, même sans en être
     membre côté Neon Auth (mes_equipes et est_responsable_equipe l'incluent) ;
   - seule personne à pouvoir nommer ou retirer un administrateur ;
   - ne peut pas être retiré depuis l'application (aucun droit d'écriture sur la table).
   Le reste des rôles (Admin, Direction, Responsable…) viendra avec « Rôles et droits ».
   Données : une seule ligne ajoutée (compte ciritecgrp@gmail.com) ; aucune donnée
   existante modifiée (règle n°8).
   ============================================================ */
create table public.createur (
  ligne_unique  boolean primary key default true check (ligne_unique),   -- une seule ligne possible
  user_id       text not null unique,
  email         text not null,
  nomme_le      timestamptz not null default now()
);
grant select on public.createur to authenticated;   -- aucune écriture depuis l'application
revoke all on public.createur from anonymous;
alter table public.createur enable row level security;
create policy "Lecture : administrateurs ou soi-même" on public.createur for select to authenticated
  using (public.est_admin() or user_id = auth.user_id());

create or replace function public.est_createur()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.createur c where c.user_id = auth.user_id())
$$;
revoke all on function public.est_createur() from public;
grant execute on function public.est_createur() to authenticated;

-- Administrateur = inscrit dans administrateurs, ou créateur
create or replace function public.est_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.administrateurs a where a.user_id = auth.user_id())
      or public.est_createur()
$$;

-- Équipes de l'utilisateur : celles dont il est membre (Neon Auth) ; le créateur les a toutes
create or replace function public.mes_equipes()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select e.id from public.equipes e
  join neon_auth.member m on m."organizationId" = e.id
  where m."userId"::text = auth.user_id()
  union
  select e.id from public.equipes e where public.est_createur()
$$;

-- Responsable d'une équipe : owner / admin de l'organisation, ou créateur
create or replace function public.est_responsable_equipe(p_equipe uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from neon_auth.member m
                 where m."organizationId" = p_equipe and m."userId"::text = auth.user_id()
                   and m.role in ('owner','admin'))
      or public.est_createur()
$$;

-- Nommer ou retirer un administrateur : le créateur seulement (auparavant : tout administrateur)
drop policy "Écriture : administrateurs" on public.administrateurs;
create policy "Écriture : créateur" on public.administrateurs
  for all to authenticated using (public.est_createur()) with check (public.est_createur());

-- Comptes en attente (migration 024) : le créateur n'y figure jamais
create or replace function public.comptes_en_attente()
returns table (user_id text, nom text, email text, inscrit_le timestamptz, derniere_connexion timestamptz, invite boolean)
language sql stable security definer set search_path = '' as $$
  select u.id::text, u.name, u.email, u."createdAt",
         (select max(s."createdAt") from neon_auth.session s where s."userId" = u.id),
         exists (select 1 from neon_auth.invitation i where lower(i.email) = lower(u.email) and i.status = 'pending')
  from neon_auth."user" u
  where public.est_admin()
    and not exists (select 1 from neon_auth.member m join public.equipes e on e.id = m."organizationId" where m."userId" = u.id)
    and not exists (select 1 from public.administrateurs a where a.user_id = u.id::text)
    and not exists (select 1 from public.createur c where c.user_id = u.id::text)
    and not exists (select 1 from public.comptes_ignores c where c.user_id = u.id::text)
  order by u."createdAt" desc
$$;

-- La créatrice de l'application
insert into public.createur (user_id, email)
select u.id::text, u.email from neon_auth."user" u where lower(u.email) = 'ciritecgrp@gmail.com';

notify pgrst, 'reload schema';
