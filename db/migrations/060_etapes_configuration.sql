/* ============================================================
   Migration 060 — Étapes de la configuration initiale
   ------------------------------------------------------------
   Pastille « Configuration » (porteur, 2026-11-06 ; maquette assistant-configuration/proposition-3-detaillee.png) : guide l'administrateur dans la
   première configuration de l'application. La plupart des étapes sont détectées d'après les données (équipes créées, responsables nommés…) ; celles qui
   reposent sur des valeurs par défaut (référentiels, écrans par équipe, droits par rôle, jours fériés) sont CONFIRMÉES par l'administrateur, et toute étape
   peut être passée : cette table retient ces confirmations et ces étapes ignorées.
   Une ligne par étape ; sans ligne, l'étape n'est ni confirmée ni ignorée. Lecture et écriture : administrateurs. Aucune donnée existante modifiée.
   ============================================================ */
create table if not exists public.etapes_configuration (
  etape       text primary key,
  statut      text not null check (statut in ('confirmee', 'ignoree')),
  modifie_par text default auth.user_id(),
  modifie_le  timestamptz not null default now()
);

alter table public.etapes_configuration enable row level security;

grant select, insert, update, delete on public.etapes_configuration to authenticated;

create policy "Administrateurs" on public.etapes_configuration for all to authenticated
  using (public.est_admin()) with check (public.est_admin());

notify pgrst, 'reload schema';
