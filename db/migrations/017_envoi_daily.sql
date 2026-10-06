/* ============================================================
   Migration 017 — Envoi du daily par e-mail (réglage par équipe)
   ------------------------------------------------------------
   Besoin (porteur du projet, 2026-10-06 ; maquette docs/maquettes/envoi-daily/) :
   envoyer chaque jour, à une heure choisie, le daily de l'équipe par e-mail. Chaque
   équipe choisit son mode : Power Automate (flux planifié du porteur, boîte pro ou
   perso) ou Envoi direct (par l'application, livré dans un second temps).
   - envois_daily : réglage d'une équipe (mode, heure, jours, fériés, destinataires) ;
   - cles_envoi_daily : clé secrète d'une équipe, lisible seulement par les fonctions
     ci-dessous (aucun droit direct, même pour un membre) ;
   - cle_envoi_daily(équipe, renouveler) : donne la clé à un administrateur ou au
     responsable de l'équipe (pour la coller dans le flux Power Automate) ;
   - daily_equipe(équipe, clé, jour) : le daily de l'équipe prêt à envoyer (objet, HTML,
     texte, destinataires, « a_envoyer » selon jours et fériés). Appelable SANS compte
     (rôle anonymous) mais seulement avec la bonne clé : c'est ce que lit Power Automate.
   Migration ADDITIVE uniquement (règle n°8) : deux tables nouvelles, vides ; aucune
   donnée existante modifiée.
   ============================================================ */
create table public.envois_daily (
  equipe_id      uuid primary key references public.equipes(id) on delete cascade,
  mode           text not null default 'aucun' check (mode in ('aucun', 'power_automate', 'direct')),
  heure          time not null default '09:30',
  jours          text not null default '1,2,3,4,5' check (jours ~ '^([1-7](,[1-7])*)?$'),
  sans_feries    boolean not null default true,
  destinataires  text not null default '' check (length(destinataires) <= 2000),
  modifie_par    text,
  modifie_le     timestamptz not null default now()
);
create trigger envois_daily_tracer_modification before update on public.envois_daily
  for each row execute function public.tracer_modification();

grant select, insert, update, delete on public.envois_daily to authenticated;
revoke all on public.envois_daily from anonymous;
alter table public.envois_daily enable row level security;
create policy "Lecture : membres ou administrateurs" on public.envois_daily for select to authenticated
  using (public.est_membre_equipe() or public.est_admin());
create policy "Écriture : responsable de l'équipe ou administrateurs" on public.envois_daily for all to authenticated
  using (public.est_admin() or public.est_responsable_equipe(equipe_id))
  with check (public.est_admin() or public.est_responsable_equipe(equipe_id));

-- Clés secrètes : RLS sans aucune règle et aucun droit → illisibles hors des fonctions SECURITY DEFINER
create table public.cles_envoi_daily (
  equipe_id  uuid primary key references public.equipes(id) on delete cascade,
  cle        text not null default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  cree_le    timestamptz not null default now()
);
revoke all on public.cles_envoi_daily from authenticated, anonymous;
alter table public.cles_envoi_daily enable row level security;

-- Clé d'une équipe (créée au premier appel ; « renouveler » invalide l'ancienne)
create or replace function public.cle_envoi_daily(p_equipe uuid, p_renouveler boolean default false)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare v_cle text;
begin
  if not (public.est_admin() or public.est_responsable_equipe(p_equipe)) then
    raise exception 'Réservé aux administrateurs et au responsable de l''équipe';
  end if;
  if p_renouveler then delete from public.cles_envoi_daily where equipe_id = p_equipe; end if;
  insert into public.cles_envoi_daily (equipe_id) values (p_equipe) on conflict (equipe_id) do nothing;
  select c.cle into v_cle from public.cles_envoi_daily c where c.equipe_id = p_equipe;
  return v_cle;
end;
$$;

-- Échappement HTML d'un texte saisi (note de daily, nom)
create or replace function public.html_texte(p text)
returns text language sql immutable set search_path = '' as $$
  select replace(replace(replace(coalesce(p, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
$$;

/* Daily d'une équipe pour un jour (par défaut aujourd'hui, heure de Paris), prêt à envoyer.
   Mêmes règles que Général › Daily des équipes : membres = membres de l'organisation de
   l'équipe ; note au format des rubriques (Hier / Aujourd'hui / Blocages, une ligne « - »
   par point) ; blocages = points de la rubrique « Blocages » sauf « aucun / RAS / néant ».
   a_envoyer = faux si le jour n'est pas coché, si c'est un férié (option) ou si le mode
   est « aucun » : le flux Power Automate teste ce champ avant d'envoyer. */
create or replace function public.daily_equipe(p_equipe uuid, p_cle text, p_jour date default null)
returns json language plpgsql stable security definer set search_path = '' as $$
declare
  v_jour      date := coalesce(p_jour, (now() at time zone 'Europe/Paris')::date);
  v_equipe    public.equipes%rowtype;
  v_reglage   public.envois_daily%rowtype;
  v_membre    record;
  v_ligne     text;
  v_point     text;
  v_rubrique  text;
  v_blocages  text := '';
  v_notes     text := '';
  v_sans_note text := '';
  v_texte     text := '';
  v_jour_txt  text;
  v_ferie     boolean;
  v_a_envoyer boolean;
begin
  if p_cle is null or not exists (select 1 from public.cles_envoi_daily c where c.equipe_id = p_equipe and c.cle = p_cle) then
    raise exception 'Clé invalide';
  end if;
  select * into v_equipe from public.equipes where id = p_equipe;
  select * into v_reglage from public.envois_daily where equipe_id = p_equipe;
  v_jour_txt := to_char(v_jour, 'DD/MM/YYYY');
  v_ferie := exists (select 1 from public.jours_feries f where f.jour = v_jour);

  for v_membre in
    select coalesce(nullif(u.name, ''), u.email) as nom, n.texte,
           (select a.type from public.absences a join public.ressources r on r.id = a.ressource_id
             where r.user_id = m."userId"::text and a.jour = v_jour limit 1) as absence
    from neon_auth.member m
    join neon_auth."user" u on u.id = m."userId"
    left join public.notes_daily n on n.user_id = m."userId"::text and n.jour = v_jour
    where m."organizationId" = p_equipe
    order by 1
  loop
    if v_membre.texte is null or btrim(v_membre.texte) = '' then
      v_sans_note := v_sans_note || '<li>' || public.html_texte(v_membre.nom)
        || coalesce(' — ' || public.html_texte(v_membre.absence), '') || '</li>';
      continue;
    end if;
    v_notes := v_notes || '<h3 style="margin:16px 0 4px">' || public.html_texte(v_membre.nom) || '</h3>';
    v_texte := v_texte || E'\n' || v_membre.nom || E'\n' || v_membre.texte || E'\n';
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
          v_blocages := v_blocages || '<li><b>' || public.html_texte(v_membre.nom) || '</b> : '
            || public.html_texte(v_point) || '</li>';
        end if;
      end if;
    end loop;
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
      || v_notes
      || case when v_sans_note = '' then '' else '<h3 style="margin:16px 0 4px">Sans daily</h3><ul>' || v_sans_note || '</ul>' end
      || '</div>',
    'texte', 'Daily ' || v_equipe.nom || ' — ' || v_jour_txt || E'\n' || v_texte
  );
end;
$$;

revoke all on function public.cle_envoi_daily(uuid, boolean), public.daily_equipe(uuid, text, date), public.html_texte(text) from public;
grant execute on function public.cle_envoi_daily(uuid, boolean) to authenticated;
grant execute on function public.daily_equipe(uuid, text, date) to authenticated, anonymous;
grant execute on function public.html_texte(text) to authenticated, anonymous;

/* Demande de relecture du schéma (à compléter par le réenregistrement
   de la configuration Data API, voir DAT § 10) */
notify pgrst, 'reload schema';
