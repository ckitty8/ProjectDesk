/* ============================================================
   Migration 041 — Matrice des droits modifiable par le créateur seul
   ------------------------------------------------------------
   Besoin (porteur du projet, 2026-10-23 : « la matrice des droits est uniquement pour le
   créateur » ; maquette docs/maquettes/matrice-createur/ validée) : la matrice quitte
   Administration › Rôles pour Administration créateur. Sa modification, jusqu'ici ouverte aux
   administrateurs ayant le droit « roles » (migration 031), est réservée au créateur.
   La lecture reste ouverte à tous les connectés : l'application en a besoin pour afficher
   les menus de chacun. Règle de sécurité remplacée ; aucune donnée modifiée.
   ============================================================ */
drop policy "Modification : droit Rôles" on public.droits_roles;
create policy "Modification : créateur" on public.droits_roles for update to authenticated
  using (public.est_createur()) with check (public.est_createur());

/* Demande de relecture du schéma (à compléter par le réenregistrement
   de la configuration Data API, voir DAT § 10) */
notify pgrst, 'reload schema';
