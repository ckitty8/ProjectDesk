/* ============================================================
   Administration › Ressources › Rôle (porteur, 2026-11-02, maquettes ressources-roles-profil/ et role-unique/) — lecture seule
   Les rôles sont fixes : le code (domaine/config.ts) et les règles de la base en dépendent, ils ne se renomment pas et on n'en ajoute pas.
   On les consulte ici : leur périmètre, ce que la matrice leur ouvre aujourd'hui (resumeDuRole, un seul calcul pour toute l'application) et le
   nombre de personnes qui les ont. Pour donner un rôle : Administration › Ressources › Paramétrage des rôles ; pour régler les droits : Matrice des droits.
   ============================================================ */
import { Badge, BadgeTon } from '../../composants/Badge';
import { Carte } from '../../composants/Carte';
import { useSession } from '../../donnees/SessionProvider';
import { parRole, rolesAffiches } from '../../domaine/admin';
import { PERIMETRES, ROLES_ACCES, ROLES_CHOISISSABLES } from '../../domaine/config';
import type { RoleAcces } from '../../domaine/config';
import { aujourdhui } from '../../domaine/dates';

/** Nombre de rôles listés (Créateur + Administrateur + les six rôles) : compteur de l'entrée dans la liste de gauche */
export const NB_ROLES_ACCES = ROLES_CHOISISSABLES.length + 1;

/** Tableau des rôles : le Créateur puis les rôles, avec périmètre, droits ouverts par la matrice et nombre de personnes */
export function RolesAcces() {
  const { ctx, comptesEnAttente } = useSession();
  if (!ctx) return null;
  const groupes = parRole(ctx, aujourdhui(), comptesEnAttente);
  // Les rôles (sans « Compte en attente », qui n'est pas un rôle)
  const roles = rolesAffiches(ctx).filter(r => r.cle !== 'sansEquipe');
  return (
    <Carte>
      <div className="carte-titre"><h2>Rôle</h2><span className="discret texte-12">fixes : consultation seulement</span></div>
      <table className="tableau">
        <thead><tr><th>Rôle</th><th>Périmètre</th><th>Ce que la matrice lui ouvre</th><th className="num">Personnes</th></tr></thead>
        <tbody>
          <tr>
            <td><BadgeTon texte="★ Créateur" ton="violet" /></td>
            <td>{PERIMETRES.createur}</td>
            <td className="discret">Droits fixes, hors matrice. Seul à régler la matrice et à nommer les administrateurs.</td>
            <td className="num">{ctx.createur.length}</td>
          </tr>
          {roles.map(r => {
            const couleurs = ROLES_ACCES[r.cle as RoleAcces];
            return (
              <tr key={r.cle}>
                <td><Badge texte={r.libelle} couleur={couleurs.texte} fond={couleurs.fond} /></td>
                <td>{PERIMETRES[r.cle as RoleAcces]}</td>
                <td className="discret">{r.cle === 'admin' ? 'Tout. Statut qui se cumule avec un autre rôle (case « Administrateur » de Rôles). ' : ''}{r.description}</td>
                <td className="num">{groupes[r.cle]?.length ?? 0}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="encart-compact discret texte-12">
        Un rôle se donne dans Administration › Ressources › Paramétrage des rôles ; ses droits se règlent dans la Matrice des droits (créateur).
      </div>
    </Carte>
  );
}
