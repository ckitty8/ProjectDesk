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
import { ModaleAffectation } from '../../composants/modales/ModaleAffectation';
import { ModaleEquipe } from '../../composants/modales/ModaleEquipe';
import { ModaleRessource } from '../../composants/modales/ModaleRessource';
import { NouveauProjet } from '../../composants/NouveauProjet';
import { PanneauProjet } from '../../composants/PanneauProjet';
import { supprimer, supprimerOrganisation } from '../../donnees/api';
import { useSession } from '../../donnees/SessionProvider';
import { aujourdhui } from '../../domaine/dates';
import { equipeVide, responsablesAffiches, roleChoisi } from '../../domaine/annuaire';
import { aDroit, estAdministrateur, estAdministrateurPrevu, peutGererEquipe, peutModifierFiche } from '../../domaine/droits';
import { AIDES } from '../../domaine/textes';
import { arbreUnites, ressourcesPresentes } from '../../domaine/vues';
import { COULEURS, ROLES_ACCES, ROLES_ATTRIBUABLES } from '../../domaine/config';
import { valeursDe } from '../../domaine/referentiels';
import { useActionsRoles } from './Roles';

export function Equipes() {
  const { ctx, donnees, executer, notifier } = useSession();
  const [modale, setModale] = useState<{ id: string | null; typeUnite?: string } | null>(null);
  // Projets : ouverts ici aussi (porteur, 2026-11-06 : directions, équipes ET projets s'ajoutent, se modifient et se suppriment depuis ce seul onglet)
  const [projetOuvert, setProjetOuvert] = useState<string | null>(null);
  const [nouveauProjet, setNouveauProjet] = useState<string | null>(null);
  // Créer des personnes pour chaque direction, équipe et projet (porteur, 2026-11-13) : « + Personne » ouvre la fiche dans l'unité ; depuis un projet, la
  // personne est ensuite affectée à ce projet (fenêtre d'affectation)
  const [fiche, setFiche] = useState<{ equipeId: string; projetId: string } | null>(null);
  const [affectation, setAffectation] = useState<{ ressourceId: string | null; projetId: string | null } | null>(null);
  // Équipes dépliées : leurs personnes s'affichent dessous, avec profil, rôle et case Administrateur
  // (porteur, 2026-11-12 : équipes et ressources au même endroit)
  const [depliees, setDepliees] = useState<ReadonlySet<string>>(new Set());
  const basculerEquipe = (id: string) => setDepliees(avant => { const suite = new Set(avant); if (!suite.delete(id)) suite.add(id); return suite; });
  const actions = useActionsRoles();
  if (!ctx || !donnees) return null;
  const actives = ressourcesPresentes(donnees, aujourdhui());
  // Ajouter et supprimer des directions et équipes : ici seulement, en mode administrateur (porteur, 2026-11-06). Suppression d'une unité vide :
  // ligne « equipes » (contrôlée en base), puis organisation Neon Auth
  async function supprimerUnite(id: string, nom: string) {
    const unite = donnees!.equipes.find(x => x.id === id);
    const membres = donnees!.ressources.filter(r => r.equipeId === id), projets = donnees!.projets.filter(p => p.equipeId === id).length;
    const sousUnites = donnees!.equipes.filter(x => x.parentId === id);
    // Direction (porteur, 2026-11-06 : « les utilisateurs se retrouvent sans direction, c'est tout ») : ses équipes sont détachées, seules ses propres
    // fiches rattachées sont supprimées avec elle ; une équipe, elle, doit être vide (la base protège les données)
    if (unite?.type === 'direction') {
      const detail = `${sousUnites.length ? `Ses équipes (${sousUnites.map(x => x.nom).join(', ')}) se retrouveront sans direction. ` : ''}`
        + `${membres.length ? `Sont supprimées avec elle : ${membres.map(r => r.nom).join(', ')}. ` : ''}`;
      if (!window.confirm(`Supprimer la direction « ${nom} » ? ${detail}`)) return;
    } else {
      if (membres.length || projets || sousUnites.length) {
        notifier(`« ${nom} » n’est pas vide (${membres.length} membre(s), ${projets} projet(s), ${sousUnites.length} sous-unité(s)) : supprimez d’abord ses projets `
          + 'et ses sous-unités, et retirez ses membres.', 'erreur');
        return;
      }
      if (!window.confirm(`Supprimer « ${nom} » (vide) ?`)) return;
    }
    if (await executer(() => supprimer('equipes', { id: 'eq.' + id }), 'equipes', 'ressources')) await supprimerOrganisation(id).catch(() => undefined);
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
              <td>
                {actives.some(r => r.equipeId === e.id)
                  ? (
                    <button type="button" className="lien-btn" aria-expanded={depliees.has(e.id)} onClick={() => basculerEquipe(e.id)}>
                      {actives.filter(r => r.equipeId === e.id).length} {depliees.has(e.id) ? '▾' : '▸'}
                    </button>
                  )
                  : 0}
              </td>
              <td>{donnees.projets.filter(p => p.equipeId === e.id).length}</td>
              <td className="num ligne-flex">
                {peutGererEquipe(ctx, e.id) && <button type="button" className="lien-btn" onClick={() => setModale({ id: e.id })}>Modifier</button>}
                {ctx.estAdmin && <button type="button" className="lien-btn" onClick={() => setFiche({ equipeId: e.id, projetId: '' })}>+ Personne</button>}
                {ctx.estAdmin && e.type !== 'direction' && <button type="button" className="lien-btn" onClick={() => setNouveauProjet(e.id)}>+ Projet</button>}
                {ctx.estAdmin && (
                  <button type="button" className={'lien-btn' + (e.type === 'direction' || equipeVide(ctx, e.id) ? '' : ' pale')} onClick={() => void supprimerUnite(e.id, e.nom)}
                    title={e.type === 'direction' ? 'Supprimer la direction (ses équipes se retrouvent sans direction)' : equipeVide(ctx, e.id) ? 'Supprimer (vide)' : 'Non vide : cliquez pour voir ce qui bloque'}>Supprimer</button>
                )}
              </td>
            </tr>
            {depliees.has(e.id) && actives.filter(r => r.equipeId === e.id).sort((a, b) => a.nom.localeCompare(b.nom)).map(r => {
              const admin = estAdministrateur(ctx, r) || estAdministrateurPrevu(ctx, r), estLeCreateur = ctx.createur.some(c => c.userId === r.userId);
              const profils = [...new Set([...valeursDe(donnees.valeurs, 'poste').map(v => v.libelle), ...(r.poste ? [r.poste] : [])])];
              return (
                <tr key={r.id} className="ligne-personne-equipe">
                  <td style={{ paddingLeft: 12 + 24 * (niveau + 1) }}><span className="ligne-flex">{r.nom}<span className="discret texte-12">personne</span></span></td>
                  <td>
                    <select className="champ champ-mini" aria-label={`Profil de ${r.nom}`} value={r.poste ?? ''} disabled={!peutModifierFiche(ctx, r)}
                      onChange={ev => void actions.changerFiche(r, { poste: ev.target.value || null }, 'Profil enregistré')}>
                      <option value="">—</option>{profils.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                  <td>
                    <select className="champ champ-mini" aria-label={`Rôle de ${r.nom}`} value={roleChoisi(ctx, r)} disabled={!aDroit(ctx, 'roles')}
                      onChange={ev => void actions.affecter(r, ev.target.value)}>
                      {ROLES_ATTRIBUABLES.map(c => <option key={c} value={c}>{ROLES_ACCES[c].libelle}</option>)}
                    </select>
                  </td>
                  <td />
                  <td className="num">
                    <label className="ligne-flex">
                      <input type="checkbox" aria-label={`Administrateur : ${r.nom}`} checked={admin} disabled={!(aDroit(ctx, 'nommer_admin') && ctx.estCreateur) || estLeCreateur}
                        onChange={ev => void actions.definirAdministrateur(r, ev.target.checked)} />Admin
                    </label>
                  </td>
                </tr>
              );
            })}
            {donnees.projets.filter(p => p.equipeId === e.id).sort((a, b) => a.code.localeCompare(b.code)).map(p => (
              <tr key={p.id} className="ligne-projet">
                <td style={{ paddingLeft: 12 + 24 * (niveau + 1) }}>
                  <span className="ligne-flex"><Code texte={p.code} />{p.nom}<span className="discret texte-12">projet</span></span>
                </td>
                <td>{donnees.ressources.find(r => r.id === p.chefId)?.nom ?? <span className="pale">—</span>}</td>
                <td>{donnees.affectations.filter(a => a.projetId === p.id).length}</td>
                <td />
                <td className="num ligne-flex">
                  {ctx.estAdmin && <button type="button" className="lien-btn" onClick={() => setFiche({ equipeId: e.id, projetId: p.id })}>+ Personne</button>}
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
      {fiche && (
        <ModaleRessource id={null} equipeId={fiche.equipeId} retourProjet={fiche.projetId} onFermer={() => setFiche(null)}
          onAffecter={id => { setFiche(null); setAffectation({ ressourceId: id, projetId: null }); }}
          onRetourAffectation={(id, projetId) => { setFiche(null); setAffectation({ ressourceId: id, projetId }); }}
          onRoles={() => setFiche(null)} />
      )}
      {affectation && <ModaleAffectation ressourceId={affectation.ressourceId} projetId={affectation.projetId} onFermer={() => setAffectation(null)} />}
      {modale && <ModaleEquipe id={modale.id} typeUnite={modale.typeUnite} onFermer={() => setModale(null)} />}
    </Carte>
  );
}
