/* ============================================================
   Migration 003 — Les administrateurs globaux lisent tout
   ------------------------------------------------------------
   Besoin (porteur du projet, 2026-09-25) : un administrateur doit
   accéder directement à l'outil, y compris avant d'appartenir à une
   équipe (ex. juste après l'installation, pour créer les équipes).
   Les règles de lecture « membres » deviennent « membres ou
   administrateurs ». L'écriture est inchangée.
   ============================================================ */

do $$
declare t text;
begin
  foreach t in array array['ressources','objectifs','resultats_cles','projets','affectations',
                           'tickets','absences','temps_saisis','feuilles_temps']
  loop
    execute format('drop policy if exists "Lecture : membres" on public.%I', t);
    execute format('create policy "Lecture : membres ou administrateurs" on public.%I for select to authenticated
                    using (public.est_membre_equipe() or public.est_admin())', t);
  end loop;
end $$;

drop policy if exists "Lecture : demandeur ou membres" on public.demandes;
create policy "Lecture : demandeur, membres ou administrateurs" on public.demandes for select to authenticated
  using (demandeur_id = auth.user_id() or public.est_membre_equipe() or public.est_admin());
