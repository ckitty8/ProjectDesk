/* ============================================================
   Migration 059 — Écrans accessibles par équipe
   ------------------------------------------------------------
   Demande du porteur (2026-11-04) : « chaque équipe n'a pas accès à tous les menus ; c'est à l'administrateur, dans Administration, de choisir quels
   écrans s'affichent pour chaque équipe » (étape 1 ; l'étape 2, les écrans par rôle, est la matrice des droits existante). L'accès effectif à un écran
   est donc : l'équipe active l'autorise ET le rôle l'autorise.
   Table droits_equipes : une ligne par équipe et par écran ÉCARTÉ OU CONFIRMÉ ; sans ligne, l'écran est accessible (comportement actuel : aucune
   donnée existante modifiée, règle n°8). Lecture : tout compte connecté ; écriture : administrateurs (comme la matrice des droits).
   ============================================================ */
create table if not exists public.droits_equipes (
  equipe_id   uuid not null references public.equipes(id) on delete cascade,
  ecran       text not null,
  acces       boolean not null default true,
  modifie_par text,
  modifie_le  timestamptz not null default now(),
  primary key (equipe_id, ecran)
);

alter table public.droits_equipes enable row level security;

grant select, insert, update, delete on public.droits_equipes to authenticated;

create policy "Lecture : comptes connectés" on public.droits_equipes for select to authenticated using (true);
create policy "Écriture : administrateurs" on public.droits_equipes for all to authenticated
  using (public.est_admin()) with check (public.est_admin());

notify pgrst, 'reload schema';
