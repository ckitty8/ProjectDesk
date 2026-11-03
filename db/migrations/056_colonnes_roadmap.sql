/* ============================================================
   Migration 056 — Colonnes du tableau Roadmap (Administration › Roadmap)
   ------------------------------------------------------------
   Besoin (porteur du projet, 2026-11-03 ; maquette docs/maquettes/admin-roadmap-colonnes/ validée « Ok, vas-y ») :
   « dans le menu administration, un onglet roadmap où je peux ajouter ou supprimer les colonnes de mon tableau ; pour chaque
   colonne, choisir si c'est une liste déroulante ou une saisie libre ».
   Une ligne par colonne du tableau de Vue d’ensemble › Roadmap :
     - bloc : Identification, Priorisation, Cadrage AMOA, Développement & recette (BLOCS_ROADMAP, domaine/config.ts) ;
     - type : « liste » (liste déroulante), « libre » (saisie libre, format texte / nombre / date) ou « calcul » (Rang, Score :
       calculés par l'application, ni supprimables ni modifiables dans leur type) ;
     - une liste déroulante prend ses valeurs dans un référentiel (valeurs_referentiel, règle n°4), id préfixé « rdm_ », ou dans
       les sprints du projet (liste_sprints, décision du 2026-10-05) ;
     - supprimer une colonne supprime son référentiel (et ses valeurs) : rien d'orphelin.
   Migration ADDITIVE (règle n°8) : une table nouvelle, 19 colonnes de départ (celles du fichier CDO-ROADMAP-NEW, déjà affichées
   en 3.04) et 12 référentiels « rdm_ » VIDES (aucune valeur importée). Aucune ligne existante n'est modifiée.
   Droits : lecture = utilisateurs connectés (le menu Roadmap est ouvert à tous) ; écriture = administrateurs avec le droit
   « administration » (comme referentiels et valeurs_referentiel, migration 031).
   Comptages attendus : referentiels 5 → 17, valeurs_referentiel 28 (inchangé), colonnes_roadmap 0 → 19 ; autres tables identiques.
   ============================================================ */

create table public.colonnes_roadmap (
  id              uuid primary key default gen_random_uuid(),
  cle             text unique,                     -- clé technique (colonnes de départ, colonnes calculées) ; null pour une colonne ajoutée
  libelle         text not null check (length(trim(libelle)) between 1 and 60),
  bloc            text not null check (bloc in ('identification', 'priorisation', 'cadrage', 'developpement')),
  type            text not null check (type in ('liste', 'libre', 'calcul')),
  format          text check (format in ('texte', 'nombre', 'date')),
  liste_sprints   boolean not null default false,  -- liste déroulante des sprints du projet (Sprint DSI) au lieu d'un référentiel
  referentiel_id  text references public.referentiels(id) on delete set null,
  ordre           smallint not null default 0,
  modifie_par     text,
  modifie_le      timestamptz not null default now(),
  -- une saisie libre a un format
  constraint colonnes_roadmap_format check (type <> 'libre' or format is not null)
);

/* Colonnes calculées (Rang, Score) : ni supprimées, ni changées de type — les formules en dépendent (docs/specifications/roadmap.md § 1) */
create or replace function public.proteger_colonne_calculee()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and old.type = 'calcul' then raise exception 'Colonne calculée : suppression impossible'; end if;
  if tg_op = 'UPDATE' and (old.type = 'calcul') <> (new.type = 'calcul') then raise exception 'Colonne calculée : type non modifiable'; end if;
  return coalesce(new, old);
end;
$$;

/* Colonne supprimée : son référentiel « rdm_ » part avec elle (ses valeurs suivent par « on delete cascade ») */
create or replace function public.supprimer_liste_colonne()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.referentiel_id like 'rdm\_%' then delete from public.referentiels where id = old.referentiel_id; end if;
  return old;
end;
$$;

create trigger colonnes_roadmap_protection before update or delete on public.colonnes_roadmap
  for each row execute function public.proteger_colonne_calculee();
create trigger colonnes_roadmap_liste after delete on public.colonnes_roadmap
  for each row execute function public.supprimer_liste_colonne();
create trigger colonnes_roadmap_tracer_modification before update on public.colonnes_roadmap
  for each row execute function public.tracer_modification();

grant select, insert, update, delete on public.colonnes_roadmap to authenticated;
revoke all on public.colonnes_roadmap from anonymous;
alter table public.colonnes_roadmap enable row level security;

create policy "Lecture : utilisateurs connectés" on public.colonnes_roadmap for select to authenticated using (true);
create policy "Écriture : administrateurs" on public.colonnes_roadmap for all to authenticated
  using (public.est_admin() and public.a_droit('administration')) with check (public.est_admin() and public.a_droit('administration'));

/* Listes déroulantes de départ : un référentiel vide par colonne « liste » (les valeurs se saisissent dans Administration › Roadmap) */
insert into public.referentiels (id, nom, ordre) values
  ('rdm_demandeur', 'Roadmap · Demandeur', 101), ('rdm_parcours', 'Roadmap · Parcours', 102),
  ('rdm_categorie', 'Roadmap · Catégorie métier', 103), ('rdm_thematique', 'Roadmap · Thématique', 104),
  ('rdm_strategique', 'Roadmap · Stratégique', 105), ('rdm_priorite', 'Roadmap · Priorité demandeur', 106),
  ('rdm_impact_client', 'Roadmap · Impact client', 107), ('rdm_impact_collaborateur', 'Roadmap · Impact collaborateur', 108),
  ('rdm_cadrage', 'Roadmap · Cadrage AMOA', 109), ('rdm_statut', 'Roadmap · Statut', 110),
  ('rdm_complexite', 'Roadmap · Complexité', 111), ('rdm_prise_en_charge', 'Roadmap · Pris en charge DSI', 112);

/* Les 19 colonnes affichées depuis la version 3.04 (fichier CDO-ROADMAP-NEW.xlsm, onglet « Roadmap fonctionnelle ») */
insert into public.colonnes_roadmap (cle, libelle, bloc, type, format, liste_sprints, referentiel_id, ordre) values
  ('rang', 'Rang', 'identification', 'calcul', null, false, null, 1),
  ('demande', 'Demande', 'identification', 'libre', 'texte', false, null, 2),
  ('demandeur', 'Demandeur', 'identification', 'liste', null, false, 'rdm_demandeur', 3),
  ('parcours', 'Parcours', 'identification', 'liste', null, false, 'rdm_parcours', 4),
  ('categorie', 'Catégorie métier', 'identification', 'liste', null, false, 'rdm_categorie', 5),
  ('thematique', 'Thématique', 'identification', 'liste', null, false, 'rdm_thematique', 6),
  ('us', 'US', 'identification', 'libre', 'texte', false, null, 7),
  ('strategique', 'Stratégique', 'priorisation', 'liste', null, false, 'rdm_strategique', 8),
  ('priorite', 'Priorité demandeur', 'priorisation', 'liste', null, false, 'rdm_priorite', 9),
  ('impactClient', 'Impact client', 'priorisation', 'liste', null, false, 'rdm_impact_client', 10),
  ('impactCollaborateur', 'Impact collaborateur', 'priorisation', 'liste', null, false, 'rdm_impact_collaborateur', 11),
  ('score', 'Score', 'priorisation', 'calcul', null, false, null, 12),
  ('cadrage', 'Cadrage AMOA', 'cadrage', 'liste', null, false, 'rdm_cadrage', 13),
  ('statut', 'Statut', 'developpement', 'liste', null, false, 'rdm_statut', 14),
  ('complexite', 'Complexité', 'developpement', 'liste', null, false, 'rdm_complexite', 15),
  ('priseEnCharge', 'Pris en charge DSI', 'developpement', 'liste', null, false, 'rdm_prise_en_charge', 16),
  ('chiffrage', 'Chiffrage DSI (j-h)', 'developpement', 'libre', 'nombre', false, null, 17),
  ('sprint', 'Sprint DSI', 'developpement', 'liste', null, true, null, 18),
  ('dateMep', 'Date de MEP', 'developpement', 'libre', 'date', false, null, 19);

/* Demande de relecture du schéma (à compléter par le réenregistrement de la configuration Data API, voir DAT § 10) */
notify pgrst, 'reload schema';
