/* ============================================================
   Chargement des tables, sans jamais effacer ce qui est affiché
   (portage de chargerDonnees / lireTable de app/js/etat.js — phase 3 de la migration)
   ------------------------------------------------------------
   Incident du 2026-09-26 (« les congés ont disparu », alors que la base était intacte) : une seule lecture en échec
   (ex. table ajoutée mais pas encore connue de la Data API, jeton expiré) ne doit ni bloquer les autres tables ni vider
   l'écran. Règles (DAT § 2, règle n°8 de CLAUDE.md) :
   - chaque table est lue indépendamment ; une table en échec garde ses données précédentes (ou une liste vide au premier
     chargement) et la liste des échecs est renvoyée pour prévenir l'utilisateur ;
   - si la lecture renvoie tout vide alors que des équipes étaient chargées, c'est une session ou des droits momentanément
     perdus (la base filtre les lignes sans erreur) : on garde tout.
   ============================================================ */
import { aujourdhui } from '../domaine/dates';
import { lire } from './api';
import type { Ligne } from './api';
import { CLES_TABLES, TABLES, couleurSure, filtresDe } from './tables';
import type { CleTable, Donnees } from './tables';

/** Résultat de la lecture d'une table : les lignes, ou la raison de l'échec */
export type LectureTable = { cle: CleTable; lignes: Ligne[] } | { cle: CleTable; erreur: unknown };

export interface ResultatChargement {
  donnees: Donnees;
  /** Tables (nom SQL) dont la lecture a échoué : leurs données précédentes sont conservées */
  echecs: string[];
}

/** Lit une table complète (toutes les pages) ; les couleurs sont validées */
export async function lireTable(cle: CleTable): Promise<Ligne[]> {
  const lignes = await lire(TABLES[cle], filtresDe(cle, aujourdhui()));
  lignes.forEach(l => { if ('couleur' in l) l.couleur = couleurSure(l.couleur); });
  return lignes;
}

/** Lit toutes les tables en parallèle, chacune indépendamment des autres */
export const lireToutesLesTables = (): Promise<LectureTable[]> =>
  Promise.all(CLES_TABLES.map(async (cle): Promise<LectureTable> => {
    try { return { cle, lignes: await lireTable(cle) }; }
    catch (erreur) { return { cle, erreur }; }
  }));

/* Fusion des lectures avec les données déjà affichées (fonction pure, testée) : applique les règles ci-dessus.
   Lève l'erreur de la première table si AUCUNE n'est lisible (réseau ou session perdus). */
export function fusionnerLectures(lectures: LectureTable[], precedent?: Donnees): ResultatChargement {
  const echouees = lectures.filter(l => 'erreur' in l);
  const premiere = echouees[0];
  if (premiere && echouees.length === lectures.length) throw premiere.erreur;
  const echecs = echouees.map(l => TABLES[l.cle]);
  const toutVide = lectures.every(l => 'erreur' in l || !l.lignes.length);
  if (toutVide && precedent?.equipes.length) return { donnees: precedent, echecs };
  const donnees = {} as Record<CleTable, readonly Ligne[]>;
  CLES_TABLES.forEach(cle => { donnees[cle] = (precedent?.[cle] as readonly Ligne[] | undefined) ?? []; });
  lectures.forEach(l => { if ('lignes' in l) donnees[l.cle] = l.lignes; });
  return { donnees: donnees as unknown as Donnees, echecs };
}

/** Chargement complet : lecture de toutes les tables puis fusion avec les données précédentes */
export async function chargerDonnees(precedent?: Donnees): Promise<ResultatChargement> {
  return fusionnerLectures(await lireToutesLesTables(), precedent);
}
