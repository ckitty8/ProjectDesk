/* ============================================================
   Fenêtre « Ajouter un Product Owner à <projet> » (porteur, 2026-11-09 : « j'ai ajouté un autre Product Owner et elle n'apparaît pas au bon endroit »)
   Un Product Owner est une personne affectée au projet dont le rôle est Chef de projet (rôle unique, migration 054). La fenêtre fait donc les deux : elle
   AFFECTE la personne au projet et lui donne le rôle Chef de projet (fonction affecter_role, administrateurs) quand son rôle est plus modeste
   (Utilisateur, Membre, Lecture seule). Un rôle plus élevé (Direction, Responsable d'équipe) est conservé : la personne a déjà plus de droits.
   Sans droit pour changer le rôle (la base le refuse), la personne est tout de même affectée et le message dit qui peut finir le travail.
   ============================================================ */
import type { FormEvent } from 'react';
import { Bouton } from '../Bouton';
import { Cadre } from '../Fenetres';
import { creer, executer as appelerFonction } from '../../donnees/api';
import { useSession } from '../../donnees/SessionProvider';
import { roleChoisi } from '../../domaine/annuaire';
import { aujourdhui } from '../../domaine/dates';
import { personnesProposees, ressourcesPresentes } from '../../domaine/vues';

/** Rôles que « Product Owner » remplace : plus modestes que Chef de projet (Direction et Responsable d'équipe sont conservés) */
const ROLES_REMPLACES = ['utilisateur', 'membre', 'lecture'];

export function ModaleProductOwner({ projetId, onFermer }: { projetId: string; onFermer: () => void }) {
  // Toutes les personnes de l'application sont proposées (chefs de projet d'autres équipes comprises), comme dans la fenêtre d'affectation
  const { ctxComplet: ctx, donneesCompletes: donnees, executer, notifier, actualiser } = useSession();
  if (!ctx || !donnees) return null;
  const projet = donnees.projets.find(p => p.id === projetId);
  const dejaAffectees = new Set(donnees.affectations.filter(a => a.projetId === projetId).map(a => a.ressourceId));
  const personnes = personnesProposees(donnees, projet?.equipeId ?? '', aujourdhui())
    .filter(p => !dejaAffectees.has(p.valeur) || roleChoisi(ctx, donnees.ressources.find(r => r.id === p.valeur)!) !== 'chef');
  const actives = new Set(ressourcesPresentes(donnees, aujourdhui()).map(r => r.id));

  async function enregistrer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const ressourceId = String(new FormData(e.currentTarget).get('ressource'));
    const personne = donnees?.ressources.find(r => r.id === ressourceId);
    if (!personne || !ctx || !actives.has(ressourceId)) return;
    const reussi = await executer(async () => {
      if (!dejaAffectees.has(ressourceId)) await creer('affectations', { projetId, ressourceId });
    }, 'affectations');
    if (!reussi) return;
    if (ROLES_REMPLACES.includes(roleChoisi(ctx, personne))) {
      try {
        await appelerFonction('affecter_role', { p_ressource: ressourceId, p_role: 'chef' });
        await actualiser();
      } catch {
        notifier(`${personne.nom} est affectée au projet, mais seul un administrateur peut lui donner le rôle Chef de projet (Administration › Ressources).`, 'erreur');
      }
    }
    onFermer();
  }

  return (
    <Cadre classe="modale" titre={`Ajouter un Product Owner à ${projet?.nom ?? ''}`} onFermer={onFermer}
      pied={<><Bouton onClick={onFermer}>Annuler</Bouton><Bouton variante="primaire" type="submit" form="product-owner">Ajouter</Bouton></>}>
      <form id="product-owner" onSubmit={e => void enregistrer(e)}>
        <label className="libelle">Personne
          <select className="champ" name="ressource" required defaultValue="">
            <option value="">{personnes.length ? '— choisir —' : '— personne à ajouter —'}</option>
            {personnes.map(p => <option key={p.valeur} value={p.valeur}>{p.libelle}</option>)}
          </select>
        </label>
        <p className="discret texte-12">
          Un Product Owner est une personne affectée au projet avec le rôle « Chef de projet » : la personne est affectée à ce projet et, si son rôle
          est plus modeste, elle reçoit le rôle Chef de projet (sur tous ses projets).
        </p>
      </form>
    </Cadre>
  );
}
