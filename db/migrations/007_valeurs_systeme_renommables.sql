/* ============================================================
   Migration 007 — Valeurs « système » renommables
   ------------------------------------------------------------
   Besoin (porteur du projet, 2026-09-25) : pouvoir renommer toutes les
   valeurs des référentiels, y compris celles utilisées par les calculs
   (statuts de projet et de ticket, rôles projet, « Congés payés »).
   → Chaque valeur système reçoit une clé technique stable (« cle ») :
     l'application et les règles de droits s'appuient sur la clé, plus
     sur le libellé.
   → Renommer une valeur met à jour les données qui la portent
     (projets, tickets, affectations, absences, demandes, ressources).
   → Une valeur système reste non supprimable, et sa clé non modifiable.
   ============================================================ */

/* ---------- 1. Clé technique des valeurs système ---------- */
alter table public.valeurs_referentiel add column cle text;
alter table public.valeurs_referentiel add constraint valeurs_referentiel_cle_unique unique (referentiel_id, cle);
update public.valeurs_referentiel v set cle = c.cle
from (values
  ('stp', 'Planifié', 'planifie'), ('stp', 'En cours', 'en_cours'), ('stp', 'À risque', 'a_risque'),
  ('stp', 'En retard', 'en_retard'), ('stp', 'Terminé', 'termine'),
  ('stt', 'À faire', 'a_faire'), ('stt', 'En cours', 'en_cours'), ('stt', 'En revue', 'en_revue'), ('stt', 'Terminé', 'termine'),
  ('role', 'Chef de projet', 'chef'), ('role', 'Membre', 'membre'), ('role', 'Lecteur', 'lecteur'),
  ('abs', 'Congés payés', 'cp')
) as c(referentiel_id, libelle, cle)
where v.referentiel_id = c.referentiel_id and v.libelle = c.libelle;

-- Libellé actuel d'une valeur système (valeurs par défaut des colonnes, droits)
create or replace function public.libelle_systeme(p_referentiel text, p_cle text)
returns text language sql stable security definer set search_path = '' as $$
  select libelle from public.valeurs_referentiel where referentiel_id = p_referentiel and cle = p_cle
$$;
grant execute on function public.libelle_systeme(text, text) to authenticated;

/* ---------- 2. Valeurs par défaut : suivent le libellé actuel ---------- */
alter table public.projets alter column statut set default public.libelle_systeme('stp', 'planifie');
alter table public.tickets alter column statut set default public.libelle_systeme('stt', 'a_faire');
alter table public.affectations alter column role set default public.libelle_systeme('role', 'membre');

/* ---------- 3. Protection : renommage permis, suppression et clé interdites ---------- */
create or replace function public.proteger_valeur_systeme()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and old.systeme then raise exception 'Valeur système : suppression impossible (la désactiver)'; end if;
  if tg_op = 'UPDATE' and old.cle is distinct from new.cle then raise exception 'Clé technique non modifiable'; end if;
  return coalesce(new, old);
end;
$$;

/* ---------- 4. Renommage propagé aux données ---------- */
create or replace function public.propager_renommage_valeur()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.libelle = old.libelle then return new; end if;
  case new.referentiel_id
    when 'poste'   then update public.ressources   set poste        = new.libelle where poste        = old.libelle;
    when 'contrat' then update public.ressources   set type_contrat = new.libelle where type_contrat = old.libelle;
    when 'stp'     then update public.projets      set statut       = new.libelle where statut       = old.libelle;
    when 'stt'     then update public.tickets      set statut       = new.libelle where statut       = old.libelle;
    when 'role'    then update public.affectations set role         = new.libelle where role         = old.libelle;
    when 'abs'     then update public.absences     set type         = new.libelle where type         = old.libelle;
    when 'type'    then update public.demandes     set type         = new.libelle where type         = old.libelle;
    when 'prio'    then update public.demandes     set priorite     = new.libelle where priorite     = old.libelle;
                        update public.tickets      set priorite     = new.libelle where priorite     = old.libelle;
    else null;
  end case;
  return new;
end;
$$;

/* ---------- 5. Droits : rôles reconnus par leur clé ---------- */
create or replace function public.peut_editer_projet(p_projet uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.projets p
                 where p.id = p_projet and p.equipe_id in (select public.mes_equipes()))
      or exists (select 1 from public.affectations a
                 where a.projet_id = p_projet
                   and a.role in (select v.libelle from public.valeurs_referentiel v
                                  where v.referentiel_id = 'role' and v.cle in ('chef', 'membre'))
                   and a.ressource_id in (select public.mes_ressources()))
$$;

/* ---------- 6. Demande de relecture du schéma (à compléter par le réenregistrement
   de la configuration Data API, voir DAT § 10) ---------- */
notify pgrst, 'reload schema';
