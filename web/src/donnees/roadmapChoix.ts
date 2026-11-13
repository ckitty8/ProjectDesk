/* ============================================================
   Roadmap : projet choisi (liste déroulante), mémorisé d'une visite à l'autre (porteur, 2026-11-13 : proposition 2 « liste déroulante »)
   Simple confort d'affichage, propre à l'appareil : jamais de donnée métier. Le stockage du navigateur peut être indisponible : on s'en passe.
   ============================================================ */
const CLE = 'pp_roadmap_projet';

/** Dernier projet choisi (null si aucun ou stockage indisponible) */
export function lireChoixRoadmap(): string | null {
  try { return window.localStorage.getItem(CLE); } catch { return null; }
}

/** Mémorise le projet choisi */
export function ecrireChoixRoadmap(id: string): void {
  try { window.localStorage.setItem(CLE, id); } catch { /* stockage indisponible : le choix vaut pour cette visite seulement */ }
}
