/* ============================================================
   Migration 039 — Mises en production (MEP) des projets
   ------------------------------------------------------------
   Besoin (porteur du projet, 2026-10-23 ; maquette docs/maquettes/roadmap-mep-sprints/) :
   « un planning de MEP » dans Suivi de mes équipes › Projets et Roadmap (lecture), saisie
   dans Mon dashboard › Projets et Roadmap › onglet MEP. Une ligne par mise en production :
   projet, date, version, contenu, statut (STATUTS_MEP, config.js).
   Migration ADDITIVE uniquement (règle n°8 de CLAUDE.md) : une table nouvelle, vide.
   Droits : identiques à sprints_projet — lecture = membres et administrateurs ; écriture =
   ceux qui peuvent modifier le projet (peut_editer_projet) ou administrateurs, avec le droit
   « projets » de la matrice (a_droit).
   ============================================================ */
create table public.mises_en_production (
  id           uuid primary key default gen_random_uuid(),
  projet_id    uuid not null references public.projets(id) on delete cascade,
  jour         date not null,
  version      text check (version is null or length(version) between 1 and 40),
  contenu      text check (contenu is null or length(contenu) <= 500),
  statut       text not null default 'prevue' check (statut in ('prevue', 'faite', 'reportee')),
  modifie_par  text,
  modifie_le   timestamptz not null default now()
);
create index mises_en_production_projet_idx on public.mises_en_production (projet_id);

create trigger mises_en_production_tracer_modification before update on public.mises_en_production
  for each row execute function public.tracer_modification();

grant select, insert, update, delete on public.mises_en_production to authenticated;
revoke all on public.mises_en_production from anonymous;
alter table public.mises_en_production enable row level security;

create policy "Lecture : membres ou administrateurs" on public.mises_en_production for select to authenticated
  using (public.est_membre_equipe() or public.est_admin());
create policy "Écriture : éditeurs du projet ou administrateurs" on public.mises_en_production for all to authenticated
  using ((public.est_admin() or public.peut_editer_projet(projet_id)) and public.a_droit('projets'))
  with check ((public.est_admin() or public.peut_editer_projet(projet_id)) and public.a_droit('projets'));

/* Demande de relecture du schéma (à compléter par le réenregistrement
   de la configuration Data API, voir DAT § 10) */
notify pgrst, 'reload schema';
