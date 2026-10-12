/* ============================================================
   Migration 027 — Plusieurs responsables par équipe
   ------------------------------------------------------------
   Spécification validée par le porteur (docs/specifications/ressources.md, 2026-10-12 ;
   maquettes docs/maquettes/ressources-v2/) : chaque équipe a 1 ou plusieurs responsables,
   et une personne peut être responsable de plusieurs équipes.
   Jusqu'ici : un seul responsable désigné par équipe (equipes.responsable_id).
   → Table responsables_equipe (équipe, personne). Les responsables désignés actuels y sont
     recopiés ; la colonne equipes.responsable_id est conservée (rien n'est supprimé).
   Droits : lecture pour tout utilisateur connecté (comme equipes) ; écriture par un
   administrateur ou un responsable de l'équipe (est_responsable_equipe : owner / admin
   de l'organisation, ou créateur).
   Migration additive : aucune donnée existante modifiée ni supprimée (règle n°8).
   ============================================================ */

create table public.responsables_equipe (
  equipe_id     uuid not null references public.equipes(id) on delete cascade,
  ressource_id  uuid not null references public.ressources(id) on delete cascade,
  cree_par      text default auth.user_id(),
  cree_le       timestamptz not null default now(),
  primary key (equipe_id, ressource_id)
);
create index responsables_equipe_ressource_idx on public.responsables_equipe (ressource_id);

grant select, insert, delete on public.responsables_equipe to authenticated;
revoke all on public.responsables_equipe from anonymous;
alter table public.responsables_equipe enable row level security;
create policy "Lecture : utilisateurs connectés" on public.responsables_equipe for select to authenticated using (true);
create policy "Écriture : administrateurs ou responsables de l'équipe" on public.responsables_equipe for all to authenticated
  using (public.est_admin() or public.est_responsable_equipe(equipe_id))
  with check (public.est_admin() or public.est_responsable_equipe(equipe_id));

-- Reprise des responsables désignés actuels (ex. Anne Caselli pour Applications)
insert into public.responsables_equipe (equipe_id, ressource_id, cree_par)
select e.id, e.responsable_id, 'migration 027' from public.equipes e where e.responsable_id is not null
on conflict do nothing;

notify pgrst, 'reload schema';
