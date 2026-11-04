/* ============================================================
   Mon dashboard › Administration › Roadmap › Calculs — détail des calculs du tableau Roadmap, avec un exemple (lecture seule)
   ------------------------------------------------------------
   Porteur, 2026-11-04 : « un onglet dans administration > roadmap avec le détail des calculs présents dans le tableau et un exemple » ;
   maquette docs/maquettes/admin-roadmap-calculs/ ; administrateurs seulement ; exemple = les 3 premières demandes du classement.
   Les textes décrivent les fonctions de domaine/roadmap.ts (scoreDemande, demandesClassees) ; l'exemple est calculé par ces mêmes fonctions
   (detailScore, raisonDuRang), donc jamais en décalage avec le tableau.
   ============================================================ */
import { Carte } from '../../composants/Carte';
import { useSession } from '../../donnees/SessionProvider';
import { NB_DEMANDES_EXEMPLE, demandesClassees, detailScore, raisonDuRang, valeurParCle } from '../../domaine/roadmap';

/** Poids de la formule du score (source : fichier CDO-ROADMAP-NEW, colonne Score ; docs/specifications/roadmap.md § 1) */
const TERMES_SCORE = [
  ['Impact client', '1, 2 ou 3', '0,5', 'Ce qui touche le client pèse le plus'],
  ['Impact collaborateur', '1, 2 ou 3', '0,3', 'Gain pour les équipes internes'],
  ['Complexité', '1 à 5', '0,2', 'Le coût : plus c’est complexe, plus le score baisse']
] as const;

const Formule = ({ children }: { children: string }) => <div className="formule">{children}</div>;

export function CalculsRoadmap() {
  const { donnees } = useSession();
  if (!donnees) return null;
  const colonnes = donnees.colonnesRoadmap;
  const classees = demandesClassees(donnees.demandesRoadmap, colonnes);
  const exemple = classees.slice(0, NB_DEMANDES_EXEMPLE);
  const val = (i: number, cle: string) => valeurParCle(exemple[i]!.demande, colonnes, cle) ?? '—';

  return (
    <div className="calculs-roadmap">
      <Carte>
        <div className="carte-titre"><h2>Score : « est-ce que ça vaut le coup ? »</h2></div>
        <div className="corps-calcul">
          <p>Ce que la demande rapporte, divisé par ce qu’elle coûte. Plus le score est élevé, plus la demande est intéressante.</p>
          <Formule>Score = (0,5 × Impact client + 0,3 × Impact collaborateur) ÷ (0,2 × Complexité)</Formule>
          <table className="tableau">
            <thead><tr><th>Terme</th><th>Valeurs</th><th>Poids</th><th>Pourquoi</th></tr></thead>
            <tbody>
              {TERMES_SCORE.map(([terme, valeurs, poids, pourquoi]) => (
                <tr key={terme}><td>{terme}</td><td>{valeurs}</td><td>{poids}</td><td>{pourquoi}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="discret">Si un impact ou la complexité n’est pas saisi, le tableau affiche « complexité à saisir » au lieu d’un score (l’Excel donnait 0).</p>
        </div>
      </Carte>
      <Carte>
        <div className="carte-titre"><h2>Rang de traitement DSI : l’ordre de traitement</h2></div>
        <div className="corps-calcul">
          <p>Les demandes sont classées critère par critère ; on ne passe au critère suivant qu’en cas d’égalité. Rang 1 = à traiter en premier.</p>
          <ol>
            <li><b>Stratégique d’abord</b> : une demande « Stratégique = Oui » passe devant toutes les autres.</li>
            <li><b>Priorité du demandeur</b> : 1, puis 2, puis 3 (non saisie : en dernier).</li>
            <li><b>Score</b> : du plus élevé au plus bas (sans score : après celles qui en ont un).</li>
            <li><b>À égalité</b> : la demande la plus ancienne d’abord.</li>
          </ol>
          <p className="discret">Le rang compare toutes les demandes, tous projets confondus. Il remplace les colonnes techniques « Fixe » et « Clé » de l’Excel.</p>
        </div>
      </Carte>
      <Carte>
        <div className="carte-titre"><h2>Exemple : les {exemple.length} premières demandes du tableau</h2></div>
        <div className="corps-calcul">
          <p>Le calcul appliqué aux demandes actuelles de la roadmap (mis à jour automatiquement quand une demande change).</p>
          {exemple.length === 0 ? <div className="vide">Aucune demande pour le moment : l’exemple apparaîtra avec la première demande.</div> : (
            <div className="defilement-x">
              <table className="tableau tableau-exemple-calcul">
                <thead><tr><th>Rang</th><th>Demande</th><th>Stratégique</th><th>Priorité</th><th>Impact client</th><th>Impact collab.</th><th>Complexité</th>
                  <th>Calcul du score</th><th>Pourquoi ce rang</th></tr></thead>
                <tbody>
                  {exemple.map((l, i) => (
                    <tr key={l.demande.id}>
                      <td><b>{l.rang}</b></td><td className="cellule-texte">{val(i, 'demande')}</td>
                      <td>{val(i, 'strategique')}</td><td>{val(i, 'priorite')}</td><td>{val(i, 'impactClient')}</td>
                      <td>{val(i, 'impactCollaborateur')}</td><td>{val(i, 'complexite')}</td>
                      <td className="nowrap">{detailScore(l.demande, colonnes) ?? <span className="pale">complexité à saisir</span>}</td>
                      <td className="cellule-texte">{raisonDuRang(classees, i, colonnes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Carte>
    </div>
  );
}
