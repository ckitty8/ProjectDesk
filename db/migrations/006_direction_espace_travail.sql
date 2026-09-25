/* ============================================================
   Migration 006 — Une direction est un espace de travail
   ------------------------------------------------------------
   Décision du porteur du projet (2026-09-25, maquette
   docs/maquettes/direction-espace-travail/) : une direction a, comme
   une équipe, des membres, des projets et des demandes, et peut en
   plus regrouper des équipes (un seul niveau).
   → Toute unité est une ligne de « equipes » (= organisation Neon Auth) :
     - type      : 'direction' ou 'equipe' ;
     - parent_id : direction de rattachement d'une équipe.
   → La table « directions » de la migration 005 (vide, accord du porteur)
     et la colonne equipes.direction_id sont supprimées.
   Les droits (RLS) sont inchangés : ils portent déjà sur « equipes ».
   ============================================================ */

/* ---------- 1. Type d'unité et rattachement ---------- */
alter table public.equipes
  add column type text not null default 'equipe' check (type in ('direction', 'equipe')),
  add column parent_id uuid references public.equipes(id) on delete restrict;   -- direction non vide : suppression refusée

/* ---------- 2. Abandon de la table « directions » (vide) ---------- */
alter table public.equipes drop column direction_id;
drop table public.directions;

/* ---------- 3. Règles de rattachement (un seul niveau) ----------
   - une équipe ne peut être rattachée qu'à une direction ;
   - une direction n'est rattachée à rien ;
   - une direction qui regroupe des équipes ne peut pas redevenir « équipe ». */
create or replace function public.controler_rattachement_equipe()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.type = 'direction' and new.parent_id is not null then
    raise exception 'Une direction ne peut pas être rattachée à une autre unité';
  end if;
  if new.parent_id is not null and not exists (
       select 1 from public.equipes d where d.id = new.parent_id and d.type = 'direction') then
    raise exception 'Une équipe ne peut être rattachée qu’à une direction';
  end if;
  if tg_op = 'UPDATE' and new.type = 'equipe'
     and exists (select 1 from public.equipes e where e.parent_id = new.id) then
    raise exception 'Cette direction regroupe des équipes : rattachez-les ailleurs avant de la passer en « équipe »';
  end if;
  return new;
end;
$$;
create trigger equipes_rattachement_controle before insert or update on public.equipes
  for each row execute function public.controler_rattachement_equipe();

/* ---------- 4. Suppression : seulement si l'unité est vide ---------- */
create or replace function public.controler_suppression_equipe()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.ressources r where r.equipe_id = old.id)
     or exists (select 1 from public.projets p where p.equipe_id = old.id) then
    raise exception 'Unité non vide (ressources ou projets) : passez-la plutôt en « Inactive »';
  end if;
  if exists (select 1 from public.equipes e where e.parent_id = old.id) then
    raise exception 'Direction non vide : rattachez ses équipes ailleurs avant de la supprimer';
  end if;
  return old;
end;
$$;

/* ---------- 5. Demande de relecture du schéma (insuffisante seule sur Neon : réenregistrer
   aussi la configuration Data API, voir DAT § 10) ---------- */
notify pgrst, 'reload schema';
