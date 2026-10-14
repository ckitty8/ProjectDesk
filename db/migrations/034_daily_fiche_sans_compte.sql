/* ============================================================
   Migration 034 — Daily d'une personne sans compte (import du CR Daily Excel)
   ------------------------------------------------------------
   Porteur (2026-10-14, « Rattacher à la fiche » puis « ok ») : le fichier CR_Daily_final_2.xlsx
   est importé dans notes_daily_projet. Nouha et Lenaic n'ont pas encore de compte de connexion,
   or un daily appartient à un compte (user_id).
   → Convention : user_id = 'fiche:' || id de la fiche (ressources.id) pour un daily importé d'une
     personne sans compte. La colonne est déjà du texte, la clé (user_id, jour, projet_id) reste unique.
   → Déclencheur : quand un compte est relié à la fiche (ressources.user_id renseigné), ses dailys
     « fiche:… » passent sur ce compte (sauf un jour / projet déjà écrit par le compte : gardé tel quel).
   Lecture inchangée (peut_lire_daily_projet) ; écriture : on n'écrit que son propre daily, une
   note « fiche:… » n'est donc modifiable par personne depuis l'application.
   Additif : une fonction et un déclencheur, aucune donnée existante modifiée (règle n°8).
   ============================================================ */

create or replace function public.transferer_daily_fiche()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.notes_daily_projet n set user_id = new.user_id
   where n.user_id = 'fiche:' || new.id::text
     and not exists (select 1 from public.notes_daily_projet x
                     where x.user_id = new.user_id and x.jour = n.jour and x.projet_id = n.projet_id);
  return new;
end;
$$;
revoke all on function public.transferer_daily_fiche() from public;

create trigger ressources_transferer_daily
  after update of user_id on public.ressources
  for each row when (new.user_id is not null and old.user_id is distinct from new.user_id)
  execute function public.transferer_daily_fiche();
