/* ============================================================
   Migration 022 — Méthode de gestion d'un projet
   ------------------------------------------------------------
   Besoin (porteur du projet, 2026-10-08 ; maquette docs/maquettes/methode-projet/) :
   à la création d'un projet, choisir sa méthode — Agile Scrum, Agile Kanban, Cascade,
   Cycle en V. Des menus dépendront de la méthode (gestion multi-projet).
   - référentiel « methode » (liste en base, règle n°4) : 4 valeurs système, renommables,
     retrouvées par leur clé (scrum, kanban, cascade, cycle_v) ;
   - colonne projets.methode (libellé, comme projets.statut) ;
   - renommage d'une méthode propagé aux projets (propager_renommage_valeur).
   Migration ADDITIVE (règle n°8) : une colonne vide, un référentiel nouveau ; seules
   valeurs posées : CDO = Agile Scrum, IA = Agile Kanban (porteur du projet).
   ============================================================ */
insert into public.referentiels (id, nom, ordre) values ('methode', 'Méthodes projet', 9);
insert into public.valeurs_referentiel (referentiel_id, cle, libelle, couleur, systeme, actif, ordre) values
  ('methode', 'scrum',   'Agile Scrum',  '#003CC8', true, true, 1),
  ('methode', 'kanban',  'Agile Kanban', '#0F8A6B', true, true, 2),
  ('methode', 'cascade', 'Cascade',      '#B25E09', true, true, 3),
  ('methode', 'cycle_v', 'Cycle en V',   '#7A3FC2', true, true, 4);

alter table public.projets add column methode text;

-- Renommage d'une valeur : la méthode des projets suit (mêmes règles que la migration 020)
create or replace function public.propager_renommage_valeur()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.libelle = old.libelle then return new; end if;
  case new.referentiel_id
    when 'poste'   then update public.ressources   set poste        = new.libelle where poste        = old.libelle;
    when 'contrat' then update public.ressources   set type_contrat = new.libelle where type_contrat = old.libelle;
    when 'stp'     then update public.projets      set statut       = new.libelle where statut       = old.libelle;
    when 'methode' then update public.projets      set methode      = new.libelle where methode      = old.libelle;
    when 'role'    then update public.affectations set role         = new.libelle where role         = old.libelle;
    when 'abs'     then update public.absences     set type         = new.libelle where type         = old.libelle;
    else null;
  end case;
  return new;
end;
$$;

-- Méthodes des projets existants (porteur du projet, 2026-10-08)
update public.projets set methode = 'Agile Scrum'  where nom = 'CDO' and methode is null;
update public.projets set methode = 'Agile Kanban' where nom = 'IA'  and methode is null;

/* Demande de relecture du schéma (à compléter par le réenregistrement
   de la configuration Data API, voir DAT § 10) */
notify pgrst, 'reload schema';
