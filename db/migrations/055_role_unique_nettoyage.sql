/* ============================================================
   Migration 055 — Rôle unique, étape 5 : nettoyage — docs/specifications/role-unique.md § 4 et § 6
   ------------------------------------------------------------
   Demande du porteur (2026-11-02) : « oui, lance le nettoyage de l'étape 5 ». Le rôle d'une personne remplace le rôle par affectation (migration 054) ;
   plus rien dans l'application ni dans la base ne lit l'ancien modèle. Sont retirés :
     - la colonne affectations.role (valeurs : « Chef de projet » 7 fois, « Membre » 7 fois — le rôle est celui de la personne) ;
     - le référentiel « role » (rôles projet : Chef de projet, Membre, Lecteur — 3 valeurs système) ;
     - la valeur « projet » (ancien rôle d'accès) : 30 lignes de la matrice droits_roles (remplacées par « chef » et « membre » depuis 052) et la valeur
       acceptée par les contraintes de roles_acces, roles_prevus et droits_roles (aucune personne ne l'a plus : migration 054) ;
     - dans les fonctions : le filtre « Lecteur » de daily_projet (appelée par Power Automate : le daily d'un projet liste toutes les personnes affectées),
       la branche « role » de propager_renommage_valeur, la valeur « projet » de l'ordre de priorité de mon_role.
   Comptages attendus : affectations 14, valeurs_referentiel 31 → 28, referentiels 6 → 5, droits_roles 240 → 210 ; autres tables identiques.
   ============================================================ */

-- 1. Fonctions qui lisaient l'ancien modèle
create or replace function public.mon_role()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select ra.role from public.roles_acces ra join public.ressources r on r.id = ra.ressource_id
      where r.user_id = auth.user_id()
      order by array_position(array['admin', 'direction', 'responsable', 'chef', 'membre', 'utilisateur', 'lecture'], ra.role) limit 1),
    case
      when exists (select 1 from public.administrateurs a where a.user_id = auth.user_id()) then 'admin'
      when exists (select 1 from public.responsables_equipe x join public.ressources r on r.id = x.ressource_id
                   where r.user_id = auth.user_id())
        or exists (select 1 from neon_auth.member m join public.equipes e on e.id = m."organizationId"
                   where m."userId"::text = auth.user_id() and m.role in ('owner', 'admin')) then 'responsable'
      else 'utilisateur'
    end)
$$;

create or replace function public.propager_renommage_valeur()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.libelle = old.libelle then return new; end if;
  case new.referentiel_id
    when 'poste'   then update public.ressources   set poste        = new.libelle where poste        = old.libelle;
    when 'contrat' then update public.ressources   set type_contrat = new.libelle where type_contrat = old.libelle;
    when 'stp'     then update public.projets      set statut       = new.libelle where statut       = old.libelle;
    when 'methode' then update public.projets      set methode      = new.libelle where methode      = old.libelle;
    when 'abs'     then update public.absences     set type         = new.libelle where type         = old.libelle;
    else null;
  end case;
  return new;
end;
$$;

create or replace function public.daily_projet(p_projet uuid, p_cle text, p_jour date default null)
returns json language plpgsql stable security definer set search_path = '' as $$
declare
  v_jour       date := coalesce(p_jour, (now() at time zone 'Europe/Paris')::date);
  v_projet     public.projets%rowtype;
  v_reglage    public.envois_daily_projet%rowtype;
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
      where af.projet_id = p_projet
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
          continue when v_point = '';
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

-- 2. Colonne et référentiel de l'ancien rôle par projet
alter table public.affectations drop column role;

-- Les 3 valeurs sont « système » : le déclencheur de protection refuse leur suppression, on le suspend le temps du retrait (cascade du référentiel)
alter table public.valeurs_referentiel disable trigger valeurs_referentiel_protection;
delete from public.referentiels where id = 'role';
alter table public.valeurs_referentiel enable trigger valeurs_referentiel_protection;

-- 3. Valeur « projet » (ancien rôle d'accès)
delete from public.droits_roles where role = 'projet';
alter table public.roles_acces drop constraint roles_acces_role_check;
alter table public.roles_acces add constraint roles_acces_role_check
  check (role in ('admin', 'direction', 'responsable', 'chef', 'membre', 'utilisateur', 'lecture'));
alter table public.roles_prevus drop constraint roles_prevus_role_check;
alter table public.roles_prevus add constraint roles_prevus_role_check
  check (role in ('admin', 'direction', 'responsable', 'chef', 'membre', 'utilisateur', 'lecture'));
alter table public.droits_roles drop constraint droits_roles_role_check;
alter table public.droits_roles add constraint droits_roles_role_check
  check (role in ('admin', 'direction', 'responsable', 'chef', 'membre', 'utilisateur', 'lecture'));

notify pgrst, 'reload schema';
