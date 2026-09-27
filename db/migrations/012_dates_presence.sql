/* ============================================================
   Migration 012 — Dates d'arrivée et de départ des personnes
   ------------------------------------------------------------
   Besoin (porteur du projet, 2026-09-27 ; maquettes docs/maquettes/date-arrivee/) :
   une personne arrivée en cours d'année (ex. avril) ne doit pas compter de jours
   travaillés ni de congés avant son arrivée ; même chose après son départ.
   Les deux dates sont facultatives (null = présente toute l'année).
   Migration ADDITIVE uniquement (règle n°8 de CLAUDE.md) : deux colonnes vides,
   aucune ligne existante modifiée. Droits : ceux de la table ressources (inchangés).
   ============================================================ */
alter table public.ressources
  add column date_arrivee date,
  add column date_depart  date,
  add constraint ressources_dates_presence_coherentes
    check (date_depart is null or date_arrivee is null or date_depart >= date_arrivee);

/* Demande de relecture du schéma (à compléter par le réenregistrement
   de la configuration Data API, voir DAT § 10) */
notify pgrst, 'reload schema';
