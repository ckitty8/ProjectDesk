/* ============================================================
   Migration 043 — Supprimer un projet : seulement ceux que l'on peut modifier
   ------------------------------------------------------------
   Suite de la 042 (porteur, 2026-10-23, « Thomas n'est pas affecté au projet CDO mais il peut le
   paramétrer »). La suppression d'un projet n'exigeait que d'être membre de son équipe (et le droit
   « projets » de la matrice) : un rôle Projet pouvait donc supprimer un projet auquel il n'est pas
   affecté. Elle suit maintenant peut_editer_projet : administrateur, responsable / direction de
   l'unité, ou personne affectée Chef de projet / Membre. Aucune donnée modifiée (règle n°8).
   ============================================================ */
alter policy "Suppression : équipe" on public.projets
  using (public.peut_editer_projet(id) and public.a_droit('projets'));
