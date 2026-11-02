/* ============================================================
   Migration 050 — Projets, sprints et mises en production lisibles par tous les membres
   ------------------------------------------------------------
   Demande du porteur (2026-11-02) : le menu Projet de « Vue d'ensemble » est visible de tous les profils et rôles, et chacun y voit
   « tous les projets de toutes les équipes » (Gantt des sprints et des MEP, liste des projets).
   Jusqu'ici la lecture suivait le périmètre du rôle (migration 042 : peut_voir_projet). Trois règles de LECTURE sont élargies à tout membre
   d'une équipe (est_membre_equipe) ou administrateur — la règle « Lecture : membres ou administrateurs » d'origine (migrations 002, 013, 039) :
   - projets ;
   - sprints_projet ;
   - mises_en_production.
   Inchangé : les règles d'ÉCRITURE ; la lecture des affectations, personnes, absences, heures et feuilles de temps reste limitée au
   périmètre du rôle (peut_voir_ressource, peut_voir_temps) ; un compte sans équipe ne lit toujours aucun projet.
   Aucune donnée modifiée (règle n°8) : seules trois règles de lecture changent.
   ============================================================ */
drop policy "Lecture : périmètre du rôle" on public.projets;
create policy "Lecture : membres ou administrateurs" on public.projets for select to authenticated
  using (public.est_membre_equipe() or public.est_admin());

drop policy "Lecture : périmètre du rôle" on public.sprints_projet;
create policy "Lecture : membres ou administrateurs" on public.sprints_projet for select to authenticated
  using (public.est_membre_equipe() or public.est_admin());

drop policy "Lecture : périmètre du rôle" on public.mises_en_production;
create policy "Lecture : membres ou administrateurs" on public.mises_en_production for select to authenticated
  using (public.est_membre_equipe() or public.est_admin());

notify pgrst, 'reload schema';
