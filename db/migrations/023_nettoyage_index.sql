/* ============================================================
   Migration 023 — Nettoyage issu de la revue qualité (audit db/audit/verifier-bdd.sql)
   ------------------------------------------------------------
   Accord du porteur du projet (2026-10-08, « Met à jour tout ») :
   - suppression de la fonction partage_une_equipe : elle ne servait qu'à la règle de
     lecture de l'ancienne table notes_daily, supprimée par la migration 020 (code mort) ;
   - index sur les clés étrangères qui n'en avaient pas : jointures et suppressions en
     cascade restent rapides quand les données grossissent.
   Aucune donnée touchée (règle n°8) : une fonction inutilisée et des index.
   ============================================================ */
drop function public.partage_une_equipe(text);

create index if not exists equipes_parent_id_idx            on public.equipes (parent_id);
create index if not exists equipes_responsable_id_idx       on public.equipes (responsable_id);
create index if not exists objectifs_equipe_id_idx          on public.objectifs (equipe_id);
create index if not exists resultats_cles_objectif_id_idx   on public.resultats_cles (objectif_id);
create index if not exists projets_resultat_cle_id_idx      on public.projets (resultat_cle_id);
create index if not exists projets_chef_id_idx              on public.projets (chef_id);
create index if not exists affectations_ressource_id_idx    on public.affectations (ressource_id);
create index if not exists temps_saisis_projet_id_idx       on public.temps_saisis (projet_id);
create index if not exists notes_daily_projet_projet_id_idx on public.notes_daily_projet (projet_id);

notify pgrst, 'reload schema';
