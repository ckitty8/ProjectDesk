/* ============================================================
   Migration 045 — Ma ressource créée automatiquement
   ------------------------------------------------------------
   Demande du porteur (2026-10-31) : dès qu'un compte fait partie d'une équipe, sa fiche « ressource » doit exister,
   sans que personne ait à la créer à la main.
   Fonction appelée à chaque connexion (comme lier_ma_ressource, accepter_mes_invitations et appliquer_mes_roles_prevus) :
   si le compte n'a aucune fiche ressource mais est membre d'au moins une équipe de ProjectDesk, une fiche est créée
   (nom et email du compte, capacité par défaut) dans son équipe — la plus ancienne de ses appartenances, une équipe
   avant une Direction. Elle passe après lier_ma_ressource : une fiche déjà préparée avec le même email est reliée, jamais dupliquée.
   Migration de structure additive : une fonction, aucune donnée existante modifiée (règle n°8) ; aujourd'hui tous les
   comptes membres d'une équipe ont déjà leur fiche, la fonction ne crée donc rien tant qu'un nouveau compte n'arrive pas.
   ============================================================ */
create or replace function public.creer_ma_ressource()
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user   uuid := auth.user_id()::uuid;
  v_equipe uuid;
  v_nom    text;
  v_email  text;
  v_id     uuid;
begin
  if v_user is null then return null; end if;
  -- Déjà une fiche : rien à faire
  if exists (select 1 from public.ressources r where r.user_id = v_user::text) then return null; end if;
  -- Équipe : la plus ancienne appartenance, une équipe avant une Direction ; aucune équipe : pas de fiche
  select e.id into v_equipe
    from neon_auth.member m join public.equipes e on e.id = m."organizationId"
   where m."userId" = v_user
   order by (e.type = 'direction'), m."createdAt" limit 1;
  if v_equipe is null then return null; end if;
  select coalesce(nullif(u.name, ''), split_part(u.email, '@', 1)), lower(u.email) into v_nom, v_email
    from neon_auth."user" u where u.id = v_user;
  insert into public.ressources (equipe_id, nom, email, user_id) values (v_equipe, v_nom, v_email, v_user::text)
    returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.creer_ma_ressource() from public;
grant execute on function public.creer_ma_ressource() to authenticated;

notify pgrst, 'reload schema';
