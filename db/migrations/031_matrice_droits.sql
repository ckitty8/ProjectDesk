/* ============================================================
   Migration 031 — Matrice des droits réglable (Administration › Rôles)
   ------------------------------------------------------------
   Porteur (2026-10-13, « ok étape 2 ») : la matrice de la maquette docs/maquettes/roles-droits/ —
   pour chaque rôle d'accès (migration 030) et chaque droit, un niveau :
     oui      le rôle modifie (sur son périmètre : tout / sa direction / son équipe / ses projets / lui-même)
     lecture  le rôle voit sans modifier
     non      le rôle ne voit pas (écran masqué)
   La BASE applique « oui » : chaque règle d'écriture ci-dessous exige a_droit(<droit>). La lecture
   reste celle d'avant (tout membre lit tout), sauf le daily des équipes (droit daily_equipes).
   Le créateur a tous les droits (fixe). Administrateur × roles est bloqué sur « oui » (contrainte)
   pour qu'on ne puisse pas retirer à tous les administrateurs la main sur la matrice.
   Valeurs de départ : celles de la maquette, sauf nommer_admin = oui pour l'administrateur
   (décision du porteur du 2026-10-13 : « tout administrateur » nomme les administrateurs).
   Droits (clés fixes, chacune reliée à des règles ci-dessous ; libellés dans DROITS, config.js) :
     general, mon_dashboard, daily_equipes, conges_equipe, valider_timesheet, fiches_ressources,
     affecter, projets, piloter, administration, comptes, roles, nommer_admin
   Les règles sont modifiées par ALTER POLICY (même nom, aucune règle supprimée). Aucune donnée
   existante modifiée (règle n°8).
   ============================================================ */

create table public.droits_roles (
  role        text not null check (role in ('admin', 'direction', 'responsable', 'projet', 'utilisateur', 'lecture')),
  droit       text not null check (droit in ('general', 'mon_dashboard', 'daily_equipes', 'conges_equipe', 'valider_timesheet',
                'fiches_ressources', 'affecter', 'projets', 'piloter', 'administration', 'comptes', 'roles', 'nommer_admin')),
  niveau      text not null check (niveau in ('oui', 'lecture', 'non')),
  modifie_par text default auth.user_id(),
  modifie_le  timestamptz not null default now(),
  primary key (role, droit),
  -- Garde-fou : les administrateurs gardent toujours la main sur les rôles et la matrice
  constraint droits_roles_admin_garde check (not (role = 'admin' and droit = 'roles' and niveau <> 'oui'))
);

-- Valeurs de départ (maquette roles-droits) : une ligne par droit, colonnes dans l'ordre
-- admin, direction, responsable, projet, utilisateur, lecture
insert into public.droits_roles (role, droit, niveau)
select r.role, d.droit, d.niveaux[r.rang]
from (values
  ('general',           array['oui', 'oui', 'oui', 'oui', 'oui', 'oui']),
  ('mon_dashboard',     array['oui', 'oui', 'oui', 'oui', 'oui', 'non']),
  ('daily_equipes',     array['oui', 'oui', 'oui', 'oui', 'oui', 'non']),
  ('conges_equipe',     array['oui', 'oui', 'oui', 'lecture', 'non', 'non']),
  ('valider_timesheet', array['oui', 'oui', 'oui', 'non', 'non', 'non']),
  ('fiches_ressources', array['oui', 'oui', 'oui', 'non', 'non', 'non']),
  ('affecter',          array['oui', 'oui', 'oui', 'oui', 'non', 'non']),
  ('projets',           array['oui', 'oui', 'oui', 'oui', 'lecture', 'lecture']),
  ('piloter',           array['oui', 'oui', 'oui', 'oui', 'non', 'non']),
  ('administration',    array['oui', 'non', 'non', 'non', 'non', 'non']),
  ('comptes',           array['oui', 'non', 'non', 'non', 'non', 'non']),
  ('roles',             array['oui', 'non', 'non', 'non', 'non', 'non']),
  ('nommer_admin',      array['oui', 'non', 'non', 'non', 'non', 'non'])
) as d(droit, niveaux)
cross join (values ('admin', 1), ('direction', 2), ('responsable', 3), ('projet', 4), ('utilisateur', 5), ('lecture', 6)) as r(role, rang);

/* Rôle d'accès du compte connecté (même règle que roleDeLaFiche, etat.js) : celui déclaré sur sa
   fiche (roles_acces), sinon administrateur, responsable (responsables_equipe ou admin / owner d'une
   équipe), sinon utilisateur. Le créateur est traité à part par niveau_droit. */
create or replace function public.mon_role()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select ra.role from public.roles_acces ra join public.ressources r on r.id = ra.ressource_id
      where r.user_id = auth.user_id()
      order by array_position(array['admin', 'direction', 'responsable', 'projet', 'utilisateur', 'lecture'], ra.role) limit 1),
    case
      when exists (select 1 from public.administrateurs a where a.user_id = auth.user_id()) then 'admin'
      when exists (select 1 from public.responsables_equipe x join public.ressources r on r.id = x.ressource_id
                   where r.user_id = auth.user_id())
        or exists (select 1 from neon_auth.member m join public.equipes e on e.id = m."organizationId"
                   where m."userId"::text = auth.user_id() and m.role in ('owner', 'admin')) then 'responsable'
      else 'utilisateur'
    end)
$$;

-- Niveau d'un droit pour le compte connecté : 'oui' pour le créateur, sinon celui de la matrice
create or replace function public.niveau_droit(p_droit text)
returns text language sql stable security definer set search_path = '' as $$
  select case when public.est_createur() then 'oui'
    else coalesce((select d.niveau from public.droits_roles d where d.role = public.mon_role() and d.droit = p_droit), 'non') end
$$;
-- Le compte connecté peut-il MODIFIER au titre de ce droit ?
create or replace function public.a_droit(p_droit text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.niveau_droit(p_droit) = 'oui'
$$;
revoke all on function public.mon_role(), public.niveau_droit(text), public.a_droit(text) from public;
grant execute on function public.mon_role(), public.niveau_droit(text), public.a_droit(text) to authenticated;

-- La matrice : lue par tout utilisateur connecté (menus), modifiée au titre du droit « roles »
grant select, update on public.droits_roles to authenticated;
revoke all on public.droits_roles from anonymous;
alter table public.droits_roles enable row level security;
create policy "Lecture : utilisateurs connectés" on public.droits_roles for select to authenticated using (true);
create policy "Modification : droit Rôles" on public.droits_roles for update to authenticated
  using (public.est_admin() and public.a_droit('roles')) with check (public.est_admin() and public.a_droit('roles'));

/* ---------- Règles d'écriture : chacune exige son droit ---------- */
-- Mon dashboard (ses congés, ses heures, sa feuille, son daily) ; les autres de l'équipe : droit propre
alter policy "Écriture : personne ou équipe" on public.absences
  using ((ressource_id in (select public.mes_ressources()) and public.a_droit('mon_dashboard'))
      or (ressource_id in (select r.id from public.ressources r where r.equipe_id in (select public.mes_equipes())) and public.a_droit('conges_equipe')))
  with check ((ressource_id in (select public.mes_ressources()) and public.a_droit('mon_dashboard'))
      or (ressource_id in (select r.id from public.ressources r where r.equipe_id in (select public.mes_equipes())) and public.a_droit('conges_equipe')));
alter policy "Écriture : personne ou équipe" on public.temps_saisis
  using ((ressource_id in (select public.mes_ressources()) and public.a_droit('mon_dashboard'))
      or (ressource_id in (select r.id from public.ressources r where r.equipe_id in (select public.mes_equipes())) and public.a_droit('valider_timesheet')))
  with check ((ressource_id in (select public.mes_ressources()) and public.a_droit('mon_dashboard'))
      or (ressource_id in (select r.id from public.ressources r where r.equipe_id in (select public.mes_equipes())) and public.a_droit('valider_timesheet')));
alter policy "Écriture : personne ou équipe" on public.feuilles_temps
  using ((ressource_id in (select public.mes_ressources()) and public.a_droit('mon_dashboard'))
      or (ressource_id in (select r.id from public.ressources r where r.equipe_id in (select public.mes_equipes())) and public.a_droit('valider_timesheet')))
  with check ((ressource_id in (select public.mes_ressources()) and public.a_droit('mon_dashboard'))
      or (ressource_id in (select r.id from public.ressources r where r.equipe_id in (select public.mes_equipes())) and public.a_droit('valider_timesheet')));
alter policy "Création : auteur" on public.notes_daily_projet
  with check (user_id = auth.user_id() and not public.est_lecture_seule() and public.a_droit('mon_dashboard'));
alter policy "Modification : auteur" on public.notes_daily_projet
  using (user_id = auth.user_id() and not public.est_lecture_seule() and public.a_droit('mon_dashboard'))
  with check (user_id = auth.user_id() and not public.est_lecture_seule() and public.a_droit('mon_dashboard'));
alter policy "Suppression : auteur" on public.notes_daily_projet
  using (user_id = auth.user_id() and not public.est_lecture_seule() and public.a_droit('mon_dashboard'));
-- Daily des équipes : lu au titre du droit daily_equipes (le sien, toujours)
alter policy "Lecture : auteur, projet, responsables, administrateurs" on public.notes_daily_projet
  using (user_id = auth.user_id() or (public.peut_lire_daily_projet(projet_id) and public.niveau_droit('daily_equipes') <> 'non'));

-- Congés & capacité de l'équipe (objectif de jours travaillés)
alter policy "Écriture : administrateurs ou responsables de l'équipe" on public.objectifs_jours_travail
  using ((public.est_admin() or public.est_responsable_equipe(equipe_id)) and public.a_droit('conges_equipe'))
  with check ((public.est_admin() or public.est_responsable_equipe(equipe_id)) and public.a_droit('conges_equipe'));
-- Fiches des personnes
alter policy "Écriture : équipe" on public.ressources
  using (((equipe_id in (select public.mes_equipes())) or public.est_admin()) and public.a_droit('fiches_ressources'))
  with check (((equipe_id in (select public.mes_equipes())) or public.est_admin()) and public.a_droit('fiches_ressources'));
-- Affecter des personnes aux projets
alter policy "Écriture : projet" on public.affectations
  using (public.peut_editer_projet(projet_id) and public.a_droit('affecter'))
  with check (public.peut_editer_projet(projet_id) and public.a_droit('affecter'));
-- Projets, roadmap (objectifs), sprints, capacité
alter policy "Création : équipe" on public.projets
  with check (equipe_id in (select public.mes_equipes()) and public.a_droit('projets'));
alter policy "Suppression : équipe" on public.projets
  using (equipe_id in (select public.mes_equipes()) and public.a_droit('projets'));
alter policy "Modification : projet" on public.projets
  using (public.peut_editer_projet(id) and public.a_droit('projets'))
  with check (public.peut_editer_projet(id) and public.a_droit('projets'));
alter policy "Écriture : équipe" on public.objectifs
  using (equipe_id in (select public.mes_equipes()) and public.a_droit('projets'))
  with check (equipe_id in (select public.mes_equipes()) and public.a_droit('projets'));
alter policy "Écriture : équipe" on public.resultats_cles
  using (objectif_id in (select o.id from public.objectifs o where o.equipe_id in (select public.mes_equipes())) and public.a_droit('projets'))
  with check (objectif_id in (select o.id from public.objectifs o where o.equipe_id in (select public.mes_equipes())) and public.a_droit('projets'));
alter policy "Écriture : éditeurs du projet ou administrateurs" on public.sprints_projet
  using ((public.est_admin() or public.peut_editer_projet(projet_id)) and public.a_droit('projets'))
  with check ((public.est_admin() or public.peut_editer_projet(projet_id)) and public.a_droit('projets'));
alter policy "Écriture : éditeurs du projet ou administrateurs" on public.repartitions_sprint
  using ((public.est_admin() or public.peut_editer_projet(projet_id)) and public.a_droit('projets'))
  with check ((public.est_admin() or public.peut_editer_projet(projet_id)) and public.a_droit('projets'));
-- Piloter un projet : plan de charge, types de tâche, envoi du daily
alter policy "Écriture : chef, responsables, administrateurs" on public.envois_daily_projet
  using (public.peut_gerer_envoi_projet(projet_id) and public.a_droit('piloter'))
  with check (public.peut_gerer_envoi_projet(projet_id) and public.a_droit('piloter'));
alter policy "Écriture : chef, responsables, administrateurs" on public.previsions_temps
  using (public.peut_gerer_envoi_projet(projet_id) and public.a_droit('piloter'))
  with check (public.peut_gerer_envoi_projet(projet_id) and public.a_droit('piloter'));
alter policy "Écriture : chef, responsables, administrateurs" on public.types_tache_projet
  using (public.peut_gerer_envoi_projet(projet_id) and public.a_droit('piloter'))
  with check (public.peut_gerer_envoi_projet(projet_id) and public.a_droit('piloter'));
-- Administration : équipes, référentiels, jours fériés
alter policy "Écriture : administrateurs" on public.equipes
  using (public.est_admin() and public.a_droit('administration')) with check (public.est_admin() and public.a_droit('administration'));
alter policy "Écriture : administrateurs" on public.referentiels
  using (public.est_admin() and public.a_droit('administration')) with check (public.est_admin() and public.a_droit('administration'));
alter policy "Écriture : administrateurs" on public.valeurs_referentiel
  using (public.est_admin() and public.a_droit('administration')) with check (public.est_admin() and public.a_droit('administration'));
alter policy "Écriture : administrateurs" on public.jours_feries
  using (public.est_admin() and public.a_droit('administration')) with check (public.est_admin() and public.a_droit('administration'));
-- Comptes en attente (écartés)
alter policy "Administrateurs seulement" on public.comptes_ignores
  using (public.est_admin() and public.a_droit('comptes')) with check (public.est_admin() and public.a_droit('comptes'));
-- Rôles : responsables d'équipe en direct, administrateurs (nommer / retirer)
alter policy "Écriture : administrateurs ou responsables de l'équipe" on public.responsables_equipe
  using ((public.est_admin() or public.est_responsable_equipe(equipe_id)) and public.a_droit('roles'))
  with check ((public.est_admin() or public.est_responsable_equipe(equipe_id)) and public.a_droit('roles'));
alter policy "Écriture : administrateurs" on public.administrateurs
  using (public.est_admin() and public.a_droit('nommer_admin')) with check (public.est_admin() and public.a_droit('nommer_admin'));

-- Affecter un rôle : droit « roles » ; nommer ou retirer un administrateur : droit « nommer_admin »
create or replace function public.affecter_role(p_ressource uuid, p_role text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  v_admin_avant boolean;
begin
  if not (public.est_admin() and public.a_droit('roles')) then
    raise exception 'Réservé aux administrateurs (droit « Rôles »)' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'direction', 'responsable', 'projet', 'utilisateur', 'lecture') then
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

notify pgrst, 'reload schema';
