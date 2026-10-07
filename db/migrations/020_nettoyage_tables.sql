/* ============================================================
   Migration 020 — Nettoyage de la base : tables inutiles, liaison des répartitions
   ------------------------------------------------------------
   Demande du porteur du projet (2026-10-07, accord explicite pour supprimer) : « pas de
   tables inutiles, des liaisons qui se font bien ». Sauvegarde préalable : branche Neon
   « sauvegarde-avant-020-2026-10-07 » (copie complète de la base avant cette migration).
   Supprimé (plus utilisé par l'application) :
   - demandes, champs_formulaire : demandes gérées dans Azure DevOps (retrait du 2026-10-05) ;
   - tickets : tickets retirés de l'application (2026-09-27) ;
   - envois_daily, cles_envoi_daily, fonctions daily_equipe et cle_envoi_daily : envoi du
     daily par équipe remplacé par l'envoi par projet (migration 019) ;
   - notes_daily : ancien daily unique, remplacé par le daily par projet (migration 018) ;
     sa seule ligne était un modèle vide ;
   - référentiels « Types de demande », « Priorités », « Statuts ticket » et leurs valeurs ;
   - dans propager_renommage_valeur : les mises à jour de demandes et tickets.
   Liaison ajoutée : repartitions_sprint → sprints_projet (projet, numéro), après suppression
   de la seule répartition orpheline (sprint n° 19 inexistant, 0 jour).
   ============================================================ */

-- Fonctions et tables de l'envoi du daily par équipe
drop function public.daily_equipe(uuid, text, date);
drop function public.cle_envoi_daily(uuid, boolean);
drop table public.cles_envoi_daily;
drop table public.envois_daily;

-- Ancien daily unique, demandes, formulaire, tickets
drop table public.notes_daily;
drop table public.demandes;
drop table public.champs_formulaire;
drop table public.tickets;

-- Renommage d'une valeur : plus de mise à jour des tables supprimées
create or replace function public.propager_renommage_valeur()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.libelle = old.libelle then return new; end if;
  case new.referentiel_id
    when 'poste'   then update public.ressources   set poste        = new.libelle where poste        = old.libelle;
    when 'contrat' then update public.ressources   set type_contrat = new.libelle where type_contrat = old.libelle;
    when 'stp'     then update public.projets      set statut       = new.libelle where statut       = old.libelle;
    when 'role'    then update public.affectations set role         = new.libelle where role         = old.libelle;
    when 'abs'     then update public.absences     set type         = new.libelle where type         = old.libelle;
    else null;
  end case;
  return new;
end;
$$;

-- Référentiels des demandes et tickets : la protection des valeurs « système » est levée
-- le temps de les supprimer (les valeurs partent avec leur référentiel : on delete cascade)
alter table public.valeurs_referentiel disable trigger valeurs_referentiel_protection;
delete from public.referentiels where id in ('type', 'prio', 'stt');
alter table public.valeurs_referentiel enable trigger valeurs_referentiel_protection;

-- Répartitions d'un sprint rattachées au sprint du projet (suppression du sprint → ses répartitions)
delete from public.repartitions_sprint r
 where not exists (select 1 from public.sprints_projet s where s.projet_id = r.projet_id and s.numero = r.numero);
alter table public.repartitions_sprint
  add constraint repartitions_sprint_sprint_fk foreign key (projet_id, numero)
  references public.sprints_projet (projet_id, numero) on delete cascade;

/* Demande de relecture du schéma (à compléter par le réenregistrement
   de la configuration Data API, voir DAT § 10) */
notify pgrst, 'reload schema';
