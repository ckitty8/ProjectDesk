/* ============================================================
   Jeu de données d'essai pour les tests des droits, du périmètre et des menus
   ------------------------------------------------------------
   Une direction (Pôle) avec deux équipes (Applications, IA), et une équipe isolée (AMOA). Les rôles ressemblent à la production :
   Christelle est la créatrice, Thomas et Cerine sont membres d'Applications, Cerine est aussi affectée sur un projet d'IA,
   Anne est responsable d'IA alors que sa fiche est dans Applications.
   ============================================================ */
import { MATRICE_PRODUCTION } from './matrice';
import type { ContexteDroits } from '../droits';
import type { DonneesPerimetre } from '../perimetre';
import type { Absence, Affectation, Equipe, Projet, Ressource } from '../types';

export const EQUIPES: Equipe[] = [
  { id: 'pole', nom: 'Pôle', parentId: null },
  { id: 'app', nom: 'Applications', parentId: 'pole' },
  { id: 'ia', nom: 'IA', parentId: 'pole' },
  { id: 'amoa', nom: 'AMOA', parentId: null }
];

export const RESSOURCES: Ressource[] = [
  { id: 'r-anne', nom: 'Anne Caselli', equipeId: 'app' },
  { id: 'r-thomas', nom: 'Thomas', equipeId: 'app', userId: 'u-thomas' },
  { id: 'r-cerine', nom: 'Cerine', equipeId: 'app', userId: 'u-cerine' },
  { id: 'r-christelle', nom: 'Christelle', equipeId: 'app', userId: 'u-christelle' },
  { id: 'r-lena', nom: 'Léna', equipeId: 'ia', userId: 'u-lena' },
  { id: 'r-marc', nom: 'Marc', equipeId: 'amoa', userId: 'u-marc' }
];

export const PROJETS: Projet[] = [
  { id: 'p-app1', code: 'APP-01', nom: 'CDO', equipeId: 'app', statut: 'En cours' },
  { id: 'p-app2', code: 'APP-02', nom: 'VISTA', equipeId: 'app', chefId: 'r-thomas', statut: 'Planifié' },
  { id: 'p-ia1', code: 'IA-01', nom: 'Chatbot', equipeId: 'ia', statut: 'En cours' },
  { id: 'p-ia2', code: 'IA-02', nom: 'Vie de Ville', equipeId: 'ia', statut: 'En cours' },
  { id: 'p-am1', code: 'AM-01', nom: 'Recette', equipeId: 'amoa', statut: 'En cours' }
];

export const AFFECTATIONS: Affectation[] = [
  { projetId: 'p-app2', ressourceId: 'r-thomas', role: 'Chef de projet' },
  { projetId: 'p-app1', ressourceId: 'r-christelle', role: 'Chef de projet' },
  { projetId: 'p-ia2', ressourceId: 'r-cerine', role: 'Membre' },
  { projetId: 'p-ia2', ressourceId: 'r-lena', role: 'Chef de projet' },
  { projetId: 'p-ia1', ressourceId: 'r-lena', role: 'Membre' },
  { projetId: 'p-am1', ressourceId: 'r-marc', role: 'Chef de projet' }
];

export const ABSENCES: Absence[] = [
  { ressourceId: 'r-thomas', jour: '2026-11-02', duree: 1 },
  { ressourceId: 'r-lena', jour: '2026-11-03', duree: 0.5 },
  { ressourceId: 'r-marc', jour: '2026-11-04', duree: 1 }
];

/** Contexte de base : Thomas connecté, sans rôle déclaré (donc « utilisateur »), matrice de production */
export function contexte(surcharge: Partial<ContexteDroits> = {}): ContexteDroits {
  return {
    estCreateur: false,
    estAdmin: false,
    userId: 'u-thomas',
    simulation: null,
    organisations: [{ id: 'app' }],
    rolesEquipe: { app: 'member' },
    membresEquipe: {},
    equipes: EQUIPES,
    ressources: RESSOURCES,
    projets: PROJETS,
    affectations: AFFECTATIONS,
    rattachements: [],
    responsablesEquipe: [{ equipeId: 'ia', ressourceId: 'r-anne' }],
    rolesAcces: [],
    rolesPrevus: [],
    administrateurs: [],
    createur: [{ userId: 'u-christelle' }],
    droitsRoles: MATRICE_PRODUCTION,
    ...surcharge
  };
}

/** Données complètes à filtrer pendant une simulation */
export const DONNEES: DonneesPerimetre = {
  ressources: RESSOURCES,
  projets: PROJETS,
  affectations: AFFECTATIONS,
  absences: ABSENCES,
  temps: [{ ressourceId: 'r-thomas', projetId: 'p-app2', jour: '2026-11-02', heures: 7.5 },
    { ressourceId: 'r-lena', projetId: 'p-ia1', jour: '2026-11-02', heures: 7 }],
  feuilles: [{ ressourceId: 'r-thomas', semaine: '2026-11-01' }, { ressourceId: 'r-lena', semaine: '2026-11-01' }],
  sprintsProjet: [{ projetId: 'p-app2', numero: 1 }, { projetId: 'p-ia1', numero: 1 }],
  repartitionsSprint: [{ projetId: 'p-ia1' }],
  misesEnProduction: [{ projetId: 'p-app2' }, { projetId: 'p-ia2' }],
  envoisDaily: [{ projetId: 'p-ia1' }],
  objectifsTravail: [{ equipeId: 'app', annee: 2026, jours: 218 }, { equipeId: 'ia', annee: 2026, jours: 210 }],
  rattachements: []
};
