/* ============================================================
   Mon dashboard › Administration › Roadmap : deux sous-onglets (porteur, 2026-11-04 ; maquette admin-roadmap-calculs/)
   - Colonnes : les colonnes du tableau (ColonnesRoadmap, 3.05) ;
   - Calculs : le détail du score et du rang, avec un exemple (CalculsRoadmap, 3.08), lecture seule.
   L'onglet Roadmap est réservé aux administrateurs (ongletsAdministration, domaine/admin.ts).
   ============================================================ */
import { useState } from 'react';
import { Onglets } from '../../composants/Onglets';
import { useSession } from '../../donnees/SessionProvider';
import { CalculsRoadmap } from './CalculsRoadmap';
import { ColonnesRoadmap } from './ColonnesRoadmap';

export function RoadmapAdmin({ modifiable }: { modifiable: boolean }) {
  const { donnees } = useSession();
  const [onglet, setOnglet] = useState('colonnes');
  return (
    <>
      <div className="onglets-secondaires">
        <Onglets liste={[{ id: 'colonnes', libelle: 'Colonnes', compte: donnees?.colonnesRoadmap.length }, { id: 'calculs', libelle: 'Calculs' }]}
          actif={onglet} onChoisir={setOnglet} />
      </div>
      {onglet === 'colonnes' ? <ColonnesRoadmap modifiable={modifiable} /> : <CalculsRoadmap />}
    </>
  );
}
