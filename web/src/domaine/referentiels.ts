/* ============================================================
   Listes métier (référentiels) : lecture des valeurs et de leurs couleurs
   (portage de valeursDe et couleurDe de app/js/etat.js — phase 5 de la migration)
   ------------------------------------------------------------
   Les types, priorités, statuts, rôles et absences sont en base (table valeurs_referentiel, administrable : règle n°4 de CLAUDE.md).
   ============================================================ */
import { COULEURS } from './config';
import type { Referentiel, ValeurReferentiel } from './types';

/** Valeurs d'une liste, actives seulement par défaut (l'ordre est celui de la base : colonne « ordre ») */
export const valeursDe = (valeurs: readonly ValeurReferentiel[], referentielId: string, avecInactives = false): ValeurReferentiel[] =>
  valeurs.filter(v => v.referentielId === referentielId && (avecInactives || v.actif));

/** Couleur associée à un libellé de liste (gris neutre si la valeur n'existe plus) */
export const couleurDe = (valeurs: readonly ValeurReferentiel[], referentielId: string, libelle: string): string =>
  valeursDe(valeurs, referentielId, true).find(v => v.libelle === libelle)?.couleur ?? COULEURS.neutre;

/** Valeur « système » d'une liste retrouvée par sa clé technique (renommable : on ne la cherche jamais par son libellé) */
export const valeurParCle = (valeurs: readonly ValeurReferentiel[], referentielId: string, cle: string): ValeurReferentiel | undefined =>
  valeurs.find(v => v.referentielId === referentielId && v.cle === cle);

/** Référentiels d'un onglet d'Administration : ceux de « montrer » (tous si absent) sans ceux de « cacher » (ceux d'un autre onglet). Chaque référentiel
 *  doit apparaître dans un onglet et un seul : Référentiels cache REFERENTIELS_RESSOURCES, Ressources ne montre que ceux-là. */
export const referentielsAffiches = (referentiels: readonly Referentiel[], montrer?: readonly string[], cacher: readonly string[] = []): Referentiel[] =>
  referentiels.filter(r => (!montrer || montrer.includes(r.id)) && !cacher.includes(r.id));
