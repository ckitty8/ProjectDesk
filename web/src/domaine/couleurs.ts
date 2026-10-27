/* ============================================================
   Couleurs d'affichage
   (portage de C.teinte et C.couleurStatutProjet de app/js/composants.js — phase 4 de la migration)
   ============================================================ */
import { COULEURS, STATUTS_PROJET } from './config';

/** Teinte claire d'une couleur #RRGGBB (fond des badges et des cases d'absence) : mélange avec du blanc, « force » = part de couleur */
export function teinte(hex: string, force = 0.12): string {
  const n = parseInt(hex.slice(1), 16);
  const melange = (composante: number) => Math.round(255 - (255 - composante) * force);
  return `rgb(${melange(n >> 16)},${melange((n >> 8) & 255)},${melange(n & 255)})`;
}

/** Couleur de la barre d'avancement selon le statut du projet */
export function couleurStatutProjet(statut: string): string {
  if (statut === STATUTS_PROJET.A_RISQUE) return COULEURS.alerte;
  if (statut === STATUTS_PROJET.EN_RETARD) return COULEURS.danger;
  if (statut === STATUTS_PROJET.TERMINE) return COULEURS.succes;
  return COULEURS.primaire;
}
