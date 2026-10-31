/* ============================================================
   Mon dashboard › Administration créateur (créateur seul, porteur 2026-10-23 ; maquettes simulation-roles/, simulation-six-roles/, matrice-createur/,
   qui-a-quel-role/ ; portage de app/js/simulation.js et roles.js — phase 5, vague D)
   Onglets : Simulation des rôles, Matrice des droits, Qui a quel rôle.
   - Simulation : voir l'application exactement comme une personne d'un rôle donné, en LECTURE SEULE (l'écriture est refusée par le client API : la base
     appliquerait les droits réels du créateur). Une carte par rôle (les 6 rôles d'accès puis « Compte en attente »), avec la personne à simuler.
   - Matrice des droits : une colonne par rôle ; modifiable par le créateur seul (migration 041) : chaque changement est enregistré aussitôt (droits_roles).
   - Qui a quel rôle : tableau par rôle (porteur 2026-10-27), calculé d'après les données.
   ============================================================ */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, BadgeTon } from '../composants/Badge';
import { Bouton } from '../composants/Bouton';
import { Carte, EnteteEcran, Vide } from '../composants/Carte';
import { Onglets } from '../composants/Onglets';
import { modifier } from '../donnees/api';
import { useSession } from '../donnees/SessionProvider';
import { ROLE_SANS_EQUIPE } from '../donnees/simulation';
import { lignesSection, parRole, rolesAffiches, sectionsMatrice } from '../domaine/admin';
import { roleChoisi } from '../domaine/annuaire';
import { NIVEAUX_DROIT, PERIMETRES, ROLES_ACCES, ROLES_CHOISISSABLES } from '../domaine/config';
import type { Niveau } from '../domaine/config';
import { aujourdhui } from '../domaine/dates';
import { droitEnBase, niveauDuRole } from '../domaine/droits';
import { ressourcesPresentes } from '../domaine/vues';
import { cheminDe } from '../routes';

const ONGLETS = [{ id: 'simulation', libelle: 'Simulation des rôles' }, { id: 'matrice', libelle: 'Matrice des droits' }, { id: 'qui', libelle: 'Qui a quel rôle' }];

/** Onglet Simulation : une carte par rôle, choix de la personne (toutes les fiches actives, celles qui ont déjà ce rôle en tête) */
function Simulation() {
  const { ctx, donnees, demarrerSimulation } = useSession();
  const navigate = useNavigate();
  const [personnes, setPersonnes] = useState<Record<string, string>>({});
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
          const choisie = personnes[role.cle] ?? liste[0]?.valeur ?? '';
          return (
            <div key={role.cle} className="carte" style={{ padding: '14px 16px', borderTop: `4px solid ${role.couleur}` }}>
              <b style={{ fontSize: 15, color: role.couleur }}>{role.libelle}</b>
              <div className="discret" style={{ margin: '6px 0 10px', minHeight: 36 }}>{role.description}</div>
              <div className="libelle">En tant que</div>
              {sansPersonne
                ? <div className="discret" style={{ height: 34, display: 'flex', alignItems: 'center' }}>un compte inscrit sans équipe</div>
                : liste.length
                  ? (
                    <select className="champ" aria-label={`Personne pour ${role.libelle}`} value={choisie} onChange={e => setPersonnes(p => ({ ...p, [role.cle]: e.target.value }))}>
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

/** Onglet Matrice des droits : une colonne par rôle, la ligne « Périmètre », puis les menus en deux sections (Suivi de mes équipes, Mon dashboard) */
function Matrice() {
  const { ctx, executer } = useSession();
  if (!ctx) return null;
  const modifiable = ctx.estCreateur, nbColonnes = 3 + ROLES_CHOISISSABLES.length;
  const createur = (contenu: React.ReactNode) => <td className="centre">{contenu}</td>;
  const cellule = (role: string, droit: string) => {
    const niveau = niveauDuRole(ctx, role, droit);
    // Figée hors créateur, pour Administrateur × Rôles (garde-fou de la base, migration 031), et pour un droit absent de la table droits_roles
    const fixe = !modifiable || (role === 'admin' && droit === 'roles') || !droitEnBase(ctx, droit);
    return (
      <td key={role} className="centre">
        <select className={`champ champ-mini ${NIVEAUX_DROIT[niveau].classe}`} aria-label={`${droit} · ${role}`} value={niveau} disabled={fixe}
          onChange={e => void executer(() => modifier('droits_roles', { role: 'eq.' + role, droit: 'eq.' + droit }, { niveau: e.target.value as Niveau }), 'droitsRoles')}>
          {Object.entries(NIVEAUX_DROIT).map(([valeur, n]) => <option key={valeur} value={valeur}>{n.libelle}</option>)}
        </select>
      </td>
    );
  };
  return (
    <>
      <Carte>
        <div className="carte-titre">
          <h2>Matrice des droits</h2>
          <span className="discret">Oui = modifie · Lecture = voit · Non = ni l’un ni l’autre — sur le périmètre du rôle{modifiable ? '' : ' · consultation'}</span>
        </div>
        <div className="defilement-x">
          <table className="tableau tableau-matrice">
            <thead>
              <tr><th>Menu / onglet</th><th>Ce qu’on peut y faire</th><th className="centre">Créateur</th>{ROLES_CHOISISSABLES.map(r => <th key={r} className="centre">{ROLES_ACCES[r].libelle}</th>)}</tr>
            </thead>
            <tbody>
              <tr className="groupe">
                <td><b>Périmètre</b></td><td className="discret">ce que couvre le rôle</td>
                {createur(<span className="discret texte-12">{PERIMETRES.createur}</span>)}
                {ROLES_CHOISISSABLES.map(r => <td key={r} className="centre discret texte-12">{PERIMETRES[r]}</td>)}
              </tr>
              {sectionsMatrice.map(sec => (
                <MatriceSection key={sec.cle} cle={sec.cle} libelle={sec.libelle} colonnes={nbColonnes} cellule={cellule} createur={createur} />
              ))}
            </tbody>
          </table>
        </div>
      </Carte>
      <div className="discret texte-12">
        Les droits de menu et d’onglet règlent l’affichage ; ce qu’on peut modifier est appliqué par la base. Un onglet « Non » disparaît de la
        page ; si tous ses onglets sont « Non », le menu disparaît aussi. Un rôle se donne dans Mon dashboard › Administration › Rôles.
      </div>
    </>
  );
}

function MatriceSection({ cle, libelle, colonnes, cellule, createur }: {
  cle: string; libelle: string; colonnes: number; cellule: (role: string, droit: string) => React.ReactNode; createur: (c: React.ReactNode) => React.ReactNode;
}) {
  const lignes = lignesSection(cle);
  /* Première colonne : « ↳ Onglet « … » » pour un droit d'onglet (migration 038), sinon le nom du menu, écrit seulement sur la première ligne du menu */
  const nom = (d: (typeof lignes)[number], i: number) => (d.onglet ? <span className="ligne-onglet">↳ Onglet « {d.onglet} »</span>
    : i && lignes[i - 1]?.menu === d.menu ? null : <b>{d.menu}</b>);
  return (
    <>
      <tr className="groupe"><td colSpan={colonnes}><b>{libelle}</b></td></tr>
      {lignes.map((d, i) => (
        <tr key={(d.cle ?? 'tous') + d.menu + i}>
          <td>{nom(d, i)}</td><td>{d.libelle}</td>
          {d.cle
            ? <>{createur(<BadgeTon texte="Oui · fixe" ton="violet" />)}{ROLES_CHOISISSABLES.map(r => cellule(r, d.cle ?? ''))}</>
            : <>{createur(<BadgeTon texte="Tous" ton="neutre" />)}{ROLES_CHOISISSABLES.map(r => <td key={r} className="centre"><BadgeTon texte="Tous" ton="neutre" /></td>)}</>}
        </tr>
      ))}
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
      <EnteteEcran titre="Administration créateur" sousTitre="Réservée au créateur · simulation des rôles, matrice des droits, qui a quel rôle" />
      {!ctx.estCreateur
        ? <Carte><Vide texte="Écran réservé au créateur." /></Carte>
        : (
          <>
            <Onglets liste={ONGLETS} actif={onglet} onChoisir={setOnglet} />
            {onglet === 'matrice' ? <Matrice /> : onglet === 'qui' ? <QuiARole /> : <Simulation />}
          </>
        )}
    </div>
  );
}
