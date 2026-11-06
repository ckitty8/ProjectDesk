/* ============================================================
   Migration 061 — Suppression d'une direction
   ------------------------------------------------------------
   Demande du porteur (2026-11-06) : « je peux avoir une direction supprimée et les utilisateurs se retrouvent sans direction, c'est tout ».
   Le déclencheur controler_suppression_equipe refusait de supprimer toute unité non vide. Pour une DIRECTION, il :
   - détache ses équipes (elles deviennent sans direction : parent_id = null) au lieu de bloquer ;
   - refuse seulement si la direction porte des projets (une équipe garde les siens) ;
   - laisse la suppression supprimer ses propres fiches rattachées (clé étrangère en cascade), l'écran le dit avant de confirmer.
   Une équipe garde la règle d'origine : non vide (personnes ou projets), pas de suppression. Aucune donnée existante modifiée à la création.
   ============================================================ */
create or replace function public.controler_suppression_equipe()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.type = 'direction' then
    if exists (select 1 from public.projets p where p.equipe_id = old.id) then
      raise exception 'Direction avec des projets : déplacez ou supprimez ses projets avant de la supprimer';
    end if;
    -- Ses équipes se retrouvent sans direction
    update public.equipes set parent_id = null where parent_id = old.id;
    return old;
  end if;
  if exists (select 1 from public.ressources r where r.equipe_id = old.id)
     or exists (select 1 from public.projets p where p.equipe_id = old.id) then
    raise exception 'Unité non vide (ressources ou projets) : passez-la plutôt en « Inactive »';
  end if;
  if exists (select 1 from public.equipes e where e.parent_id = old.id) then
    raise exception 'Unité non vide : rattachez ses équipes ailleurs avant de la supprimer';
  end if;
  return old;
end;
$$;
