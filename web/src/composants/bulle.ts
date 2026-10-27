/* ============================================================
   Position de la bulle d'une icône ⓘ (portage de C.placerBulle de app/js/composants.js — phase 4 de la migration)
   Fonction pure : la bulle est placée sous l'icône (au-dessus s'il n'y a pas la place), sans sortir de la fenêtre.
   ============================================================ */

export interface Zone { left: number; top: number; width: number; height: number; bottom: number }

export const LARGEUR_BULLE = 280;
const MARGE = 8;

/** Coin haut-gauche de la bulle (position « fixed ») ; « origine » = coin d'une fenêtre modale, qui sert de repère aux éléments fixed qu'elle contient */
export function positionBulle(icone: Zone, hauteurBulle: number, fenetre: { largeur: number; hauteur: number },
  origine: { left: number; top: number } = { left: 0, top: 0 }): { left: number; top: number } {
  const gauche = Math.min(Math.max(icone.left + icone.width / 2 - LARGEUR_BULLE / 2, MARGE), fenetre.largeur - LARGEUR_BULLE - MARGE);
  const dessous = icone.bottom + 6;
  const haut = dessous + hauteurBulle > fenetre.hauteur - MARGE ? Math.max(MARGE, icone.top - 6 - hauteurBulle) : dessous;
  return { left: gauche - origine.left, top: haut - origine.top };
}
