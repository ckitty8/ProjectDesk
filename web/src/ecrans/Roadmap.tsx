/* ============================================================
   Vue d’ensemble › Roadmap — tableau des demandes de la roadmap fonctionnelle (lecture)
   ------------------------------------------------------------
   Porteur, 2026-11-03 : « construis le tableau sans alimenter les données » (3.04), puis les colonnes réglées dans Administration › Roadmap
   (3.05, table colonnes_roadmap, migration 056). L'en-tête suit les colonnes en base, regroupées par bloc (domaine/roadmap.ts). Aucune
   demande en base pour l'instant : la source des demandes (saisie, import du fichier ou Azure DevOps) reste à décider
   (docs/specifications/roadmap.md).
   ============================================================ */
import { Carte, EnteteEcran, Vide } from '../composants/Carte';
import { useSession } from '../donnees/SessionProvider';
import { blocsDuTableau } from '../domaine/roadmap';

/** Menu Roadmap : en-tête à deux niveaux (bloc, puis colonne) et, pour l'instant, le message « aucune demande » sous le tableau */
export function Roadmap() {
  const { donnees } = useSession();
  if (!donnees) return null;
  const blocs = blocsDuTableau(donnees.colonnesRoadmap);
  const colonnes = blocs.flatMap(b => b.colonnes);
  return (
    <div className="ecran ecran-large">
      <EnteteEcran titre="Roadmap" sousTitre="Demandes de la roadmap fonctionnelle · classées par rang de traitement DSI · Rang et Score calculés par l’application" />
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
              <tbody />
            </table>
          </div>
          {/* Message hors de la zone qui défile : il reste visible quelle que soit la largeur du tableau */}
          <Vide texte="Aucune demande pour le moment." />
        </>}
      </Carte>
    </div>
  );
}
