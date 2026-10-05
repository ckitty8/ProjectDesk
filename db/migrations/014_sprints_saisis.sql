/* ============================================================
   Migration 014 — Sprints saisis par projet (version, début, fin)
   ------------------------------------------------------------
   Besoin (porteur du projet, 2026-10-05) : chaque projet a ses propres sprints ;
   le porteur saisit pour chacun le nom de la version, la date de début et la
   date de fin (Mon dashboard › Administration › Sprints). La table sprints_projet (migration 013, une ligne
   par projet et par sprint, avec les points de vélocité) reçoit ces trois colonnes.
   Migration ADDITIVE uniquement (règle n°8) : trois colonnes vides, aucune ligne
   modifiée (la table est vide à ce jour). Droits : inchangés (peut_editer_projet).
   ============================================================ */
alter table public.sprints_projet
  add column nom   text check (nom is null or length(nom) between 1 and 80),
  add column debut date,
  add column fin   date,
  add constraint sprints_projet_dates_coherentes check (fin is null or debut is null or fin >= debut);

/* Demande de relecture du schéma (à compléter par le réenregistrement
   de la configuration Data API, voir DAT § 10) */
notify pgrst, 'reload schema';
