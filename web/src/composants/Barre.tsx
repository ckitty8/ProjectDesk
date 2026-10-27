/* ============================================================
   Barre de progression (portage de C.barre) — pourcentage 0-100, borné
   ============================================================ */
import { COULEURS } from '../domaine/config';

export const borner = (pct: number): number => Math.max(0, Math.min(100, pct));

export function Barre({ pct, couleur = COULEURS.primaire, classe = '' }: { pct: number; couleur?: string; classe?: string }) {
  return (
    <span className={`barre ${classe}`.trim()} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={borner(pct)}>
      <span style={{ width: `${borner(pct)}%`, background: couleur }} />
    </span>
  );
}
