/* ============================================================
   Migration 049 — Nom du compte de connexion modifiable avec la fiche de la personne
   ------------------------------------------------------------
   Demande du porteur (2026-11-02) : « modifie aussi le nom du compte de connexion ». Le nom affiché du compte (Neon Auth, table
   neon_auth."user", colonne name : bloc utilisateur de la barre latérale) suivait jusqu'ici l'inscription et ne pouvait pas être corrigé.
   Nouvelle fonction renommer_compte(fiche, nom) : copie le nom complet de la fiche dans le compte relié à cette fiche.
   - Mêmes droits que l'écriture de la fiche (règle de la table ressources, migration 031) : équipe de la personne ou administrateur,
     et droit « fiches_ressources » de la matrice ;
   - sans effet (renvoie 'sans_compte') si la fiche n'est pas encore reliée à un compte ;
   - ne modifie que name et updatedAt du compte (ni l'email, ni le rôle, ni le mot de passe).
   Aucune donnée existante modifiée à la création (règle n°8) : le nom d'un compte ne change que si une personne est modifiée dans l'application.
   ============================================================ */
create or replace function public.renommer_compte(p_ressource uuid, p_nom text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user   text;
  v_equipe uuid;
  v_nom    text := btrim(coalesce(p_nom, ''));
begin
  if v_nom = '' or length(v_nom) > 200 then raise exception 'Nom invalide'; end if;
  select r.user_id, r.equipe_id into v_user, v_equipe from public.ressources r where r.id = p_ressource;
  if not found then raise exception 'Fiche introuvable'; end if;
  -- Même règle que l'écriture de la fiche (migration 031)
  if not ((v_equipe in (select public.mes_equipes()) or public.est_admin()) and public.a_droit('fiches_ressources')) then
    raise exception 'Droit insuffisant' using errcode = '42501';
  end if;
  if v_user is null then return 'sans_compte'; end if;
  update neon_auth."user" set name = v_nom, "updatedAt" = now() where id::text = v_user;
  return 'applique';
end;
$$;
revoke all on function public.renommer_compte(uuid, text) from public;
grant execute on function public.renommer_compte(uuid, text) to authenticated;

notify pgrst, 'reload schema';
