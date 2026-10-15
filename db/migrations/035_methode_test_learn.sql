/* ============================================================
   Migration 035 — Méthode « Test & Learn » (projets IA)
   ------------------------------------------------------------
   Porteur (2026-10-15, « Ah oui et ok ») : ajouter Test & Learn aux méthodes proposées à la
   création d'un projet, à côté de Scrum, Kanban, Cascade et Cycle en V (référentiel « methode »,
   migration 022). Fiche pratique : Trucs et astuces › Test & Learn.
   Additive : une valeur système ajoutée ; aucun projet modifié (règle n°8).
   ============================================================ */
insert into public.valeurs_referentiel (referentiel_id, cle, libelle, couleur, systeme, actif, ordre)
select 'methode', 'test_learn', 'Test & Learn', '#D98A1C', true, true, 5
where not exists (select 1 from public.valeurs_referentiel where referentiel_id = 'methode' and cle = 'test_learn');
