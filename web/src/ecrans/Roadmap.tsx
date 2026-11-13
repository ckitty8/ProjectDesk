/* ============================================================
   Vue d’ensemble › Roadmap — tableau des demandes de la roadmap fonctionnelle (lecture)
   ------------------------------------------------------------
   Porteur, 2026-11-03 : le tableau (3.04), ses colonnes réglées dans Administration › Roadmap (3.05, table colonnes_roadmap), puis ses premières
   lignes : « les 3 plus récentes pour 2026 » du fichier CDO-ROADMAP-NEW (3.06, table demandes_roadmap, migration 057). L'en-tête suit les colonnes
   en base, regroupées par bloc ; les demandes sont classées par rang de traitement DSI, Rang et Score étant calculés (domaine/roadmap.ts).
   ============================================================ */
import { useState } from 'react';
import { Carte, EnteteEcran, Vide } from '../composants/Carte';
import { Onglets } from '../composants/Onglets';
import { CelluleDemande } from './roadmap/CelluleDemande';
import { useSession } from '../donnees/SessionProvider';
import { blocsDuTableau, choixRoadmap, demandesClassees, demandesDeLaPastille, pastilleParDefaut } from '../domaine/roadmap';

/** Menu Roadmap : en-tête à deux niveaux (bloc, puis colonne) et une ligne par demande, dans l'ordre de traitement DSI */
export function Roadmap() {
  const { donnees, equipeCourante } = useSession();
  // Une seule roadmap à la fois : pastille choisie (au départ : l'équipe active)
  const [choisie, setChoisie] = useState<string | null>(null);
  if (!donnees) return null;
  const pastilles = choixRoadmap(donnees.equipes, donnees.projets, donnees.demandesRoadmap);
  const actif = pastilles.some(p => p.id === choisie) ? choisie! : pastilleParDefaut(pastilles, equipeCourante);
  const blocs = blocsDuTableau(donnees.colonnesRoadmap);
  const colonnes = blocs.flatMap(b => b.colonnes);
  const lignes = demandesClassees(demandesDeLaPastille(donnees.demandesRoadmap, donnees.projets, actif), donnees.colonnesRoadmap);
  return (
    <div className="ecran ecran-large">
      <EnteteEcran titre="Roadmap"
        sousTitre={`${lignes.length} demande${lignes.length > 1 ? 's' : ''} · classées par rang de traitement DSI · Rang et Score calculés par l’application`} />
      {pastilles.length > 1
        && <Onglets liste={pastilles.map(p => ({ id: p.id, libelle: p.libelle, compte: p.nombre }))} actif={actif} onChoisir={setChoisie} />}
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
                    {colonnes.map(c => <td key={c.id} className={c.cle === 'demande' ? 'cellule-demande' : 'nowrap'}><CelluleDemande colonne={c} ligne={l} valeurs={donnees.valeurs} /></td>)}
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
