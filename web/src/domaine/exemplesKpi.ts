/* ============================================================
   Trucs et astuces › KPI Agile : exemples chiffrés
   (portage de exemplesKpi de app/js/ecrans/astuces.js — phase 5, vague A)
   ------------------------------------------------------------
   Exemples calculés sur un projet choisi. Équipe, capacité et absences du sprint en cours sont RÉELS (« reel ») ; les autres KPI
   (vélocité, flux…) sont ILLUSTRATIFS : dimensionnés sur la taille de l'équipe, la notion de ticket ayant été retirée de
   l'application (2026-09-27). Les parties en gras du texte sont encadrées par « ** ».
   ============================================================ */
import { capacitePeriode, capaciteScrum, estPresent, sprintDe } from './calculs';
import { CONFIG } from './config';
import { nombre } from './dates';
import type { Absence, Affectation, Iso, Projet, Ressource } from './types';

/** Un exemple : « reel » (données du projet) ou « illustratif » (à défaut de données suivies dans l'application) */
export interface ExempleKpi {
  nature: 'reel' | 'illustratif';
  texte: string;
}

export function exemplesKpi(projet: Pick<Projet, 'id'>, ressources: readonly Ressource[], affectations: readonly Affectation[],
  absences: readonly Absence[], feries: ReadonlySet<Iso>, jour: Iso): Record<string, ExempleKpi[]> {
  const n = nombre;
  const reel = (texte: string): ExempleKpi => ({ nature: 'reel', texte });
  const illu = (texte: string): ExempleKpi => ({ nature: 'illustratif', texte });
  const membres = affectations.filter(a => a.projetId === projet.id)
    .map(a => ressources.find(r => r.id === a.ressourceId))
    .filter((r): r is Ressource => !!r && estPresent(r, jour));
  const nb = membres.length;
  const noms = membres.map(r => r.nom.split(' ')[0]).join(', ');
  const sprint = sprintDe(jour);
  const cap = capacitePeriode(membres, sprint.debut, sprint.fin, absences, feries);
  const scrum = capaciteScrum(membres, cap.disponible);
  const absents = n(cap.theorique - cap.disponible);
  const velo = Math.round(nb * 6.5);                       // hypothèse illustrative : ~6,5 points par personne et par sprint
  return {
    velocite: [illu(`${nb} personnes (${noms}) terminent ${velo - 3}, ${velo + 2} puis ${velo + 1} points sur 3 sprints → vélocité ≈ ${velo} points.`)],
    capacite: [reel(`Sprint ${sprint.numero} : ${n(cap.theorique)} j théoriques pour ${nb} personnes, ${absents} j d’absence → **${n(cap.disponible)} j** disponibles.`)],
    engagement: [illu(`L’équipe engage ${velo} points et en termine ${velo - 2} → say/do = ${Math.round((velo - 2) / velo * 100)} %.`)],
    burndown: [illu(`${velo} points sur 10 jours ouvrés → pente idéale ${n(velo / 10)} point/jour ; au jour 5, il devrait rester ≈ ${n(velo / 2)} points.`)],
    burnup: [illu(`Release de 120 points, ${velo * 3} livrés en 3 sprints ; si 10 points s’ajoutent au périmètre, la ligne cible monte à 130.`)],
    objectif: [illu('4 objectifs de sprint atteints sur les 5 derniers sprints → 80 %.')],
    focus: [
      reel(`Capacité engageable ce sprint : (${n(cap.disponible)} − ${n(scrum.ceremonies)} j de cérémonies) × ${Math.round(CONFIG.FACTEUR_FOCUS * 100)} % = **${n(scrum.engageable)} j**`),
      illu(`vélocité ${velo} points ÷ ${n(cap.disponible)} j = ${n(cap.disponible ? velo / cap.disponible : 0)} point/jour-homme.`)
    ],
    debordement: [illu(`3 points non terminés sur ${velo} engagés → ${Math.round(3 / velo * 100)} % de débordement.`)],
    defauts: [illu('2 anomalies remontées en recette après la livraison du sprint.')],
    imprevus: [illu(`${n(cap.disponible * 0.15)} j de support sur ${n(cap.disponible)} j disponibles → 15 % d’imprévus.`)],
    bonheur: [illu(`Notes de rétrospective de ${noms} : 4, 3 et 4 → 3,7 / 5.`)],
    leadTime: [illu('Demande déposée le 1er septembre, livrée le 19 → lead time = 18 jours.')],
    cycleTime: [illu('Travail commencé le 12 septembre, livré le 19 → cycle time = 7 jours.')],
    debit: [illu(`${nb} personnes livrent 4 éléments par semaine.`)],
    wip: [illu(`WIP 6 ÷ débit 4 / semaine → cycle time moyen ≈ 1,5 semaine (loi de Little) ; limite conseillée ≈ ${nb * 2} (2 par personne).`)],
    cfd: [illu('La bande « En revue » passe de 2 à 6 éléments en 2 semaines → goulet d’étranglement en revue.')],
    age: [illu('Un élément « En cours » depuis 12 jours alors que 85 % sont livrés en 10 jours → à regarder au daily.')],
    efficacite: [illu('3 jours de travail actif sur 12 jours de lead time → 25 % d’efficacité de flux.')],
    bloque: [illu('2 blocages cette semaine (identifiants de recette, attente d’arbitrage), 3 jours bloqués au total.')],
    sle: [illu('Sur les 20 derniers éléments, 17 livrés en moins de 10 jours → « 85 % en moins de 10 jours ».')]
  };
}
