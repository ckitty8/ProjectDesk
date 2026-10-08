/* ============================================================
   Migration 026 — Acceptation des invitations faite par la base
   ------------------------------------------------------------
   Incident (porteur du projet, 2026-10-08) : Cerine (et Thomas) ont reçu l'accès depuis
   Administration › Comptes en attente, mais restaient bloqués sur « Votre compte est créé ».
   L'acceptation automatique passait par l'API de Neon Auth (liste des invitations de
   l'utilisateur puis acceptation), et un échec de cette API était silencieux.
   Correctif : la base accepte elle-même, à la connexion, les invitations en attente adressées
   à l'email du compte connecté (jeton JWT) — même effet que l'API : une ligne de membre dans
   l'équipe, invitation passée à « accepted ». Mêmes cas qu'avant (migration 024-025) :
   compte sans aucune équipe de ProjectDesk, ou créateur.
   L'échéance de l'invitation (48 h côté Neon Auth) n'est pas bloquante : l'accès a été donné
   volontairement par un administrateur, la personne peut se connecter plus tard.
   Aucune donnée existante modifiée hors des invitations concernées (règle n°8).
   ============================================================ */
create or replace function public.accepter_mes_invitations()
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user  uuid := auth.user_id()::uuid;
  v_email text := lower(auth.jwt() ->> 'email');
  v_nb    integer;
begin
  if v_user is null or v_email is null then return 0; end if;
  -- Seulement un compte sans équipe de ProjectDesk, ou le créateur
  if exists (select 1 from neon_auth.member m join public.equipes e on e.id = m."organizationId" where m."userId" = v_user)
     and not public.est_createur() then
    return 0;
  end if;
  with acceptees as (
    update neon_auth.invitation i set status = 'accepted'
    where lower(i.email) = v_email and i.status = 'pending'
      and i."organizationId" in (select e.id from public.equipes e)
    returning i."organizationId", coalesce(i.role, 'member') as role
  )
  insert into neon_auth.member ("organizationId", "userId", role, "createdAt")
  select distinct on (a."organizationId") a."organizationId", v_user, a.role, now() from acceptees a
  where not exists (select 1 from neon_auth.member m where m."organizationId" = a."organizationId" and m."userId" = v_user);
  get diagnostics v_nb = row_count;
  return v_nb;
end;
$$;
revoke all on function public.accepter_mes_invitations() from public;
grant execute on function public.accepter_mes_invitations() to authenticated;

notify pgrst, 'reload schema';
