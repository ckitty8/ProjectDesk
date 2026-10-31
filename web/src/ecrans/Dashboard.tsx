/* ============================================================
   Suivi de mes équipes › Dashboard général (maquette 01-gDash.png ; portage de app/js/ecrans/dashboard.js — phase 5, vague A)
   Lecture : indicateurs (projets actifs, avancement, risques, occupation) et projets à surveiller (objectifs OKR retirés : porteur 2026-10-25).
   Les calculs viennent de domaine/calculs.ts ; l'écran ne recalcule rien.
   ============================================================ */
import { useState } from 'react';
import { Badge } from '../composants/Badge';
import { PanneauProjet } from '../composants/PanneauProjet';
import { Carte, EnteteEcran, Kpi, Vide } from '../composants/Carte';
import { Aide } from '../composants/Aide';
import { useSession } from '../donnees/SessionProvider';
import { avancementMoyen, projetsActifs, projetsASurveiller, tauxOccupation } from '../domaine/calculs';
import { CONFIG, STATUTS_PROJET } from '../domaine/config';
import { aujourdhui, formatCourt, lundi, pourcent } from '../domaine/dates';
import { couleurDe } from '../domaine/referentiels';
import { AIDES } from '../domaine/textes';

export function Dashboard() {
  const { donnees } = useSession();
  const [ouvert, setOuvert] = useState<string | null>(null);
  if (!donnees) return null;
  const jour = aujourdhui();
  const { projets, ressources, temps, absences, equipes, valeurs } = donnees;
  const actifs = projetsActifs(projets);
  const aRisque = actifs.filter(p => [STATUTS_PROJET.A_RISQUE, STATUTS_PROJET.EN_RETARD].includes(p.statut)).length;
  const feries = new Set(donnees.joursFeries.map(j => j.jour));
  const occupation = tauxOccupation(ressources, lundi(jour), temps, absences, feries);
  const aSurveiller = projetsASurveiller(projets, jour);

  return (
    <div className="ecran">
      <EnteteEcran titre="Dashboard général" sousTitre="Vue consolidée des équipes" />
      <div className="grille-kpi">
        <Kpi libelle="Projets actifs" valeur={actifs.length} complement={`${projets.length - actifs.length} terminés`} />
        <Kpi libelle="Avancement moyen" valeur={pourcent(avancementMoyen(actifs))} complement="projets actifs" aide={AIDES.avancementMoyen} />
        <Kpi libelle="Projets à risque ou en retard" valeur={aRisque} aide={AIDES.projetsRisque} />
        <Kpi libelle="Taux d’occupation" valeur={pourcent(occupation)} complement={`cible ${CONFIG.CIBLE_OCCUPATION} %`} aide={AIDES.tauxOccupation} />
      </div>
      <Carte>
        <div className="carte-titre"><h2>Projets à surveiller <Aide texte={AIDES.projetsSurveiller} /></h2></div>
        {aSurveiller.length === 0
          ? <Vide texte="Aucun projet à risque ni échéance proche." />
          : (
            <table className="tableau">
              <tbody>
                {aSurveiller.map(p => (
                  <tr key={p.id} className="cliquable" tabIndex={0} onClick={() => setOuvert(p.id)} onKeyDown={e => { if (e.key === 'Enter') setOuvert(p.id); }}>
                    <td>
                      {p.nom}
                      <div className="discret texte-12">{equipes.find(e => e.id === p.equipeId)?.nom} · échéance {formatCourt(p.fin)}</div>
                    </td>
                    <td className="num"><Badge texte={p.statut} couleur={couleurDe(valeurs, 'stp', p.statut)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </Carte>
      {ouvert && <PanneauProjet projetId={ouvert} onFermer={() => setOuvert(null)} />}
    </div>
  );
}
