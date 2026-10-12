/* ============================================================
   Migration 027 — Rôle d'accès « Lecteur » dans une équipe
   ------------------------------------------------------------
   Besoin (porteur du projet, 2026-10-12 ; maquettes docs/maquettes/role-acces/) : choisir
   dans la fiche d'une personne son rôle d'accès — Administrateur, Responsable d'équipe,
   Membre de l'équipe ou Lecteur. Les trois premiers existent déjà (table administrateurs,
   rôle owner / admin / member de l'organisation Neon Auth). « Lecteur » n'existait qu'au
   niveau d'un projet : il est ajouté au niveau de l'équipe.
   Lecteur de l'équipe = sa fiche de l'équipe porte lecture_seule = true :
   - il garde la LECTURE (il reste membre de l'organisation : est_membre_equipe) ;
   - il perd l'ÉCRITURE sur l'équipe : mes_equipes(), utilisée par toutes les règles
     d'écriture, n'inclut plus cette équipe ; et peut_editer_projet() ne lui donne plus
     l'écriture par ses affectations (Chef de projet / Membre) ;
   - ses propres congés et heures restent saisissables (mes_ressources, inchangé).
   Seuls un administrateur ou un responsable de l'équipe changent lecture_seule (trigger).
   Migration de structure additive : colonne à false pour toutes les fiches existantes,
   les droits actuels sont donc inchangés. Aucune donnée existante modifiée (règle n°8).
   ============================================================ */

/* ---------- 1. La fiche porte le rôle Lecteur ---------- */
alter table public.ressources add column lecture_seule boolean not null default false;

/* ---------- 2. Équipes lues / équipes modifiables ---------- */
-- Équipes dont je suis membre (lecture) : ancien corps de mes_equipes() (migration 025)
create or replace function public.mes_equipes_lecture()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select e.id from public.equipes e
  join neon_auth.member m on m."organizationId" = e.id
  where m."userId"::text = auth.user_id()
  union
  select e.id from public.equipes e where public.est_createur()
$$;

-- Équipes que je peux modifier : celles où je ne suis pas Lecteur (le créateur : toutes)
create or replace function public.mes_equipes()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select x from public.mes_equipes_lecture() x
  where public.est_createur()
     or not exists (select 1 from public.ressources r
                    where r.equipe_id = x and r.user_id = auth.user_id() and r.lecture_seule)
$$;

-- Droit de lecture global : membre d'au moins une équipe, Lecteur compris
create or replace function public.est_membre_equipe()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.mes_equipes_lecture())
$$;

-- Projet modifiable : équipe modifiable, ou affectation Chef de projet / Membre d'une fiche non Lecteur
create or replace function public.peut_editer_projet(p_projet uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.projets p
                 where p.id = p_projet and p.equipe_id in (select public.mes_equipes()))
      or exists (select 1 from public.affectations a
                 join public.ressources r on r.id = a.ressource_id
                 where a.projet_id = p_projet
                   and a.role in (select v.libelle from public.valeurs_referentiel v
                                  where v.referentiel_id = 'role' and v.cle in ('chef', 'membre'))
                   and r.user_id = auth.user_id() and not r.lecture_seule)
$$;

revoke all on function public.mes_equipes_lecture() from public;
grant execute on function public.mes_equipes_lecture() to authenticated;

/* ---------- 3. Qui change le rôle Lecteur : administrateur ou responsable de l'équipe ---------- */
create or replace function public.controler_lecture_seule()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (tg_op = 'INSERT' and new.lecture_seule)
     or (tg_op = 'UPDATE' and new.lecture_seule is distinct from old.lecture_seule) then
    if not (public.est_admin() or public.est_responsable_equipe(new.equipe_id)) then
      raise exception 'Rôle Lecteur : seul un responsable de l''équipe ou un administrateur peut le changer';
    end if;
  end if;
  return new;
end;
$$;
create trigger ressources_controle_lecture_seule before insert or update on public.ressources
  for each row execute function public.controler_lecture_seule();

/* ---------- 4. Demande de relecture du schéma (à compléter par le réenregistrement
   de la configuration Data API, voir DAT § 10) ---------- */
notify pgrst, 'reload schema';
