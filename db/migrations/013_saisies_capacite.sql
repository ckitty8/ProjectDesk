/* ============================================================
   Migration 013 — Saisies de l'onglet Capacité (vélocité, répartition)
   ------------------------------------------------------------
   Besoin (porteur du projet, 2026-09-27 ; maquette docs/maquettes/capacite-saisie/) :
   - sprints_projet : points engagés / terminés d'un projet par sprint (vélocité) ;
   - repartitions_sprint : jours réellement passés par catégorie de travail
     (catégories : REPARTITION_SPRINT, config.js) pour un projet et un sprint.
   Le sprint est identifié par son numéro (sprints de 14 jours depuis SPRINT_REFERENCE).
   Migration ADDITIVE uniquement (règle n°8 de CLAUDE.md) : deux tables nouvelles, vides.
   Droits : lecture = membres et administrateurs ; écriture = ceux qui peuvent modifier le
   projet (peut_editer_projet) ou administrateurs.
   ============================================================ */
create table public.sprints_projet (
  projet_id        uuid not null references public.projets(id) on delete cascade,
  numero           int  not null check (numero > 0),
  points_engages   numeric(6,1) check (points_engages >= 0),
  points_termines  numeric(6,1) check (points_termines >= 0),
  modifie_par      text,
  modifie_le       timestamptz not null default now(),
  primary key (projet_id, numero)
);

create table public.repartitions_sprint (
  projet_id    uuid not null references public.projets(id) on delete cascade,
  numero       int  not null check (numero > 0),
  categorie    text not null check (length(categorie) between 1 and 80),
  jours        numeric(5,1) not null check (jours >= 0),
  modifie_par  text,
  modifie_le   timestamptz not null default now(),
  primary key (projet_id, numero, categorie)
);

create trigger sprints_projet_tracer_modification before update on public.sprints_projet
  for each row execute function public.tracer_modification();
create trigger repartitions_sprint_tracer_modification before update on public.repartitions_sprint
  for each row execute function public.tracer_modification();

grant select, insert, update, delete on public.sprints_projet, public.repartitions_sprint to authenticated;
revoke all on public.sprints_projet, public.repartitions_sprint from anonymous;
alter table public.sprints_projet enable row level security;
alter table public.repartitions_sprint enable row level security;

create policy "Lecture : membres ou administrateurs" on public.sprints_projet for select to authenticated
  using (public.est_membre_equipe() or public.est_admin());
create policy "Écriture : éditeurs du projet ou administrateurs" on public.sprints_projet for all to authenticated
  using (public.est_admin() or public.peut_editer_projet(projet_id))
  with check (public.est_admin() or public.peut_editer_projet(projet_id));

create policy "Lecture : membres ou administrateurs" on public.repartitions_sprint for select to authenticated
  using (public.est_membre_equipe() or public.est_admin());
create policy "Écriture : éditeurs du projet ou administrateurs" on public.repartitions_sprint for all to authenticated
  using (public.est_admin() or public.peut_editer_projet(projet_id))
  with check (public.est_admin() or public.peut_editer_projet(projet_id));

/* Demande de relecture du schéma (à compléter par le réenregistrement
   de la configuration Data API, voir DAT § 10) */
notify pgrst, 'reload schema';
