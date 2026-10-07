/* ============================================================
   Migration 018 — Daily par projet
   ------------------------------------------------------------
   Besoin (porteur du projet, 2026-10-07 ; maquette docs/maquettes/daily-par-projet/) :
   - chaque personne saisit un daily PAR PROJET où elle est affectée (Chef de projet,
     Membre), lié aux congés (pas de daily attendu un jour d'absence) ;
   - Général › Daily des équipes : chacun ne voit que le daily de SES projets ; le
     responsable d'une unité (ex. Anne, Applications) voit les dailies de tous les projets
     de son unité et des unités rattachées dessous ; un administrateur voit tout.
   Contenu :
   - table notes_daily_projet (une note par personne, jour et projet) ;
   - fonction peut_lire_daily_projet(projet) : la règle de lecture ci-dessus, appliquée en
     base par RLS (pas seulement à l'écran) ;
   - daily_equipe (e-mail) : regroupé par projet de l'équipe, seulement les personnes
     présentes ce jour-là (arrivée / date de fin) — remplace la migration 018 non appliquée.
   Migration ADDITIVE (règle n°8) : une table nouvelle et vide ; notes_daily et ses données
   sont conservées (affichées comme « note générale »). Aucune donnée existante modifiée.
   ============================================================ */
create table public.notes_daily_projet (
  user_id      text not null default auth.user_id(),
  jour         date not null,
  projet_id    uuid not null references public.projets(id) on delete cascade,
  texte        text not null default '' check (length(texte) <= 20000),
  modifie_par  text,
  modifie_le   timestamptz not null default now(),
  primary key (user_id, jour, projet_id)
);
create trigger notes_daily_projet_tracer_modification before update on public.notes_daily_projet
  for each row execute function public.tracer_modification();

-- Lecture du daily d'un projet : administrateur, personne affectée au projet, ou responsable
-- (fiche responsable_id, ou owner/admin de l'organisation) de l'unité du projet ou d'une unité parente
create or replace function public.peut_lire_daily_projet(p_projet uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.est_admin()
    or exists (select 1 from public.affectations a
               where a.projet_id = p_projet and a.ressource_id in (select public.mes_ressources()))
    or exists (
      with recursive chaine as (
        select e.id, e.parent_id, e.responsable_id
          from public.equipes e join public.projets p on p.equipe_id = e.id where p.id = p_projet
        union
        select e.id, e.parent_id, e.responsable_id
          from public.equipes e join chaine c on e.id = c.parent_id)
      select 1 from chaine
      where chaine.responsable_id in (select public.mes_ressources()) or public.est_responsable_equipe(chaine.id))
$$;
revoke all on function public.peut_lire_daily_projet(uuid) from public;
grant execute on function public.peut_lire_daily_projet(uuid) to authenticated;

grant select, insert, update, delete on public.notes_daily_projet to authenticated;
revoke all on public.notes_daily_projet from anonymous;
alter table public.notes_daily_projet enable row level security;
create policy "Lecture : auteur, projet, responsables, administrateurs" on public.notes_daily_projet for select to authenticated
  using (user_id = auth.user_id() or public.peut_lire_daily_projet(projet_id));
create policy "Création : auteur" on public.notes_daily_projet for insert to authenticated
  with check (user_id = auth.user_id());
create policy "Modification : auteur" on public.notes_daily_projet for update to authenticated
  using (user_id = auth.user_id()) with check (user_id = auth.user_id());
create policy "Suppression : auteur" on public.notes_daily_projet for delete to authenticated
  using (user_id = auth.user_id());

/* E-mail du daily d'une équipe (migration 017), désormais par projet de l'équipe :
   pour chaque projet non terminé, les personnes affectées (hors Lecteur) présentes ce jour-là,
   leur note du projet, ou « sans daily » avec leur absence éventuelle (congés). Blocages en tête.
   Libellés « Terminé » et « Lecteur » lus dans les référentiels (renommables). */
create or replace function public.daily_equipe(p_equipe uuid, p_cle text, p_jour date default null)
returns json language plpgsql stable security definer set search_path = '' as $$
declare
  v_jour       date := coalesce(p_jour, (now() at time zone 'Europe/Paris')::date);
  v_equipe     public.equipes%rowtype;
  v_reglage    public.envois_daily%rowtype;
  v_termine    text := (select v.libelle from public.valeurs_referentiel v where v.referentiel_id = 'stp' and v.cle = 'termine' limit 1);
  v_lecteur    text := (select v.libelle from public.valeurs_referentiel v where v.referentiel_id = 'role' and v.cle = 'lecteur' limit 1);
  v_projet     record;
  v_membre     record;
  v_ligne      text;
  v_point      text;
  v_rubrique   text;
  v_notes      text;
  v_sans_note  text;
  v_blocages   text := '';
  v_corps      text := '';
  v_texte      text := '';
  v_jour_txt   text;
  v_ferie      boolean;
  v_a_envoyer  boolean;
begin
  if p_cle is null or not exists (select 1 from public.cles_envoi_daily c where c.equipe_id = p_equipe and c.cle = p_cle) then
    raise exception 'Clé invalide';
  end if;
  select * into v_equipe from public.equipes where id = p_equipe;
  select * into v_reglage from public.envois_daily where equipe_id = p_equipe;
  v_jour_txt := to_char(v_jour, 'DD/MM/YYYY');
  v_ferie := exists (select 1 from public.jours_feries f where f.jour = v_jour);

  for v_projet in
    select p.id, p.code, p.nom from public.projets p
    where p.equipe_id = p_equipe and p.statut is distinct from v_termine order by p.code
  loop
    v_notes := ''; v_sans_note := '';
    for v_membre in
      select r.nom, n.texte,
             (select a.type from public.absences a where a.ressource_id = r.id and a.jour = v_jour limit 1) as absence
      from public.affectations af
      join public.ressources r on r.id = af.ressource_id
      left join public.notes_daily_projet n on n.user_id = r.user_id and n.jour = v_jour and n.projet_id = v_projet.id
      where af.projet_id = v_projet.id and af.role is distinct from v_lecteur
        and (r.date_arrivee is null or r.date_arrivee <= v_jour)
        and (r.date_depart is null or r.date_depart >= v_jour)
      order by r.nom
    loop
      if v_membre.texte is null or btrim(v_membre.texte) = '' then
        v_sans_note := v_sans_note || '<li>' || public.html_texte(v_membre.nom)
          || case when v_membre.absence is null then '' else ' — ' || public.html_texte(v_membre.absence) end || '</li>';
        continue;
      end if;
      v_notes := v_notes || '<h4 style="margin:10px 0 2px">' || public.html_texte(v_membre.nom) || '</h4>';
      v_texte := v_texte || E'\n[' || v_projet.code || '] ' || v_membre.nom || E'\n' || v_membre.texte || E'\n';
      v_rubrique := '';
      foreach v_ligne in array string_to_array(v_membre.texte, E'\n') loop
        v_ligne := btrim(v_ligne);
        continue when v_ligne = '';
        if left(v_ligne, 1) <> '-' then
          v_rubrique := v_ligne;
          v_notes := v_notes || '<b>' || public.html_texte(v_ligne) || '</b><br>';
        else
          v_point := btrim(regexp_replace(v_ligne, '^-\s*', ''));
          continue when v_point = '';                     -- point vide ignoré (comme à l'écran)
          v_notes := v_notes || '- ' || public.html_texte(v_point) || '<br>';
          if v_rubrique ~* '^blocages?\M' and v_point !~* '^(aucun|aucune|ras|néant|rien)\.?$' then
            v_blocages := v_blocages || '<li><b>' || public.html_texte(v_projet.code) || ' · ' || public.html_texte(v_membre.nom)
              || '</b> : ' || public.html_texte(v_point) || '</li>';
          end if;
        end if;
      end loop;
    end loop;
    continue when v_notes = '' and v_sans_note = '';
    v_corps := v_corps || '<h3 style="margin:18px 0 4px;border-bottom:1px solid #DDE3EE">' || public.html_texte(v_projet.code)
      || ' · ' || public.html_texte(v_projet.nom) || '</h3>' || v_notes
      || case when v_sans_note = '' then '' else '<p style="margin:8px 0 2px;color:#5B6475">Sans daily :</p><ul>' || v_sans_note || '</ul>' end;
  end loop;

  v_a_envoyer := coalesce(v_reglage.mode, 'aucun') <> 'aucun'
    and extract(isodow from v_jour)::text = any (string_to_array(coalesce(v_reglage.jours, ''), ','))
    and not (coalesce(v_reglage.sans_feries, true) and v_ferie);

  return json_build_object(
    'equipe', v_equipe.nom,
    'jour', v_jour,
    'a_envoyer', v_a_envoyer,
    'destinataires', coalesce(v_reglage.destinataires, ''),
    'objet', 'Daily ' || v_equipe.nom || ' — ' || v_jour_txt,
    'html', '<div style="font-family:Arial,sans-serif;font-size:14px;color:#1B2333">'
      || '<h2 style="margin:0 0 12px">Daily ' || public.html_texte(v_equipe.nom) || ' — ' || v_jour_txt || '</h2>'
      || '<h3 style="color:#C62828;margin:0 0 4px">Blocages du jour</h3>'
      || case when v_blocages = '' then '<p>Aucun blocage signalé.</p>' else '<ul>' || v_blocages || '</ul>' end
      || case when v_corps = '' then '<p>Aucun projet en cours.</p>' else v_corps end
      || '</div>',
    'texte', 'Daily ' || v_equipe.nom || ' — ' || v_jour_txt || E'\n' || v_texte
  );
end;
$$;

/* Demande de relecture du schéma (à compléter par le réenregistrement
   de la configuration Data API, voir DAT § 10) */
notify pgrst, 'reload schema';
