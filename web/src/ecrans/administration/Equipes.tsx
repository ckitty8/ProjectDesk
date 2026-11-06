/* ============================================================
   Administration › Équipes (portage de Administration.equipes de app/js/ecrans/administration.js — phase 5, vague D)
   Tableau des directions et de leurs équipes (maquette docs/maquettes/hierarchie-equipes/, porteur 2026-11-02 : Direction › équipe › projet › membre) :
   la direction est une ligne de groupe, ses équipes sont dessous. « Nouvelle direction », « Nouvelle équipe » et « Supprimer » (une unité vide) :
   administrateurs, ici seulement (porteur, 2026-11-06) ; les projets de chaque équipe sont listés dessous (ajouter, modifier, supprimer) ;
   « Modifier » (qui gère l'unité :
   administrateur ou responsable). Les chiffres de chaque ligne sont ceux de l'unité elle-même.
   ============================================================ */
import { Fragment, useState } from 'react';
import { Aide } from '../../composants/Aide';
import { BadgeTon, Code, Pastille } from '../../composants/Badge';
import { Bouton } from '../../composants/Bouton';
import { Carte, Vide } from '../../composants/Carte';
import { ModaleEquipe } from '../../composants/modales/ModaleEquipe';
import { NouveauProjet } from '../../composants/NouveauProjet';
import { PanneauProjet } from '../../composants/PanneauProjet';
import { supprimer, supprimerOrganisation } from '../../donnees/api';
import { useSession } from '../../donnees/SessionProvider';
import { aujourdhui } from '../../domaine/dates';
import { equipeVide, responsablesAffiches } from '../../domaine/annuaire';
import { peutGererEquipe } from '../../domaine/droits';
import { AIDES } from '../../domaine/textes';
import { arbreUnites, ressourcesPresentes } from '../../domaine/vues';
import { COULEURS } from '../../domaine/config';

export function Equipes() {
  const { ctx, donnees, executer } = useSession();
  const [modale, setModale] = useState<{ id: string | null; typeUnite?: string } | null>(null);
  // Projets : ouverts ici aussi (porteur, 2026-11-06 : directions, équipes ET projets s'ajoutent, se modifient et se suppriment depuis ce seul onglet)
  const [projetOuvert, setProjetOuvert] = useState<string | null>(null);
  const [nouveauProjet, setNouveauProjet] = useState<string | null>(null);
  if (!ctx || !donnees) return null;
  const actives = ressourcesPresentes(donnees, aujourdhui());
  // Ajouter et supprimer des directions et équipes : ici seulement, en mode administrateur (porteur, 2026-11-06). Suppression d'une unité vide :
  // ligne « equipes » (contrôlée en base), puis organisation Neon Auth
  async function supprimerUnite(id: string, nom: string) {
    if (!window.confirm(`Supprimer « ${nom} » (vide) ?`)) return;
    if (await executer(() => supprimer('equipes', { id: 'eq.' + id }), 'equipes')) await supprimerOrganisation(id).catch(() => undefined);
  }
  async function supprimerProjet(id: string, nom: string) {
    if (!window.confirm(`Supprimer le projet « ${nom} » ?`)) return;
    await executer(() => supprimer('projets', { id: 'eq.' + id }), 'projets');
  }
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
        <thead><tr><th>Direction › équipe › projet</th><th>Responsable / chef de projet</th><th>Membres</th><th>Projets</th><th /></tr></thead>
        <tbody>
          {donnees.equipes.length === 0 && <tr><td colSpan={5}><Vide texte="Aucune équipe. Un administrateur crée la première équipe (Mon dashboard › Administration)." /></td></tr>}
          {arbreUnites(donnees.equipes).map(({ equipe: e, niveau }) => (
            <Fragment key={e.id}>
            <tr className={e.type === 'direction' ? 'groupe' : undefined}>
              <td style={niveau ? { paddingLeft: 12 + 24 * niveau } : undefined}>
                <span className="ligne-flex">
                  <Pastille couleur={e.couleur ?? COULEURS.pale} />{e.nom} <Code texte={e.prefixe ?? ''} />
                  {e.type === 'direction' ? <BadgeTon texte="Direction" ton="violet" /> : <span className="discret texte-12">équipe</span>}
                </span>
              </td>
              <td>{responsablesAffiches(ctx, e.id).map(r => r.nom).join(', ') || <span className="pale">—</span>}</td>
              <td>{actives.filter(r => r.equipeId === e.id).length}</td>
              <td>{donnees.projets.filter(p => p.equipeId === e.id).length}</td>
              <td className="num ligne-flex">
                {peutGererEquipe(ctx, e.id) && <button type="button" className="lien-btn" onClick={() => setModale({ id: e.id })}>Modifier</button>}
                {ctx.estAdmin && e.type !== 'direction' && <button type="button" className="lien-btn" onClick={() => setNouveauProjet(e.id)}>+ Projet</button>}
                {ctx.estAdmin && (
                  <button type="button" className="lien-btn" disabled={!equipeVide(ctx, e.id)} onClick={() => void supprimerUnite(e.id, e.nom)}
                    title={equipeVide(ctx, e.id) ? 'Supprimer (vide)' : 'Non vide : retirez d’abord ses projets, ses membres et ses sous-unités'}>Supprimer</button>
                )}
              </td>
            </tr>
            {donnees.projets.filter(p => p.equipeId === e.id).sort((a, b) => a.code.localeCompare(b.code)).map(p => (
              <tr key={p.id} className="ligne-projet">
                <td style={{ paddingLeft: 12 + 24 * (niveau + 1) }}>
                  <span className="ligne-flex"><Code texte={p.code} />{p.nom}<span className="discret texte-12">projet</span></span>
                </td>
                <td>{donnees.ressources.find(r => r.id === p.chefId)?.nom ?? <span className="pale">—</span>}</td>
                <td>{donnees.affectations.filter(a => a.projetId === p.id).length}</td>
                <td />
                <td className="num ligne-flex">
                  <button type="button" className="lien-btn" onClick={() => setProjetOuvert(p.id)}>Modifier</button>
                  {ctx.estAdmin && <button type="button" className="lien-btn" onClick={() => void supprimerProjet(p.id, p.nom)}>Supprimer</button>}
                </td>
              </tr>
            ))}
            </Fragment>
          ))}
        </tbody>
      </table>
      {projetOuvert && <PanneauProjet projetId={projetOuvert} section="moi" onFermer={() => setProjetOuvert(null)} />}
      {nouveauProjet && (
        <NouveauProjet equipeId={nouveauProjet} onFermer={() => setNouveauProjet(null)} onCree={id => { setNouveauProjet(null); setProjetOuvert(id); }} />
      )}
      {modale && <ModaleEquipe id={modale.id} typeUnite={modale.typeUnite} onFermer={() => setModale(null)} />}
    </Carte>
  );
}
