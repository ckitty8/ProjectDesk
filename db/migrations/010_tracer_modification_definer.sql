/* ============================================================
   Migration 010 — Traçabilité des modifications sans droit sur « auth »
   ------------------------------------------------------------
   Incident (2026-09-26) : « permission denied for schema auth » à chaque
   modification (enregistrer une équipe, une fiche…). Le rôle
   « authenticated » n'a plus l'usage du schéma auth (géré par Neon,
   propriétaire cloud_admin : nous ne pouvons pas le lui rendre).
   Les règles RLS et valeurs par défaut ne sont pas touchées (auth.user_id()
   y est déjà résolu), mais le trigger tracer_modification(), exécuté avec
   les droits de l'utilisateur, résout auth.user_id() à chaque appel.
   → Il s'exécute désormais avec les droits de son propriétaire
     (SECURITY DEFINER, search_path vide), comme les autres fonctions
     de droits (est_admin, mes_equipes…). Il ne fait que dater et signer
     la ligne modifiée.
   ============================================================ */
create or replace function public.tracer_modification()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.modifie_le := now();
  new.modifie_par := auth.user_id();
  return new;
end;
$$;
