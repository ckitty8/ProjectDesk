/* ============================================================
   Migration 024 — Comptes en attente d'accès
   ------------------------------------------------------------
   Besoin (porteur du projet, 2026-10-08 ; maquette docs/maquettes/comptes-en-attente/) :
   une personne qui s'inscrit n'a accès à rien tant qu'elle n'est pas membre d'une équipe,
   et l'administrateur ne savait pas qu'elle attendait. Administration › « Comptes en
   attente » liste ces comptes ; « Donner l'accès » l'invite dans une équipe (Neon Auth)
   et renseigne l'email de sa fiche ressource ; « Ignorer » écarte un compte (doublon…).
   - comptes_ignores : comptes écartés par un administrateur ;
   - comptes_en_attente() : inscrits sans équipe, ni administrateurs, ni écartés —
     réservée aux administrateurs (liste vide pour les autres).
   Migration ADDITIVE (règle n°8) : une table vide et une fonction de lecture.
   ============================================================ */
create table public.comptes_ignores (
  user_id     text primary key,
  ignore_par  text,
  ignore_le   timestamptz not null default now()
);
grant select, insert, delete on public.comptes_ignores to authenticated;
revoke all on public.comptes_ignores from anonymous;
alter table public.comptes_ignores enable row level security;
create policy "Administrateurs seulement" on public.comptes_ignores for all to authenticated
  using (public.est_admin()) with check (public.est_admin());

/* Inscrits sans accès : aucun lien de membre vers une équipe de ProjectDesk.
   « invite » = une invitation est en attente (accès donné, la personne ne s'est pas encore
   reconnectée). Lecture des tables de Neon Auth : d'où SECURITY DEFINER, limité aux administrateurs. */
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
    and not exists (select 1 from public.comptes_ignores c where c.user_id = u.id::text)
  order by u."createdAt" desc
$$;
revoke all on function public.comptes_en_attente() from public;
grant execute on function public.comptes_en_attente() to authenticated;

notify pgrst, 'reload schema';
