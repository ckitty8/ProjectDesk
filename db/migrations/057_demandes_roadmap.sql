/* ============================================================
   Migration 057 — Demandes de la Roadmap (lignes du tableau de Vue d’ensemble › Roadmap)
   ------------------------------------------------------------
   Besoin (porteur du projet, 2026-11-03) : « prends 3 lignes du fichier que je t'ai donné, les 3 plus récentes pour 2026, et
   alimente la partie [tableau] » ; plus tard, les chefs de projet ajouteront des lignes à la main dans Mon dashboard.
   Une ligne par demande ; ses valeurs sont rangées par colonne (clé = id de colonnes_roadmap, migration 056), car les colonnes
   sont réglables dans Administration › Roadmap. Une liste déroulante stocke le libellé choisi ; Rang et Score ne sont pas
   stockés : ils sont calculés par l'application (domaine/roadmap.ts).
   projet_id : facultatif (rattachement à un projet ; les chefs de projet pourront écrire les demandes de leurs projets).
   Écritures autorisées par le porteur (règle n°8) : 3 demandes du fichier CDO-ROADMAP-NEW.xlsm (onglet « Roadmap
   fonctionnelle », lignes 85, 39 et 16 : mois de la demande 24/07, 01/07 et 15/06/2026, les plus récentes de 2026) et les
   valeurs de listes déroulantes qu'elles utilisent (référentiels « rdm_ », vides depuis 056). Aucune ligne existante modifiée.
   Droits : lecture = utilisateurs connectés (le menu Roadmap est ouvert à tous) ; écriture = administrateurs, ou
   chefs du projet de la demande (peut_gerer_projet, migration 052 : chef de projet affecté, responsable de son unité).
   Comptages attendus : demandes_roadmap 0 → 3, valeurs_referentiel 28 → 54 ; autres tables identiques.
   ============================================================ */

create table public.demandes_roadmap (
  id           uuid primary key default gen_random_uuid(),
  projet_id    uuid references public.projets(id) on delete set null,
  valeurs      jsonb not null default '{}'::jsonb check (jsonb_typeof(valeurs) = 'object'),   -- { "<id de colonne>": valeur }
  cree_le      timestamptz not null default now(),
  modifie_par  text,
  modifie_le   timestamptz not null default now()
);
create index demandes_roadmap_projet_idx on public.demandes_roadmap (projet_id);

create trigger demandes_roadmap_tracer_modification before update on public.demandes_roadmap
  for each row execute function public.tracer_modification();

grant select, insert, update, delete on public.demandes_roadmap to authenticated;
revoke all on public.demandes_roadmap from anonymous;
alter table public.demandes_roadmap enable row level security;

create policy "Lecture : utilisateurs connectés" on public.demandes_roadmap for select to authenticated using (true);
create policy "Écriture : administrateurs ou chefs du projet" on public.demandes_roadmap for all to authenticated
  using (public.est_admin() or (projet_id is not null and public.peut_gerer_projet(projet_id)))
  with check (public.est_admin() or (projet_id is not null and public.peut_gerer_projet(projet_id)));

/* Valeurs des listes déroulantes utilisées par les 3 demandes (libellés du fichier, espaces de fin retirés) */
insert into public.valeurs_referentiel (referentiel_id, libelle, couleur, ordre) values
  ('rdm_demandeur', 'Céline MASSON', '#4A5363', 1), ('rdm_demandeur', 'Estelle Bailly', '#4A5363', 2), ('rdm_demandeur', 'Sandie PIRON', '#4A5363', 3),
  ('rdm_parcours', 'Distribution', '#4A5363', 1), ('rdm_parcours', 'Publication', '#4A5363', 2), ('rdm_parcours', 'Flux', '#4A5363', 3),
  ('rdm_categorie', 'COM', '#4A5363', 1), ('rdm_categorie', 'DIGITAL', '#4A5363', 2),
  ('rdm_thematique', 'MANDAT DE COM INTERNE', '#4A5363', 1), ('rdm_thematique', 'PUBLICATION', '#4A5363', 2), ('rdm_thematique', 'IMAGINO', '#4A5363', 3),
  ('rdm_strategique', 'Oui', '#0F8A6B', 1), ('rdm_strategique', 'Non', '#8A93A3', 2),
  ('rdm_priorite', '1', '#D14343', 1),
  ('rdm_impact_client', '1', '#4A5363', 1), ('rdm_impact_client', '3', '#4A5363', 2),
  ('rdm_impact_collaborateur', '2', '#4A5363', 1), ('rdm_impact_collaborateur', '3', '#4A5363', 2),
  ('rdm_cadrage', 'Non démarré', '#8A93A3', 1), ('rdm_cadrage', 'En cours', '#003CC8', 2),
  ('rdm_statut', 'Nouveau', '#8A93A3', 1), ('rdm_statut', 'Recette DSI', '#7A3FC2', 2), ('rdm_statut', 'Annulée', '#D14343', 3),
  ('rdm_complexite', '2', '#4A5363', 1),
  ('rdm_prise_en_charge', 'Oui', '#0F8A6B', 1), ('rdm_prise_en_charge', 'Non', '#8A93A3', 2);

/* Les 3 demandes : valeurs rangées sous l'id de chaque colonne, retrouvé par sa clé technique (colonnes de départ, migration 056) */
insert into public.demandes_roadmap (valeurs, cree_le)
select (select jsonb_object_agg(c.id::text, d.v ->> c.cle) from public.colonnes_roadmap c where d.v ? c.cle), d.cree_le
from (values
  ('{"demande": "Modifier dans le template du mandat de com le montant de la prestation e-business : De 7500 HT à 15.000 HT",
     "demandeur": "Céline MASSON", "parcours": "Distribution", "categorie": "COM", "thematique": "MANDAT DE COM INTERNE",
     "strategique": "Non", "priorite": "1", "impactClient": "1", "impactCollaborateur": "3", "cadrage": "En cours",
     "statut": "Nouveau", "priseEnCharge": "Non"}'::jsonb, '2026-07-24'::timestamptz),
  ('{"demande": "Ajouter plusieurs liens vidéos dans CDO (illimités)", "us": "30768",
     "demandeur": "Estelle Bailly", "parcours": "Publication", "categorie": "DIGITAL", "thematique": "PUBLICATION",
     "strategique": "Non", "priorite": "1", "impactClient": "1", "impactCollaborateur": "3", "cadrage": "Non démarré",
     "statut": "Recette DSI", "complexite": "2", "priseEnCharge": "Oui"}'::jsonb, '2026-07-01'::timestamptz),
  ('{"demande": "Ajouter priorité d''affichage au niveau du flux tranche commerciale", "us": "31716",
     "demandeur": "Sandie PIRON", "parcours": "Flux", "categorie": "DIGITAL", "thematique": "IMAGINO",
     "strategique": "Oui", "priorite": "1", "impactClient": "3", "impactCollaborateur": "2", "cadrage": "Non démarré",
     "statut": "Annulée", "complexite": "2", "priseEnCharge": "Non", "chiffrage": "1.5"}'::jsonb, '2026-06-15'::timestamptz)
) as d(v, cree_le);

/* Demande de relecture du schéma (à compléter par le réenregistrement de la configuration Data API, voir DAT § 10) */
notify pgrst, 'reload schema';
