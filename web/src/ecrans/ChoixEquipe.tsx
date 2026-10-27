/* ============================================================
   Écran « Choix de l'équipe » (maquette complements/choix-equipe.png ; portage de app/js/ecrans/choix-equipe.js — phase 5, vague A)
   Invitations reçues, équipes de l'utilisateur. Compte sans équipe : message « compte créé, en attente d'accès » et bouton Actualiser
   (maquette docs/maquettes/comptes-en-attente/) — l'accès est donné par un administrateur dans Administration › Comptes en attente.
   ============================================================ */
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BadgeActif, Pastille } from '../composants/Badge';
import { Bouton } from '../composants/Bouton';
import { Carte, Vide } from '../composants/Carte';
import { accepterInvitation, refuserInvitation } from '../donnees/api';
import { useSession } from '../donnees/SessionProvider';
import { estPresent } from '../domaine/calculs';
import { aujourdhui } from '../domaine/dates';
import { COULEURS } from '../domaine/config';
import { mesEquipes } from '../domaine/droits';
import { cheminDe, routeDe } from '../routes';

/** En-tête commun aux deux vues : « Bonjour Prénom ». Avec une équipe déjà ouverte, une croix ferme la fenêtre et revient à l'écran
 *  précédent (porteur 2026-10-26) ; compte en attente d'accès : lien de déconnexion (changer de compte). */
function Bonjour({ prenom, fermable, onFermer }: { prenom: string; fermable: boolean; onFermer: () => void }) {
  const { equipeCourante, seDeconnecter } = useSession();
  return (
    <div className="ligne-flex entre">
      <h1>Bonjour {prenom}</h1>
      {fermable
        ? <button type="button" className="lien-btn" title="Fermer" aria-label="Fermer" onClick={onFermer}>✕</button>
        : !equipeCourante && <button type="button" className="lien-btn" onClick={() => void seDeconnecter()}>Déconnexion</button>}
    </div>
  );
}

/** Compte créé mais pas encore d'équipe : l'administrateur voit la demande (Comptes en attente) */
function EnAttente({ prenom }: { prenom: string }) {
  const { compte, actualiser } = useSession();
  return (
    <div className="plein-ecran"><Carte classe="boite large">
      <Bonjour prenom={prenom} fermable={false} onFermer={() => undefined} />
      <Carte classe="encart-moyen encart-info"><div style={{ margin: '14px 0' }}>
        <b>Votre compte est créé.</b> Il reste une étape : un administrateur doit vous donner accès à votre équipe.
        <div className="discret" style={{ marginTop: 6 }}>
          Votre demande apparaît déjà dans son Administration (compte <b>{compte?.session.user.email}</b>). Vous n’avez rien d’autre à faire.
        </div>
      </div></Carte>
      <div className="ligne-flex">
        <Bouton variante="primaire" onClick={() => void actualiser()}>Actualiser</Bouton>
        <span className="discret texte-12-5">dès que l’accès est donné, cliquez ici ou reconnectez-vous</span>
      </div>
      <div className="discret" style={{ borderTop: '1px solid var(--bordure-fine)', paddingTop: 14, marginTop: 18, fontSize: 12.5 }}>
        Ce n’est pas le bon compte ? Si vous en avez créé plusieurs (email personnel et professionnel), connectez-vous avec celui donné à
        votre responsable.
      </div>
    </Carte></div>
  );
}

export function ChoixEquipe() {
  const { compte, ctx, donnees, equipeCourante, choisirEquipe, actualiser } = useSession();
  const navigate = useNavigate();
  const { state } = useLocation() as { state: { retour?: string } | null };
  const [erreur, setErreur] = useState<string | null>(null);
  if (!compte || !ctx || !donnees) return null;
  const prenom = (compte.session.user.name || '').split(' ')[0] ?? '';
  const equipes = mesEquipes(ctx);
  const retour = () => navigate(state?.retour && routeDe(state.retour) ? cheminDe(state.retour) : '/');
  if (!equipes.length && !compte.invitations.length && !ctx.estAdmin) return <EnAttente prenom={prenom} />;

  // Invitation acceptée ou refusée : l'équipe apparaît (ou non) après une relecture complète
  async function repondre(action: typeof accepterInvitation, id: string) {
    try { await action(id); setErreur(null); await actualiser(); }
    catch (e) { setErreur((e as Error).message); }
  }

  return (
    <div className="plein-ecran"><Carte classe="boite large">
      <Bonjour prenom={prenom} fermable={!!equipeCourante} onFermer={retour} />
      <div className="sous-titre marge-bas">Choisissez l’équipe dans laquelle vous travaillez. Vous pourrez en changer à tout moment.</div>
      {erreur && <div className="message-erreur" role="alert">{erreur}</div>}
      {compte.invitations.length > 0 && (
        <>
          <div className="libelle">Invitations reçues</div>
          <div className="pile marge-bas">
            {compte.invitations.map(i => (
              <div key={i.id} className="carte-choix invitation">
                <Pastille couleur={COULEURS.violet} />
                <div className="extensible"><b>{i.organizationName || 'Équipe'}</b><div className="discret texte-12">Invitation · rôle {i.role}</div></div>
                <Bouton onClick={() => void repondre(refuserInvitation, i.id)}>Refuser</Bouton>
                <Bouton variante="primaire" onClick={() => void repondre(accepterInvitation, i.id)}>Accepter</Bouton>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="libelle">Mes équipes</div>
      <div className="pile marge-bas">
        {equipes.length === 0 && <Vide texte="Vous n’êtes membre d’aucune équipe pour le moment." />}
        {equipes.map(e => {
          const nbPers = donnees.ressources.filter(r => r.equipeId === e.id && estPresent(r, aujourdhui())).length;
          const nbProj = donnees.projets.filter(p => p.equipeId === e.id).length;
          const courante = e.id === equipeCourante;
          return (
            <div key={e.id} className={'carte-choix' + (courante ? ' courante' : '')}>
              <Pastille couleur={e.couleur ?? COULEURS.pale} />
              <div className="extensible">
                <b>{e.nom}</b> {e.actif === false && <BadgeActif actif={false} />}
                <div className="discret texte-12">{nbPers} personnes · {nbProj} projets · rôle {ctx.rolesEquipe[e.id] || 'member'}</div>
              </div>
              <Bouton variante={courante ? 'primaire' : 'normal'} onClick={() => { choisirEquipe(e.id); navigate(cheminDe('dashboard')); }}>Ouvrir</Bouton>
            </div>
          );
        })}
      </div>
      {ctx.estAdmin && !equipes.length && (
        <div className="discret texte-12-5">Les équipes sont créées dans l’Administration. <Link to={cheminDe('monAdmin')}>Ouvrir l’administration</Link></div>
      )}
    </Carte></div>
  );
}
