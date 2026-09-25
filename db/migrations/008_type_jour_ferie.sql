/* ============================================================
   Migration 008 — Jours fériés affichés avec le type « Jours férié »
   ------------------------------------------------------------
   Besoin (porteur du projet, 2026-09-25) : par défaut, les jours fériés
   (table jours_feries) apparaissent dans le calendrier des congés avec
   le type d'absence « Jours férié » (couleur et abrégé administrables).
   → La valeur « Jours férié » devient une valeur système de clé 'ferie'
     (renommable, non supprimable) : le calendrier la retrouve par sa clé.
   → Une clé technique peut désormais être posée une fois sur une valeur
     qui n'en avait pas ; elle reste ensuite non modifiable.
   ============================================================ */

/* ---------- 1. Protection : clé posable une fois, puis figée ---------- */
create or replace function public.proteger_valeur_systeme()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and old.systeme then raise exception 'Valeur système : suppression impossible (la désactiver)'; end if;
  if tg_op = 'UPDATE' and old.cle is not null and old.cle is distinct from new.cle then raise exception 'Clé technique non modifiable'; end if;
  return coalesce(new, old);
end;
$$;

/* ---------- 2. « Jours férié » : valeur système de clé 'ferie' ---------- */
update public.valeurs_referentiel set cle = 'ferie', systeme = true
where referentiel_id = 'abs' and libelle = 'Jours férié' and cle is null;

/* ---------- 3. Demande de relecture du schéma (à compléter par le réenregistrement
   de la configuration Data API, voir DAT § 10) ---------- */
notify pgrst, 'reload schema';
