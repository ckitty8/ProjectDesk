/* ============================================================
   Migration 058 — Roadmap : les colonnes du fichier qui manquaient
   ------------------------------------------------------------
   Bug signalé par le porteur (2026-11-04) : « tous les champs du excel ne sont pas présents dans l'application ». En 3.04, 9 colonnes de
   l'onglet « Roadmap fonctionnelle » du fichier CDO-ROADMAP-NEW.xlsm avaient été écartées ; elles sont ajoutées, en fin de leur bloc
   (l'ordre se règle ensuite dans Administration › Roadmap › Colonnes) :
     Identification : Mois de la demande (date), Commentaires (texte) ;
     Priorisation : Etat (liste), Planification (liste) ;
     Développement & recette : Atterrissage chiffrage (nombre), Avancement dév (nombre), Estimé MEP (date), Statut Recette (liste),
     Statut MEP (liste).
   Seules « Fixe » et « Clé » ne sont pas reprises : ce sont les étapes intermédiaires du rang dans l'Excel, remplacées par le calcul du Rang.
   Listes : valeurs de l'onglet « Listes » du fichier (Etat ; Planification T1 2026 → T4 2028 ; Statut recette et Statut MEP : Itération 1 → 9).
   Les 3 demandes du 2026-11-03 (migration 057) reçoivent les valeurs du fichier pour ces colonnes (lignes 85, 39, 16 : Mois de la demande,
   Etat, Planification ; les autres cellules sont vides dans le fichier) — ajout de clés seulement, aucune valeur existante modifiée
   (bug du porteur : « tous les champs du excel » ; règle n°8).
   Comptages attendus : colonnes_roadmap 19 → 28, referentiels 17 → 21, valeurs_referentiel 54 → 87, demandes_roadmap 3 (inchangé).
   ============================================================ */

insert into public.referentiels (id, nom, ordre) values
  ('rdm_etat', 'Roadmap · Etat', 113), ('rdm_planification', 'Roadmap · Planification', 114),
  ('rdm_statut_recette', 'Roadmap · Statut Recette', 115), ('rdm_statut_mep', 'Roadmap · Statut MEP', 116);

insert into public.valeurs_referentiel (referentiel_id, libelle, couleur, ordre)
select 'rdm_etat', v.libelle, v.couleur, v.ordre from (values ('Ouvert', '#003CC8', 1), ('Fermé', '#0F8A6B', 2), ('Annulé', '#D14343', 3)) as v(libelle, couleur, ordre)
union all
select 'rdm_planification', 'T' || t || ' ' || a, '#4A5363', (a - 2026) * 4 + t from generate_series(2026, 2028) a, generate_series(1, 4) t
union all
select r, 'Itération ' || i, '#4A5363', i from unnest(array['rdm_statut_recette', 'rdm_statut_mep']) r, generate_series(1, 9) i;

insert into public.colonnes_roadmap (cle, libelle, bloc, type, format, referentiel_id, ordre) values
  ('moisDemande', 'Mois de la demande', 'identification', 'libre', 'date', null, 20),
  ('commentaires', 'Commentaires', 'identification', 'libre', 'texte', null, 21),
  ('etat', 'Etat', 'priorisation', 'liste', null, 'rdm_etat', 22),
  ('planification', 'Planification', 'priorisation', 'liste', null, 'rdm_planification', 23),
  ('atterrissage', 'Atterrissage chiffrage', 'developpement', 'libre', 'nombre', null, 24),
  ('avancement', 'Avancement dév', 'developpement', 'libre', 'nombre', null, 25),
  ('estimeMep', 'Estimé MEP', 'developpement', 'libre', 'date', null, 26),
  ('statutRecette', 'Statut Recette', 'developpement', 'liste', null, 'rdm_statut_recette', 27),
  ('statutMep', 'Statut MEP', 'developpement', 'liste', null, 'rdm_statut_mep', 28);

/* Valeurs du fichier pour les 3 demandes, retrouvées par le texte de leur colonne « Demande » ; « nouvelles || existantes » : une valeur déjà
   présente l'emporte toujours */
update public.demandes_roadmap d
set valeurs = (select jsonb_object_agg(c.id::text, x.v ->> c.cle) from public.colonnes_roadmap c where x.v ? c.cle) || d.valeurs
from (values
  ('Modifier dans le template du mandat de com le montant de la prestation e-business : De 7500 HT à 15.000 HT',
   '{"moisDemande": "2026-07-24", "etat": "Ouvert", "planification": "T4 2026"}'::jsonb),
  ('Ajouter plusieurs liens vidéos dans CDO (illimités)', '{"moisDemande": "2026-07-01", "etat": "Ouvert", "planification": "T3 2026"}'::jsonb),
  ('Ajouter priorité d''affichage au niveau du flux tranche commerciale', '{"moisDemande": "2026-06-15", "etat": "Annulé"}'::jsonb)
) as x(titre, v)
where d.valeurs ->> (select id::text from public.colonnes_roadmap where cle = 'demande') = x.titre;

notify pgrst, 'reload schema';
