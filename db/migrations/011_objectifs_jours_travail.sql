/* ============================================================
   Migration 011 — Jours de travail attendus par le client
   ------------------------------------------------------------
   Besoin (porteur du projet, 2026-09-26 ; maquette
   docs/maquettes/recap-jours-travailles/) : le Récap annuel reprend
   l'onglet « Jours de congés » du fichier Calendrier_2026.xlsx :
   jours travaillés / congés par mois et « reste à prendre » =
   total travaillé − jours imposés par le client (ex. 218).
   → Ce nombre est fixé par année et par équipe (décision du porteur).
   Lecture : membres et administrateurs ; écriture : administrateurs et
   responsables de l'équipe (owner / admin de l'organisation).
   ============================================================ */
create table public.objectifs_jours_travail (
  equipe_id    uuid not null references public.equipes(id) on delete cascade,
  annee        int  not null check (annee between 2000 and 2100),
  jours        numeric(5,1) not null check (jours > 0 and jours <= 366),
  modifie_par  text,
  modifie_le   timestamptz not null default now(),
  primary key (equipe_id, annee)
);
create trigger objectifs_jours_travail_tracer_modification before update on public.objectifs_jours_travail
  for each row execute function public.tracer_modification();

grant select, insert, update, delete on public.objectifs_jours_travail to authenticated;
revoke all on public.objectifs_jours_travail from anonymous;
alter table public.objectifs_jours_travail enable row level security;
create policy "Lecture : membres ou administrateurs" on public.objectifs_jours_travail for select to authenticated
  using (public.est_membre_equipe() or public.est_admin());
create policy "Écriture : administrateurs ou responsables de l'équipe" on public.objectifs_jours_travail for all to authenticated
  using (public.est_admin() or public.est_responsable_equipe(equipe_id))
  with check (public.est_admin() or public.est_responsable_equipe(equipe_id));

/* Demande de relecture du schéma (à compléter par le réenregistrement
   de la configuration Data API, voir DAT § 10) */
notify pgrst, 'reload schema';
