/* ============================================================
   Migration 051 — Le référentiel « Postes » s'appelle « Profil »
   ------------------------------------------------------------
   Demande du porteur (2026-11-02) : dans Administration › Ressources, la liste des postes s'appelle « Profil » (choix : « Les postes,
   renommés Profil »). Seul le NOM du référentiel (colonne nom de la ligne « poste ») change : l'identifiant « poste », ses 9 valeurs, la colonne
   ressources.poste et toutes les données restent identiques. Une ligne modifiée (règle n°8 : accord du porteur donné par ce choix).
   ============================================================ */
update public.referentiels set nom = 'Profil' where id = 'poste' and nom = 'Postes';
