/* ============================================================
   Migration 044 — MEP : nombre de tickets livrés (Bug, Incident, US)
   ------------------------------------------------------------
   Porteur (2026-10-24) : « Mon dashboard › Mises en production : à la place de contenu, je veux
   le nombre de tickets Bug, Incident, US livrés ». Trois compteurs par mise en production.
   Migration ADDITIVE (règle n°8) : trois colonnes avec valeur par défaut 0 ; la colonne
   « contenu » est conservée en base (non affichée) et aucune ligne n'est modifiée.
   Les droits de la table (migrations 039 et 042) ne changent pas.
   ============================================================ */
alter table public.mises_en_production
  add column nb_bugs      integer not null default 0 check (nb_bugs >= 0),
  add column nb_incidents integer not null default 0 check (nb_incidents >= 0),
  add column nb_us        integer not null default 0 check (nb_us >= 0);

notify pgrst, 'reload schema';
