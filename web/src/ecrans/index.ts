/* ============================================================
   Registre des écrans migrés : identifiant d'écran (routes.ts) → composant
   Un écran absent d'ici (et marqué « migre: false » dans routes.ts) affiche la page « pas encore migré ».
   ============================================================ */
import type { ComponentType } from 'react';
import { Astuces } from './Astuces';
import { Dashboard } from './Dashboard';

export const ECRANS: Record<string, ComponentType> = {
  dashboard: Dashboard,
  astuces: Astuces
};
