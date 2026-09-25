/* ============================================================
   Migration 004 — Daily des équipes
   ------------------------------------------------------------
   Besoin (porteur du projet, 2026-09-25) : voir les daily des
   membres de ses équipes (écran Général › Daily des équipes).
   Décision : une note est lisible par son auteur, par les personnes
   qui partagent au moins une équipe avec lui, et par les
   administrateurs globaux. Seul l'auteur écrit sa note.
   ============================================================ */

-- L'utilisateur connecté partage-t-il au moins une équipe (reconnue) avec p_user ?
create or replace function public.partage_une_equipe(p_user text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from neon_auth.member moi
    join neon_auth.member autre on autre."organizationId" = moi."organizationId"
    join public.equipes e on e.id = moi."organizationId"
    where moi."userId"::text = auth.user_id() and autre."userId"::text = p_user)
$$;
revoke all on function public.partage_une_equipe(text) from public;
grant execute on function public.partage_une_equipe(text) to authenticated;

drop policy if exists "Auteur uniquement" on public.notes_daily;

create policy "Lecture : auteur, coéquipiers, administrateurs" on public.notes_daily for select to authenticated
  using (user_id = auth.user_id() or public.partage_une_equipe(user_id) or public.est_admin());
create policy "Création : auteur" on public.notes_daily for insert to authenticated
  with check (user_id = auth.user_id());
create policy "Modification : auteur" on public.notes_daily for update to authenticated
  using (user_id = auth.user_id()) with check (user_id = auth.user_id());
create policy "Suppression : auteur" on public.notes_daily for delete to authenticated
  using (user_id = auth.user_id());
