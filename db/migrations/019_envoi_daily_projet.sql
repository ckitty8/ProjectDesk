/* ============================================================
   Migration 019 — Envoi du daily PAR PROJET
   ------------------------------------------------------------
   Besoin (porteur du projet, 2026-10-07 ; maquette docs/maquettes/envoi-daily-projet/) :
   Administration › Envoi du daily se règle par PROJET (et non plus par équipe) : mode
   (Power Automate / Envoi direct), heure, jours, fériés, destinataires — un e-mail par projet.
   - envois_daily_projet : réglage d'un projet ;
   - cles_envoi_daily_projet : clé secrète d'un projet (aucun droit direct) ;
   - peut_gerer_envoi_projet(projet) : administrateur, chef du projet (fiche chef ou
     affectation « Chef de projet »), responsable de l'unité du projet ou d'une unité parente ;
   - cle_envoi_daily_projet(projet, renouveler) : la clé, pour ces personnes seulement ;
   - daily_projet(projet, clé, jour) : le daily du projet prêt à envoyer, appelable sans
     compte avec la bonne clé (flux Power Automate). Mêmes règles que daily_equipe (018).
   Migration ADDITIVE (règle n°8) : tables nouvelles et vides ; envois_daily et
   cles_envoi_daily (par équipe, vides) sont conservées mais ne sont plus utilisées.
   ============================================================ */
create table public.envois_daily_projet (
  projet_id      uuid primary key references public.projets(id) on delete cascade,
  mode           text not null default 'aucun' check (mode in ('aucun', 'power_automate', 'direct')),
  heure          time not null default '09:30',
  jours          text not null default '1,2,3,4,5' check (jours ~ '^([1-7](,[1-7])*)?$'),
  sans_feries    boolean not null default true,
  destinataires  text not null default '' check (length(destinataires) <= 2000),
  modifie_par    text,
  modifie_le     timestamptz not null default now()
);
create trigger envois_daily_projet_tracer_modification before update on public.envois_daily_projet
  for each row execute function public.tracer_modification();

-- Qui règle l'envoi du daily d'un projet
create or replace function public.peut_gerer_envoi_projet(p_projet uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.est_admin()
    or exists (select 1 from public.projets p where p.id = p_projet and p.chef_id in (select public.mes_ressources()))
    or exists (select 1 from public.affectations a join public.valeurs_referentiel v on v.referentiel_id = 'role' and v.cle = 'chef'
               where a.projet_id = p_projet and a.role = v.libelle and a.ressource_id in (select public.mes_ressources()))
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
revoke all on function public.peut_gerer_envoi_projet(uuid) from public;
grant execute on function public.peut_gerer_envoi_projet(uuid) to authenticated;

grant select, insert, update, delete on public.envois_daily_projet to authenticated;
revoke all on public.envois_daily_projet from anonymous;
alter table public.envois_daily_projet enable row level security;
create policy "Lecture : membres ou administrateurs" on public.envois_daily_projet for select to authenticated
  using (public.est_membre_equipe() or public.est_admin());
create policy "Écriture : chef, responsables, administrateurs" on public.envois_daily_projet for all to authenticated
  using (public.peut_gerer_envoi_projet(projet_id)) with check (public.peut_gerer_envoi_projet(projet_id));

-- Clés secrètes par projet : RLS sans règle et aucun droit → lues seulement par les fonctions
create table public.cles_envoi_daily_projet (
  projet_id  uuid primary key references public.projets(id) on delete cascade,
  cle        text not null default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  cree_le    timestamptz not null default now()
);
revoke all on public.cles_envoi_daily_projet from authenticated, anonymous;
alter table public.cles_envoi_daily_projet enable row level security;

create or replace function public.cle_envoi_daily_projet(p_projet uuid, p_renouveler boolean default false)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare v_cle text;
begin
  if not public.peut_gerer_envoi_projet(p_projet) then
    raise exception 'Réservé aux administrateurs, au chef du projet et aux responsables de son unité';
  end if;
  if p_renouveler then delete from public.cles_envoi_daily_projet where projet_id = p_projet; end if;
  insert into public.cles_envoi_daily_projet (projet_id) values (p_projet) on conflict (projet_id) do nothing;
  select c.cle into v_cle from public.cles_envoi_daily_projet c where c.projet_id = p_projet;
  return v_cle;
end;
$$;

/* Daily d'un projet pour un jour (par défaut aujourd'hui, heure de Paris), prêt à envoyer :
   membres affectés hors Lecteur et présents ce jour-là, leur note du projet, ou « sans daily »
   avec leur absence (congés) ; blocages en tête. a_envoyer = faux si le mode est « aucun »,
   si le jour n'est pas coché ou si c'est un férié (option). */
create or replace function public.daily_projet(p_projet uuid, p_cle text, p_jour date default null)
returns json language plpgsql stable security definer set search_path = '' as $$
declare
  v_jour       date := coalesce(p_jour, (now() at time zone 'Europe/Paris')::date);
  v_projet     public.projets%rowtype;
  v_reglage    public.envois_daily_projet%rowtype;
  v_lecteur    text := (select v.libelle from public.valeurs_referentiel v where v.referentiel_id = 'role' and v.cle = 'lecteur' limit 1);
  v_membre     record;
  v_ligne      text;
  v_point      text;
  v_rubrique   text;
  v_notes      text := '';
  v_sans_note  text := '';
  v_blocages   text := '';
  v_texte      text := '';
  v_jour_txt   text;
  v_ferie      boolean;
  v_a_envoyer  boolean;
begin
  if p_cle is null or not exists (select 1 from public.cles_envoi_daily_projet c where c.projet_id = p_projet and c.cle = p_cle) then
    raise exception 'Clé invalide';
  end if;
  select * into v_projet from public.projets where id = p_projet;
  select * into v_reglage from public.envois_daily_projet where projet_id = p_projet;
  v_jour_txt := to_char(v_jour, 'DD/MM/YYYY');
  v_ferie := exists (select 1 from public.jours_feries f where f.jour = v_jour);

    for v_membre in
      select r.nom, n.texte,
             (select a.type from public.absences a where a.ressource_id = r.id and a.jour = v_jour limit 1) as absence
      from public.affectations af
      join public.ressources r on r.id = af.ressource_id
      left join public.notes_daily_projet n on n.user_id = r.user_id and n.jour = v_jour and n.projet_id = p_projet
      where af.projet_id = p_projet and af.role is distinct from v_lecteur
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

  v_a_envoyer := coalesce(v_reglage.mode, 'aucun') <> 'aucun'
    and extract(isodow from v_jour)::text = any (string_to_array(coalesce(v_reglage.jours, ''), ','))
    and not (coalesce(v_reglage.sans_feries, true) and v_ferie);

  return json_build_object(
    'projet', v_projet.code || ' · ' || v_projet.nom,
    'jour', v_jour,
    'a_envoyer', v_a_envoyer,
    'destinataires', coalesce(v_reglage.destinataires, ''),
    'objet', 'Daily ' || v_projet.code || ' · ' || v_projet.nom || ' — ' || v_jour_txt,
    'html', '<div style="font-family:Arial,sans-serif;font-size:14px;color:#1B2333">'
      || '<h2 style="margin:0 0 12px">Daily ' || public.html_texte(v_projet.code || ' · ' || v_projet.nom) || ' — ' || v_jour_txt || '</h2>'
      || '<h3 style="color:#C62828;margin:0 0 4px">Blocages du jour</h3>'
      || case when v_blocages = '' then '<p>Aucun blocage signalé.</p>' else '<ul>' || v_blocages || '</ul>' end
      || v_notes
      || case when v_sans_note = '' then '' else '<p style="margin:12px 0 2px;color:#5B6475">Sans daily :</p><ul>' || v_sans_note || '</ul>' end
      || '</div>',
    'texte', 'Daily ' || v_projet.code || ' · ' || v_projet.nom || ' — ' || v_jour_txt || E'\n' || v_texte
  );
end;
$$;

revoke all on function public.cle_envoi_daily_projet(uuid, boolean), public.daily_projet(uuid, text, date) from public;
grant execute on function public.cle_envoi_daily_projet(uuid, boolean) to authenticated;
grant execute on function public.daily_projet(uuid, text, date) to authenticated, anonymous;

/* Demande de relecture du schéma (à compléter par le réenregistrement
   de la configuration Data API, voir DAT § 10) */
notify pgrst, 'reload schema';
