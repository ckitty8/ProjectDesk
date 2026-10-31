/* ============================================================
   Panneau latéral « Projet » (maquette 11-panneau-projet.png ; portage de app/js/panneau-projet.js — phase 5, vague B)
   ------------------------------------------------------------
   Détail réduit à la demande du porteur (2026-09-25) : nom, description, chef de projet, équipe projet (membres et rôles) ; + statut
   (2026-10-26, liste « Statuts projet » d'Administration › Référentiels). Depuis « Suivi de mes équipes », le panneau reste en LECTURE
   SEULE ; la modification (nom, statut, chef, membres, suppression) arrive avec Mon dashboard › Projets et Roadmap (vague C).
   ============================================================ */
import { Avatar, BadgeRef, Pastille } from './Badge';
import { Panneau } from './Fenetres';
import { useSession } from '../donnees/SessionProvider';
import { estPresent } from '../domaine/calculs';
import { aujourdhui } from '../domaine/dates';

export function PanneauProjet({ projetId, onFermer }: { projetId: string; onFermer: () => void }) {
  const { donnees } = useSession();
  const projet = donnees?.projets.find(p => p.id === projetId);
  if (!donnees || !projet) return null;
  const equipe = donnees.equipes.find(e => e.id === projet.equipeId);
  const chef = donnees.ressources.find(r => r.id === projet.chefId);
  const membres = donnees.affectations.filter(a => a.projetId === projet.id)
    .flatMap(a => donnees.ressources.filter(r => r.id === a.ressourceId && estPresent(r, aujourdhui())).map(r => ({ r, role: a.role })));
  return (
    <Panneau titre={projet.nom} onFermer={onFermer}
      surtitre={equipe && <div className="ligne-flex discret"><Pastille couleur={equipe.couleur ?? '#8A93A3'} />{equipe.nom}</div>}>
      {projet.description && <div>{projet.description}</div>}
      <div className="infos">
        <span>Statut</span><span><BadgeRef valeurs={donnees.valeurs} referentielId="stp" libelle={projet.statut} /></span>
        <span>Méthode</span><span>{projet.methode ? <BadgeRef valeurs={donnees.valeurs} referentielId="methode" libelle={projet.methode} /> : '—'}</span>
        <span>Chef de projet</span><span className="ligne-flex">{chef ? <><Avatar nom={chef.nom} />{chef.nom}</> : '—'}</span>
      </div>
      <div className="discret texte-12">Vue « Suivi de mes équipes » en lecture seule. Modifiez ce projet depuis Mon dashboard.</div>
      <div>
        <div className="libelle">Équipe projet</div>
        {membres.length === 0 && <span className="pale">Aucun membre.</span>}
        {membres.map(({ r, role }) => (
          <div key={r.id} className="ligne-flex ligne-liste">
            <Avatar nom={r.nom} /><span className="extensible">{r.nom}</span><BadgeRef valeurs={donnees.valeurs} referentielId="role" libelle={role} />
          </div>
        ))}
      </div>
    </Panneau>
  );
}
