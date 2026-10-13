/* ============================================================
   Migration 030 — Les six rôles d'accès de « Rôles et droits »
   ------------------------------------------------------------
   Porteur (2026-10-13, « ok étape 1 ») : la liste des rôles d'Administration › Rôles reprend les
   rôles de la maquette docs/maquettes/roles-droits/ (le Créateur reste à part, unique) :
     admin        Administrateur  → table administrateurs (inchangé)
     direction    Direction       → responsable de sa direction (unité parente de son équipe) et
                                    donc de ses équipes ; sans direction : de son équipe
     responsable  Responsable     → responsable de son équipe (inchangé)
     projet       Projet          → droits de chef de projet sur les projets où il est affecté
     utilisateur  Utilisateur     → membre (ex « membre ») : son daily, ses heures, ses congés
     lecture      Lecture seule   → consulte ; la base refuse toute écriture (équipe, ses données, daily)
   Chaque rôle s'appuie sur les mécanismes existants (responsables_equipe, rôle dans
   l'organisation, administrateurs, affectations) ; le rôle déclaré est gardé dans roles_acces.
   Sécurité :
   - un rôle qui DONNE des droits (admin, direction, responsable, projet) n'est appliqué qu'à un
     compte relié dont l'email est vérifié, sinon il est « prévu » (roles_prevus, migration 029) —
     corrige aussi la 029, qui inscrivait le responsable avant cette vérification ;
   - un rôle qui RESTREINT (utilisateur, lecture) s'applique tout de suite.
   - Lecture seule : mes_equipes() et mes_ressources() (droits d'écriture) sont vides pour elle ;
     la lecture passe par est_membre_equipe(), réécrite sans mes_equipes() (même résultat).
   Additif : une table, des fonctions remplacées, trois règles du daily recréées. Aucune donnée
   existante modifiée (règle n°8) ; roles_prevus est vide (sa contrainte est élargie).
   ============================================================ */

-- Rôle d'accès déclaré de chaque fiche (appliqué). Sans ligne : rôle déduit (administrateur,
-- responsable ou utilisateur), comme avant.
create table public.roles_acces (
  ressource_id  uuid primary key references public.ressources(id) on delete cascade,
  role          text not null check (role in ('admin', 'direction', 'responsable', 'projet', 'utilisateur', 'lecture')),
  cree_par      text default auth.user_id(),
  cree_le       timestamptz not null default now()
);
grant select on public.roles_acces to authenticated;
revoke all on public.roles_acces from anonymous;
alter table public.roles_acces enable row level security;
create policy "Lecture : utilisateurs connectés" on public.roles_acces for select to authenticated using (true);

alter table public.roles_prevus drop constraint roles_prevus_role_check;
alter table public.roles_prevus add constraint roles_prevus_role_check
  check (role in ('admin', 'direction', 'responsable', 'projet', 'utilisateur', 'lecture'));

-- Le compte connecté est-il en « Lecture seule » ? (jamais le créateur)
create or replace function public.est_lecture_seule()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.roles_acces ra join public.ressources r on r.id = ra.ressource_id
                 where r.user_id = auth.user_id() and ra.role = 'lecture')
     and not exists (select 1 from public.createur c where c.user_id = auth.user_id())
$$;
revoke all on function public.est_lecture_seule() from public;
grant execute on function public.est_lecture_seule() to authenticated;

-- Lecture : membre d'une équipe de ProjectDesk, ou créateur (même résultat qu'avant, sans mes_equipes)
create or replace function public.est_membre_equipe()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.equipes e join neon_auth.member m on m."organizationId" = e.id
                 where m."userId"::text = auth.user_id())
      or public.est_createur()
$$;

-- Écriture : mes équipes et mes fiches, vides pour un compte en Lecture seule
create or replace function public.mes_equipes()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select e.id from public.equipes e
  join neon_auth.member m on m."organizationId" = e.id
  where m."userId"::text = auth.user_id() and not public.est_lecture_seule()
  union
  select e.id from public.equipes e where public.est_createur()
$$;
create or replace function public.mes_ressources()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select r.id from public.ressources r where r.user_id = auth.user_id() and not public.est_lecture_seule()
$$;

-- Daily : on n'écrit pas son daily en Lecture seule
drop policy "Création : auteur" on public.notes_daily_projet;
drop policy "Modification : auteur" on public.notes_daily_projet;
drop policy "Suppression : auteur" on public.notes_daily_projet;
create policy "Création : auteur" on public.notes_daily_projet for insert to authenticated
  with check (user_id = auth.user_id() and not public.est_lecture_seule());
create policy "Modification : auteur" on public.notes_daily_projet for update to authenticated
  using (user_id = auth.user_id() and not public.est_lecture_seule())
  with check (user_id = auth.user_id() and not public.est_lecture_seule());
create policy "Suppression : auteur" on public.notes_daily_projet for delete to authenticated
  using (user_id = auth.user_id() and not public.est_lecture_seule());

/* Piloter un projet (envoi du daily, plan de charge, types de tâche) : administrateur, chef du
   projet, rôle « Projet » affecté au projet (hors Lecteur), responsable de l'unité ou d'une unité
   parente. Reprend la migration 028 et ajoute le rôle « Projet ». */
create or replace function public.peut_gerer_envoi_projet(p_projet uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.est_admin()
    or exists (select 1 from public.projets p where p.id = p_projet and p.chef_id in (select public.mes_ressources()))
    or exists (select 1 from public.affectations a join public.valeurs_referentiel v on v.referentiel_id = 'role' and v.cle = 'chef'
               where a.projet_id = p_projet and a.role = v.libelle and a.ressource_id in (select public.mes_ressources()))
    or exists (select 1 from public.affectations a join public.roles_acces ra on ra.ressource_id = a.ressource_id and ra.role = 'projet'
               where a.projet_id = p_projet and a.ressource_id in (select public.mes_ressources())
                 and a.role not in (select v.libelle from public.valeurs_referentiel v where v.referentiel_id = 'role' and v.cle = 'lecteur'))
    or exists (
      with recursive chaine as (
        select e.id, e.parent_id
          from public.equipes e join public.projets p on p.equipe_id = e.id where p.id = p_projet
        union
        select e.id, e.parent_id
          from public.equipes e join chaine c on e.id = c.parent_id)
      select 1 from chaine
      where exists (select 1 from public.responsables_equipe x
                    where x.equipe_id = chaine.id and x.ressource_id in (select public.mes_ressources()))
         or public.est_responsable_equipe(chaine.id))
$$;

/* Applique un rôle à une fiche (interne). Renvoie 'applique', ou 'prevu' si un rôle qui donne des
   droits attend la connexion de la personne (pas de compte, email non vérifié, ou responsable pas
   encore membre de l'organisation de son équipe). */
create or replace function public.appliquer_role(p_ressource uuid, p_role text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user      text;
  v_equipe    uuid;
  v_parent    uuid;
  v_verifie   boolean;
  v_membre    boolean;
  v_privilege boolean := p_role in ('admin', 'direction', 'responsable', 'projet');
begin
  select r.user_id, r.equipe_id, e.parent_id into v_user, v_equipe, v_parent
    from public.ressources r join public.equipes e on e.id = r.equipe_id where r.id = p_ressource;
  if not found then raise exception 'Fiche introuvable'; end if;
  select u."emailVerified" into v_verifie from neon_auth."user" u where u.id::text = v_user;

  -- Rôle qui donne des droits : seulement à un compte relié, email vérifié
  if v_privilege and (v_user is null or v_verifie is not true) then
    insert into public.roles_prevus (ressource_id, role) values (p_ressource, p_role)
      on conflict (ressource_id) do update set role = excluded.role, cree_par = auth.user_id(), cree_le = now();
    return 'prevu';
  end if;

  -- Responsabilités : un seul rôle à la fois (équipe pour Responsable, direction pour Direction)
  delete from public.responsables_equipe where ressource_id = p_ressource;
  if p_role = 'responsable' then
    insert into public.responsables_equipe (equipe_id, ressource_id) values (v_equipe, p_ressource);
  elsif p_role = 'direction' then
    insert into public.responsables_equipe (equipe_id, ressource_id) values (coalesce(v_parent, v_equipe), p_ressource);
  end if;

  if v_user is not null then
    if p_role = 'admin' then
      insert into public.administrateurs (user_id) select v_user
        where not exists (select 1 from public.administrateurs a where a.user_id = v_user);
    else
      delete from public.administrateurs where user_id = v_user;
    end if;
    -- Rôle dans l'organisation de son équipe : admin (valide les timesheets) pour Responsable et Direction
    select exists (select 1 from neon_auth.member m where m."organizationId" = v_equipe and m."userId"::text = v_user) into v_membre;
    update neon_auth.member m set role = case when p_role in ('responsable', 'direction') then 'admin' else 'member' end
      where m."organizationId" = v_equipe and m."userId"::text = v_user and m.role <> 'owner';
  end if;

  insert into public.roles_acces (ressource_id, role) values (p_ressource, p_role)
    on conflict (ressource_id) do update set role = excluded.role, cree_par = auth.user_id(), cree_le = now();

  -- Responsable ou Direction pas encore membre de l'organisation : rôle d'organisation à sa connexion
  if p_role in ('responsable', 'direction') and v_user is not null and not v_membre then
    insert into public.roles_prevus (ressource_id, role) values (p_ressource, p_role)
      on conflict (ressource_id) do update set role = excluded.role, cree_le = now();
    return 'prevu';
  end if;
  delete from public.roles_prevus where ressource_id = p_ressource;
  return 'applique';
end;
$$;
revoke all on function public.appliquer_role(uuid, text) from public;

create or replace function public.affecter_role(p_ressource uuid, p_role text)
returns text language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.est_admin() then raise exception 'Réservé aux administrateurs' using errcode = '42501'; end if;
  if p_role not in ('admin', 'direction', 'responsable', 'projet', 'utilisateur', 'lecture') then
    raise exception 'Rôle inconnu : %', p_role;
  end if;
  return public.appliquer_role(p_ressource, p_role);
end;
$$;

notify pgrst, 'reload schema';
