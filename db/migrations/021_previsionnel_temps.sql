/* ============================================================
   Migration 021 — Prévisionnel des temps (chefs de projet)
   ------------------------------------------------------------
   Besoin (porteur du projet, 2026-10-07 ; maquette docs/maquettes/previsionnel-temps/) :
   remplacer le tableur « Suivi temps tech lead » par un écran de Mon dashboard, réservé
   aux chefs de projet, pour toute personne affectée (pas seulement les tech leads) :
     jours travaillés × % du temps sur le projet × % du type de tâche.
   - previsions_temps : % du temps d'une personne sur un projet (une ligne par
     affectation ; supprimée avec l'affectation) ;
   - types_tache_projet : types de tâche d'un projet et leur % cible
     (ex. CDO : US 36 %, Incident 20 %…).
   Droits : lecture = membres et administrateurs ; écriture = chef du projet, responsable
   de son unité, administrateur — même règle que l'envoi du daily (peut_gerer_envoi_projet,
   migration 019).
   Migration ADDITIVE (règle n°8) : deux tables nouvelles ; aucune ligne existante modifiée.
   Valeurs de départ reprises du tableur du porteur (Suivi_temps_TechLead_2projets_v3).
   ============================================================ */
create table public.previsions_temps (
  projet_id     uuid not null,
  ressource_id  uuid not null,
  part          numeric(5,2) not null check (part >= 0 and part <= 100),
  modifie_par   text,
  modifie_le    timestamptz not null default now(),
  primary key (projet_id, ressource_id),
  foreign key (projet_id, ressource_id) references public.affectations (projet_id, ressource_id) on delete cascade
);

create table public.types_tache_projet (
  id            uuid primary key default gen_random_uuid(),
  projet_id     uuid not null references public.projets(id) on delete cascade,
  libelle       text not null check (length(btrim(libelle)) between 1 and 80),
  part          numeric(5,2) not null default 0 check (part >= 0 and part <= 100),
  ordre         int not null default 0,
  modifie_par   text,
  modifie_le    timestamptz not null default now(),
  unique (projet_id, libelle)
);

create trigger previsions_temps_tracer_modification before update on public.previsions_temps
  for each row execute function public.tracer_modification();
create trigger types_tache_projet_tracer_modification before update on public.types_tache_projet
  for each row execute function public.tracer_modification();

grant select, insert, update, delete on public.previsions_temps, public.types_tache_projet to authenticated;
revoke all on public.previsions_temps, public.types_tache_projet from anonymous;
alter table public.previsions_temps enable row level security;
alter table public.types_tache_projet enable row level security;

create policy "Lecture : membres ou administrateurs" on public.previsions_temps for select to authenticated
  using (public.est_membre_equipe() or public.est_admin());
create policy "Écriture : chef, responsables, administrateurs" on public.previsions_temps for all to authenticated
  using (public.peut_gerer_envoi_projet(projet_id)) with check (public.peut_gerer_envoi_projet(projet_id));
create policy "Lecture : membres ou administrateurs" on public.types_tache_projet for select to authenticated
  using (public.est_membre_equipe() or public.est_admin());
create policy "Écriture : chef, responsables, administrateurs" on public.types_tache_projet for all to authenticated
  using (public.peut_gerer_envoi_projet(projet_id)) with check (public.peut_gerer_envoi_projet(projet_id));

/* Valeurs de départ (tableur du porteur) : types de tâche de CDO et des projets IA,
   répartition de Nouha (CDO 80 %, IA 20 %). Ignorées si le projet ou l'affectation
   n'existe pas (base de test, autre environnement). */
insert into public.types_tache_projet (projet_id, libelle, part, ordre)
select p.id, t.libelle, t.part, t.ordre
from public.projets p
join (values ('CDO', 'US', 36, 1), ('CDO', 'Incident', 20, 2), ('CDO', 'Bug', 6, 3), ('CDO', 'Doc', 5, 4),
             ('CDO', 'Test / Aller retour', 9, 5), ('CDO', 'Technique', 4, 6), ('CDO', 'Autres sujets', 20, 7),
             ('IA', 'Fonctionnel', 25, 1), ('IA', 'Infra', 25, 2), ('IA', 'Sécurité', 25, 3), ('IA', 'Agent', 25, 4))
  as t (projet, libelle, part, ordre) on t.projet = p.nom;

insert into public.previsions_temps (projet_id, ressource_id, part)
select a.projet_id, a.ressource_id, case p.nom when 'CDO' then 80 else 20 end
from public.affectations a
join public.projets p on p.id = a.projet_id
join public.ressources r on r.id = a.ressource_id
where r.nom = 'Nouha' and p.nom in ('CDO', 'IA');

/* Demande de relecture du schéma (à compléter par le réenregistrement
   de la configuration Data API, voir DAT § 10) */
notify pgrst, 'reload schema';
