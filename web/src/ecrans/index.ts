/* ============================================================
   Registre des écrans migrés : identifiant d'écran (routes.ts) → composant
   Chaque écran de « Vue d’ensemble » et de « Mon dashboard » (routes.ts) y figure ; les pages plein écran (connexion, choix d'équipe) sont dans App.tsx.
   ============================================================ */
import type { ComponentType } from 'react';
import { AdminCreateur } from './AdminCreateur';
import { Administration } from './Administration';
import { Astuces } from './Astuces';
import { Conges } from './Conges';
import { Daily } from './Daily';
import { DailyEquipes } from './DailyEquipes';
import { Dashboard } from './Dashboard';
import { ListeRessources } from './ListeRessources';
import { MesDemandes } from './MesDemandes';
import { MesProjets } from './MesProjets';
import { Profil } from './Profil';
import { Projets } from './Projets';
import { Ressources } from './Ressources';
import { Roadmap } from './Roadmap';
import { SaisirHeures } from './SaisirHeures';
import { Sprints } from './Sprints';
import { Timesheet } from './Timesheet';

export const ECRANS: Record<string, ComponentType> = {
  dashboard: Dashboard,
  dailyEquipes: DailyEquipes,
  projets: Projets,
  roadmap: Roadmap,
  ressources: Ressources,
  timesheet: Timesheet,
  daily: Daily,
  mesProjets: MesProjets,
  mesSprints: Sprints,
  mesDemandes: MesDemandes,
  conges: Conges,
  listeRessources: ListeRessources,
  monTimesheet: SaisirHeures,
  monAdmin: Administration,
  adminCreateur: AdminCreateur,
  astuces: Astuces,
  profil: Profil
};
