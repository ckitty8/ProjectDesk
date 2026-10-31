/* ============================================================
   Mon dashboard › Gestion des ressources › Liste des ressources (maquette docs/maquettes/liste-ressources-ux/3-navigation-detail.png, piste 3
   retenue par le porteur le 2026-10-09 ; portage de app/js/ecrans/liste-ressources.js — phase 5, vague D)
   Deux colonnes : à gauche la navigation (équipes, sous chacune son responsable et ses projets, puis Postes et Types de contrat) ; à droite le
   détail de ce qui est choisi (équipe : responsable, projets, membres ; projet : Product Owners puis membres ; Postes / Types de contrat).
   Droits d'affichage des boutons : unités et listes → administrateurs ; projets et personnes → membres de l'unité ; membres d'un projet →
   peutEditerProjet. La base (RLS, triggers) reste seule juge. Écran ouvert sans équipe pour un administrateur (vue d'organisation).
   ============================================================ */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListesValeurs } from './annuaire/ListesValeurs';
import { TableauPersonnes } from './annuaire/TableauPersonnes';
import type { LignePersonne } from './annuaire/TableauPersonnes';
import { Aide } from '../composants/Aide';
import { Avatar, BadgeActif, BadgeRef, BadgeTon, Code } from '../composants/Badge';
import { Bouton, BoutonIcone } from '../composants/Bouton';
import { Carte, EnteteEcran, Vide } from '../composants/Carte';
import { Icone } from '../composants/Icone';
import { ModaleAffectation } from '../composants/modales/ModaleAffectation';
import { ModaleEquipe } from '../composants/modales/ModaleEquipe';
import { ModaleRattachement } from '../composants/modales/ModaleRattachement';
import { ModaleRessource } from '../composants/modales/ModaleRessource';
import { NouveauProjet } from '../composants/NouveauProjet';
import { PanneauProjet } from '../composants/PanneauProjet';
import { supprimer, supprimerOrganisation } from '../donnees/api';
import { useSession } from '../donnees/SessionProvider';
import { equipeVide, rattachesA, rolesDuProjet, selectionAnnuaire, unitesNavigation } from '../domaine/annuaire';
import type { Choix } from '../domaine/annuaire';
import { libellePresence } from '../domaine/calculs';
import { ROLES_PROJET } from '../domaine/config';
import { aujourdhui } from '../domaine/dates';
import { estMembreDe, estResponsableDe, peutEditerProjet, peutModifierFiche, peutRattacherA, responsablesDe } from '../domaine/droits';
import { valeursDe } from '../domaine/referentiels';
import { AIDES } from '../domaine/textes';
import type { Equipe, Projet, Ressource } from '../domaine/types';
import { estInactive } from '../domaine/vues';

/** Fenêtre ou panneau ouvert sur cet écran */
type Ouvert =
  | { genre: 'projet'; id: string }
  | { genre: 'nouveauProjet'; equipeId: string }
  | { genre: 'affectation'; ressourceId: string | null; projetId: string | null; role: string | null }
  | { genre: 'rattachement'; equipeId: string }
  | { genre: 'ressource'; id: string | null; equipeId: string | null; retourProjet: string }
  | { genre: 'equipe'; id: string | null; typeUnite?: string }
  | null;

export function ListeRessources() {
  const { ctx, donnees, equipeCourante, executer } = useSession();
  const navigate = useNavigate();
  const [choixMemorise, setChoix] = useState<Choix | null>(null);
  const [q, setQ] = useState('');
  const [ouvert, setOuvert] = useState<Ouvert>(null);
  if (!ctx || !donnees) return null;
  const admin = ctx.estAdmin;
  const choix = selectionAnnuaire(ctx, choixMemorise, equipeCourante);
  const unites = unitesNavigation(ctx);
  const equipeNom = (id: string) => donnees.equipes.find(e => e.id === id)?.nom ?? '—';

  /* ---------- Colonne de gauche : navigation ---------- */
  const recherche = q.trim().toLowerCase();
  const noms = (liste: readonly Ressource[]) => liste.map(r => r.nom).join(' ');
  const actif = (type: Choix['type'], id?: string) => (choix.type === type && choix.id === id ? ' actif' : '');
  const groupes = unites.map(e => {
    const responsable = responsablesDe(ctx, e.id)[0];
    const personnes = donnees.ressources.filter(r => r.equipeId === e.id);
    const projets = donnees.projets.filter(p => p.equipeId === e.id).map(p => {
      const { productOwners, membres } = rolesDuProjet(ctx, p);
      const equipeProjet = [...productOwners, ...membres.map(m => m.r)];
      return { p, equipeProjet, texte: `${p.code} ${p.nom} ${noms(equipeProjet)}`.toLowerCase() };
    });
    // Un élément est visible s'il correspond (son nom ou une de ses personnes) ; toute l'équipe reste visible si son nom correspond
    const equipeTrouvee = !recherche || e.nom.toLowerCase().includes(recherche);
    const trouves = projets.filter(x => equipeTrouvee || x.texte.includes(recherche));
    const texteEquipe = `${e.nom} ${noms(personnes.filter(r => !donnees.affectations.some(a => a.ressourceId === r.id)))}`.toLowerCase();
    const visible = equipeTrouvee || trouves.length > 0 || texteEquipe.includes(recherche);
    const responsableVisible = equipeTrouvee || (!!responsable && responsable.nom.toLowerCase().includes(recherche));
    return { e, responsable, nbPersonnes: personnes.length + rattachesA(ctx, e.id).length, trouves, visible, responsableVisible };
  }).filter(g => g.visible);

  /* ---------- Détail : équipe ---------- */
  const detailEquipe = (e: Equipe) => {
    const membre = estMembreDe(ctx, e.id);
    const personnes = donnees.ressources.filter(r => r.equipeId === e.id), rattaches = rattachesA(ctx, e.id);
    const projets = donnees.projets.filter(p => p.equipeId === e.id);
    const responsable = responsablesDe(ctx, e.id)[0];
    const vide = equipeVide(ctx, e.id);
    const lignes: LignePersonne[] = [...personnes.map(r => ({ r })), ...rattaches.map(x => ({ r: x.r, rattacheA: e.id, depuis: x.depuis }))];
    const supprimerEquipe = async () => {
      if (!window.confirm(`Supprimer « ${e.nom} » (vide) ?`)) return;
      // Suppression d'une unité vide : ligne « equipes » (contrôlée en base), puis organisation Neon Auth
      if (await executer(() => supprimer('equipes', { id: 'eq.' + e.id }), 'equipes')) await supprimerOrganisation(e.id).catch(() => undefined);
    };
    return (
      <>
        <Carte classe="detail-entete">
          <div>
            <h2 className="detail-titre">{e.nom} <Code texte={e.prefixe ?? ''} /></h2>
            <div className="discret">{projets.length} projet(s) · {personnes.length} personne(s){rattaches.length ? ` · ${rattaches.length} rattachée(s)` : ''}</div>
          </div>
          <span className="extensible" />
          {(admin || estResponsableDe(ctx, e.id)) && <Bouton onClick={() => setOuvert({ genre: 'equipe', id: e.id })}>Modifier l’équipe</Bouton>}
          {admin && <BoutonIcone icone="supprimer" titre={vide ? 'Supprimer l’équipe' : 'Équipe non vide : retirez d’abord ses projets et ses membres'} disabled={!vide} onClick={() => void supprimerEquipe()} />}
        </Carte>
        {responsable && <CarteResponsable r={responsable} affecte={donnees.affectations.some(a => a.ressourceId === responsable.id)} onFiche={id => setOuvert({ genre: 'ressource', id, equipeId: null, retourProjet: '' })} />}
        <Carte>
          <div className="carte-titre">
            <h2>Projets</h2>
            {membre && <button type="button" className="lien-btn" onClick={() => setOuvert({ genre: 'nouveauProjet', equipeId: e.id })}>+ Projet</button>}
          </div>
          <table className="tableau">
            <thead><tr><th>Projet</th><th>Statut</th><th>Product Owners</th><th className="num">Membres</th></tr></thead>
            <tbody>
              {projets.length === 0 && <tr><td colSpan={5}><Vide texte="Aucun projet." /></td></tr>}
              {projets.map(p => {
                const { productOwners, membres } = rolesDuProjet(ctx, p);
                return (
                  <tr key={p.id} className="cliquable" tabIndex={0} onClick={() => setChoix({ type: 'projet', id: p.id })} onKeyDown={ev => { if (ev.key === 'Enter') setChoix({ type: 'projet', id: p.id }); }}>
                    <td><b style={{ fontWeight: 500 }}>{p.nom}</b></td>
                    <td><BadgeRef valeurs={donnees.valeurs} referentielId="stp" libelle={p.statut} /></td>
                    <td>{productOwners.map(r => r.nom).join(', ') || <span className="pale">—</span>}</td>
                    <td className="num">{membres.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Carte>
        <Carte>
          <div className="carte-titre">
            <h2>Membres de l’équipe {e.nom}</h2>
            <span className="ligne-flex">
              {peutRattacherA(ctx, e.id) && <button type="button" className="lien-btn" onClick={() => setOuvert({ genre: 'rattachement', equipeId: e.id })}>+ Personne existante</button>}
              {(membre || admin) && <button type="button" className="lien-btn" onClick={() => setOuvert({ genre: 'ressource', id: null, equipeId: e.id, retourProjet: '' })}>+ Personne</button>}
            </span>
          </div>
          <TableauPersonnes cle={'equipe:' + e.id} lignes={lignes} texteVide="Aucune personne." onFiche={id => setOuvert({ genre: 'ressource', id, equipeId: null, retourProjet: '' })} />
        </Carte>
      </>
    );
  };

  /* ---------- Détail : projet ---------- */
  const detailProjet = (p: Projet) => {
    const editable = peutEditerProjet(ctx, p);
    const { productOwners, membres } = rolesDuProjet(ctx, p);
    const departs = [...productOwners, ...membres.map(m => m.r)].filter(r => r.dateDepart && r.dateDepart >= aujourdhui()).length;
    const indicateur = (n: number, libelle: string) => <div><b>{n}</b><span className="discret">{libelle}</span></div>;
    return (
      <>
        <Carte classe="detail-entete">
          <div>
            <button type="button" className="lien-btn discret" onClick={() => setChoix({ type: 'equipe', id: p.equipeId })}>{equipeNom(p.equipeId)} ›</button>
            <h2 className="detail-titre">{p.nom} <BadgeRef valeurs={donnees.valeurs} referentielId="stp" libelle={p.statut} /></h2>
          </div>
          <span className="extensible" />
          <div className="detail-kpi">{indicateur(productOwners.length, 'Product Owners')}{indicateur(membres.length, 'membres')}{indicateur(departs, 'départ(s) prévu(s)')}</div>
          <Bouton onClick={() => setOuvert({ genre: 'projet', id: p.id })}>{editable ? 'Modifier le projet' : 'Voir le projet'}</Bouton>
        </Carte>
        <Carte>
          <div className="carte-titre"><h2>Product Owners <Aide texte={AIDES.productOwners()} /></h2><span className="discret">rôle « {ROLES_PROJET.CHEF} »</span></div>
          <div className="cartes-po">
            {productOwners.length === 0 && <span className="pale">Aucun Product Owner.</span>}
            {productOwners.map(r => (
              <div key={r.id} className="carte-po">
                <Avatar nom={r.nom} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="nom-personne">{r.nom}</div>
                  <div className="discret">{[r.typeContrat, libellePresence(r, aujourdhui())].filter(Boolean).join(' · ')}</div>
                </div>
                {peutModifierFiche(ctx, r) && <button type="button" className="lien-btn" onClick={() => setOuvert({ genre: 'ressource', id: r.id, equipeId: null, retourProjet: '' })}>Fiche</button>}
              </div>
            ))}
            {editable && (
              <a className="carte-po ajout" role="button" tabIndex={0} onClick={() => setOuvert({ genre: 'affectation', ressourceId: null, projetId: p.id, role: ROLES_PROJET.CHEF })}>
                + Ajouter un Product Owner
              </a>
            )}
          </div>
        </Carte>
        <Carte>
          <div className="carte-titre">
            <h2>Membres</h2>
            {editable && <button type="button" className="lien-btn" onClick={() => setOuvert({ genre: 'affectation', ressourceId: null, projetId: p.id, role: null })}>+ Membre</button>}
          </div>
          <TableauPersonnes cle={'projet:' + p.id} lignes={membres} texteVide="Aucun membre." deProjet onFiche={id => setOuvert({ genre: 'ressource', id, equipeId: null, retourProjet: '' })} />
        </Carte>
      </>
    );
  };

  const detail = choix.type === 'postes' ? <ListesValeurs refId="poste" champ="poste" titre="Postes" />
    : choix.type === 'contrats' ? <ListesValeurs refId="contrat" champ="typeContrat" titre="Types de contrat" />
      : choix.type === 'projet' ? (() => { const p = donnees.projets.find(x => x.id === choix.id); return p ? detailProjet(p) : null; })()
        : choix.type === 'equipe' ? (() => { const e = donnees.equipes.find(x => x.id === choix.id); return e ? detailEquipe(e) : null; })() : null;

  const noeud = (type: Choix['type'], id: string | undefined, contenu: React.ReactNode, classe = '') => (
    <a className={`noeud ${classe}${classe === 'personne' ? '' : actif(type, id)}`.trim()} role="button" tabIndex={0} onClick={() => setChoix({ type, id } as Choix)}
      onKeyDown={ev => { if (ev.key === 'Enter') setChoix({ type, id } as Choix); }}>{contenu}</a>
  );

  return (
    <div className="ecran" style={{ maxWidth: 1300 }}>
      <EnteteEcran titre="Liste des ressources" sousTitre="Choisissez une équipe ou un projet à gauche : ses personnes s’affichent à droite"
        actions={admin ? <Bouton variante="primaire" onClick={() => setOuvert({ genre: 'equipe', id: null, typeUnite: 'equipe' })}>+ Ajouter une équipe</Bouton> : undefined} />
      <div className="liste-ressources">
        <nav className="carte nav-ressources">
          <label className="recherche-champ"><Icone nom="recherche" /><input placeholder="Rechercher une personne, un projet" value={q} onChange={e => setQ(e.target.value)} /></label>
          {groupes.length === 0 && <Vide texte={admin ? 'Aucune équipe : « + Ajouter une équipe » pour commencer.' : 'Aucune équipe.'} />}
          {groupes.map(g => (
            <div key={g.e.id} className="noeud-groupe">
              {noeud('equipe', g.e.id, <>{g.e.nom} <span className="compte">{g.nbPersonnes}</span></>, 'equipe')}
              {g.responsable && g.responsableVisible && noeud('equipe', g.e.id, <><Avatar nom={g.responsable.nom} /><span>{g.responsable.nom}</span> <span className="compte">responsable</span></>, 'personne')}
              {g.trouves.map(x => <span key={x.p.id} style={{ display: 'contents' }}>{noeud('projet', x.p.id, <>{x.p.nom} <span className="compte">{x.equipeProjet.length}</span></>, 'projet')}</span>)}
            </div>
          ))}
          <div className="nav-separateur" />
          {noeud('postes', undefined, <>Postes <span className="compte">{valeursDe(donnees.valeurs, 'poste', true).length}</span></>)}
          {noeud('contrats', undefined, <>Types de contrat <span className="compte">{valeursDe(donnees.valeurs, 'contrat', true).length}</span></>)}
        </nav>
        <div className="detail-ressources">{detail}</div>
      </div>

      {ouvert?.genre === 'projet' && (
        <PanneauProjet projetId={ouvert.id} section="moi" onFermer={() => setOuvert(null)}
          onAssigner={id => setOuvert({ genre: 'affectation', ressourceId: null, projetId: id, role: null })} />
      )}
      {ouvert?.genre === 'nouveauProjet' && <NouveauProjet equipeId={ouvert.equipeId} onFermer={() => setOuvert(null)} onCree={id => setOuvert({ genre: 'projet', id })} />}
      {ouvert?.genre === 'affectation' && (
        <ModaleAffectation ressourceId={ouvert.ressourceId} projetId={ouvert.projetId} role={ouvert.role} onFermer={() => setOuvert(null)}
          onNouvellePersonne={(equipeId, projetId) => setOuvert({ genre: 'ressource', id: null, equipeId, retourProjet: projetId })} />
      )}
      {ouvert?.genre === 'rattachement' && <ModaleRattachement equipeId={ouvert.equipeId} onFermer={() => setOuvert(null)} />}
      {ouvert?.genre === 'ressource' && (
        <ModaleRessource id={ouvert.id} equipeId={ouvert.equipeId} retourProjet={ouvert.retourProjet} onFermer={() => setOuvert(null)}
          onAffecter={id => setOuvert({ genre: 'affectation', ressourceId: id, projetId: null, role: null })}
          onRetourAffectation={(id, projetId) => setOuvert({ genre: 'affectation', ressourceId: id, projetId, role: null })}
          onRoles={() => navigate('/administration', { state: { onglet: 'roles' } })} />
      )}
      {ouvert?.genre === 'equipe' && <ModaleEquipe id={ouvert.id} typeUnite={ouvert.typeUnite} onFermer={() => setOuvert(null)} />}
    </div>
  );
}

/** Responsable de l'équipe : en tête, signalé « hors projet » s'il n'est affecté à aucun projet. Il compte comme toute personne de l'équipe dans Congés. */
function CarteResponsable({ r, affecte, onFiche }: { r: Ressource; affecte: boolean; onFiche: (id: string) => void }) {
  const { ctx } = useSession();
  if (!ctx) return null;
  return (
    <Carte classe="detail-entete responsable">
      <Avatar nom={r.nom} grand />
      <div><div className="nom-personne">{r.nom}</div><div className="discret">Responsable de l’équipe{r.poste ? ' · ' + r.poste : ''}</div></div>
      <span className="extensible" />
      {!affecte && <BadgeTon texte="Hors projet" ton="violet" />}
      {estInactive(r) ? <BadgeActif actif={false} libelles={['Actif', 'Inactif']} /> : <BadgeTon texte="Comptée dans Congés" ton="info" />}
      {peutModifierFiche(ctx, r) && <button type="button" className="lien-btn" onClick={() => onFiche(r.id)}>Fiche</button>}
    </Carte>
  );
}
