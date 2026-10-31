/* ============================================================
   Postes / Types de contrat (portage de Ecrans.listeRessources.valeurs de app/js/ecrans/liste-ressources.js — phase 5, vague D)
   Référentiels « poste » et « contrat » : administrateurs seulement pour ajouter, renommer (met à jour les fiches), activer / désactiver, supprimer
   une valeur inutilisée. « refId » = référentiel ; « champ » = propriété de la ressource qui porte la valeur.
   ============================================================ */
import { Aide } from '../../composants/Aide';
import { BadgeActif, Pastille } from '../../composants/Badge';
import { BoutonIcone } from '../../composants/Bouton';
import { Carte, Vide } from '../../composants/Carte';
import { creer, modifier, supprimer } from '../../donnees/api';
import { useSession } from '../../donnees/SessionProvider';
import { COULEURS } from '../../domaine/config';
import { valeursDe } from '../../domaine/referentiels';
import { AIDES } from '../../domaine/textes';

export function ListesValeurs({ refId, champ, titre }: { refId: 'poste' | 'contrat'; champ: 'poste' | 'typeContrat'; titre: string }) {
  const { ctx, donnees, executer } = useSession();
  if (!ctx || !donnees) return null;
  const admin = ctx.estAdmin;
  const valeurs = valeursDe(donnees.valeurs, refId, true);

  const ajouter = () => {
    const libelle = (window.prompt(refId === 'poste' ? 'Nouveau poste :' : 'Nouveau type de contrat :') ?? '').trim();
    if (libelle) void executer(() => creer('valeurs_referentiel', { referentielId: refId, libelle, ordre: valeurs.length + 1, couleur: COULEURS.neutre }), 'valeurs');
  };
  const renommer = (id: string, actuel: string) => {
    const libelle = (window.prompt('Nouveau nom :', actuel) ?? '').trim();
    if (libelle && libelle !== actuel) void executer(() => modifier('valeurs_referentiel', { id: 'eq.' + id }, { libelle }), 'valeurs', 'ressources');
  };

  return (
    <Carte>
      <div className="carte-titre">
        <h2>{titre}</h2>
        {admin ? <button type="button" className="lien-btn" onClick={ajouter}>+ Ajouter</button> : <span className="discret">Utilisés dans les fiches ressources</span>}
      </div>
      <table className="tableau">
        <thead><tr><th>Nom</th><th className="centre">Ressources</th><th>Statut <Aide texte={AIDES.valeursListe} /></th><th className="num">Actions</th></tr></thead>
        <tbody>
          {valeurs.length === 0 && <tr><td colSpan={4}><Vide texte="Aucune valeur." /></td></tr>}
          {valeurs.map(v => {
            const n = donnees.ressources.filter(r => r[champ] === v.libelle).length;
            const badge = <BadgeActif actif={v.actif} />;
            return (
              <tr key={v.id ?? v.libelle}>
                <td><span className="ligne-flex"><Pastille couleur={v.couleur} />{v.libelle}</span></td>
                <td className="num centre">{n}</td>
                <td>
                  {admin
                    ? <button type="button" className="lien-btn" title="Activer / désactiver" onClick={() => void executer(() => modifier('valeurs_referentiel', { id: 'eq.' + v.id }, { actif: !v.actif }), 'valeurs')}>{badge}</button>
                    : badge}
                </td>
                <td className="num">
                  {admin && (
                    <>
                      <BoutonIcone icone="modifier" titre="Renommer (met à jour les fiches)" onClick={() => renommer(v.id ?? '', v.libelle)} />
                      <BoutonIcone icone="supprimer" titre={n ? 'Valeur utilisée : passez-la en Inactive' : 'Supprimer'} disabled={!!n}
                        onClick={() => { if (window.confirm('Supprimer cette valeur ?')) void executer(() => supprimer('valeurs_referentiel', { id: 'eq.' + v.id }), 'valeurs'); }} />
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Carte>
  );
}
