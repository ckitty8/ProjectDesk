/* ============================================================
   Migration 009 — Absences à la demi-journée
   ------------------------------------------------------------
   Besoin (porteur du projet, 2026-09-25) : import de l'onglet « Planning »
   du fichier Calendrier_2026.xlsx, où 0 = congé validé (journée) et
   0,5 = demi-journée de congé.
   → absences.duree : 1 (journée, défaut) ou 0,5 (demi-journée).
     Les calculs (récap, solde, capacité, heures attendues) en tiennent
     compte (app/js/calculs.js).
   ============================================================ */
alter table public.absences
  add column duree numeric(2,1) not null default 1 check (duree in (0.5, 1));

/* Demande de relecture du schéma (à compléter par le réenregistrement
   de la configuration Data API, voir DAT § 10) */
notify pgrst, 'reload schema';
