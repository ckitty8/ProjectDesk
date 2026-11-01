/* ============================================================
   Mon dashboard › Administration créateur (créateur seul, porteur 2026-10-23 ; maquettes simulation-roles/, simulation-six-roles/, matrice-createur/,
   qui-a-quel-role/ ; portage de app/js/simulation.js et roles.js — phase 5, vague D)
   Onglets : Simulation des rôles, Qui a quel rôle (la Matrice des droits est dans Administration, depuis 2.77).
   - Simulation : voir l'application exactement comme une personne d'un rôle donné, en LECTURE SEULE (l'écriture est refusée par le client API : la base
     appliquerait les droits réels du créateur). Une carte par rôle (les 6 rôles d'accès puis « Compte en attente »), avec la personne à simuler.
   - Qui a quel rôle : tableau par rôle (porteur 2026-10-27), calculé d'après les données.
   ============================================================ */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../composants/Badge';
import { Bouton } from '../composants/Bouton';
import { Carte, EnteteEcran, Vide } from '../composants/Carte';
import { Onglets } from '../composants/Onglets';
import { useSession } from '../donnees/SessionProvider';
import { lirePersonnesSimulation, memoriserPersonnesSimulation, ROLE_SANS_EQUIPE } from '../donnees/simulation';
import { parRole, rolesAffiches } from '../domaine/admin';
import { roleChoisi } from '../domaine/annuaire';
import { ROLES_ACCES } from '../domaine/config';
import { aujourdhui } from '../domaine/dates';
import { ressourcesPresentes } from '../domaine/vues';
import { cheminDe } from '../routes';

const ONGLETS = [{ id: 'simulation', libelle: 'Simulation des rôles' }, { id: 'qui', libelle: 'Qui a quel rôle' }];

/** Onglet Simulation : une carte par rôle, choix de la personne (toutes les fiches actives, celles qui ont déjà ce rôle en tête) */
function Simulation() {
  const { ctx, donnees, demarrerSimulation } = useSession();
  const navigate = useNavigate();
  const [personnes, setPersonnes] = useState<Record<string, string>>(lirePersonnesSimulation);
  const choisirPersonne = (role: string, id: string) => setPersonnes(p => {
    const suite = { ...p, [role]: id };
    memoriserPersonnesSimulation(suite);
    return suite;
  });
  if (!ctx || !donnees) return null;
  const actives = ressourcesPresentes(ctx, aujourdhui());
  /* Personnes proposées pour un rôle : toutes les fiches actives, celles qui ont déjà ce rôle en tête (« · a ce rôle »), puis les autres avec leur rôle
     actuel. Le rôle de la carte leur est appliqué le temps de la simulation ; leurs équipes et leurs projets restent les leurs. Fiches sans compte
     comprises (« (sans compte) » : leurs écrans personnels sont vides). */
  const proposees = (cle: string) => [...actives]
    .sort((a, b) => Number(roleChoisi(ctx, b) === cle) - Number(roleChoisi(ctx, a) === cle) || a.nom.localeCompare(b.nom))
    .map(r => ({ valeur: r.id, libelle: `${r.nom}${r.userId ? '' : ' (sans compte)'} · ${roleChoisi(ctx, r) === cle ? 'a ce rôle' : 'aujourd’hui ' + ROLES_ACCES[roleChoisi(ctx, r) as keyof typeof ROLES_ACCES]?.libelle}` }));
  const lancer = (cle: string, ressourceId: string | null) => {
    demarrerSimulation({ cle, ressourceId });
    navigate(cle === ROLE_SANS_EQUIPE ? cheminDe('choixEquipe') : '/');
  };
  return (
    <>
      <Carte classe="encart-createur">
        <b>Réservé au créateur.</b> Choisissez un rôle et une personne : l’application s’affiche comme pour elle avec ce rôle (menus, écrans, boutons, données visibles).{' '}
        <b>Lecture seule</b> : pendant la simulation rien n’est enregistré, pour ne jamais modifier les données réelles avec vos droits de créateur.
      </Carte>
      <div className="grille-simulation">
        {rolesAffiches(ctx).map(role => {
          const liste = proposees(role.cle), sansPersonne = role.cle === ROLE_SANS_EQUIPE;
          // Personne mémorisée si elle est toujours proposée, sinon la première de la liste
          const memorisee = liste.some(p => p.valeur === personnes[role.cle]) ? personnes[role.cle] : undefined;
          const choisie = memorisee ?? liste[0]?.valeur ?? '';
          return (
            <div key={role.cle} className="carte" style={{ padding: '14px 16px', borderTop: `4px solid ${role.couleur}` }}>
              <b style={{ fontSize: 15, color: role.couleur }}>{role.libelle}</b>
              <div className="discret" style={{ margin: '6px 0 10px', minHeight: 36 }}>{role.description}</div>
              <div className="libelle">En tant que</div>
              {sansPersonne
                ? <div className="discret" style={{ height: 34, display: 'flex', alignItems: 'center' }}>un compte inscrit sans équipe</div>
                : liste.length
                  ? (
                    <select className="champ" aria-label={`Personne pour ${role.libelle}`} value={choisie} onChange={e => choisirPersonne(role.cle, e.target.value)}>
                      {liste.map(p => <option key={p.valeur} value={p.valeur}>{p.libelle}</option>)}
                    </select>
                  )
                  : <div className="discret" style={{ height: 34, display: 'flex', alignItems: 'center' }}>personne n’a ce rôle aujourd’hui</div>}
              <Bouton variante="primaire" style={{ marginTop: 10, width: '100%' }} disabled={!sansPersonne && !liste.length}
                onClick={() => lancer(role.cle, sansPersonne ? null : choisie)}>Voir l’application en tant que {role.libelle.toLowerCase()}</Bouton>
            </div>
          );
        })}
      </div>
      <div className="discret texte-12">
        Le rôle choisi s’applique à la personne pendant la simulation (droits de ce rôle dans la matrice) ; ses équipes et ses projets restent les siens.
      </div>
    </>
  );
}

/** Onglet Qui a quel rôle : tableau par rôle (nom, nombre de personnes, menus qu'il ouvre), puis une ligne par personne */
function QuiARole() {
  const { ctx, comptesEnAttente } = useSession();
  if (!ctx) return null;
  const groupes = parRole(ctx, aujourdhui(), comptesEnAttente);
  return (
    <Carte>
      <table className="tableau tableau-qui-a-quel-role">
        <thead><tr><th>Personne</th><th>Équipe</th><th>Compte</th></tr></thead>
        <tbody>
          {rolesAffiches(ctx).map(role => {
            const liste = groupes[role.cle] ?? [];
            return (
              <FragmentRole key={role.cle} description={role.description}
                titre={<span className="ligne-flex"><b style={{ color: role.couleur }}>{role.libelle}</b><span className="discret poids-normal">{liste.length} personne(s)</span></span>}>
                {liste.length === 0 && <tr><td colSpan={3} className="pale">personne</td></tr>}
                {liste.map(x => (
                  <tr key={x.nom + x.compte}>
                    <td><span className="ligne-flex"><Avatar nom={x.nom} />{x.nom}</span></td><td>{x.equipe}</td><td className="discret">{x.compte}</td>
                  </tr>
                ))}
              </FragmentRole>
            );
          })}
        </tbody>
      </table>
    </Carte>
  );
}

const FragmentRole = ({ titre, description, children }: { titre: React.ReactNode; description: string; children: React.ReactNode }) => (
  <>
    <tr className="groupe"><td colSpan={3}>{titre}<div className="discret texte-12 poids-normal">{description}</div></td></tr>
    {children}
  </>
);

export function AdminCreateur() {
  const { ctx } = useSession();
  const [onglet, setOnglet] = useState('simulation');
  if (!ctx) return null;
  return (
    <div className="ecran ecran-large">
      <EnteteEcran titre="Administration créateur" sousTitre="Réservée au créateur · simulation des rôles, qui a quel rôle" />
      {!ctx.estCreateur
        ? <Carte><Vide texte="Écran réservé au créateur." /></Carte>
        : (
          <>
            <Onglets liste={ONGLETS} actif={onglet} onChoisir={setOnglet} />
            {onglet === 'qui' ? <QuiARole /> : <Simulation />}
          </>
        )}
    </div>
  );
}
