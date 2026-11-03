/* ============================================================
   Roadmap : colonnes du tableau (table colonnes_roadmap, migration 056)
   ------------------------------------------------------------
   Fonctions pures partagées par Vue d’ensemble › Roadmap (affichage du tableau) et Administration › Roadmap (réglage des
   colonnes) : regroupement par bloc, déplacement d'une colonne, résumé des valeurs d'une liste déroulante.
   ============================================================ */
import { BLOCS_ROADMAP, PREFIXE_LISTE_ROADMAP } from './config';
import type { ColonneRoadmap, ValeurReferentiel } from './types';

/** Un bloc du tableau et ses colonnes, dans l'ordre d'affichage */
export interface BlocDuTableau { cle: string; titre: string; colonnes: ColonneRoadmap[] }

/** Colonnes regroupées par bloc (ordre de BLOCS_ROADMAP), triées par « ordre » dans chaque bloc ; un bloc sans colonne n'apparaît pas */
export function blocsDuTableau(colonnes: readonly ColonneRoadmap[]): BlocDuTableau[] {
  return BLOCS_ROADMAP
    .map(b => ({ cle: b.cle as string, titre: b.titre as string, colonnes: colonnes.filter(c => c.bloc === b.cle).sort((x, y) => x.ordre - y.ordre) }))
    .filter(b => b.colonnes.length > 0);
}

/** Toutes les colonnes, dans l'ordre d'affichage du tableau (bloc par bloc) */
export const colonnesOrdonnees = (colonnes: readonly ColonneRoadmap[]): ColonneRoadmap[] => blocsDuTableau(colonnes).flatMap(b => b.colonnes);

/** Référentiel d'une liste déroulante de la Roadmap (réglé dans Administration › Roadmap, caché de l'onglet Référentiels) */
export const estListeRoadmap = (referentielId: string): boolean => referentielId.startsWith(PREFIXE_LISTE_ROADMAP);

/** Identifiant d'un nouveau référentiel de liste déroulante, tiré d'un identifiant aléatoire (ex. crypto.randomUUID()) */
export const nouvelIdListe = (aleatoire: string): string => PREFIXE_LISTE_ROADMAP + aleatoire.replace(/-/g, '').slice(0, 12);

/** Ordre d'une colonne ajoutée : après toutes les autres (elle se range en fin de son bloc) */
export const ordreEnFin = (colonnes: readonly ColonneRoadmap[]): number => Math.max(0, ...colonnes.map(c => c.ordre)) + 1;

/** Nouvel ordre d'une colonne */
export interface OrdreColonne { id: string; ordre: number }

/** Déplacement d'une colonne vers le haut (-1) ou le bas (+1) dans son bloc : les deux ordres à échanger, ou null en bout de bloc */
export function echangeOrdre(colonnes: readonly ColonneRoadmap[], id: string, sens: -1 | 1): [OrdreColonne, OrdreColonne] | null {
  const bloc = blocsDuTableau(colonnes).find(b => b.colonnes.some(c => c.id === id));
  if (!bloc) return null;
  const i = bloc.colonnes.findIndex(c => c.id === id);
  const moi = bloc.colonnes[i], voisine = bloc.colonnes[i + sens];
  if (!moi || !voisine) return null;
  // Deux colonnes de même ordre (ajouts concurrents) : on les départage pour que l'échange se voie
  const ordreVoisine = voisine.ordre === moi.ordre ? moi.ordre + sens : voisine.ordre;
  return [{ id: moi.id, ordre: ordreVoisine }, { id: voisine.id, ordre: moi.ordre }];
}

/** Résumé des valeurs d'une liste : « Aucune valeur », les valeurs elles-mêmes (jusqu'à 4), sinon « 12 valeurs » */
export function resumeValeurs(valeurs: readonly ValeurReferentiel[]): string {
  if (!valeurs.length) return 'Aucune valeur';
  return valeurs.length <= 4 ? valeurs.map(v => v.libelle).join(', ') : `${valeurs.length} valeurs`;
}
