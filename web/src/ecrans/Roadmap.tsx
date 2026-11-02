/* ============================================================
   Suivi de mes équipes › Roadmap (porteur 2026-11-02, maquette menus-projets-roadmap/) — lecture
   Ancien onglet « Planning projet » de Projets et Roadmap, devenu un menu : sur une frise de 6 mois, les sprints de chaque projet et ses
   dates de mise en production (composant PlanningProjet), avec le même filtre par équipe que l'écran Projets.
   ============================================================ */
import { useState } from 'react';
import { PlanningProjet } from './projets/PlanningProjet';
import { EnteteEcran } from '../composants/Carte';
import { PucesEquipes } from '../composants/PucesEquipes';
import { useSession } from '../donnees/SessionProvider';

export function Roadmap() {
  const { donnees } = useSession();
  const [equipeId, setEquipeId] = useState('toutes');
  if (!donnees) return null;
  const projets = donnees.projets.filter(p => equipeId === 'toutes' || p.equipeId === equipeId);
  return (
    <div className="ecran">
      <EnteteEcran titre="Roadmap" sousTitre="Sprints et mises en production par projet"
        actions={<PucesEquipes equipes={donnees.equipes} choisie={equipeId} onChoisir={setEquipeId} />} />
      <PlanningProjet projets={projets} />
    </div>
  );
}
