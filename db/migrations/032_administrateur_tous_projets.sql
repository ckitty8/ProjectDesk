/* ============================================================
   Migration 032 — L'administrateur agit sur tous les projets
   ------------------------------------------------------------
   La matrice des droits (migration 031, validée par le porteur) donne à l'administrateur le
   périmètre « Tout ». Or peut_editer_projet n'acceptait que les membres de l'équipe du projet et
   les personnes affectées : un administrateur hors de l'équipe (ex. Camille pour Mobile) ne
   pouvait ni modifier un projet ni y affecter une personne (constaté le 2026-10-13 en ajoutant
   « + Personne existante » à une équipe). On ajoute l'administrateur ; les niveaux de la matrice
   (a_droit) restent exigés par chaque règle d'écriture. Aucune donnée modifiée (règle n°8).
   ============================================================ */
create or replace function public.peut_editer_projet(p_projet uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.est_admin()
      or exists (select 1 from public.projets p
                 where p.id = p_projet and p.equipe_id in (select public.mes_equipes()))
      or exists (select 1 from public.affectations a
                 where a.projet_id = p_projet
                   and a.role in (select v.libelle from public.valeurs_referentiel v
                                  where v.referentiel_id = 'role' and v.cle in ('chef', 'membre'))
                   and a.ressource_id in (select public.mes_ressources()))
$$;

notify pgrst, 'reload schema';
