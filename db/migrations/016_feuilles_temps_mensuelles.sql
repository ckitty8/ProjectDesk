/* ============================================================
   Migration 016 — Feuilles de temps mensuelles
   ------------------------------------------------------------
   Besoin (porteur du projet, 2026-10-05) : la saisie des heures se fait par MOIS.
   Une feuille mensuelle est rangée dans feuilles_temps avec semaine = 1er jour du mois
   (colonne inchangée, pas de nouvelle table).
   Seule la règle de verrouillage change : les heures d'un jour ne sont plus modifiables
   si la feuille de son MOIS est validée (et toujours si une ancienne feuille de sa
   semaine l'est). Aucune table ni donnée modifiée (règle n°8).
   ============================================================ */
create or replace function public.controler_temps_saisi()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_jour date := coalesce(new.jour, old.jour);
begin
  if exists (select 1 from public.feuilles_temps f
             where f.ressource_id = coalesce(new.ressource_id, old.ressource_id)
               and f.statut = 'validee'
               and f.semaine in (date_trunc('month', v_jour::timestamp)::date,
                                 date_trunc('week', v_jour::timestamp)::date)) then
    raise exception 'Mois validé : heures non modifiables';
  end if;
  return coalesce(new, old);
end;
$$;
