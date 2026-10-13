/* ============================================================
   Migration 033 — Personnes rattachées à une autre équipe
   ------------------------------------------------------------
   Porteur (2026-10-13, « ok » sur docs/maquettes/membres-equipe/) : pouvoir ajouter à une équipe
   (ex. IA, sans projet) une personne déjà présente dans l'application, SANS la retirer de son
   équipe d'origine (ressources.equipe_id reste inchangé).
   → Table membres_equipe (équipe, personne) : la personne s'affiche dans la carte « Membres »
     de l'équipe, section « Rattachées depuis une autre équipe ».
   Le rattachement est un affichage : il ne donne aucun droit sur l'équipe, et la capacité et les
   congés restent comptés dans l'équipe d'origine (pas de double compte).
   Droits : lecture pour tout utilisateur connecté ; écriture par un administrateur ou un
   responsable de l'équipe, qui ont le droit « affecter » de la matrice (migration 031).
   Migration additive : une table créée, aucune donnée existante modifiée (règle n°8).
   ============================================================ */

create table public.membres_equipe (
  equipe_id     uuid not null references public.equipes(id) on delete cascade,
  ressource_id  uuid not null references public.ressources(id) on delete cascade,
  cree_par      text default auth.user_id(),
  cree_le       timestamptz not null default now(),
  primary key (equipe_id, ressource_id)
);
create index membres_equipe_ressource_idx on public.membres_equipe (ressource_id);

grant select, insert, delete on public.membres_equipe to authenticated;
revoke all on public.membres_equipe from anonymous;
alter table public.membres_equipe enable row level security;
create policy "Lecture : utilisateurs connectés" on public.membres_equipe for select to authenticated using (true);
create policy "Écriture : administrateurs ou responsables de l'équipe" on public.membres_equipe for all to authenticated
  using ((public.est_admin() or public.est_responsable_equipe(equipe_id)) and public.a_droit('affecter'))
  with check ((public.est_admin() or public.est_responsable_equipe(equipe_id)) and public.a_droit('affecter'));

notify pgrst, 'reload schema';
