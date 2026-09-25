/* ============================================================
   Migration 001 — Schéma initial ProjectDesk (Roadmap PM)
   ------------------------------------------------------------
   Base : Neon, projet "ProjectDesk", branche "production", base "neondb".
   Accès : le navigateur passe par la Neon Data API (REST) avec le jeton
   JWT de Neon Auth. La base choisit le rôle "authenticated" et applique
   les règles RLS ci-dessous : un utilisateur ne voit et ne modifie QUE les
   données des organisations dont il est membre.

   Conventions :
   - Colonnes en snake_case ; côté JS, les champs sont en camelCase
     (conversion automatique dans roadmap-app/db.js).
   - Les listes de valeurs (statuts, catégories...) restent définies dans
     roadmap-app/data.js (règle n°4 : un seul référentiel). La base ne
     contrôle que les bornes numériques.
   - Les organisations, membres et utilisateurs sont gérés par Neon Auth
     (schéma neon_auth) : on ne fait que s'y référer.
   ============================================================ */


/* ---------- 1. Organisations de l'utilisateur connecté ----------
   Renvoie les identifiants des organisations dont l'utilisateur du jeton
   JWT est membre. SECURITY DEFINER : permet de lire neon_auth.member sans
   donner au rôle "authenticated" l'accès direct à cette table. */
create or replace function public.mes_organisations()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m."organizationId"
  from neon_auth.member m
  where m."userId"::text = auth.user_id()
$$;

revoke all on function public.mes_organisations() from public;
grant execute on function public.mes_organisations() to authenticated;


/* ---------- 2. Horodatage automatique des modifications ----------
   Renseigne modifie_le / modifie_par à chaque mise à jour, pour tracer
   qui a changé quoi dans un backlog partagé. */
create or replace function public.tracer_modification()
returns trigger
language plpgsql
as $$
begin
  new.modifie_le := now();
  new.modifie_par := auth.user_id();
  return new;
end;
$$;


/* ---------- 3. Table des demandes (le backlog) ----------
   Une ligne = une demande. Colonnes = champs de FIELD_LABELS (data.js),
   hors champs calculés (score, rang) qui restent calculés dans app.js. */
create table if not exists public.demandes (
  id                      uuid primary key default gen_random_uuid(),
  organisation_id         uuid not null references neon_auth.organization(id) on delete cascade,

  -- Identification de la demande
  demandeur               text,
  parcours                text,
  categorie               text,
  mois_demande            date,
  us                      text,
  thematique              text,
  demande                 text not null default '',
  commentaires            text,

  -- Priorisation
  etat                    text,
  priorite_demandeur      smallint check (priorite_demandeur between 1 and 3),
  strategique             text,
  impact_client           smallint check (impact_client between 1 and 3),
  impact_collaborateur    smallint check (impact_collaborateur between 1 and 3),
  complexite              smallint check (complexite between 1 and 5),
  planification           text,

  -- Cadrage & développement
  cadrage_amoa            text,
  statut                  text,
  prise_en_charge_dsi     text,
  chiffrage_dsi           numeric(7,1) check (chiffrage_dsi >= 0),
  atterrissage_chiffrage  text,
  sprint_dsi              text,
  avancement_dev          smallint check (avancement_dev between 0 and 100),

  -- Recette & mise en production
  estime_mep              date,
  statut_recette          text,
  date_mep                date,
  statut_mep              text,

  -- Traçabilité
  cree_par                text not null default auth.user_id(),
  cree_le                 timestamptz not null default now(),
  modifie_par             text,
  modifie_le              timestamptz not null default now()
);

create index if not exists demandes_organisation_idx on public.demandes (organisation_id);

drop trigger if exists demandes_tracer_modification on public.demandes;
create trigger demandes_tracer_modification
  before update on public.demandes
  for each row execute function public.tracer_modification();


/* ---------- 4. Paramètres de capacité (une ligne par organisation) ----------
   Reprend DEFAULT_CAPACITY (data.js). */
create table if not exists public.capacites (
  organisation_id             uuid primary key references neon_auth.organization(id) on delete cascade,
  nb_dev                      smallint not null default 3  check (nb_dev >= 0),
  nb_po                       smallint not null default 1  check (nb_po >= 0),
  tjm_dev                     integer  not null default 800 check (tjm_dev >= 0),
  tjm_po                      integer  not null default 800 check (tjm_po >= 0),
  jours_ouvres_par_trimestre  smallint not null default 60 check (jours_ouvres_par_trimestre >= 0),
  modifie_par                 text,
  modifie_le                  timestamptz not null default now()
);

drop trigger if exists capacites_tracer_modification on public.capacites;
create trigger capacites_tracer_modification
  before update on public.capacites
  for each row execute function public.tracer_modification();


/* ---------- 5. Droits et sécurité par ligne (RLS) ----------
   GRANT : le rôle "authenticated" peut lire/écrire les tables.
   RLS   : ... mais seulement les lignes de SES organisations.
   Le rôle "anonymous" n'a aucun droit. */
grant select, insert, update, delete on public.demandes  to authenticated;
grant select, insert, update, delete on public.capacites to authenticated;
revoke all on public.demandes, public.capacites from anonymous;

alter table public.demandes  enable row level security;
alter table public.capacites enable row level security;

drop policy if exists "Membres de l'organisation" on public.demandes;
create policy "Membres de l'organisation" on public.demandes
  for all to authenticated
  using      (organisation_id in (select public.mes_organisations()))
  with check (organisation_id in (select public.mes_organisations()));

drop policy if exists "Membres de l'organisation" on public.capacites;
create policy "Membres de l'organisation" on public.capacites
  for all to authenticated
  using      (organisation_id in (select public.mes_organisations()))
  with check (organisation_id in (select public.mes_organisations()));
