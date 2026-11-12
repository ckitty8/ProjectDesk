/* ============================================================
   Administration › Ressources (porteur, 2026-11-02, maquette ressources-roles-profil/)
   Les listes qui qualifient les personnes : les profils (référentiel « poste », nommé « Profil », modifiable) et le Rôle (un seul par personne depuis
   le 2026-11-02 : Direction, Responsable d'équipe, Chef de projet, Membre, Utilisateur, Lecture seule ; fixe, en lecture seule).
   Même écran que Référentiels, restreint à
   ces listes (composant Referentiels, règle n°4 : réutiliser avant de recréer).
   ============================================================ */
import { Equipes } from './Equipes';
import { Referentiels } from './Referentiels';
import type { EntreeLecture } from './Referentiels';
import { Roles } from './Roles';
import { NB_ROLES_ACCES, RolesAcces } from './RolesAcces';
import { useSession } from '../../donnees/SessionProvider';
import { ENTREE_PARAMETRAGE_ROLES, ENTREE_UNITES, REFERENTIELS_RESSOURCES } from '../../domaine/config';
import { aujourdhui } from '../../domaine/dates';
import { ongletPermis } from '../../domaine/droits';
import { ressourcesPresentes } from '../../domaine/vues';

/** Onglet « Équipes et ressources » (porteur, 2026-11-12 : « l'onglet ressources et équipes gérés au même endroit »), navigation à gauche :
 *  Directions, équipes et projets (ex-onglet Équipes), Profil (modifiable), Rôle (description, lecture seule) et Personnes et rôles (qui a quel rôle,
 *  droit « roles » de la matrice) */
export function RessourcesAdmin({ modifiable, entreeInitiale }: { modifiable: boolean; entreeInitiale?: string }) {
  const { ctx, donnees } = useSession();
  if (!ctx || !donnees) return null;
  const extras: EntreeLecture[] = [{ id: 'acces', nom: 'Rôle', compte: NB_ROLES_ACCES, contenu: <RolesAcces /> }];
  if (ongletPermis(ctx, 'monAdmin', 'roles')) {
    extras.push({ id: ENTREE_PARAMETRAGE_ROLES, nom: 'Personnes et rôles', compte: ressourcesPresentes(donnees, aujourdhui()).length, contenu: <div className="colonne-parametrage"><Roles /></div> });
  }
  const avant: EntreeLecture[] = [{ id: ENTREE_UNITES, nom: 'Directions, équipes et projets', compte: donnees.equipes.length, contenu: <Equipes /> }];
  return <Referentiels modifiable={modifiable} montrer={REFERENTIELS_RESSOURCES} avant={avant} extras={extras} entreeInitiale={entreeInitiale} />;
}
