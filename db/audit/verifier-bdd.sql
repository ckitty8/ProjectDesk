/* ============================================================
   Audit de la base (skill « revue-qualite », .claude/skills/)
   ------------------------------------------------------------
   LECTURE SEULE : une seule requête SELECT, aucune écriture. À exécuter sur la branche
   « production » (outil Neon run_sql, ou psql). Chaque ligne renvoyée est un écart :
     controle  — ce qui est vérifié ;
     gravite   — « erreur » (à corriger) ou « avertissement » (à juger) ;
     nombre    — nombre de lignes concernées ;
     exemples  — jusqu'à 5 exemples.
   Aucun résultat = base saine.
   Rappel règle n°8 : une correction de DONNÉES demande l'accord explicite du porteur.
   ============================================================ */
with
-- Tables de l'application (schéma public)
tables as (select c.oid, c.relname as nom, c.relrowsecurity as rls
           from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r'),
-- Libellés actifs ou non d'un référentiel
ref as (select referentiel_id, libelle from public.valeurs_referentiel),
ecarts as (
  /* ---------- Structure et sécurité ---------- */
  select 'Table sans RLS (lisible sans contrôle)' as controle, 'erreur' as gravite, count(*) as nombre, string_agg(nom, ', ') as exemples
    from tables where not rls having count(*) > 0
  union all
  -- Exception voulue : cles_envoi_daily_projet n'est lue que par des fonctions (migration 019)
  select 'Table avec RLS mais sans aucune règle (illisible)', 'avertissement', count(*), string_agg(nom, ', ')
    from tables t where rls and nom <> 'cles_envoi_daily_projet'
      and not exists (select 1 from pg_policy p where p.polrelid = t.oid) having count(*) > 0
  union all
  select 'Table sans clé primaire', 'erreur', count(*), string_agg(nom, ', ')
    from tables t where not exists (select 1 from pg_constraint k where k.conrelid = t.oid and k.contype = 'p') having count(*) > 0
  union all
  select 'Droit accordé au rôle anonymous sur une table', 'erreur', count(*), string_agg(distinct table_name, ', ')
    from information_schema.role_table_grants where grantee = 'anonymous' and table_schema = 'public' having count(*) > 0
  union all
  select 'Fonction SECURITY DEFINER sans search_path fixé', 'erreur', count(*), string_agg(p.proname, ', ')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
    having count(*) > 0
  union all
  select 'Clé étrangère sans index (lenteur possible)', 'avertissement', count(*), string_agg(k.conrelid::regclass || '(' || k.conname || ')', ', ')
    from pg_constraint k join tables t on t.oid = k.conrelid
    where k.contype = 'f' and not exists (select 1 from pg_index i where i.indrelid = k.conrelid and (i.indkey::int2[])[0:array_length(k.conkey, 1) - 1] @> k.conkey::int2[])
    having count(*) > 0
  union all
  -- Fonction jamais utilisée en base (ni règle RLS, ni trigger, ni autre fonction) : vérifier
  -- qu'elle est appelée par l'application (/rpc/<nom> ou Api.executer('<nom>') dans app/), sinon code mort
  select 'Fonction non référencée en base (vérifier son appel dans app/)', 'avertissement', count(*), string_agg(p.proname, ', ')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and not exists (select 1 from pg_trigger g where g.tgfoid = p.oid)
      and not exists (select 1 from pg_policy r where pg_get_expr(r.polqual, r.polrelid) like '%' || p.proname || '(%'
                                                    or pg_get_expr(r.polwithcheck, r.polrelid) like '%' || p.proname || '(%')
      and not exists (select 1 from pg_proc q join pg_namespace m on m.oid = q.pronamespace
                      where m.nspname = 'public' and q.oid <> p.oid and q.prosrc like '%' || p.proname || '(%')
      and not exists (select 1 from pg_attrdef d where pg_get_expr(d.adbin, d.adrelid) like '%' || p.proname || '(%')
    having count(*) > 0

  /* ---------- Données : valeurs hors référentiel (listes en base, règle n°4) ---------- */
  union all
  select 'Projet avec un statut hors référentiel', 'erreur', count(*), string_agg(code || '=' || statut, ', ')
    from public.projets where statut not in (select libelle from ref where referentiel_id = 'stp') having count(*) > 0
  union all
  select 'Projet avec une méthode hors référentiel', 'erreur', count(*), string_agg(code || '=' || methode, ', ')
    from public.projets where methode is not null and methode not in (select libelle from ref where referentiel_id = 'methode') having count(*) > 0
  union all
  select 'Projet sans méthode', 'avertissement', count(*), string_agg(code, ', ')
    from public.projets where methode is null having count(*) > 0
  union all
  select 'Affectation avec un rôle hors référentiel', 'erreur', count(*), string_agg(role, ', ')
    from public.affectations where role not in (select libelle from ref where referentiel_id = 'role') having count(*) > 0
  union all
  select 'Absence avec un type hors référentiel', 'erreur', count(*), string_agg(distinct type, ', ')
    from public.absences where type not in (select libelle from ref where referentiel_id = 'abs') having count(*) > 0
  union all
  select 'Ressource avec un poste hors référentiel', 'erreur', count(*), string_agg(nom || '=' || poste, ', ')
    from public.ressources where poste is not null and poste not in (select libelle from ref where referentiel_id = 'poste') having count(*) > 0
  union all
  select 'Ressource avec un contrat hors référentiel', 'erreur', count(*), string_agg(nom || '=' || type_contrat, ', ')
    from public.ressources where type_contrat is not null and type_contrat not in (select libelle from ref where referentiel_id = 'contrat') having count(*) > 0
  union all
  select 'Valeur système sans clé technique', 'erreur', count(*), string_agg(referentiel_id || ':' || libelle, ', ')
    from public.valeurs_referentiel where systeme and cle is null having count(*) > 0
  union all
  select 'Aucun administrateur', 'erreur', 1, null
    where not exists (select 1 from public.administrateurs)

  /* ---------- Données : cohérence entre tables ---------- */
  union all
  select 'Ressource : date de fin avant la date d''arrivée', 'erreur', count(*), string_agg(nom, ', ')
    from public.ressources where date_depart < date_arrivee having count(*) > 0
  union all
  select 'Même email sur plusieurs fiches ressource', 'erreur', count(*), string_agg(distinct email, ', ')
    from public.ressources r where email is not null and (select count(*) from public.ressources x where lower(x.email) = lower(r.email)) > 1 having count(*) > 0
  union all
  select 'Même compte relié à plusieurs fiches ressource', 'avertissement', count(*), string_agg(distinct nom, ', ')
    from public.ressources r where user_id is not null and (select count(*) from public.ressources x where x.user_id = r.user_id) > 1 having count(*) > 0
  union all
  select 'Chef de projet (fiche) non affecté au projet', 'avertissement', count(*), string_agg(p.code, ', ')
    from public.projets p where p.chef_id is not null
      and not exists (select 1 from public.affectations a where a.projet_id = p.id and a.ressource_id = p.chef_id) having count(*) > 0
  union all
  select 'Unité rattachée à elle-même', 'erreur', count(*), string_agg(nom, ', ')
    from public.equipes where parent_id = id having count(*) > 0
  union all
  select 'Absence en dehors de la présence de la personne', 'avertissement', count(*), string_agg(distinct r.nom, ', ')
    from public.absences a join public.ressources r on r.id = a.ressource_id
    where a.jour > r.date_depart or a.jour < r.date_arrivee having count(*) > 0
  union all
  select 'Heures saisies en dehors de la présence de la personne', 'erreur', count(*), string_agg(distinct r.nom, ', ')
    from public.temps_saisis t join public.ressources r on r.id = t.ressource_id
    where t.jour > r.date_depart or t.jour < r.date_arrivee having count(*) > 0
  union all
  select 'Heures saisies un week-end', 'avertissement', count(*), string_agg(distinct t.jour::text, ', ')
    from public.temps_saisis t where extract(isodow from t.jour) > 5 having count(*) > 0
  union all
  select 'Heures saisies sur un projet sans affectation', 'avertissement', count(*), string_agg(distinct r.nom, ', ')
    from public.temps_saisis t join public.ressources r on r.id = t.ressource_id
    where not exists (select 1 from public.affectations a where a.projet_id = t.projet_id and a.ressource_id = t.ressource_id) having count(*) > 0
  union all
  select 'Sprint : début après la fin', 'erreur', count(*), string_agg(numero::text, ', ')
    from public.sprints_projet where debut > fin having count(*) > 0
  union all
  select 'Sprint sans dates (inutilisable par Capacité et Plan de charge)', 'avertissement', count(*), string_agg(p.code || ' n°' || s.numero, ', ')
    from public.sprints_projet s join public.projets p on p.id = s.projet_id where s.debut is null or s.fin is null having count(*) > 0
  union all
  select 'Plan de charge : une personne prévue à plus de 100 %', 'erreur', count(*), string_agg(nom || ' ' || total || ' %', ', ')
    from (select r.nom, sum(v.part) total from public.previsions_temps v join public.ressources r on r.id = v.ressource_id group by r.nom having sum(v.part) > 100) x
    having count(*) > 0
  union all
  select 'Plan de charge : types de tâche d''un projet ≠ 100 %', 'avertissement', count(*), string_agg(code || ' ' || total || ' %', ', ')
    from (select p.code, sum(t.part) total from public.types_tache_projet t join public.projets p on p.id = t.projet_id group by p.code having sum(t.part) <> 100) x
    having count(*) > 0
  union all
  select 'Daily sur un projet où la personne n''est pas affectée', 'avertissement', count(*), string_agg(distinct p.code, ', ')
    from public.notes_daily_projet n join public.projets p on p.id = n.projet_id
    where not exists (select 1 from public.affectations a join public.ressources r on r.id = a.ressource_id
                      where a.projet_id = n.projet_id and r.user_id = n.user_id) having count(*) > 0
  union all
  select 'Envoi du daily actif sans destinataire', 'avertissement', count(*), string_agg(p.code, ', ')
    from public.envois_daily_projet e join public.projets p on p.id = e.projet_id
    where e.mode <> 'aucun' and btrim(e.destinataires) = '' having count(*) > 0
)
select * from ecarts order by gravite desc, controle;
