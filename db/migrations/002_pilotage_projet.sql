/* ============================================================
   Migration 002 — Schéma « Pilotage Projet »
   ------------------------------------------------------------
   Remplace le schéma Roadmap PM (migration 001) : les tables
   demandes (backlog) et capacites, vides, sont supprimées avec
   l'accord du porteur du projet (2026-09-25).

   Principes (voir docs/DAT.md) :
   - 1 organisation Neon Auth = 1 équipe (table equipes, même id).
   - Lecture : tout membre d'une équipe enregistrée lit tout.
   - Écriture : dans ses équipes et dans les projets où l'on est
     « Chef de projet » ou « Membre » (le rôle « Lecteur » ne modifie pas).
   - Administrateurs globaux (table administrateurs) : équipes,
     référentiels, champs du formulaire de demande.
   - Demandeurs (compte sans équipe) : déposent et lisent LEURS demandes.
   - Rôle anonymous : aucun droit.
   Colonnes en snake_case ; conversion camelCase côté app (app/js/api.js).
   ============================================================ */


/* ---------- 0. Nettoyage du schéma Roadmap PM ---------- */
drop table if exists public.demandes cascade;
drop table if exists public.capacites cascade;
drop function if exists public.mes_organisations();


/* ---------- 1. Tables de référence (administration) ---------- */

-- Administrateurs globaux : identifiants d'utilisateurs Neon Auth.
-- Le premier administrateur est ajouté à la main (voir app/README.md).
create table public.administrateurs (
  user_id     text primary key,
  cree_le     timestamptz not null default now()
);

-- Équipes : une ligne par organisation Neon Auth « reconnue » par l'application.
-- Une organisation créée hors de l'écran Administration n'ouvre donc aucun accès.
create table public.equipes (
  id              uuid primary key references neon_auth.organization(id) on delete cascade,
  nom             text not null,
  prefixe         text not null,                 -- préfixe des codes projet (ex. PF)
  couleur         text not null default '#003CC8',
  responsable_id  uuid,                          -- ressource responsable (FK ajoutée plus bas)
  cree_par        text default auth.user_id(),
  cree_le         timestamptz not null default now(),
  modifie_par     text,
  modifie_le      timestamptz not null default now()
);

-- Référentiels administrables (types de demande, priorités, statuts, rôles, absences...)
create table public.referentiels (
  id     text primary key,                       -- ex. 'type', 'prio', 'stp'
  nom    text not null,
  ordre  smallint not null default 0
);

-- Valeurs d'un référentiel. « systeme » = valeur utilisée par les calculs de
-- l'application : elle peut être désactivée ou recolorée, mais pas renommée ni supprimée.
create table public.valeurs_referentiel (
  id              uuid primary key default gen_random_uuid(),
  referentiel_id  text not null references public.referentiels(id) on delete cascade,
  libelle         text not null,
  abrege          text,                          -- libellé court (ex. CP, RTT pour les absences)
  couleur         text not null default '#4A5363',
  actif           boolean not null default true,
  systeme         boolean not null default false,
  ordre           smallint not null default 0,
  unique (referentiel_id, libelle)
);

-- Champs du formulaire de demande. « cle » = colonne de la table demandes
-- alimentée par le champ ; sans clé, la valeur est rangée dans demandes.valeurs (jsonb).
create table public.champs_formulaire (
  id              uuid primary key default gen_random_uuid(),
  ordre           smallint not null default 0,
  libelle         text not null,
  type            text not null check (type in ('Texte court','Texte long','Liste','Date','Nombre','Fichier')),
  obligatoire     boolean not null default false,
  referentiel_id  text,                          -- pour une Liste : id de référentiel ou 'equipes'
  cle             text,                          -- titre, type, description, equipe_id, priorite, date_souhaitee, budget
  systeme         boolean not null default false,
  modifie_par     text,
  modifie_le      timestamptz not null default now()
);

create table public.jours_feries (
  jour     date primary key,
  libelle  text not null
);


/* ---------- 2. Ressources, objectifs, projets ---------- */

-- Ressources = personnes d'une équipe (avec ou sans compte de connexion).
create table public.ressources (
  id          uuid primary key default gen_random_uuid(),
  equipe_id   uuid not null references public.equipes(id) on delete cascade,
  nom         text not null,
  poste       text,
  capacite    smallint not null default 100 check (capacite between 0 and 100),  -- % de temps disponible
  email       text,
  user_id     text unique,                       -- compte Neon Auth lié (null si pas de compte)
  cree_par    text default auth.user_id(),
  cree_le     timestamptz not null default now(),
  modifie_par text,
  modifie_le  timestamptz not null default now()
);
create index ressources_equipe_idx on public.ressources (equipe_id);

alter table public.equipes
  add constraint equipes_responsable_fk foreign key (responsable_id) references public.ressources(id) on delete set null;

-- Objectifs (OKR) d'une équipe pour un trimestre, et leurs résultats clés.
create table public.objectifs (
  id          uuid primary key default gen_random_uuid(),
  equipe_id   uuid not null references public.equipes(id) on delete cascade,
  annee       smallint not null,
  trimestre   smallint not null check (trimestre between 1 and 4),
  code        text not null,                     -- ex. O1
  titre       text not null,
  confiance   text not null default 'moyenne' check (confiance in ('haute','moyenne','faible')),
  cree_par    text default auth.user_id(),
  cree_le     timestamptz not null default now(),
  modifie_par text,
  modifie_le  timestamptz not null default now()
);

create table public.resultats_cles (
  id            uuid primary key default gen_random_uuid(),
  objectif_id   uuid not null references public.objectifs(id) on delete cascade,
  code          text not null,                   -- ex. KR1.1
  libelle       text not null,
  progression   smallint not null default 0 check (progression between 0 and 100),
  modifie_par   text,
  modifie_le    timestamptz not null default now()
);

create table public.projets (
  id              uuid primary key default gen_random_uuid(),
  equipe_id       uuid not null references public.equipes(id) on delete cascade,
  code            text not null unique,          -- ex. PF-12
  nom             text not null,
  description     text,
  resultat_cle_id uuid references public.resultats_cles(id) on delete set null,
  chef_id         uuid references public.ressources(id) on delete set null,
  debut           date,
  fin             date,
  statut          text not null default 'Planifié',   -- référentiel « stp »
  avancement      smallint not null default 0 check (avancement between 0 and 100),
  cree_par        text default auth.user_id(),
  cree_le         timestamptz not null default now(),
  modifie_par     text,
  modifie_le      timestamptz not null default now()
);
create index projets_equipe_idx on public.projets (equipe_id);

-- Affectation d'une ressource à un projet, avec son rôle (référentiel « role »).
create table public.affectations (
  id            uuid primary key default gen_random_uuid(),
  projet_id     uuid not null references public.projets(id) on delete cascade,
  ressource_id  uuid not null references public.ressources(id) on delete cascade,
  role          text not null default 'Membre',
  modifie_par   text,
  modifie_le    timestamptz not null default now(),
  unique (projet_id, ressource_id)
);

create table public.tickets (
  id          uuid primary key default gen_random_uuid(),
  projet_id   uuid not null references public.projets(id) on delete cascade,
  numero      text not null,                     -- ex. PF-14.3
  titre       text not null,
  statut      text not null default 'À faire',   -- référentiel « stt »
  priorite    text not null default 'Moyenne',   -- référentiel « prio »
  assigne_id  uuid references public.ressources(id) on delete set null,
  cree_par    text default auth.user_id(),
  cree_le     timestamptz not null default now(),
  modifie_par text,
  modifie_le  timestamptz not null default now()
);
create index tickets_projet_idx on public.tickets (projet_id);


/* ---------- 3. Congés, temps, daily ---------- */

-- Une absence = une ressource, un jour, un type (référentiel « abs »).
create table public.absences (
  ressource_id  uuid not null references public.ressources(id) on delete cascade,
  jour          date not null,
  type          text not null,
  modifie_par   text,
  modifie_le    timestamptz not null default now(),
  primary key (ressource_id, jour)
);

-- Heures saisies par une ressource, un jour, sur un projet.
create table public.temps_saisis (
  id            uuid primary key default gen_random_uuid(),
  ressource_id  uuid not null references public.ressources(id) on delete cascade,
  projet_id     uuid not null references public.projets(id) on delete cascade,
  jour          date not null,
  heures        numeric(4,2) not null check (heures >= 0 and heures <= 24),
  modifie_par   text,
  modifie_le    timestamptz not null default now(),
  unique (ressource_id, projet_id, jour)
);

-- Feuille de temps hebdomadaire (semaine = date du lundi) et son statut.
create table public.feuilles_temps (
  ressource_id  uuid not null references public.ressources(id) on delete cascade,
  semaine       date not null,
  statut        text not null default 'en_saisie' check (statut in ('en_saisie','soumise','validee','a_completer')),
  commentaire   text,
  modifie_par   text,
  modifie_le    timestamptz not null default now(),
  primary key (ressource_id, semaine)
);

-- Notes de stand-up personnelles (visibles par leur seul auteur).
create table public.notes_daily (
  user_id     text not null default auth.user_id(),
  jour        date not null,
  texte       text not null default '',
  modifie_par text,
  modifie_le  timestamptz not null default now(),
  primary key (user_id, jour)
);


/* ---------- 4. Demandes entrantes ---------- */
create table public.demandes (
  id              uuid primary key default gen_random_uuid(),
  numero          integer generated always as identity,   -- affiché DEM-047
  titre           text not null,
  type            text,                         -- référentiel « type »
  description     text,
  equipe_id       uuid references public.equipes(id) on delete set null,
  priorite        text,                         -- référentiel « prio »
  date_souhaitee  date,
  budget          numeric(10,1),                -- k€
  valeurs         jsonb not null default '{}',  -- champs ajoutés par l'administration
  statut          text not null default 'nouvelle' check (statut in ('nouvelle','analyse','acceptee','refusee')),
  commentaire     text,
  demandeur_id    text not null default auth.user_id(),
  demandeur_nom   text,
  service         text,
  projet_id       uuid references public.projets(id) on delete set null,
  cree_le         timestamptz not null default now(),
  modifie_par     text,
  modifie_le      timestamptz not null default now()
);
create index demandes_equipe_idx on public.demandes (equipe_id);


/* ---------- 5. Fonctions de sécurité ----------
   SECURITY DEFINER : elles lisent neon_auth.member / administrateurs sans
   donner ces tables au rôle « authenticated ». search_path vide = noms qualifiés. */

-- Équipes (organisations reconnues) dont l'utilisateur est membre.
create or replace function public.mes_equipes()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select e.id from public.equipes e
  join neon_auth.member m on m."organizationId" = e.id
  where m."userId"::text = auth.user_id()
$$;

-- L'utilisateur appartient-il à au moins une équipe ? (droit de lecture global)
create or replace function public.est_membre_equipe()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.mes_equipes())
$$;

create or replace function public.est_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.administrateurs a where a.user_id = auth.user_id())
$$;

-- Responsable d'équipe = rôle owner ou admin dans l'organisation de l'équipe.
create or replace function public.est_responsable_equipe(p_equipe uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from neon_auth.member m
                 where m."organizationId" = p_equipe and m."userId"::text = auth.user_id()
                   and m.role in ('owner','admin'))
$$;

-- Ressource(s) liée(s) au compte connecté.
create or replace function public.mes_ressources()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select r.id from public.ressources r where r.user_id = auth.user_id()
$$;

-- Peut modifier un projet : membre de l'équipe du projet, ou affecté comme
-- « Chef de projet » / « Membre » (le rôle « Lecteur » ne donne pas l'écriture).
create or replace function public.peut_editer_projet(p_projet uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.projets p
                 where p.id = p_projet and p.equipe_id in (select public.mes_equipes()))
      or exists (select 1 from public.affectations a
                 where a.projet_id = p_projet and a.role in ('Chef de projet','Membre')
                   and a.ressource_id in (select public.mes_ressources()))
$$;

-- Lie le compte connecté à la ressource portant le même email (appelée à la connexion).
create or replace function public.lier_ma_ressource()
returns void language sql volatile security definer set search_path = '' as $$
  update public.ressources set user_id = auth.user_id()
  where user_id is null and lower(email) = lower(auth.jwt() ->> 'email')
$$;

revoke all on function public.mes_equipes(), public.est_membre_equipe(), public.est_admin(),
  public.est_responsable_equipe(uuid), public.mes_ressources(), public.peut_editer_projet(uuid),
  public.lier_ma_ressource() from public;
grant execute on function public.mes_equipes(), public.est_membre_equipe(), public.est_admin(),
  public.est_responsable_equipe(uuid), public.mes_ressources(), public.peut_editer_projet(uuid),
  public.lier_ma_ressource() to authenticated;


/* ---------- 6. Contrôles métier (triggers) ---------- */

-- Feuilles de temps : seul un responsable d'équipe peut valider ou renvoyer
-- (statuts 'validee' / 'a_completer') ; une feuille validée n'est plus modifiable
-- par la personne elle-même.
create or replace function public.controler_feuille_temps()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_equipe uuid;
begin
  select r.equipe_id into v_equipe from public.ressources r where r.id = new.ressource_id;
  if new.statut in ('validee','a_completer') and not public.est_responsable_equipe(v_equipe) then
    raise exception 'Seul un responsable d''équipe peut valider ou renvoyer une feuille de temps';
  end if;
  if tg_op = 'UPDATE' and old.statut = 'validee' and not public.est_responsable_equipe(v_equipe) then
    raise exception 'Feuille de temps déjà validée';
  end if;
  return new;
end;
$$;

-- Heures : interdit de modifier les heures d'une semaine validée.
create or replace function public.controler_temps_saisi()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_statut text;
begin
  select f.statut into v_statut from public.feuilles_temps f
  where f.ressource_id = coalesce(new.ressource_id, old.ressource_id)
    and f.semaine = date_trunc('week', coalesce(new.jour, old.jour)::timestamp)::date;
  if v_statut = 'validee' then
    raise exception 'Semaine validée : heures non modifiables';
  end if;
  return coalesce(new, old);
end;
$$;

-- Valeurs « système » d'un référentiel : ni renommées ni supprimées.
create or replace function public.proteger_valeur_systeme()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and old.systeme then raise exception 'Valeur système : suppression impossible'; end if;
  if tg_op = 'UPDATE' and old.systeme and new.libelle <> old.libelle then raise exception 'Valeur système : renommage impossible'; end if;
  return coalesce(new, old);
end;
$$;

create trigger feuilles_temps_controle before insert or update on public.feuilles_temps
  for each row execute function public.controler_feuille_temps();
create trigger temps_saisis_controle before insert or update or delete on public.temps_saisis
  for each row execute function public.controler_temps_saisi();
create trigger valeurs_referentiel_protection before update or delete on public.valeurs_referentiel
  for each row execute function public.proteger_valeur_systeme();

-- Traçabilité (fonction tracer_modification() créée par la migration 001)
do $$
declare t text;
begin
  foreach t in array array['equipes','champs_formulaire','ressources','objectifs','resultats_cles','projets',
                           'affectations','tickets','absences','temps_saisis','feuilles_temps','notes_daily','demandes']
  loop
    execute format('create trigger %I before update on public.%I for each row execute function public.tracer_modification()',
                   t || '_tracer_modification', t);
  end loop;
end $$;


/* ---------- 7. Droits (GRANT) et sécurité par ligne (RLS) ---------- */
do $$
declare t text;
begin
  foreach t in array array['administrateurs','equipes','referentiels','valeurs_referentiel','champs_formulaire',
                           'jours_feries','ressources','objectifs','resultats_cles','projets','affectations',
                           'tickets','absences','temps_saisis','feuilles_temps','notes_daily','demandes']
  loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anonymous', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- 7.1 Administration : lisible par tout utilisateur connecté (formulaire de demande),
--     modifiable par les administrateurs globaux.
do $$
declare t text;
begin
  foreach t in array array['equipes','referentiels','valeurs_referentiel','champs_formulaire','jours_feries']
  loop
    execute format('create policy "Lecture : utilisateurs connectés" on public.%I for select to authenticated using (true)', t);
    execute format('create policy "Écriture : administrateurs" on public.%I for all to authenticated using (public.est_admin()) with check (public.est_admin())', t);
  end loop;
end $$;

create policy "Lecture : administrateurs" on public.administrateurs
  for select to authenticated using (public.est_admin() or user_id = auth.user_id());
create policy "Écriture : administrateurs" on public.administrateurs
  for all to authenticated using (public.est_admin()) with check (public.est_admin());

-- 7.2 Données d'équipe : lecture par tout membre, écriture par l'équipe concernée.
create policy "Lecture : membres" on public.ressources for select to authenticated using (public.est_membre_equipe());
create policy "Écriture : équipe" on public.ressources for all to authenticated
  using (equipe_id in (select public.mes_equipes()) or public.est_admin())
  with check (equipe_id in (select public.mes_equipes()) or public.est_admin());

create policy "Lecture : membres" on public.objectifs for select to authenticated using (public.est_membre_equipe());
create policy "Écriture : équipe" on public.objectifs for all to authenticated
  using (equipe_id in (select public.mes_equipes())) with check (equipe_id in (select public.mes_equipes()));

create policy "Lecture : membres" on public.resultats_cles for select to authenticated using (public.est_membre_equipe());
create policy "Écriture : équipe" on public.resultats_cles for all to authenticated
  using (objectif_id in (select o.id from public.objectifs o where o.equipe_id in (select public.mes_equipes())))
  with check (objectif_id in (select o.id from public.objectifs o where o.equipe_id in (select public.mes_equipes())));

-- 7.3 Projets : création dans ses équipes ; modification selon peut_editer_projet().
create policy "Lecture : membres" on public.projets for select to authenticated using (public.est_membre_equipe());
create policy "Création : équipe" on public.projets for insert to authenticated
  with check (equipe_id in (select public.mes_equipes()));
create policy "Modification : projet" on public.projets for update to authenticated
  using (public.peut_editer_projet(id)) with check (public.peut_editer_projet(id));
create policy "Suppression : équipe" on public.projets for delete to authenticated
  using (equipe_id in (select public.mes_equipes()));

create policy "Lecture : membres" on public.affectations for select to authenticated using (public.est_membre_equipe());
create policy "Écriture : projet" on public.affectations for all to authenticated
  using (public.peut_editer_projet(projet_id)) with check (public.peut_editer_projet(projet_id));

create policy "Lecture : membres" on public.tickets for select to authenticated using (public.est_membre_equipe());
create policy "Écriture : projet" on public.tickets for all to authenticated
  using (public.peut_editer_projet(projet_id)) with check (public.peut_editer_projet(projet_id));

-- 7.4 Absences et temps : la personne elle-même ou son équipe.
create policy "Lecture : membres" on public.absences for select to authenticated using (public.est_membre_equipe());
create policy "Écriture : personne ou équipe" on public.absences for all to authenticated
  using (ressource_id in (select public.mes_ressources())
         or ressource_id in (select r.id from public.ressources r where r.equipe_id in (select public.mes_equipes())))
  with check (ressource_id in (select public.mes_ressources())
         or ressource_id in (select r.id from public.ressources r where r.equipe_id in (select public.mes_equipes())));

create policy "Lecture : membres" on public.temps_saisis for select to authenticated using (public.est_membre_equipe());
create policy "Écriture : personne ou équipe" on public.temps_saisis for all to authenticated
  using (ressource_id in (select public.mes_ressources())
         or ressource_id in (select r.id from public.ressources r where r.equipe_id in (select public.mes_equipes())))
  with check (ressource_id in (select public.mes_ressources())
         or ressource_id in (select r.id from public.ressources r where r.equipe_id in (select public.mes_equipes())));

create policy "Lecture : membres" on public.feuilles_temps for select to authenticated using (public.est_membre_equipe());
create policy "Écriture : personne ou équipe" on public.feuilles_temps for all to authenticated
  using (ressource_id in (select public.mes_ressources())
         or ressource_id in (select r.id from public.ressources r where r.equipe_id in (select public.mes_equipes())))
  with check (ressource_id in (select public.mes_ressources())
         or ressource_id in (select r.id from public.ressources r where r.equipe_id in (select public.mes_equipes())));

-- 7.5 Daily : notes privées.
create policy "Auteur uniquement" on public.notes_daily for all to authenticated
  using (user_id = auth.user_id()) with check (user_id = auth.user_id());

-- 7.6 Demandes : le demandeur dépose et lit les siennes ; les membres lisent tout ;
--     l'équipe destinataire traite (modifie) les demandes qui lui sont adressées.
create policy "Lecture : demandeur ou membres" on public.demandes for select to authenticated
  using (demandeur_id = auth.user_id() or public.est_membre_equipe());
create policy "Dépôt : tout utilisateur connecté" on public.demandes for insert to authenticated
  with check (demandeur_id = auth.user_id() and statut = 'nouvelle');
create policy "Traitement : équipe destinataire" on public.demandes for update to authenticated
  using (equipe_id in (select public.mes_equipes()))
  with check (equipe_id in (select public.mes_equipes()));


/* ---------- 8. Données initiales ---------- */

insert into public.referentiels (id, nom, ordre) values
  ('type', 'Types de demande', 1), ('prio', 'Priorités', 2), ('stp', 'Statuts projet', 3),
  ('stt', 'Statuts ticket', 4), ('role', 'Rôles projet', 5), ('abs', 'Types d''absence', 6);

-- Valeurs reprises de la maquette. systeme = utilisée par les calculs (config.js).
insert into public.valeurs_referentiel (referentiel_id, libelle, abrege, couleur, systeme, ordre) values
  ('type','Nouveau projet',null,'#003CC8',false,1), ('type','Évolution',null,'#0F8A6B',false,2),
  ('type','Anomalie',null,'#A32020',false,3), ('type','Accès / droits',null,'#7A3FC2',false,4),
  ('type','Donnée / rapport',null,'#B25E09',false,5),
  ('prio','Critique',null,'#A32020',false,1), ('prio','Haute',null,'#B25E09',false,2),
  ('prio','Moyenne',null,'#4A5363',false,3), ('prio','Basse',null,'#8A93A3',false,4),
  ('stp','Planifié',null,'#8A93A3',true,1), ('stp','En cours',null,'#003CC8',true,2),
  ('stp','À risque',null,'#D98A1C',true,3), ('stp','En retard',null,'#D14343',true,4),
  ('stp','Terminé',null,'#0F8A6B',true,5),
  ('stt','À faire',null,'#4A5363',true,1), ('stt','En cours',null,'#003CC8',true,2),
  ('stt','En revue',null,'#5E2CA5',true,3), ('stt','Terminé',null,'#0F8A6B',true,4),
  ('role','Chef de projet',null,'#003CC8',true,1), ('role','Membre',null,'#4A5363',true,2),
  ('role','Lecteur',null,'#8A93A3',true,3),
  ('abs','Congés payés','CP','#003CC8',true,1), ('abs','RTT','RTT','#0F8A6B',false,2),
  ('abs','Maladie','MA','#A32020',false,3), ('abs','Formation','FO','#B25E09',false,4);

insert into public.champs_formulaire (ordre, libelle, type, obligatoire, referentiel_id, cle, systeme) values
  (1,'Titre de la demande','Texte court',true,null,'titre',true),
  (2,'Type de demande','Liste',true,'type','type',true),
  (3,'Description du besoin','Texte long',true,null,'description',false),
  (4,'Équipe concernée','Liste',true,'equipes','equipe_id',true),
  (5,'Priorité souhaitée','Liste',false,'prio','priorite',false),
  (6,'Date de livraison souhaitée','Date',false,null,'date_souhaitee',false),
  (7,'Budget estimé (k€)','Nombre',false,null,'budget',false),
  (8,'Pièces jointes','Fichier',false,null,null,false);

insert into public.jours_feries (jour, libelle) values
  ('2026-01-01','Jour de l''an'), ('2026-04-06','Lundi de Pâques'), ('2026-05-01','Fête du travail'),
  ('2026-05-08','Victoire 1945'), ('2026-05-14','Ascension'), ('2026-05-25','Lundi de Pentecôte'),
  ('2026-07-14','Fête nationale'), ('2026-08-15','Assomption'), ('2026-11-01','Toussaint'),
  ('2026-11-11','Armistice'), ('2026-12-25','Noël'),
  ('2027-01-01','Jour de l''an'), ('2027-03-29','Lundi de Pâques'), ('2027-05-01','Fête du travail'),
  ('2027-05-06','Ascension'), ('2027-05-08','Victoire 1945'), ('2027-05-17','Lundi de Pentecôte'),
  ('2027-07-14','Fête nationale'), ('2027-08-15','Assomption'), ('2027-11-01','Toussaint'),
  ('2027-11-11','Armistice'), ('2027-12-25','Noël');
