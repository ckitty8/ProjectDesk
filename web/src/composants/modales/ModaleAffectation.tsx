/* ============================================================
   Fenêtre d'affectation (maquette « Assigner une ressource » ; portage de Modale.affectation et enregistrerAffectations de app/js/modale.js
   — phase 5, vague D)
   ------------------------------------------------------------
   Assigner une ressource à des projets. « projetId » pré-coche le projet d'origine (« + Membre »). Pas de rôle par
   affectation : le rôle est celui de la personne (rôle unique, Ressources › Paramétrage des rôles, migration 054). Projets proposés : ceux que je peux
   gérer et où j'ai le droit d'affecter (peutAffecterSur), groupés par équipe.
   ============================================================ */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Bouton } from '../Bouton';
import { Cadre } from '../Fenetres';
import { creer, supprimer } from '../../donnees/api';
import { useSession } from '../../donnees/SessionProvider';
import { aujourdhui } from '../../domaine/dates';
import { peutAffecterSur } from '../../domaine/droits';
import { personnesProposees } from '../../domaine/vues';

interface Props {
  ressourceId: string | null;
  projetId: string | null;
  onFermer: () => void;
  /** « + Nouveau membre » : créer la personne dans cette équipe, puis revenir ici avec elle sélectionnée */
  onNouvellePersonne?: (equipeId: string, projetId: string) => void;
}

export function ModaleAffectation({ ressourceId, projetId, onFermer, onNouvellePersonne }: Props) {
  /* Projets : ceux de l'équipe active seulement (porteur, 2026-11-04 : « dans AMOA, je ne dois pas voir les projets d'IA et d'Applications »).
     Personnes proposées : TOUTES celles de l'application (chefs de projet et membres d'autres équipes comprises, porteur 2026-10-13 et 2026-11-04 :
     « il y a plein de chefs de projet dans la base ») : on les cherche dans les données complètes. */
  const { ctx, donnees, donneesCompletes, equipeCourante, executer } = useSession();
  const [choisie, setChoisie] = useState(ressourceId ?? '');
  if (!ctx || !donnees) return null;
  const projetOrigine = donnees.projets.find(p => p.id === projetId);
  const toutesLesPersonnes = donneesCompletes ?? donnees;
  const personnes = personnesProposees(toutesLesPersonnes, projetOrigine?.equipeId ?? '', aujourdhui());
  const ressource = toutesLesPersonnes.ressources.find(r => r.id === choisie);
  const actuelles = choisie ? donnees.affectations.filter(a => a.ressourceId === choisie) : [];
  // Équipe où créer une nouvelle personne : celle du projet d'origine, sinon l'équipe ouverte
  const equipeNouvelle = projetOrigine?.equipeId ?? equipeCourante;
  const nbCoches = actuelles.length + (projetId && !actuelles.some(a => a.projetId === projetId) ? 1 : 0);

  async function enregistrer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!donnees || !ctx) return;
    const f = new FormData(e.currentTarget), rId = String(f.get('ressource'));
    const coches = new Set(f.getAll('projet').map(String));
    const reussi = await executer(async () => {
      for (const p of donnees.projets.filter(x => peutAffecterSur(ctx, x))) {
        const a = donnees.affectations.filter(x => x.ressourceId === rId).find(x => x.projetId === p.id);
        if (coches.has(p.id) && !a) await creer('affectations', { projetId: p.id, ressourceId: rId });
        else if (!coches.has(p.id) && a) await supprimer('affectations', { id: 'eq.' + a.id });
      }
    }, 'affectations');
    if (reussi) onFermer();
  }

  const titre = projetOrigine ? `Ajouter une ressource à ${projetOrigine.nom}` : ressource ? `Affectations de ${ressource.nom}` : 'Assigner une ressource';
  return (
    <Cadre classe="modale" titre={titre} onFermer={onFermer}
      pied={(
        <>
          <span className="discret extensible">{nbCoches} affectation(s)</span>
          <Bouton onClick={onFermer}>Annuler</Bouton><Bouton variante="primaire" type="submit" form="affectations">Enregistrer les affectations</Bouton>
        </>
      )}>
      <form id="affectations" className="pile" onSubmit={e => void enregistrer(e)}>
        <div>
          <label className="libelle">Ressource
            <select className="champ" name="ressource" required value={choisie} onChange={e => setChoisie(e.target.value)}>
              <option value="">{personnes.length ? '— choisir —' : '— aucune fiche : créez la personne —'}</option>
              {personnes.map(p => <option key={p.valeur} value={p.valeur}>{p.libelle}</option>)}
            </select>
          </label>
          {equipeNouvelle && onNouvellePersonne && (
            <div style={{ marginTop: 6 }}>
              <button type="button" className="lien-btn" onClick={() => onNouvellePersonne(equipeNouvelle, projetId ?? '')}>+ Nouveau membre</button>{' '}
              <span className="discret texte-12">(créée dans {donnees.equipes.find(e => e.id === equipeNouvelle)?.nom}, puis sélectionnée ici)</span>
            </div>
          )}
        </div>
        <div>
          {donnees.equipes.map(e => {
            const projets = donnees.projets.filter(p => p.equipeId === e.id && peutAffecterSur(ctx, p));
            if (!projets.length) return null;
            return (
              <div key={e.id}>
                <div className="libelle" style={{ marginTop: 10 }}>{e.nom}</div>
                {projets.map(p => {
                  // Coché : déjà affecté, ou projet d'où l'on vient (« + Membre »)
                  const a = actuelles.find(x => x.projetId === p.id);
                  const coche = !!a || projetId === p.id;
                  return (
                    <label key={`${p.id}-${choisie}`} className="ligne-flex ligne-liste">
                      <input type="checkbox" name="projet" value={p.id} defaultChecked={coche} />
                      <span className="extensible">{p.nom}</span>
                    </label>
                  );
                })}
              </div>
            );
          })}
          {!donnees.projets.some(p => peutAffecterSur(ctx, p)) && <div className="vide">Aucun projet modifiable.</div>}
        </div>
      </form>
    </Cadre>
  );
}
