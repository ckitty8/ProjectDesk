/* ============================================================
   Règles de calcul (un seul endroit — règle n°4 de CLAUDE.md)
   (portage TypeScript de app/js/calculs.js — phase 2 de la migration ; mêmes règles, mêmes résultats)
   ------------------------------------------------------------
   Fonctions pures : elles reçoivent des données et renvoient un résultat, sans lire d'état global ni toucher à
   l'écran. Les écrans les appellent ; ils ne recalculent rien eux-mêmes.
   ============================================================ */
import { CONFIG, STATUTS_PROJET } from './config';
import { ajouterJours, deux, depuisIso, ecartJours, estJourOuvre, estWeekend, formatAvecAnnee, joursDuMois, joursOuvresSemaine } from './dates';
import type { Absence, Iso, Projet, Ressource, TempsSaisi } from './types';

export const moyenne = (liste: readonly number[]): number => (liste.length ? liste.reduce((a, b) => a + b, 0) / liste.length : 0);

/* ---------- Anniversaires ---------- */

/** Anniversaires (date de naissance, migration 036) : seuls le jour et le mois comptent, jamais l'année.
 *  Un 29 février n'est fêté que les années bissextiles (comparaison de « MM-JJ »). */
export const estAnniversaire = (naissance: Iso | null | undefined, jour: Iso): boolean => !!naissance && naissance.slice(5) === jour.slice(5);

/** Personnes nées le mois donné (0-11), triées par jour du mois */
export const anniversairesDuMois = (ressources: readonly Ressource[], mois: number): Ressource[] => ressources
  .filter(r => r.dateNaissance && depuisIso(r.dateNaissance).getMonth() === mois)
  .sort((a, b) => (a.dateNaissance ?? '').slice(8).localeCompare((b.dateNaissance ?? '').slice(8)));

/* ---------- Sprints (2 semaines, numérotés depuis le sprint de référence) ---------- */

export function sprintDe(iso: Iso): { numero: number; debut: Iso; fin: Iso } {
  const ref = CONFIG.SPRINT_REFERENCE;
  const index = Math.floor(ecartJours(ref.debut, iso) / CONFIG.DUREE_SPRINT_JOURS);
  const debut = ajouterJours(ref.debut, index * CONFIG.DUREE_SPRINT_JOURS);
  // Le sprint se termine le vendredi de sa 2e semaine
  return { numero: ref.numero + index, debut, fin: ajouterJours(debut, CONFIG.DUREE_SPRINT_JOURS - 3) };
}

/* ---------- Projets ---------- */

export const estTermine = (p: Pick<Projet, 'statut'>): boolean => p.statut === STATUTS_PROJET.TERMINE;
export const projetsActifs = <P extends Pick<Projet, 'statut'>>(projets: readonly P[]): P[] => projets.filter(p => !estTermine(p));
export const avancementMoyen = (projets: readonly Pick<Projet, 'avancement'>[]): number => moyenne(projets.map(p => p.avancement || 0));

/** À surveiller : à risque, en retard, ou échéance proche (non terminés) */
export function projetsASurveiller(projets: readonly Projet[], dateIso: Iso): Projet[] {
  return projetsActifs(projets).filter(p =>
    [STATUTS_PROJET.A_RISQUE, STATUTS_PROJET.EN_RETARD].includes(p.statut)
    || (!!p.fin && ecartJours(dateIso, p.fin) <= CONFIG.ALERTE_ECHEANCE_JOURS && ecartJours(dateIso, p.fin) >= 0));
}

/* ---------- Présence (dates d'arrivée et de départ, facultatives) ---------- */

type Presence = Pick<Ressource, 'dateArrivee' | 'dateDepart'>;

/** Présence d'une personne un jour donné : entre sa date d'arrivée et sa date de départ (incluses) */
export const estPresent = (r: Presence, jour: Iso): boolean => (!r.dateArrivee || jour >= r.dateArrivee) && (!r.dateDepart || jour <= r.dateDepart);

/** Présente au moins un jour de la période [debut, fin] : arrivée avant la fin ET départ après le début */
export const estPresentSur = (r: Presence, debut: Iso, fin: Iso): boolean =>
  (!r.dateArrivee || r.dateArrivee <= fin) && (!r.dateDepart || r.dateDepart >= debut);

/** Présence d'une personne en clair (Liste des ressources) : la date de fin prime (« partie le … » si elle est
 *  passée, « jusqu'au … » sinon), puis l'arrivée */
export function libellePresence(r: Presence, jourCourant: Iso): string {
  if (r.dateDepart) return (r.dateDepart < jourCourant ? 'partie le ' : 'jusqu’au ') + formatAvecAnnee(r.dateDepart);
  if (r.dateArrivee) return (r.dateArrivee > jourCourant ? 'arrive le ' : 'depuis le ') + formatAvecAnnee(r.dateArrivee);
  return '';
}

/* ---------- Congés ---------- */

/** Durée d'une absence en jours : 1 (journée) ou 0,5 (demi-journée, migration 009) */
export const dureeAbsence = (a: Pick<Absence, 'duree'>): number => Number(a.duree ?? 1);

export interface JoursTravailles {
  ouvres: number;
  feries: number;
  travailles: number;
  conges: number;
}

/** Jours travaillés / non travaillés d'une personne sur un mois — reprise de l'onglet « Jours de congés » du fichier
 *  du porteur, sur les jours de semaine du mois :
 *  - congés = absences de tout type posées sur ces jours (demi-journée = 0,5), fériés NON compris ;
 *  - fériés = jours fériés tombant en semaine (non travaillés, mais ce ne sont pas des congés) ;
 *  - travaillés = jours de semaine − fériés − congés ;
 *  - presence : les jours hors présence ne comptent ni en travaillés ni en congés. */
export function joursTravaillesMois(
  ressourceId: string, annee: number, mois: number, absences: readonly Absence[], feries: ReadonlySet<Iso>, presence: Presence = {}
): JoursTravailles {
  const semaine = joursDuMois(annee, mois).filter(j => !estWeekend(j) && estPresent(presence, j));
  const absent = new Map(absences.filter(a => a.ressourceId === ressourceId).map(a => [a.jour, dureeAbsence(a)]));
  const nbFeries = semaine.filter(j => feries.has(j)).length;
  const conges = semaine.filter(j => !feries.has(j)).reduce((s, j) => s + (absent.get(j) ?? 0), 0);
  return { ouvres: semaine.length, feries: nbFeries, travailles: semaine.length - nbFeries - conges, conges };
}

export interface RecapJours {
  mois: JoursTravailles[];
  travailles: number;
  conges: number;
  /** Objectif de la personne, proratisé sur sa présence dans l'année */
  objectif: number;
  /** Reste à prendre = total travaillé − objectif (négatif = jours pris en trop) */
  reste: number;
}

/** Récap annuel d'une personne : 12 mois, totaux, et « reste à prendre » = total travaillé − objectif (jours de travail
 *  attendus par le client pour l'équipe et l'année). Arrivée ou départ en cours d'année (décision du porteur
 *  2026-09-27) : objectif proratisé = objectif × jours de semaine de présence ÷ jours de semaine de l'année,
 *  arrondi à la demi-journée. */
export function recapJoursTravailles(
  ressourceId: string, annee: number, absences: readonly Absence[], feries: ReadonlySet<Iso>, objectif: number, presence: Presence = {}
): RecapJours {
  const mois = Array.from({ length: 12 }, (_, m) => joursTravaillesMois(ressourceId, annee, m, absences, feries, presence));
  const travailles = mois.reduce((s, m) => s + m.travailles, 0);
  const conges = mois.reduce((s, m) => s + m.conges, 0);
  const ouvresAnnee = Array.from({ length: 12 }, (_, m) => joursDuMois(annee, m).filter(j => !estWeekend(j)).length).reduce((a, b) => a + b, 0);
  const ouvresPresence = mois.reduce((s, m) => s + m.ouvres, 0);
  const objectifPersonne = Math.round((objectif * ouvresPresence) / ouvresAnnee * 2) / 2;
  return { mois, travailles, conges, objectif: objectifPersonne, reste: travailles - objectifPersonne };
}

/** Capacité « type » Scrum d'une équipe pour un sprint (information) : engageable = (disponible − cérémonies) × facteur
 *  de focus, avec cérémonies = Σ capacité × jours de cérémonie par sprint. */
export function capaciteScrum(ressources: readonly Pick<Ressource, 'capacite'>[], disponible: number) {
  const ceremonies = ressources.reduce((s, r) => s + (r.capacite ?? 100) / 100 * CONFIG.CEREMONIES_JOURS_SPRINT, 0);
  const engageable = Math.max(0, disponible - ceremonies) * CONFIG.FACTEUR_FOCUS;
  return { disponible, ceremonies, engageable, heures: engageable * CONFIG.HEURES_PAR_JOUR };
}

/** Absents d'un groupe (membres d'un projet) un jour donné, en personnes (demi-journée = 0,5).
 *  Niveau : « aucun » | « partiel » (au moins un absent) | « critique » (plus de la moitié absente). */
export function absentsDuJour(ressourceIds: readonly string[], jour: Iso, absences: readonly Absence[]) {
  const absents = absences.filter(a => a.jour === jour && ressourceIds.includes(a.ressourceId)).reduce((s, a) => s + dureeAbsence(a), 0);
  const niveau = !absents ? 'aucun' : absents > ressourceIds.length / 2 ? 'critique' : 'partiel';
  return { absents, total: ressourceIds.length, niveau } as const;
}

/** Capacité d'une liste de personnes sur une période, en jours-homme : théorique = Σ jours ouvrés × capacité ;
 *  disponible = idem, moins les absences (demi-journée = 0,5). Les jours hors présence (avant l'arrivée, après le départ)
 *  ne comptent pas. */
export function capacitePeriode(
  ressources: readonly Ressource[], debut: Iso, fin: Iso, absences: readonly Absence[], feries: ReadonlySet<Iso>
): { theorique: number; disponible: number } {
  let theorique = 0, disponible = 0;
  const absent = new Map(absences.map(a => [a.ressourceId + '|' + a.jour, dureeAbsence(a)]));
  for (let jour = debut; jour <= fin; jour = ajouterJours(jour, 1)) {
    if (!estJourOuvre(jour, feries)) continue;
    ressources.filter(r => estPresent(r, jour)).forEach(r => {
      const part = (r.capacite ?? 100) / 100;
      theorique += part;
      disponible += part * (1 - (absent.get(r.id + '|' + jour) ?? 0));
    });
  }
  return { theorique, disponible };
}

/* ---------- Temps ---------- */

/** Jours de semaine (lundi → vendredi) d'un mois ; la saisie des heures est mensuelle */
export const joursSemaineMois = (annee: number, mois: number): Iso[] => joursDuMois(annee, mois).filter(j => !estWeekend(j));

/** Clé d'une feuille de temps mensuelle : 1er jour du mois (colonne `semaine` de feuilles_temps, migration 016) */
export const debutMois = (annee: number, mois: number): Iso => `${annee}-${deux(mois + 1)}-01`;

/** Heures d'une personne sur une liste de jours : total par jour et total général */
export function heuresJours(ressourceId: string, jours: readonly Iso[], temps: readonly TempsSaisi[]) {
  const parJour = jours.map(j => temps.filter(t => t.ressourceId === ressourceId && t.jour === j).reduce((s, t) => s + Number(t.heures || 0), 0));
  return { jours, parJour, total: parJour.reduce((a, b) => a + b, 0) };
}
export const heuresSemaine = (ressourceId: string, lundiIso: Iso, temps: readonly TempsSaisi[]) =>
  heuresJours(ressourceId, joursOuvresSemaine(lundiIso), temps);
export const heuresMois = (ressourceId: string, annee: number, mois: number, temps: readonly TempsSaisi[]) =>
  heuresJours(ressourceId, joursSemaineMois(annee, mois), temps);

/** Heures attendues d'une personne sur une liste de jours : jours ouvrés (hors fériés), moins les absences
 *  (demi-journée = 0,5) et les jours hors présence, × HEURES_PAR_JOUR × capacité */
export function heuresAttenduesJours(ressource: Ressource, jours: readonly Iso[], absences: readonly Absence[], feries: ReadonlySet<Iso>): number {
  const absent = new Map(absences.filter(a => a.ressourceId === ressource.id).map(a => [a.jour, dureeAbsence(a)]));
  const nb = jours.filter(j => estJourOuvre(j, feries) && estPresent(ressource, j)).reduce((s, j) => s + 1 - (absent.get(j) ?? 0), 0);
  return (nb * CONFIG.HEURES_PAR_JOUR * (ressource.capacite ?? 100)) / 100;
}
export const heuresAttendues = (ressource: Ressource, lundiIso: Iso, absences: readonly Absence[], feries: ReadonlySet<Iso>): number =>
  heuresAttenduesJours(ressource, joursOuvresSemaine(lundiIso), absences, feries);
export const heuresAttenduesMois = (ressource: Ressource, annee: number, mois: number, absences: readonly Absence[], feries: ReadonlySet<Iso>): number =>
  heuresAttenduesJours(ressource, joursSemaineMois(annee, mois), absences, feries);

/** Taux d'occupation = heures saisies / heures attendues (en %) */
export function tauxOccupation(
  ressources: readonly Ressource[], lundiIso: Iso, temps: readonly TempsSaisi[], absences: readonly Absence[], feries: ReadonlySet<Iso>
): number {
  const attendu = ressources.reduce((s, r) => s + heuresAttendues(r, lundiIso, absences, feries), 0);
  const saisi = ressources.reduce((s, r) => s + heuresSemaine(r.id, lundiIso, temps).total, 0);
  return attendu ? (saisi / attendu) * 100 : 0;
}

/* ---------- Divers ---------- */

export const initiales = (nom?: string | null): string => (nom || '?').split(/\s+/).map(m => m.charAt(0)).join('').slice(0, 2).toUpperCase();

/** Prochain code projet d'une équipe : PREFIXE-n (n = plus grand numéro existant + 1) */
export function prochainCodeProjet(prefixe: string, projets: readonly Pick<Projet, 'code'>[]): string {
  const numeros = projets.map(p => p.code).filter(c => c.startsWith(prefixe + '-')).map(c => Number(c.split('-')[1]) || 0);
  return `${prefixe}-${deux(Math.max(0, ...numeros) + 1)}`;
}
