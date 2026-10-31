/* ============================================================
   Registre des écrans migrés : identifiant d'écran (routes.ts) → composant
   Un écran absent d'ici (et marqué « migre: false » dans routes.ts) affiche la page « pas encore migré ».
   ============================================================ */
import type { ComponentType } from 'react';
import { Astuces } from './Astuces';
import { Conges } from './Conges';
import { Daily } from './Daily';
import { DailyEquipes } from './DailyEquipes';
import { Dashboard } from './Dashboard';
import { ListeRessources } from './ListeRessources';
import { MesProjets } from './MesProjets';
import { Projets } from './Projets';
import { Ressources } from './Ressources';
import { SaisirHeures } from './SaisirHeures';
import { Sprints } from './Sprints';
import { Timesheet } from './Timesheet';

export const ECRANS: Record<string, ComponentType> = {
  dashboard: Dashboard,
  dailyEquipes: DailyEquipes,
  projets: Projets,
  ressources: Ressources,
  timesheet: Timesheet,
  daily: Daily,
  mesProjets: MesProjets,
  mesSprints: Sprints,
  conges: Conges,
  listeRessources: ListeRessources,
  monTimesheet: SaisirHeures,
  astuces: Astuces
};
