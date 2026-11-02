/* ============================================================
   Administration › Matrice des droits (créateur seul ; auparavant dans Administration créateur — déplacée en 2.77, porteur 2026-10-31 ;
   maquette matrice-dans-administration/)
   Une colonne par rôle ; modifiable par le créateur seul (migration 041) : chaque changement est enregistré aussitôt (droits_roles).
   ============================================================ */
import { BadgeTon } from '../../composants/Badge';
import { Carte } from '../../composants/Carte';
import { modifier } from '../../donnees/api';
import { useSession } from '../../donnees/SessionProvider';
import { lignesSection, sectionsMatrice } from '../../domaine/admin';
import { NIVEAUX_DROIT, PERIMETRES, ROLES_ACCES, ROLES_CHOISISSABLES } from '../../domaine/config';
import type { Niveau } from '../../domaine/config';
import { droitEnBase, niveauDuRole } from '../../domaine/droits';

/** Onglet Matrice des droits : une colonne par rôle, la ligne « Périmètre », puis les menus en deux sections (Vue d’ensemble, Mon dashboard) */
export function MatriceDroits() {
  const { ctx, executer } = useSession();
  if (!ctx) return null;
  /* Enregistre un niveau de droit. La Data API répond « succès » avec zéro ligne quand la base refuse en silence (règle RLS) :
     ce cas est signalé comme une erreur, sinon le niveau reprendrait son ancienne valeur sans explication. */
  const enregistrer = (role: string, droit: string, niveau: Niveau) => executer(async () => {
    const lignes = await modifier('droits_roles', { role: 'eq.' + role, droit: 'eq.' + droit }, { niveau });
    if (!lignes.length) throw new Error('Droit non enregistré : la base l’a refusé (vérifiez que vous êtes connecté en tant que créateur).');
  }, 'droitsRoles');
  const modifiable = ctx.estCreateur, nbColonnes = 3 + ROLES_CHOISISSABLES.length;
  const createur = (contenu: React.ReactNode) => <td className="centre">{contenu}</td>;
  const cellule = (role: string, droit: string) => {
    const niveau = niveauDuRole(ctx, role, droit);
    // Figée hors créateur, pour Administrateur × Rôles (garde-fou de la base, migration 031), et pour un droit absent de la table droits_roles
    const fixe = !modifiable || (role === 'admin' && droit === 'roles') || !droitEnBase(ctx, droit);
    return (
      <td key={role} className="centre">
        <select className={`champ champ-mini ${NIVEAUX_DROIT[niveau].classe}`} aria-label={`${droit} · ${role}`} value={niveau} disabled={fixe}
          onChange={e => void enregistrer(role, droit, e.target.value as Niveau)}>
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
        page ; si tous ses onglets sont « Non », le menu disparaît aussi. Un rôle se donne dans Mon dashboard › Ressources › Paramétrage des rôles.
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

