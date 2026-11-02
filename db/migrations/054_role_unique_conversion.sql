/* ============================================================
   Migration 054 — Rôle unique, étapes 3 et 4 : conversion des 9 fiches et règles de la base — docs/specifications/role-unique.md § 3 et § 4
   ------------------------------------------------------------
   Demande du porteur (2026-11-02) : un seul « Rôle » par personne (Direction, Responsable d'équipe, Chef de projet, Membre, Utilisateur, Lecture seule)
   à la place du rôle d'accès + du rôle projet ; accord explicite : « oui, lance la conversion des 9 fiches » (tableau du § 3).
   1. Fonctions de rôle : affecter_role et appliquer_role acceptent « chef » et « membre » ; « projet » n'est plus attribuable. Chef de projet et Membre
      donnent des droits : comme Direction et Responsable, ils s'appliquent à un compte relié dont l'email est vérifié, sinon ils restent « prévus ».
   2. Conversion des données (5 lignes de rôles écrites, aucune autre donnée touchée) :
        Christelle LABBE (rôle d'accès enregistré « projet »)  → « chef »          (roles_acces)
        Thomas LELIEVRE (rôle prévu « projet »)                → « chef »          (roles_prevus)
        Cerine KERARMA (compte), Nouha BENJELBEN, Lenaic HOUSSOU → « membre » prévu (roles_prevus : sans rôle enregistré jusqu'ici)
      Inchangés : Paul SHERRAT (Direction), Anne CASELLI et Dina BELMAHJOUB (Responsable d'équipe, prévu), 2e fiche « Cerine Kerarma » (Utilisateur par défaut).
   3. Règles de la base : le rôle de la PERSONNE remplace le rôle par projet de l'affectation.
        sprints_projet, mises_en_production, repartitions_sprint : peut_saisir_projet (Chef de projet ou Membre affecté, chef désigné, gestionnaire de l'unité, administrateur) ;
        projets (modification, suppression) et affectations : peut_gerer_projet (Chef de projet affecté ou chef désigné du projet, gestionnaire de l'unité, administrateur) ;
        envoi du daily (peut_gerer_envoi_projet) : chef désigné, Chef de projet affecté, responsables de l'unité du projet ou parente, administrateur.
      peut_editer_projet, remplacée, est supprimée. La colonne affectations.role reste (valeur par défaut « Membre », retrouvée par sa clé) jusqu'au nettoyage.
   Comptages attendus : roles_acces direction 1 + chef 1 ; roles_prevus responsable 2 + chef 1 + membre 3 ; autres tables identiques.
   ============================================================ */

-- 1. Fonctions de rôle
create or replace function public.affecter_role(p_ressource uuid, p_role text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_admin_avant boolean;
begin
  if not (public.est_admin() and public.a_droit('roles')) then
    raise exception 'Réservé aux administrateurs (droit « Rôles »)' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'direction', 'responsable', 'chef', 'membre', 'utilisateur', 'lecture') then
    raise exception 'Rôle inconnu : %', p_role;
  end if;
  select exists (select 1 from public.administrateurs a join public.ressources r on r.user_id = a.user_id where r.id = p_ressource)
    into v_admin_avant;
  if (p_role = 'admin' or v_admin_avant) and not public.a_droit('nommer_admin') then
    raise exception 'Nommer ou retirer un administrateur : droit « Nommer un administrateur » requis' using errcode = '42501';
  end if;
  return public.appliquer_role(p_ressource, p_role);
end;
$$;

create or replace function public.appliquer_role(p_ressource uuid, p_role text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_user      text;
  v_equipe    uuid;
  v_parent    uuid;
  v_verifie   boolean;
  v_membre    boolean;
  v_privilege boolean := p_role in ('admin', 'direction', 'responsable', 'chef', 'membre');
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
    -- Ancien rôle « admin » : ajoute encore le statut d'administrateur ; les autres rôles n'y touchent plus (cumul, migration 046)
    if p_role = 'admin' then
      insert into public.administrateurs (user_id) select v_user
        where not exists (select 1 from public.administrateurs a where a.user_id = v_user);
    end if;
    -- Rôle dans l'organisation de son équipe : admin (valide les timesheets) pour Responsable et Direction
    select exists (select 1 from neon_auth.member m where m."organizationId" = v_equipe and m."userId"::text = v_user) into v_membre;
    update neon_auth.member m set role = case when p_role in ('responsable', 'direction') then 'admin' else 'member' end
      where m."organizationId" = v_equipe and m."userId"::text = v_user and m.role <> 'owner';
  end if;

  insert into public.roles_acces (ressource_id, role) values (p_ressource, p_role)
    on conflict (ressource_id) do update set role = excluded.role, cree_par = auth.user_id(), cree_le = now();

  if p_role in ('responsable', 'direction') and v_user is not null and not v_membre then
    insert into public.roles_prevus (ressource_id, role) values (p_ressource, p_role)
      on conflict (ressource_id) do update set role = excluded.role, cree_le = now();
    return 'prevu';
  end if;
  delete from public.roles_prevus where ressource_id = p_ressource;
  return 'applique';
end;
$$;

-- 2. Conversion des 9 fiches (tableau du § 3 de la spécification)
update public.roles_acces set role = 'chef' where role = 'projet';
update public.roles_prevus set role = 'chef' where role = 'projet';
insert into public.roles_prevus (ressource_id, role)
  select r.id, 'membre' from public.ressources r
   where r.nom in ('Nouha BENJELBEN', 'Lenaic HOUSSOU') or (r.nom = 'Cerine KERARMA' and r.user_id is not null)
  on conflict (ressource_id) do nothing;

-- 3. Règles de la base fondées sur le rôle de la personne
-- peut_saisir_projet (052) reprend aussi peut_gerer_projet : le Chef de projet désigné sur la fiche du projet saisit lui aussi ses sprints et MEP
create or replace function public.peut_saisir_projet(p_projet uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.peut_gerer_projet(p_projet)
      or (public.mon_role() in ('chef', 'membre')
          and exists (select 1 from public.affectations a where a.projet_id = p_projet and a.ressource_id in (select public.mes_ressources())))
$$;

create or replace function public.peut_gerer_envoi_projet(p_projet uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.est_admin()
    or exists (select 1 from public.projets p where p.id = p_projet and p.chef_id in (select public.mes_ressources()))
    or (public.mon_role() = 'chef'
        and exists (select 1 from public.affectations a where a.projet_id = p_projet and a.ressource_id in (select public.mes_ressources())))
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

alter policy "Écriture : éditeurs du projet ou administrateurs" on public.sprints_projet
  using (public.peut_saisir_projet(projet_id) and public.a_droit('projets'))
  with check (public.peut_saisir_projet(projet_id) and public.a_droit('projets'));
alter policy "Écriture : éditeurs du projet ou administrateurs" on public.mises_en_production
  using (public.peut_saisir_projet(projet_id) and public.a_droit('projets'))
  with check (public.peut_saisir_projet(projet_id) and public.a_droit('projets'));
alter policy "Écriture : éditeurs du projet ou administrateurs" on public.repartitions_sprint
  using (public.peut_saisir_projet(projet_id) and public.a_droit('projets'))
  with check (public.peut_saisir_projet(projet_id) and public.a_droit('projets'));
alter policy "Modification : projet" on public.projets
  using (public.peut_gerer_projet(id) and public.a_droit('projets'))
  with check (public.peut_gerer_projet(id) and public.a_droit('projets'));
alter policy "Suppression : équipe" on public.projets
  using (public.peut_gerer_projet(id) and public.a_droit('projets'));
alter policy "Écriture : projet" on public.affectations
  using (public.peut_gerer_projet(projet_id) and public.a_droit('affecter'))
  with check (public.peut_gerer_projet(projet_id) and public.a_droit('affecter'));

drop function public.peut_editer_projet(uuid);

notify pgrst, 'reload schema';
