/* ============================================================
   Administration › Équipes (portage de Administration.equipes de app/js/ecrans/administration.js — phase 5, vague D)
   Tableau des équipes : « Nouvelle équipe » (administrateurs), « Modifier » (qui gère l'équipe : administrateur ou responsable).
   ============================================================ */
import { useState } from 'react';
import { Aide } from '../../composants/Aide';
import { Code, Pastille } from '../../composants/Badge';
import { Bouton } from '../../composants/Bouton';
import { Carte, Vide } from '../../composants/Carte';
import { ModaleEquipe } from '../../composants/modales/ModaleEquipe';
import { useSession } from '../../donnees/SessionProvider';
import { aujourdhui } from '../../domaine/dates';
import { peutGererEquipe, responsablesDe } from '../../domaine/droits';
import { AIDES } from '../../domaine/textes';
import { ressourcesPresentes } from '../../domaine/vues';

export function Equipes() {
  const { ctx, donnees } = useSession();
  const [modale, setModale] = useState<{ id: string | null } | null>(null);
  if (!ctx || !donnees) return null;
  const actives = ressourcesPresentes(donnees, aujourdhui());
  return (
    <Carte>
      <div className="carte-titre">
        <h2>Équipes <Aide texte={AIDES.rolesEquipe} /></h2>
        {ctx.estAdmin && <Bouton variante="primaire" onClick={() => setModale({ id: null })}>+ Nouvelle équipe</Bouton>}
      </div>
      <table className="tableau">
        <thead><tr><th>Équipe</th><th>Responsable</th><th>Membres</th><th>Projets</th><th /></tr></thead>
        <tbody>
          {donnees.equipes.length === 0 && <tr><td colSpan={5}><Vide texte="Aucune équipe. Un administrateur crée la première équipe (Mon dashboard › Administration)." /></td></tr>}
          {donnees.equipes.map(e => (
            <tr key={e.id}>
              <td><span className="ligne-flex"><Pastille couleur={e.couleur ?? '#8A93A3'} />{e.nom} <Code texte={e.prefixe ?? ''} /></span></td>
              <td>{responsablesDe(ctx, e.id).map(r => r.nom).join(', ') || <span className="pale">—</span>}</td>
              <td>{actives.filter(r => r.equipeId === e.id).length}</td>
              <td>{donnees.projets.filter(p => p.equipeId === e.id).length}</td>
              <td className="num">{peutGererEquipe(ctx, e.id) && <button type="button" className="lien-btn" onClick={() => setModale({ id: e.id })}>Modifier</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {modale && <ModaleEquipe id={modale.id} onFermer={() => setModale(null)} />}
    </Carte>
  );
}
