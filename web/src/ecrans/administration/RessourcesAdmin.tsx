/* ============================================================
   Administration › Ressources (porteur, 2026-11-02, maquette ressources-roles-profil/)
   Les listes qui qualifient les personnes : les profils (référentiel « poste », nommé « Profil », modifiable) et le Rôle (un seul par personne depuis
   le 2026-11-02 : Direction, Responsable d'équipe, Chef de projet, Membre, Utilisateur, Lecture seule ; fixe, en lecture seule).
   Même écran que Référentiels, restreint à
   ces listes (composant Referentiels, règle n°4 : réutiliser avant de recréer).
   ============================================================ */
import { Referentiels } from './Referentiels';
import { NB_ROLES_ACCES, RolesAcces } from './RolesAcces';
import { REFERENTIELS_RESSOURCES } from '../../domaine/config';

export function RessourcesAdmin({ modifiable }: { modifiable: boolean }) {
  return <Referentiels modifiable={modifiable} montrer={REFERENTIELS_RESSOURCES}
    extras={[{ id: 'acces', nom: 'Rôle', compte: NB_ROLES_ACCES, contenu: <RolesAcces /> }]} />;
}
