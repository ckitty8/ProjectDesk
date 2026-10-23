/* ============================================================
   Migration 040 — Part idéale de la répartition saisie pour chaque sprint
   ------------------------------------------------------------
   Besoin (porteur du projet, 2026-10-23 : « dans capacité la répartition doit être saisie
   manuellement », choix « % par sprint » ; maquette docs/maquettes/capacite-repartition-saisie/) :
   la part idéale (%) de chaque catégorie n'est plus fixe (REPARTITION_SPRINT, config.js,
   devient une simple suggestion) mais saisie par sprint, à côté des jours réels.
   Migration ADDITIVE (règle n°8 de CLAUDE.md) : une colonne nouvelle, vide ; la colonne
   jours devient facultative (on peut saisir la part avant le réel). Aucune ligne modifiée.
   Droits : inchangés (peut_editer_projet, migration 013).
   ============================================================ */
alter table public.repartitions_sprint
  add column part numeric(5,1) check (part is null or part between 0 and 100),
  alter column jours drop not null,
  add constraint repartitions_sprint_part_ou_jours check (part is not null or jours is not null);

/* Demande de relecture du schéma (à compléter par le réenregistrement
   de la configuration Data API, voir DAT § 10) */
notify pgrst, 'reload schema';
