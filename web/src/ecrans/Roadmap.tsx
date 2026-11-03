/* ============================================================
   Vue d’ensemble › Roadmap — tableau des demandes de la roadmap fonctionnelle (lecture)
   ------------------------------------------------------------
   Porteur, 2026-11-03 : le tableau (3.04), ses colonnes réglées dans Administration › Roadmap (3.05, table colonnes_roadmap), puis ses premières
   lignes : « les 3 plus récentes pour 2026 » du fichier CDO-ROADMAP-NEW (3.06, table demandes_roadmap, migration 057). L'en-tête suit les colonnes
   en base, regroupées par bloc ; les demandes sont classées par rang de traitement DSI, Rang et Score étant calculés (domaine/roadmap.ts).
   ============================================================ */
import { BadgeRef } from '../composants/Badge';
import { Carte, EnteteEcran, Vide } from '../composants/Carte';
import { useSession } from '../donnees/SessionProvider';
import { formatAvecAnnee } from '../domaine/dates';
import { blocsDuTableau, demandesClassees, scoreAffiche } from '../domaine/roadmap';
import type { DemandeClassee } from '../domaine/roadmap';
import type { ColonneRoadmap, ValeurReferentiel } from '../domaine/types';

/** Contenu d'une cellule selon le type de sa colonne : rang et score calculés, libellé de liste en pastille, date, nombre ou texte */
function Cellule({ colonne, ligne, valeurs }: { colonne: ColonneRoadmap; ligne: DemandeClassee; valeurs: readonly ValeurReferentiel[] }) {
  if (colonne.type === 'calcul') {
    if (colonne.cle === 'rang') return <b>{ligne.rang}</b>;
    return ligne.score === null ? <span className="pale" title="Impacts ou complexité non saisis">complexité à saisir</span> : <>{scoreAffiche(ligne.score)}</>;
  }
  const valeur = ligne.demande.valeurs[colonne.id];
  if (valeur === null || valeur === undefined || valeur === '') return <span className="pale">—</span>;
  if (colonne.type === 'liste' && colonne.referentielId) return <BadgeRef valeurs={valeurs} referentielId={colonne.referentielId} libelle={valeur} />;
  if (colonne.format === 'date') return <>{formatAvecAnnee(valeur)}</>;
  if (colonne.format === 'nombre') return <>{valeur.replace('.', ',')}</>;
  return <>{valeur}</>;
}

/** Menu Roadmap : en-tête à deux niveaux (bloc, puis colonne) et une ligne par demande, dans l'ordre de traitement DSI */
export function Roadmap() {
  const { donnees } = useSession();
  if (!donnees) return null;
  const blocs = blocsDuTableau(donnees.colonnesRoadmap);
  const colonnes = blocs.flatMap(b => b.colonnes);
  const lignes = demandesClassees(donnees.demandesRoadmap, donnees.colonnesRoadmap);
  return (
    <div className="ecran ecran-large">
      <EnteteEcran titre="Roadmap"
        sousTitre={`${lignes.length} demande${lignes.length > 1 ? 's' : ''} · classées par rang de traitement DSI · Rang et Score calculés par l’application`} />
      <Carte>
        {colonnes.length === 0 ? <Vide texte="Aucune colonne : elles se règlent dans Mon dashboard › Administration › Roadmap." /> : <>
          <div className="defilement-x">
            <table className="tableau tableau-roadmap">
              <thead>
                <tr className="blocs-roadmap">
                  {blocs.map(b => <th key={b.cle} scope="colgroup" colSpan={b.colonnes.length}>{b.titre}</th>)}
                </tr>
                <tr>
                  {colonnes.map(c => <th key={c.id} scope="col" title={c.type === 'calcul' ? 'Calculé par l’application' : undefined}>{c.libelle}</th>)}
                </tr>
              </thead>
              <tbody>
                {lignes.map(l => (
                  <tr key={l.demande.id}>
                    {colonnes.map(c => <td key={c.id} className={c.cle === 'demande' ? 'cellule-demande' : 'nowrap'}><Cellule colonne={c} ligne={l} valeurs={donnees.valeurs} /></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Message hors de la zone qui défile : il reste visible quelle que soit la largeur du tableau */}
          {lignes.length === 0 && <Vide texte="Aucune demande pour le moment." />}
        </>}
      </Carte>
    </div>
  );
}
