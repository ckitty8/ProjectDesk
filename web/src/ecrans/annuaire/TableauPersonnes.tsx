/* ============================================================
   Tableau de personnes de la Liste des ressources (portage de app/js/ecrans/liste-ressources.js — phase 5, vague D)
   ------------------------------------------------------------
   Lignes [{ r, role }] : membres d'un projet (colonne « Rôle sur le projet ») ou d'une équipe (colonne « Projets / origine »).
   Colonne « Accès » : rôle d'accès (maquette role-acces/). Sections Actifs / Inactifs repliables (porteur, 2026-10-12) puis personnes rattachées.
   Statut : « Inactif » dès qu'une date de fin est saisie (règle du porteur, 2026-10-05) ; cliquable par l'équipe de la personne.
   ============================================================ */
import { useState } from 'react';
import { Aide } from '../../composants/Aide';
import { Avatar, Badge, BadgeActif, BadgeRef, BadgeTon } from '../../composants/Badge';
import { Vide } from '../../composants/Carte';
import { modifier, supprimer } from '../../donnees/api';
import { useSession } from '../../donnees/SessionProvider';
import { roleAcces } from '../../domaine/annuaire';
import { libellePresence } from '../../domaine/calculs';
import { ROLES_ACCES } from '../../domaine/config';
import { aujourdhui, formatAvecAnnee } from '../../domaine/dates';
import { peutModifierFiche, peutRattacherA } from '../../domaine/droits';
import { AIDES } from '../../domaine/textes';
import type { Ressource } from '../../domaine/types';
import { estInactive, projetsPourAnnuaire } from '../../domaine/vues';

export interface LignePersonne {
  r: Ressource;
  role?: string;
  /** Équipe où la personne est rattachée (rattachement depuis une autre équipe) */
  rattacheA?: string;
  depuis?: string | null;
}

interface Props {
  /** Clé du tableau (mémorise ses sections repliées) */
  cle: string;
  lignes: readonly LignePersonne[];
  texteVide: string;
  deProjet?: boolean;
  onFiche: (ressourceId: string) => void;
}

const NB_COLONNES = 7;

/** Trois premières cellules d'une ligne de personne : nom (avec avatar), poste, rôle d'accès */
function CellulesIdentite({ r }: { r: Ressource }) {
  const { ctx } = useSession();
  if (!ctx) return null;
  const acces = ROLES_ACCES[roleAcces(ctx, r) as keyof typeof ROLES_ACCES];
  return (
    <>
      <td><span className="ligne-flex"><Avatar nom={r.nom} /><span className="nom-personne">{r.nom}</span></span></td>
      <td>{r.poste || '—'}</td>
      <td><Badge texte={acces.libelle} couleur={acces.texte} fond={acces.fond} /></td>
    </>
  );
}

export function TableauPersonnes({ cle, lignes, texteVide, deProjet = false, onFiche }: Props) {
  const { ctx, donnees, executer } = useSession();
  const [replies, setReplies] = useState<Record<string, boolean>>({});
  if (!ctx || !donnees) return null;

  // « Inactif » = date de fin saisie : le bouton pose la date de fin à aujourd'hui, ou la retire pour réactiver la personne
  async function basculerActif(r: Ressource) {
    const inactive = estInactive(r);
    if (!inactive && !window.confirm(`Rendre ${r.nom} inactive ? Sa date de fin sera aujourd’hui.`)) return;
    await executer(() => modifier('ressources', { id: 'eq.' + r.id }, { dateDepart: inactive ? null : aujourdhui() }), 'ressources');
  }

  const ligne = ({ r, role, rattacheA, depuis }: LignePersonne) => {
    if (rattacheA) {
      const origine = donnees.equipes.find(e => e.id === r.equipeId)?.nom ?? '—';
      const accueil = donnees.equipes.find(e => e.id === rattacheA)?.nom ?? '—';
      return (
        <tr key={'rat' + r.id} data-ressource={r.id} data-rattachee={rattacheA}>
          <CellulesIdentite r={r} />
          <td><BadgeTon texte={'Équipe d’origine : ' + origine} ton="violet" /></td>
          <td className="discret">{depuis ? 'rattachée le ' + formatAvecAnnee(depuis.slice(0, 10)) : ''}</td>
          <td><BadgeActif actif={!estInactive(r)} libelles={['Actif', 'Inactif']} /></td>
          <td className="num">
            {peutRattacherA(ctx, rattacheA) && (
              <button type="button" className="lien-btn" title={`Retirer de ${accueil} (elle reste dans ${origine})`}
                onClick={() => { if (window.confirm(`Retirer ${r.nom} de ${accueil} ? Elle reste dans son équipe d’origine.`)) {
                  void executer(() => supprimer('membres_equipe', { equipe_id: 'eq.' + rattacheA, ressource_id: 'eq.' + r.id }), 'rattachements'); } }}>
                Retirer
              </button>
            )}
          </td>
        </tr>
      );
    }
    const editable = peutModifierFiche(ctx, r), inactif = estInactive(r);
    const projets = projetsPourAnnuaire(ctx, donnees, r);
    const badge = <BadgeActif actif={!inactif} libelles={['Actif', 'Inactif']} />;
    return (
      <tr key={r.id} data-ressource={r.id} className={inactif ? 'inactive' : undefined}>
        <CellulesIdentite r={r} />
        <td className="projets-personne">
          {deProjet ? <BadgeRef valeurs={donnees.valeurs} referentielId="role" libelle={role} />
            : projets.genre === 'projets' ? projets.lignes.map(l => <div key={l}>{l}</div>)
              : projets.genre === 'responsable' ? <BadgeTon texte="Responsable d’équipe" ton="violet" /> : <span className="pale">hors projet</span>}
        </td>
        <td className={r.dateDepart ? 'presence-fin' : 'discret'}>{libellePresence(r, aujourdhui()) || <span className="pale">—</span>}</td>
        <td>
          {editable
            ? <button type="button" className="lien-btn" title={inactif ? 'Réactiver (retire la date de fin)' : 'Rendre inactive (date de fin = aujourd’hui)'} onClick={() => void basculerActif(r)}>{badge}</button>
            : badge}
        </td>
        <td className="num">{editable && <button type="button" className="lien-btn" onClick={() => onFiche(r.id)}>Fiche</button>}</td>
      </tr>
    );
  };

  // Deux sections repliables, Actifs puis Inactifs (porteur, 2026-10-12), puis les personnes rattachées depuis une autre équipe (migration 033)
  const section = (id: string, titre: string, liste: readonly LignePersonne[], complement: string) => {
    if (!liste.length) return null;
    const ouverte = !replies[`${cle}:${id}`];
    return (
      <tbody key={id}>
        <tr className="groupe">
          <td colSpan={NB_COLONNES}>
            <button type="button" className="lien-btn section-pliable" onClick={() => setReplies(x => ({ ...x, [`${cle}:${id}`]: ouverte }))}>
              {ouverte ? '▾' : '▸'} {titre} <span className="pale">({liste.length}){complement}</span>
            </button>
          </td>
        </tr>
        {ouverte && liste.map(ligne)}
      </tbody>
    );
  };
  const propres = lignes.filter(x => !x.rattacheA);
  const sections = [
    section('actifs', 'Actifs', propres.filter(x => !estInactive(x.r)), ''),
    section('inactifs', 'Inactifs', propres.filter(x => estInactive(x.r)), ' · date de fin saisie'),
    section('rattaches', 'Rattachées depuis une autre équipe', lignes.filter(x => x.rattacheA), ' · comptées dans leur équipe d’origine')
  ].filter(Boolean);

  return (
    <div className="defilement-x">
      <table className="tableau tableau-personnes">
        <thead>
          <tr>
            <th>Personne</th><th>Poste</th><th>Accès <Aide texte={AIDES.roleAcces} /></th><th>{deProjet ? 'Rôle sur le projet' : 'Projets / origine'}</th>
            <th>Présence <Aide texte={AIDES.datesPresence} /></th><th>Statut <Aide texte={AIDES.statutPersonne} /></th><th />
          </tr>
        </thead>
        {sections.length ? sections : <tbody><tr><td colSpan={NB_COLONNES}><Vide texte={texteVide} /></td></tr></tbody>}
      </table>
    </div>
  );
}
