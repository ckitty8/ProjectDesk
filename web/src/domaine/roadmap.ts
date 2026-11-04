/* ============================================================
   Roadmap : colonnes du tableau (table colonnes_roadmap, migration 056)
   ------------------------------------------------------------
   Fonctions pures partagées par Vue d’ensemble › Roadmap (affichage du tableau) et Administration › Roadmap (réglage des
   colonnes) : regroupement par bloc, déplacement d'une colonne, résumé des valeurs d'une liste déroulante ; score et rang de
   traitement DSI des demandes (table demandes_roadmap, migration 057).
   ============================================================ */
import { BLOCS_ROADMAP, PREFIXE_LISTE_ROADMAP } from './config';
import type { ColonneRoadmap, DemandeRoadmap, SprintProjet, ValeurReferentiel } from './types';

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

/* ---------- Demandes : score et rang de traitement DSI (règle du fichier CDO-ROADMAP-NEW, docs/specifications/roadmap.md § 1) ---------- */

/** Valeur d'une demande pour la colonne de clé technique « cle » (ex. « complexite ») ; undefined si la colonne n'existe plus ou est vide */
export function valeurParCle(demande: DemandeRoadmap, colonnes: readonly ColonneRoadmap[], cle: string): string | undefined {
  const colonne = colonnes.find(c => c.cle === cle);
  const valeur = colonne ? demande.valeurs[colonne.id] : undefined;
  return valeur === null || valeur === undefined || String(valeur).trim() === '' ? undefined : String(valeur).trim();
}

/** Nombre lu dans une valeur (« 1,5 » ou « 1.5 ») ; undefined si ce n'en est pas un */
const nombre = (valeur: string | undefined): number | undefined => {
  const n = valeur === undefined ? NaN : Number(valeur.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

/** Score = (0,5 × impact client + 0,3 × impact collaborateur) ÷ (0,2 × complexité) : ce que la demande rapporte ÷ ce qu'elle coûte.
 *  null si un des trois n'est pas saisi (l'écran affiche alors « complexité à saisir », au lieu du 0 de l'Excel) */
export function scoreDemande(demande: DemandeRoadmap, colonnes: readonly ColonneRoadmap[]): number | null {
  const client = nombre(valeurParCle(demande, colonnes, 'impactClient'));
  const collaborateur = nombre(valeurParCle(demande, colonnes, 'impactCollaborateur'));
  const complexite = nombre(valeurParCle(demande, colonnes, 'complexite'));
  if (client === undefined || collaborateur === undefined || !complexite) return null;
  return (0.5 * client + 0.3 * collaborateur) / (0.2 * complexite);
}

/** Demande classée : son rang (1 = à traiter en premier) et son score */
export interface DemandeClassee { demande: DemandeRoadmap; rang: number; score: number | null }

/** Demandes dans l'ordre de traitement DSI : stratégiques d'abord, puis priorité du demandeur (1, 2, 3 ; non saisie en dernier), puis
 *  score décroissant (sans score : après celles qui en ont un) ; à égalité, la plus ancienne d'abord (ordre des lignes de l'Excel) */
export function demandesClassees(demandes: readonly DemandeRoadmap[], colonnes: readonly ColonneRoadmap[]): DemandeClassee[] {
  const cle = (d: DemandeRoadmap) => ({
    strategique: valeurParCle(d, colonnes, 'strategique')?.toLowerCase() === 'oui' ? 0 : 1,
    priorite: nombre(valeurParCle(d, colonnes, 'priorite')) ?? 99,
    score: scoreDemande(d, colonnes)
  });
  return demandes.map(d => ({ d, k: cle(d) }))
    .sort((a, b) => a.k.strategique - b.k.strategique || a.k.priorite - b.k.priorite
      || (b.k.score ?? -1) - (a.k.score ?? -1) || String(a.d.creeLe ?? '').localeCompare(String(b.d.creeLe ?? '')))
    .map(({ d, k }, i) => ({ demande: d, rang: i + 1, score: k.score }));
}

/** Score affiché : deux décimales au plus, virgule française (« 5,25 ») */
export const scoreAffiche = (score: number): string => String(Math.round(score * 100) / 100).replace('.', ',');

/* ---------- Saisie des demandes (Mon dashboard › Projet › Roadmap) ---------- */

/** Colonnes résumées dans la liste de saisie (clés techniques des colonnes de départ ; une colonne supprimée est simplement omise) */
export const CLES_RESUME_SAISIE = ['rang', 'demande', 'demandeur', 'parcours', 'strategique', 'priorite', 'score', 'statut'] as const;

/** Colonnes saisissables d'une fiche : toutes sauf les colonnes calculées (Rang, Score), dans l'ordre du tableau */
export const colonnesSaisissables = (colonnes: readonly ColonneRoadmap[]): ColonneRoadmap[] => colonnesOrdonnees(colonnes).filter(c => c.type !== 'calcul');

/** Valeurs à enregistrer : texte rogné, champs vides retirés, seulement les colonnes qui existent encore */
export function valeursAEnregistrer(saisie: Record<string, string | null | undefined>, colonnes: readonly ColonneRoadmap[]): Record<string, string> {
  const ids = new Set(colonnes.map(c => c.id));
  return Object.fromEntries(Object.entries(saisie)
    .map(([id, v]) => [id, (v ?? '').trim()] as const)
    .filter(([id, v]) => ids.has(id) && v !== ''));
}

/** Libellé d'un sprint dans la liste déroulante Sprint DSI (c'est aussi la valeur enregistrée) : son nom, sinon « Sprint 19 » ou « Sprint n°2 » */
export const libelleSprint = (s: Pick<SprintProjet, 'nom' | 'numeroSprint' | 'numero'>): string =>
  (s.nom ?? '').trim() || (s.numeroSprint ? `Sprint ${s.numeroSprint}` : `Sprint n°${s.numero}`);

/** Demandes d'un projet (null : demandes sans projet), avec leur rang dans le classement de TOUTES les demandes (le rang DSI est global) */
export const demandesDuProjet = (classees: readonly DemandeClassee[], projetId: string | null): DemandeClassee[] =>
  classees.filter(l => (l.demande.projetId ?? null) === projetId);
