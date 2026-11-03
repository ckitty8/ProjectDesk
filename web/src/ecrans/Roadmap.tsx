/* ============================================================
   Vue d’ensemble › Roadmap — tableau des demandes de la roadmap fonctionnelle (lecture)
   ------------------------------------------------------------
   Porteur, 2026-11-03 : « construis le tableau sans alimenter les données ». Le tableau reprend les colonnes retenues du
   fichier CDO-ROADMAP-NEW.xlsm, rangées par bloc (domaine/config.ts, BLOCS_ROADMAP). Aucune table ni donnée en base pour
   l'instant : la source des demandes (saisie, import du fichier ou Azure DevOps) reste à décider (docs/specifications/roadmap.md).
   ============================================================ */
import { Carte, EnteteEcran, Vide } from '../composants/Carte';
import { BLOCS_ROADMAP } from '../domaine/config';

/** Toutes les colonnes, dans l'ordre des blocs */
const COLONNES = BLOCS_ROADMAP.flatMap(b => b.colonnes);

/** Menu Roadmap : en-tête à deux niveaux (bloc, puis colonne) et, pour l'instant, le message « aucune demande » sous le tableau */
export function Roadmap() {
  return (
    <div className="ecran ecran-large">
      <EnteteEcran titre="Roadmap" sousTitre="Demandes de la roadmap fonctionnelle · classées par rang de traitement DSI · Rang et Score calculés par l’application" />
      <Carte>
        <div className="defilement-x">
          <table className="tableau tableau-roadmap">
            <thead>
              <tr className="blocs-roadmap">
                {BLOCS_ROADMAP.map(b => <th key={b.titre} scope="colgroup" colSpan={b.colonnes.length}>{b.titre}</th>)}
              </tr>
              <tr>
                {COLONNES.map(c => (
                  <th key={c.cle} scope="col" title={c.calculee ? 'Calculé par l’application' : undefined}>{c.titre}</th>
                ))}
              </tr>
            </thead>
            <tbody />
          </table>
        </div>
        {/* Message hors de la zone qui défile : il reste visible quelle que soit la largeur du tableau */}
        <Vide texte="Aucune demande pour le moment." />
      </Carte>
    </div>
  );
}
