-- ============================================================
-- 036 — Date de naissance des ressources (demande du porteur 2026-10-16,
-- maquette docs/maquettes/ressources-onglets-naissance/)
-- Migration ADDITIVE (règle 8) : une colonne facultative, aucune donnée modifiée.
-- Les écrans n'affichent que le jour et le mois (anniversaire) ; la date complète
-- n'apparaît que dans la fiche. Les règles RLS de ressources s'appliquent telles quelles.
-- ============================================================
alter table public.ressources add column if not exists date_naissance date;

comment on column public.ressources.date_naissance is
  'Date de naissance (facultative) — écrans : jour et mois seulement (Gestion des ressources)';
