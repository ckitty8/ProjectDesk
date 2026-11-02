/* ============================================================
   Mon profil (porteur, 2026-10-31 ; maquette docs/maquettes/profil/mon-profil.png) — ouvert par un clic sur l'avatar ou le nom du bloc utilisateur
   Consultation seulement (porteur : aucune modification depuis cette page) : le compte (nom, email, vérification), la fiche ressource (équipe, poste,
   capacité, arrivée, date de naissance) et l'accès (rôle, équipes, projets). Pendant une simulation, c'est le profil de la personne simulée.
   ============================================================ */
import { Link, useNavigate } from 'react-router-dom';
import { Avatar, BadgeTon } from '../composants/Badge';
import { Bouton } from '../composants/Bouton';
import { Carte, EnteteEcran } from '../composants/Carte';
import { useSession } from '../donnees/SessionProvider';
import { LIBELLES_ROLES } from '../domaine/config';
import type { RoleAcces } from '../domaine/config';
import { formatAvecAnnee } from '../domaine/dates';
import { maRessource, mesEquipes, monRole, monRoleSansAdmin, trouverEquipe } from '../domaine/droits';
import { projetsDe } from '../domaine/vues';
import { cheminDe } from '../routes';

/** Une ligne « libellé : valeur » de carte (« — » quand l'information n'est pas renseignée) */
const Ligne = ({ libelle, valeur }: { libelle: string; valeur?: string | null }) => (
  <div className="ligne-profil"><span className="discret">{libelle}</span><span>{valeur || '—'}</span></div>
);

export function Profil() {
  const { ctx, donnees, compte, simulation, modeAdmin, definirModeAdmin } = useSession();
  const navigate = useNavigate();
  if (!ctx || !donnees || !compte) return null;
  const utilisateur = compte.session.user;
  const fiche = maRessource(ctx);
  const nom = fiche?.nom || utilisateur.name || utilisateur.email;
  const email = fiche?.email || utilisateur.email;
  const role = monRole(ctx);
  const roleLibelle = ctx.estCreateur && !simulation ? 'Créateur (tous les droits)' : LIBELLES_ROLES[role as RoleAcces] ?? role;
  const roleHabituel = LIBELLES_ROLES[monRoleSansAdmin(ctx) as RoleAcces] ?? '—';
  const equipes = mesEquipes(ctx).map(e => e.nom + (ctx.rolesEquipe[e.id] === 'owner' ? ' (propriétaire)' : '')).join(', ');
  const projets = fiche ? projetsDe(donnees, fiche.id).map(p => p.nom).join(', ') : '';
  const emailNonVerifie = utilisateur.emailVerified === false && !simulation;
  return (
    <div className="ecran">
      <EnteteEcran titre="Mon profil" sousTitre="Vos informations de compte et de fiche ressource" />
      <Carte classe="carte-profil">
        <div className="ligne-flex profil-entete">
          <Avatar nom={nom} grand />
          <div>
            <h2 className="sans-marge">{nom}</h2>
            <div className="discret">
              {email}
              {emailNonVerifie && <> · <span className="alerte-texte">email non vérifié</span> <Link to="/verifier-email">Vérifier mon email</Link></>}
            </div>
            {ctx.estCreateur && !simulation && <BadgeTon texte="★ Créateur" ton="violet" />}
          </div>
        </div>
      </Carte>
      <div className="grille-profil">
        <Carte classe="carte-profil">
          <h3 className="sans-marge">Ma fiche ressource</h3>
          {fiche ? (
            <>
              <Ligne libelle="Équipe" valeur={trouverEquipe(ctx, fiche.equipeId)?.nom} />
              <Ligne libelle="Profil" valeur={fiche.poste} />
              <Ligne libelle="Capacité" valeur={fiche.capacite == null ? null : `${fiche.capacite} %`} />
              <Ligne libelle="Arrivée" valeur={fiche.dateArrivee ? formatAvecAnnee(fiche.dateArrivee) : null} />
              <Ligne libelle="Date de naissance" valeur={fiche.dateNaissance ? formatAvecAnnee(fiche.dateNaissance) : null} />
            </>
          ) : <p className="discret">Aucune fiche ressource n’est reliée à ce compte.</p>}
        </Carte>
        <Carte classe="carte-profil">
          <h3 className="sans-marge">Mon accès</h3>
          <Ligne libelle="Rôle" valeur={roleLibelle} />
          <Ligne libelle="Équipes" valeur={equipes} />
          <Ligne libelle="Projets" valeur={projets} />
        </Carte>
      </div>
      {ctx.peutAdministrer && !simulation && (
        <Carte classe="carte-profil">
          <h3 className="sans-marge">Mode d’affichage</h3>
          <p className="discret">
            {modeAdmin
              ? 'Le mode administrateur est actif : vous voyez tout ce que voit un administrateur.'
              : `Vous voyez l’application avec votre rôle (${roleHabituel}). Le mode administrateur affiche tout ce qu’un administrateur peut voir.`}
          </p>
          <Bouton variante={modeAdmin ? 'normal' : 'primaire'} onClick={() => { definirModeAdmin(!modeAdmin); navigate('/'); }}>
            {modeAdmin ? `Revenir à mon rôle (${roleHabituel})` : 'Passer en administrateur'}
          </Bouton>
        </Carte>
      )}
      {ctx.estCreateur && !simulation && (
        <Carte classe="carte-profil">
          <h3 className="sans-marge">Espace créateur</h3>
          <p className="discret">Simulation des rôles et « Qui a quel rôle » (la matrice des droits est dans Administration).</p>
          <Link className="btn" to={cheminDe('adminCreateur')}>Ouvrir l’Administration créateur</Link>
        </Carte>
      )}
    </div>
  );
}
