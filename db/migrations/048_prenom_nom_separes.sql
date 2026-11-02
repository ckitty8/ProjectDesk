/* ============================================================
   Migration 048 — Prénom et nom séparés sur la fiche d'une personne
   ------------------------------------------------------------
   Demande du porteur (2026-11-02) : « ça serait bien de séparer les deux » (nom et prénom des utilisateurs).
   Deux colonnes facultatives sont ajoutées à ressources : prenom et nom_famille. La colonne nom (nom complet « Prénom Nom ») est CONSERVÉE :
   tous les écrans continuent de l'afficher, et l'application la recompose (prénom + nom) à chaque modification du prénom ou du nom.
   Aucune donnée existante modifiée (règle n°8) : les deux colonnes sont vides pour les fiches existantes ; l'application propose le
   découpage du nom actuel (premier mot = prénom) sans l'écrire, tant que la personne n'a pas été modifiée.
   Droits et règles RLS inchangés (la table ressources garde ses règles ; nouvelles colonnes couvertes par les privilèges existants).
   ============================================================ */
alter table public.ressources add column if not exists prenom text;
alter table public.ressources add column if not exists nom_famille text;

notify pgrst, 'reload schema';
