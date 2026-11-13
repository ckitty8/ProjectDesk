/* ============================================================
   Roadmap : colonnes du tableau (table colonnes_roadmap, migration 056)
   ------------------------------------------------------------
   Fonctions pures partagées par Vue d’ensemble › Roadmap (affichage du tableau) et Administration › Roadmap (réglage des
   colonnes) : regroupement par bloc, déplacement d'une colonne, résumé des valeurs d'une liste déroulante ; score et rang de
   traitement DSI des demandes (table demandes_roadmap, migration 057).
   ============================================================ */
import { BLOCS_ROADMAP, PREFIXE_LISTE_ROADMAP } from './config';
import { formatAvecAnnee } from './dates';
import type { ColonneRoadmap, DemandeRoadmap, Equipe, Iso, MiseEnProduction, Projet, SprintProjet, ValeurReferentiel } from './types';
import { arbreUnites } from './vues';

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

/** Critères du classement d'une demande : stratégique (0 = oui, en tête), priorité (99 = non saisie, en dernier), score (null = sans score) */
export interface CriteresRang { strategique: 0 | 1; priorite: number; score: number | null }

export const criteresDe = (d: DemandeRoadmap, colonnes: readonly ColonneRoadmap[]): CriteresRang => ({
  strategique: valeurParCle(d, colonnes, 'strategique')?.toLowerCase() === 'oui' ? 0 : 1,
  priorite: nombre(valeurParCle(d, colonnes, 'priorite')) ?? 99,
  score: scoreDemande(d, colonnes)
});

/** Demande classée : son rang (1 = à traiter en premier) et son score */
export interface DemandeClassee { demande: DemandeRoadmap; rang: number; score: number | null }

/** Demandes dans l'ordre de traitement DSI : stratégiques d'abord, puis priorité du demandeur (1, 2, 3 ; non saisie en dernier), puis
 *  score décroissant (sans score : après celles qui en ont un) ; à égalité, la plus ancienne d'abord (ordre des lignes de l'Excel) */
export function demandesClassees(demandes: readonly DemandeRoadmap[], colonnes: readonly ColonneRoadmap[]): DemandeClassee[] {
  return demandes.map(d => ({ d, k: criteresDe(d, colonnes) }))
    .sort((a, b) => a.k.strategique - b.k.strategique || a.k.priorite - b.k.priorite
      || (b.k.score ?? -1) - (a.k.score ?? -1) || String(a.d.creeLe ?? '').localeCompare(String(b.d.creeLe ?? '')))
    .map(({ d, k }, i) => ({ demande: d, rang: i + 1, score: k.score }));
}

/* ---------- Une roadmap par projet (Vue d'ensemble › Roadmap ; porteur 2026-11-13 : « il n'y a pas de roadmap AMOA : une roadmap par projet »,
   et jamais toutes les roadmaps en même temps) ---------- */

/** Identifiant de la pastille des demandes sans projet */
export const ROADMAP_SANS_PROJET = 'sans-projet';

/** Une pastille de choix : un projet (ou « Sans projet »), avec le nombre de ses demandes ; equipeId sert à ouvrir la roadmap d'un projet de l'équipe active */
export interface ChoixRoadmap { id: string; libelle: string; nombre: number; equipeId?: string }

/** Pastille de la demande : son projet ; ROADMAP_SANS_PROJET sans projet (ou projet inconnu) */
const pastilleDeLaDemande = (d: DemandeRoadmap, projets: readonly Projet[]): string => projets.find(p => p.id === d.projetId)?.id ?? ROADMAP_SANS_PROJET;

/** Pastilles : un projet chacune, nommé « équipe › projet » (« AMOA › CDO » et « CDO › CDO » : deux projets peuvent porter le même nom), rangés dans l'ordre
 *  de l'arborescence (direction, équipes) puis par code ; « Sans projet » à la fin, seulement s'il y a de telles demandes */
export function choixRoadmap(equipes: readonly Equipe[], projets: readonly Projet[], demandes: readonly DemandeRoadmap[]): ChoixRoadmap[] {
  const nombre = (id: string) => demandes.filter(d => pastilleDeLaDemande(d, projets) === id).length;
  const parProjet = arbreUnites(equipes).flatMap(u => projets.filter(p => p.equipeId === u.equipe.id).sort((a, b) => a.code.localeCompare(b.code))
    .map(p => ({ id: p.id, libelle: `${u.equipe.nom} › ${p.nom}`, nombre: nombre(p.id), equipeId: p.equipeId })));
  const sans = nombre(ROADMAP_SANS_PROJET);
  return sans > 0 ? [...parProjet, { id: ROADMAP_SANS_PROJET, libelle: 'Sans projet', nombre: sans }] : parProjet;
}

/** Demandes d'une pastille (un projet, ou « Sans projet ») */
export const demandesDeLaPastille = (demandes: readonly DemandeRoadmap[], projets: readonly Projet[], choix: string): DemandeRoadmap[] =>
  demandes.filter(d => pastilleDeLaDemande(d, projets) === choix);

/** Pastille ouverte au départ : un projet de l'équipe active qui a des demandes, sinon un projet de l'équipe active, sinon la première qui a des demandes */
export function pastilleParDefaut(choix: readonly ChoixRoadmap[], equipeActive: string | null): string {
  const deLEquipe = choix.filter(c => c.equipeId === equipeActive);
  return (deLEquipe.find(c => c.nombre > 0) ?? deLEquipe[0] ?? choix.find(c => c.nombre > 0) ?? choix[0])?.id ?? '';
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

/** Un choix de la liste Sprint / version : un sprint ou une mise en production du projet (porteur, 2026-11-04 : « pour la partie Sprint/version,
 *  il faut reprendre les sprints et MEP présents dans Projet ») ; « jour » = date d'une MEP (reprise dans Date de MEP si elle est vide) */
export interface ChoixSprintVersion { groupe: 'Sprints' | 'Mises en production'; libelle: string; jour?: Iso }

/** Libellé (et valeur enregistrée) d'une mise en production : « MEP V2.0 du 9 oct. 2026 », ou « MEP du 9 oct. 2026 » sans version */
export const libelleMep = (m: Pick<MiseEnProduction, 'version' | 'jour'>): string =>
  ['MEP', (m.version ?? '').trim(), 'du', formatAvecAnnee(m.jour)].filter(Boolean).join(' ');

/** Choix de la liste Sprint / version d'un projet : ses sprints (par date de début), puis ses mises en production (par date) */
export function choixSprintVersion(sprints: readonly SprintProjet[], meps: readonly MiseEnProduction[], projetId: string | null): ChoixSprintVersion[] {
  const parDate = (a?: string | null, b?: string | null) => String(a ?? '').localeCompare(String(b ?? ''));
  return [
    ...sprints.filter(s => s.projetId === projetId).sort((a, b) => parDate(a.debut, b.debut) || a.numero - b.numero)
      .map(s => ({ groupe: 'Sprints' as const, libelle: libelleSprint(s) })),
    ...meps.filter(m => m.projetId === projetId && m.jour).sort((a, b) => parDate(a.jour, b.jour))
      .map(m => ({ groupe: 'Mises en production' as const, libelle: libelleMep(m), jour: m.jour }))
  ];
}

/** Versions proposées pour une mise en production (porteur, 2026-11-13 : « le nom de la version est une liste déroulante des versions du menu Sprints ») :
 *  les noms des sprints du projet (par date de début), sans doublon */
export const versionsDuProjet = (sprints: readonly SprintProjet[], projetId: string | null): string[] =>
  [...new Set(choixSprintVersion(sprints, [], projetId).map(c => c.libelle))];

/** Demandes d'un projet (null : demandes sans projet), avec leur rang dans le classement de TOUTES les demandes (le rang DSI est global) */
export const demandesDuProjet = (classees: readonly DemandeClassee[], projetId: string | null): DemandeClassee[] =>
  classees.filter(l => (l.demande.projetId ?? null) === projetId);

/* ---------- Administration › Roadmap › Calculs : le détail sur un exemple ---------- */

/** Nombre affiché à la française : deux décimales au plus, virgule (« 2,1 ») */
const fr = (n: number): string => String(Math.round(n * 100) / 100).replace('.', ',');

/** Détail du calcul du score d'une demande : « (0,5 × 3 + 0,3 × 2) ÷ (0,2 × 2) = 2,1 ÷ 0,4 = 5,25 » ; null s'il manque un terme */
export function detailScore(demande: DemandeRoadmap, colonnes: readonly ColonneRoadmap[]): string | null {
  const client = nombre(valeurParCle(demande, colonnes, 'impactClient'));
  const collaborateur = nombre(valeurParCle(demande, colonnes, 'impactCollaborateur'));
  const complexite = nombre(valeurParCle(demande, colonnes, 'complexite'));
  if (client === undefined || collaborateur === undefined || !complexite) return null;
  const haut = 0.5 * client + 0.3 * collaborateur, bas = 0.2 * complexite;
  return `(0,5 × ${fr(client)} + 0,3 × ${fr(collaborateur)}) ÷ (0,2 × ${fr(complexite)}) = ${fr(haut)} ÷ ${fr(bas)} = ${fr(haut / bas)}`;
}

/** Pourquoi une demande est à ce rang : le premier critère qui la sépare de la précédente (ou ce qui la met en tête) */
export function raisonDuRang(classees: readonly DemandeClassee[], index: number, colonnes: readonly ColonneRoadmap[]): string {
  const moi = criteresDe(classees[index]!.demande, colonnes);
  const priorite = moi.priorite === 99 ? 'priorité non saisie' : `priorité ${moi.priorite}`;
  const score = moi.score === null ? 'sans score' : `score ${fr(moi.score)}`;
  if (index === 0) return moi.strategique === 0 ? 'Stratégique : passe en tête' : `En tête : ${priorite}, ${score}`;
  const avant = criteresDe(classees[index - 1]!.demande, colonnes);
  if (moi.strategique !== avant.strategique) return `Non stratégique : après les demandes stratégiques (${priorite}, ${score})`;
  if (moi.priorite !== avant.priorite) return `${priorite.charAt(0).toUpperCase()}${priorite.slice(1)} : après les priorités plus hautes`;
  if (moi.score === null && avant.score !== null) return 'Même priorité, mais sans score : après celles qui en ont un';
  if (moi.score !== avant.score) return `Même priorité, ${score} : après un score plus élevé`;
  return 'Égalité : la plus ancienne passe avant';
}

/** Nombre de demandes montrées en exemple dans Administration › Roadmap › Calculs (porteur, 2026-11-04 : « les 3 premières ») */
export const NB_DEMANDES_EXEMPLE = 3;
