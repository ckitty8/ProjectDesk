/* ============================================================
   Administration › Équipes (portage de Administration.equipes de app/js/ecrans/administration.js — phase 5, vague D)
   Tableau des directions et de leurs équipes (maquette docs/maquettes/hierarchie-equipes/, porteur 2026-11-02 : Direction › équipe › projet › membre) :
   la direction est une ligne de groupe, ses équipes sont dessous. « Nouvelle équipe » (administrateurs), « Modifier » (qui gère l'unité :
   administrateur ou responsable). Les chiffres de chaque ligne sont ceux de l'unité elle-même.
   ============================================================ */
import { useState } from 'react';
import { Aide } from '../../composants/Aide';
import { BadgeTon, Code, Pastille } from '../../composants/Badge';
import { Bouton } from '../../composants/Bouton';
import { Carte, Vide } from '../../composants/Carte';
import { ModaleEquipe } from '../../composants/modales/ModaleEquipe';
import { useSession } from '../../donnees/SessionProvider';
import { aujourdhui } from '../../domaine/dates';
import { responsablesAffiches } from '../../domaine/annuaire';
import { peutGererEquipe } from '../../domaine/droits';
import { AIDES } from '../../domaine/textes';
import { arbreUnites, ressourcesPresentes } from '../../domaine/vues';
import { COULEURS } from '../../domaine/config';

export function Equipes() {
  const { ctx, donnees } = useSession();
  const [modale, setModale] = useState<{ id: string | null; typeUnite?: string } | null>(null);
  if (!ctx || !donnees) return null;
  const actives = ressourcesPresentes(donnees, aujourdhui());
  return (
    <Carte>
      <div className="carte-titre">
        <h2>Directions et équipes <Aide texte={AIDES.rolesEquipe} /></h2>
        {ctx.estAdmin && (
          <span className="ligne-flex">
            <Bouton onClick={() => setModale({ id: null, typeUnite: 'direction' })}>+ Nouvelle direction</Bouton>
            <Bouton variante="primaire" onClick={() => setModale({ id: null, typeUnite: 'equipe' })}>+ Nouvelle équipe</Bouton>
          </span>
        )}
      </div>
      <table className="tableau">
        <thead><tr><th>Direction › équipe</th><th>Responsable</th><th>Membres</th><th>Projets</th><th /></tr></thead>
        <tbody>
          {donnees.equipes.length === 0 && <tr><td colSpan={5}><Vide texte="Aucune équipe. Un administrateur crée la première équipe (Mon dashboard › Administration)." /></td></tr>}
          {arbreUnites(donnees.equipes).map(({ equipe: e, niveau }) => (
            <tr key={e.id} className={e.type === 'direction' ? 'groupe' : undefined}>
              <td style={niveau ? { paddingLeft: 12 + 24 * niveau } : undefined}>
                <span className="ligne-flex">
                  <Pastille couleur={e.couleur ?? COULEURS.pale} />{e.nom} <Code texte={e.prefixe ?? ''} />
                  {e.type === 'direction' ? <BadgeTon texte="Direction" ton="violet" /> : <span className="discret texte-12">équipe</span>}
                </span>
              </td>
              <td>{responsablesAffiches(ctx, e.id).map(r => r.nom).join(', ') || <span className="pale">—</span>}</td>
              <td>{actives.filter(r => r.equipeId === e.id).length}</td>
              <td>{donnees.projets.filter(p => p.equipeId === e.id).length}</td>
              <td className="num">{peutGererEquipe(ctx, e.id) && <button type="button" className="lien-btn" onClick={() => setModale({ id: e.id })}>Modifier</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {modale && <ModaleEquipe id={modale.id} typeUnite={modale.typeUnite} onFermer={() => setModale(null)} />}
    </Carte>
  );
}
