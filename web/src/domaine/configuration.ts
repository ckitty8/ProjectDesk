/* ============================================================
   Configuration initiale (porteur, 2026-11-06 ; maquette docs/maquettes/assistant-configuration/proposition-3-detaillee.png)
   ------------------------------------------------------------
   Neuf étapes guident l'administrateur dans la première configuration de l'application. L'état de chaque étape est CALCULÉ d'après les données
   (jamais coché à la main) ; les étapes qui reposent sur des valeurs par défaut (référentiels, écrans par équipe, droits par rôle, jours fériés) sont
   « confirmées » par l'administrateur, et toute étape peut être « passée » : ces deux choix sont retenus dans la table etapes_configuration.
   Fonctions pures : l'écran et la pastille les consomment, ils ne recalculent rien.
   ============================================================ */
import { responsablesAffiches } from './annuaire';
import type { ContexteDroits } from './droits';

export type EtatEtape = 'fait' | 'a_faire' | 'ignoree';

/** Où l'étape se règle : un écran, et l'onglet d'Administration à ouvrir le cas échéant */
export interface CibleEtape { ecran: string; onglet?: string; entree?: string }

export interface DefinitionEtape {
  id: string;
  libelle: string;
  /** Pourquoi cette étape existe (affiché dans le détail) */
  pourquoi: string;
  cible: CibleEtape;
  libelleBouton: string;
  /** Étape validée par un bouton « J'ai vérifié » (valeurs par défaut déjà proposées) au lieu d'être détectée */
  confirmable: boolean;
}

/** Les neuf étapes, dans l'ordre */
export const ETAPES_CONFIGURATION: readonly DefinitionEtape[] = [
  { id: 'equipes', libelle: 'Créer une direction / des équipes', cible: { ecran: 'monAdmin', onglet: 'equipesRessources', entree: 'unites' }, libelleBouton: 'Ouvrir Administration › Équipes et ressources',
    pourquoi: 'Les équipes sont les espaces de travail : personnes, projets et écrans y sont rattachés.', confirmable: false },
  { id: 'referentiels', libelle: 'Vérifier les référentiels', cible: { ecran: 'monAdmin', onglet: 'equipesRessources', entree: 'poste' }, libelleBouton: 'Ouvrir Administration › Équipes et ressources',
    pourquoi: 'Profils, types de contrat, d’absence, statuts : des valeurs par défaut sont proposées, adaptez-les à votre métier.', confirmable: true },
  { id: 'ressources', libelle: 'Ajouter les ressources', cible: { ecran: 'listeRessources' }, libelleBouton: 'Ouvrir la Liste des ressources',
    pourquoi: 'Chaque équipe a besoin de ses personnes (fiches ressources) pour les congés, les heures et les projets.', confirmable: false },
  { id: 'responsables', libelle: 'Nommer les responsables', cible: { ecran: 'monAdmin', onglet: 'equipesRessources', entree: 'unites' }, libelleBouton: 'Ouvrir Administration › Équipes et ressources',
    pourquoi: 'Un responsable voit tout son équipe, valide les feuilles de temps et affecte les chefs de projet.', confirmable: false },
  { id: 'menusEquipes', libelle: 'Écrans de chaque équipe', cible: { ecran: 'monAdmin', onglet: 'menusEquipes' }, libelleBouton: 'Ouvrir Menus par équipe',
    pourquoi: 'Chaque équipe n’a pas besoin de tous les écrans : choisissez ceux qui lui sont accessibles (étape 1 des accès).', confirmable: true },
  { id: 'matrice', libelle: 'Écrans de chaque rôle', cible: { ecran: 'monAdmin', onglet: 'matrice' }, libelleBouton: 'Ouvrir la Matrice des droits',
    pourquoi: 'Choisissez les écrans que chaque rôle (Direction, Responsable, Chef de projet…) voit (étape 2 des accès) ; des valeurs par défaut existent.',
    confirmable: true },
  { id: 'feries', libelle: 'Jours fériés', cible: { ecran: 'monAdmin', onglet: 'feries' }, libelleBouton: 'Ouvrir Administration › Jours fériés',
    pourquoi: 'Les jours fériés réduisent les heures attendues et les jours travaillés : vérifiez l’année en cours.', confirmable: true },
  { id: 'projet', libelle: 'Créer un premier projet', cible: { ecran: 'listeRessources' }, libelleBouton: 'Ouvrir la Liste des ressources',
    pourquoi: 'Un projet permet d’affecter des personnes, de saisir des sprints et de lire le daily.', confirmable: false },
  { id: 'invitations', libelle: 'Inviter les membres', cible: { ecran: 'monAdmin', onglet: 'equipesRessources', entree: 'unites' }, libelleBouton: 'Ouvrir Administration › Équipes et ressources',
    pourquoi: 'Les membres invités créent leur compte avec leur email et retrouvent leur fiche automatiquement.', confirmable: false }
];

export interface EtapeEtat extends DefinitionEtape {
  etat: EtatEtape;
  /** Constat chiffré affiché sous l'étape (« 2 équipes sur 3 sans responsable ») */
  detail: string;
}

/** Équipes « de travail » : les directions n'ont ni personnes ni responsable propre à compter */
const equipesDeTravail = (ctx: ContexteDroits) => ctx.equipes.filter(e => e.type !== 'direction' && e.actif !== false);

/** L'étape est-elle détectée comme faite d'après les données ? (étapes confirmables : jamais, elles se confirment) */
function detecter(id: string, ctx: ContexteDroits): { fait: boolean; detail: string } {
  const equipes = equipesDeTravail(ctx);
  switch (id) {
    case 'equipes':
      return { fait: ctx.equipes.length > 0, detail: `${ctx.equipes.length} direction(s) ou équipe(s)` };
    case 'ressources': {
      const sans = equipes.filter(e => !ctx.ressources.some(r => r.equipeId === e.id));
      return { fait: equipes.length > 0 && sans.length === 0, detail: equipes.length ? `${sans.length} équipe(s) sur ${equipes.length} sans personne` : 'aucune équipe' };
    }
    case 'responsables': {
      const sans = equipes.filter(e => responsablesAffiches(ctx, e.id).length === 0);
      return { fait: equipes.length > 0 && sans.length === 0, detail: equipes.length ? `${sans.length} équipe(s) sur ${equipes.length} sans responsable` : 'aucune équipe' };
    }
    case 'menusEquipes':
      return { fait: ctx.droitsEquipes.length > 0, detail: ctx.droitsEquipes.length ? 'réglages enregistrés' : 'tous les écrans sont accessibles par défaut' };
    case 'projet':
      return { fait: ctx.projets.length > 0, detail: `${ctx.projets.length} projet(s)` };
    case 'invitations': {
      const lies = ctx.ressources.filter(r => !!r.userId && r.userId !== ctx.userId).length;
      return { fait: lies > 0, detail: `${lies} compte(s) relié(s) à une fiche` };
    }
    default:
      return { fait: false, detail: 'valeurs par défaut proposées : à vérifier' };
  }
}

/** État de chacune des neuf étapes : ignorée ou confirmée d'après la table, sinon détectée d'après les données */
export function etatsConfiguration(ctx: ContexteDroits): EtapeEtat[] {
  return ETAPES_CONFIGURATION.map(def => {
    const retenue = ctx.etapesConfiguration.find(e => e.etape === def.id)?.statut;
    const { fait, detail } = detecter(def.id, ctx);
    const etat: EtatEtape = retenue === 'ignoree' ? 'ignoree' : retenue === 'confirmee' || fait ? 'fait' : 'a_faire';
    return { ...def, etat, detail: retenue === 'confirmee' ? 'confirmée' : retenue === 'ignoree' ? 'passée' : detail };
  });
}

/** Progression : étapes faites ou passées sur le total ; « terminee » quand toutes le sont */
export function progressionConfiguration(etapes: readonly EtapeEtat[]): { faites: number; total: number; terminee: boolean; suivante: EtapeEtat | null } {
  const faites = etapes.filter(e => e.etat !== 'a_faire').length;
  return { faites, total: etapes.length, terminee: faites === etapes.length, suivante: etapes.find(e => e.etat === 'a_faire') ?? null };
}
