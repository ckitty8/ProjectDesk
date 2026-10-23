/* ============================================================
   Migration 042 — Périmètre de lecture et de modification par rôle
   ------------------------------------------------------------
   Porteur (2026-10-23) : « Thomas n'est pas affecté au projet CDO mais il peut paramétrer des
   sprints, il voit les éléments CDO ; le responsable d'une équipe ne peut pas voir les éléments
   d'une autre équipe ». Constats :
   - LECTURE : les règles de lecture reposaient sur est_membre_equipe(), qui répond « oui » dès
     qu'on est membre d'UNE équipe : chacun lisait les projets, personnes, absences et temps de
     toutes les équipes. Les périmètres de la matrice (config.js, PERIMETRES) n'étaient pas appliqués.
   - MODIFICATION : peut_editer_projet acceptait tout membre de l'équipe du projet, affecté ou non.

   Règle appliquée (validée par le porteur) :
   - Administrateur et créateur : tout.
   - Direction / Responsable : leur unité (responsables_equipe, ou rôle owner / admin de
     l'organisation) et ses sous-unités ; ils modifient les projets de ces unités.
   - Projet / Utilisateur : eux-mêmes, leurs projets et les personnes de ces projets ; ils ne
     modifient que les projets où ils sont affectés Chef de projet ou Membre.
   - Les heures saisies et les feuilles de temps : la personne et ceux qui gèrent son unité.
   - Un rattachement (membres_equipe, migration 033) ne donne aucun droit supplémentaire ;
     il permet seulement au responsable de l'unité d'accueil de voir la fiche et les absences.

   Additif : fonctions créées ou remplacées, règles de lecture remplacées. Aucune donnée modifiée
   (règle n°8). Les équipes, référentiels, droits, jours fériés restent lisibles par tous.
   ============================================================ */

-- Fiches (ressources) liées au compte connecté, y compris en lecture seule (lecture seulement)
create or replace function public.mes_fiches()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select r.id from public.ressources r where r.user_id = auth.user_id()
$$;

/* Unités que je gère : celles dont je suis responsable (table responsables_equipe) ou owner / admin
   de l'organisation, avec toutes leurs sous-unités ; l'administrateur et le créateur les gèrent toutes. */
create or replace function public.mes_unites_gerees()
returns setof uuid language sql stable security definer set search_path = '' as $$
  with recursive depart as (
    select e.id from public.equipes e where public.est_admin()
    union
    select x.equipe_id from public.responsables_equipe x where x.ressource_id in (select public.mes_fiches())
    union
    select m."organizationId" from neon_auth.member m
     where m."userId"::text = auth.user_id() and m.role in ('owner', 'admin')
  ), arbre as (
    select id from depart
    union
    select e.id from public.equipes e join arbre a on e.parent_id = a.id
  )
  select id from arbre
$$;

-- Puis-je LIRE ce projet ? : tout (administrateur), projet d'une unité que je gère, projet où je suis chef ou affecté
create or replace function public.peut_voir_projet(p_projet uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.est_admin()
      or exists (select 1 from public.projets p
                 where p.id = p_projet
                   and (p.equipe_id in (select public.mes_unites_gerees()) or p.chef_id in (select public.mes_fiches())))
      or exists (select 1 from public.affectations a
                 where a.projet_id = p_projet and a.ressource_id in (select public.mes_fiches()))
$$;

-- Puis-je LIRE cette personne ? : moi, une personne d'une unité que je gère, un rattaché à une de ces unités,
-- ou une personne affectée à l'un de MES projets
create or replace function public.peut_voir_ressource(p_ressource uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.est_admin()
      or p_ressource in (select public.mes_fiches())
      or exists (select 1 from public.ressources r
                 where r.id = p_ressource and r.equipe_id in (select public.mes_unites_gerees()))
      or exists (select 1 from public.membres_equipe m
                 where m.ressource_id = p_ressource and m.equipe_id in (select public.mes_unites_gerees()))
      or exists (select 1 from public.affectations a join public.affectations b on b.projet_id = a.projet_id
                 where a.ressource_id = p_ressource and b.ressource_id in (select public.mes_fiches()))
$$;

-- Puis-je LIRE les heures et feuilles de temps de cette personne ? : moi, ou l'unité que je gère (pas les collègues de projet)
create or replace function public.peut_voir_temps(p_ressource uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.est_admin()
      or p_ressource in (select public.mes_fiches())
      or exists (select 1 from public.ressources r
                 where r.id = p_ressource and r.equipe_id in (select public.mes_unites_gerees()))
$$;

-- Puis-je LIRE les objectifs de cette unité ? : unité que je gère ou unité de ma fiche
create or replace function public.peut_voir_equipe(p_equipe uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.est_admin()
      or p_equipe in (select public.mes_unites_gerees())
      or p_equipe in (select r.equipe_id from public.ressources r where r.id in (select public.mes_fiches()))
$$;

revoke all on function public.mes_fiches(), public.mes_unites_gerees(), public.peut_voir_projet(uuid),
  public.peut_voir_ressource(uuid), public.peut_voir_temps(uuid), public.peut_voir_equipe(uuid) from public;
grant execute on function public.mes_fiches(), public.mes_unites_gerees(), public.peut_voir_projet(uuid),
  public.peut_voir_ressource(uuid), public.peut_voir_temps(uuid), public.peut_voir_equipe(uuid) to authenticated;

/* Modifier un projet : administrateur ; responsable ou direction des projets de son unité (pas en lecture
   seule) ; personne affectée Chef de projet ou Membre. Un simple membre de l'équipe n'y est plus autorisé.
   Les niveaux de la matrice (a_droit) restent exigés par chaque règle d'écriture. */
create or replace function public.peut_editer_projet(p_projet uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.est_admin()
      or (not public.est_lecture_seule()
          and exists (select 1 from public.projets p
                      where p.id = p_projet and p.equipe_id in (select public.mes_unites_gerees())))
      or exists (select 1 from public.affectations a
                 where a.projet_id = p_projet
                   and a.role in (select v.libelle from public.valeurs_referentiel v
                                  where v.referentiel_id = 'role' and v.cle in ('chef', 'membre'))
                   and a.ressource_id in (select public.mes_ressources()))
$$;

/* Règles de lecture : remplacent « Lecture : membres ou administrateurs » (est_membre_equipe() or est_admin()) */
drop policy "Lecture : membres ou administrateurs" on public.projets;
create policy "Lecture : périmètre du rôle" on public.projets for select to authenticated
  using (public.peut_voir_projet(id));

drop policy "Lecture : membres ou administrateurs" on public.affectations;
create policy "Lecture : périmètre du rôle" on public.affectations for select to authenticated
  using (public.peut_voir_projet(projet_id));

drop policy "Lecture : membres ou administrateurs" on public.ressources;
create policy "Lecture : périmètre du rôle" on public.ressources for select to authenticated
  using (public.peut_voir_ressource(id));

drop policy "Lecture : membres ou administrateurs" on public.absences;
create policy "Lecture : périmètre du rôle" on public.absences for select to authenticated
  using (public.peut_voir_ressource(ressource_id));

drop policy "Lecture : membres ou administrateurs" on public.temps_saisis;
create policy "Lecture : périmètre du rôle" on public.temps_saisis for select to authenticated
  using (public.peut_voir_temps(ressource_id));

drop policy "Lecture : membres ou administrateurs" on public.feuilles_temps;
create policy "Lecture : périmètre du rôle" on public.feuilles_temps for select to authenticated
  using (public.peut_voir_temps(ressource_id));

-- Tables rattachées à un projet
drop policy "Lecture : membres ou administrateurs" on public.sprints_projet;
create policy "Lecture : périmètre du rôle" on public.sprints_projet for select to authenticated
  using (public.peut_voir_projet(projet_id));

drop policy "Lecture : membres ou administrateurs" on public.repartitions_sprint;
create policy "Lecture : périmètre du rôle" on public.repartitions_sprint for select to authenticated
  using (public.peut_voir_projet(projet_id));

drop policy "Lecture : membres ou administrateurs" on public.mises_en_production;
create policy "Lecture : périmètre du rôle" on public.mises_en_production for select to authenticated
  using (public.peut_voir_projet(projet_id));

drop policy "Lecture : membres ou administrateurs" on public.envois_daily_projet;
create policy "Lecture : périmètre du rôle" on public.envois_daily_projet for select to authenticated
  using (public.peut_voir_projet(projet_id));

drop policy "Lecture : membres ou administrateurs" on public.previsions_temps;
create policy "Lecture : périmètre du rôle" on public.previsions_temps for select to authenticated
  using (public.peut_voir_projet(projet_id));

drop policy "Lecture : membres ou administrateurs" on public.types_tache_projet;
create policy "Lecture : périmètre du rôle" on public.types_tache_projet for select to authenticated
  using (public.peut_voir_projet(projet_id));

-- Tables rattachées à une unité
drop policy "Lecture : membres ou administrateurs" on public.objectifs;
create policy "Lecture : périmètre du rôle" on public.objectifs for select to authenticated
  using (public.peut_voir_equipe(equipe_id));

drop policy "Lecture : membres ou administrateurs" on public.resultats_cles;
create policy "Lecture : périmètre du rôle" on public.resultats_cles for select to authenticated
  using (objectif_id in (select o.id from public.objectifs o));

drop policy "Lecture : membres ou administrateurs" on public.objectifs_jours_travail;
create policy "Lecture : périmètre du rôle" on public.objectifs_jours_travail for select to authenticated
  using (public.peut_voir_equipe(equipe_id));

notify pgrst, 'reload schema';
