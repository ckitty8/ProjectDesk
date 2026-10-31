/* ============================================================
   Registre des écrans migrés : identifiant d'écran (routes.ts) → composant
   Un écran absent d'ici (et marqué « migre: false » dans routes.ts) affiche la page « pas encore migré ».
   ============================================================ */
import type { ComponentType } from 'react';
import { Astuces } from './Astuces';
import { DailyEquipes } from './DailyEquipes';
import { Dashboard } from './Dashboard';
import { Projets } from './Projets';
import { Ressources } from './Ressources';
import { Timesheet } from './Timesheet';

export const ECRANS: Record<string, ComponentType> = {
  dashboard: Dashboard,
  dailyEquipes: DailyEquipes,
  projets: Projets,
  ressources: Ressources,
  timesheet: Timesheet,
  astuces: Astuces
};
