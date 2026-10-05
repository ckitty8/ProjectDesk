/* ============================================================
   Migration 015 — Numéro et année des sprints
   ------------------------------------------------------------
   Besoin (porteur du projet, 2026-10-05) : dans Administration › Sprints, saisir le
   numéro du sprint (affiché « Sprint 1 ») et l'année, pour afficher les sprints par année.
   - numero_sprint : numéro saisi par le porteur (distinct de `numero`, clé technique
     attribuée à l'ajout, à laquelle se rattachent les points et les répartitions) ;
   - annee : année du sprint (pré-remplie avec l'année de la date de début).
   Un même numéro ne peut pas servir deux fois la même année pour un projet.
   Migration ADDITIVE uniquement (règle n°8) : deux colonnes vides + un index d'unicité
   qui ne porte que sur les lignes renseignées. Aucune ligne existante modifiée.
   ============================================================ */
alter table public.sprints_projet
  add column numero_sprint int check (numero_sprint > 0),
  add column annee         int check (annee between 2000 and 2100);
create unique index sprints_projet_numero_annee_unique on public.sprints_projet (projet_id, annee, numero_sprint)
  where numero_sprint is not null and annee is not null;

/* Demande de relecture du schéma (à compléter par le réenregistrement
   de la configuration Data API, voir DAT § 10) */
notify pgrst, 'reload schema';
