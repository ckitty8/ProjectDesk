/* ============================================================
   Migration 005 — Directions, statut des équipes, postes, contrats
   ------------------------------------------------------------
   Besoin (porteur du projet, 2026-09-25) : tableau « Directions &
   équipes » dans Mon dashboard › Liste des ressources (maquette
   docs/maquettes/liste-ressources-board/), avec onglets Postes et
   Types de contrat.
   - Une direction regroupe des équipes (pas d'espace de travail propre).
   - Équipes et directions ont un statut actif / inactif.
   - Suppression d'une unité uniquement si elle est vide (décision du
     porteur) : contrôlé ici par des triggers.
   - Postes et types de contrat = référentiels administrables ; renommer
     une valeur met à jour les fiches ressources qui l'utilisent.
   ============================================================ */

/* ---------- 1. Directions ---------- */
create table public.directions (
  id              uuid primary key default gen_random_uuid(),
  nom             text not null unique,
  responsable_id  uuid references public.ressources(id) on delete set null,
  actif           boolean not null default true,
  cree_par        text default auth.user_id(),
  cree_le         timestamptz not null default now(),
  modifie_par     text,
  modifie_le      timestamptz not null default now()
);
create trigger directions_tracer_modification before update on public.directions
  for each row execute function public.tracer_modification();

grant select, insert, update, delete on public.directions to authenticated;
revoke all on public.directions from anonymous;
alter table public.directions enable row level security;
create policy "Lecture : utilisateurs connectés" on public.directions for select to authenticated using (true);
create policy "Écriture : administrateurs" on public.directions for all to authenticated
  using (public.est_admin()) with check (public.est_admin());

/* ---------- 2. Équipes : direction de rattachement et statut ---------- */
alter table public.equipes
  add column direction_id uuid references public.directions(id) on delete restrict,   -- direction non vide : suppression refusée
  add column actif boolean not null default true;

/* ---------- 3. Ressources : type de contrat (référentiel « contrat ») ---------- */
alter table public.ressources add column type_contrat text;

/* ---------- 4. Suppression d'une équipe : seulement si elle est vide ---------- */
create or replace function public.controler_suppression_equipe()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.ressources r where r.equipe_id = old.id)
     or exists (select 1 from public.projets p where p.equipe_id = old.id) then
    raise exception 'Équipe non vide (ressources ou projets) : passez-la plutôt en « Inactive »';
  end if;
  return old;
end;
$$;
create trigger equipes_suppression_controle before delete on public.equipes
  for each row execute function public.controler_suppression_equipe();

/* ---------- 5. Référentiels Postes et Types de contrat ---------- */
insert into public.referentiels (id, nom, ordre) values ('poste', 'Postes', 7), ('contrat', 'Types de contrat', 8);
insert into public.valeurs_referentiel (referentiel_id, libelle, couleur, ordre) values
  ('poste','Chef de projet','#003CC8',1), ('poste','Product manager','#7A3FC2',2), ('poste','Product designer','#7A3FC2',3),
  ('poste','Dév. back-end','#0F8A6B',4), ('poste','Dév. front-end','#0F8A6B',5), ('poste','DevOps','#0F8A6B',6),
  ('poste','Lead data','#B25E09',7), ('poste','Data engineer','#B25E09',8), ('poste','Data analyst','#B25E09',9),
  ('poste','Dév. mobile','#4A5363',10), ('poste','Lead technique','#4A5363',11),
  ('contrat','CDI','#0F8A6B',1), ('contrat','CDD','#003CC8',2), ('contrat','Prestataire','#B25E09',3), ('contrat','Alternance','#7A3FC2',4);

-- Renommer un poste / un type de contrat met à jour les fiches ressources concernées
create or replace function public.propager_renommage_valeur()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.libelle <> old.libelle then
    if new.referentiel_id = 'poste' then
      update public.ressources set poste = new.libelle where poste = old.libelle;
    elsif new.referentiel_id = 'contrat' then
      update public.ressources set type_contrat = new.libelle where type_contrat = old.libelle;
    end if;
  end if;
  return new;
end;
$$;
create trigger valeurs_referentiel_propagation after update on public.valeurs_referentiel
  for each row execute function public.propager_renommage_valeur();

-- Supprimer un poste / un type de contrat encore utilisé est refusé (le passer en inactif)
create or replace function public.controler_suppression_valeur()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (old.referentiel_id = 'poste' and exists (select 1 from public.ressources where poste = old.libelle))
     or (old.referentiel_id = 'contrat' and exists (select 1 from public.ressources where type_contrat = old.libelle)) then
    raise exception 'Valeur utilisée par des ressources : passez-la plutôt en inactive';
  end if;
  return old;
end;
$$;
create trigger valeurs_referentiel_suppression before delete on public.valeurs_referentiel
  for each row execute function public.controler_suppression_valeur();
