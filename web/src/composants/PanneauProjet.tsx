/* ============================================================
   Panneau latéral « Projet » (maquette 11-panneau-projet.png ; portage de app/js/panneau-projet.js — phase 5, vagues B et C)
   ------------------------------------------------------------
   Détail réduit à la demande du porteur (2026-09-25) : nom, description, chef de projet, équipe projet (membres et rôles) ; + méthode.
   Le statut n'y figure plus (porteur, 2026-10-31 : « je ne veux pas du statut »). Modifiable si l'écran d'origine est de « Mon dashboard » et
   que je peux modifier le projet (peutEditerProjet) ; sinon lecture seule. Depuis « Vue d’ensemble », le panneau reste en lecture.
   Suppression du projet par un membre de son équipe (règle RLS). L'ajout de membres (« + Membre ») arrive avec la fenêtre d'affectation (vague D).
   ============================================================ */
import { Avatar, BadgeRef, Pastille } from './Badge';
import { Bouton } from './Bouton';
import { Liste } from './Liste';
import { Panneau, useFermerAvecEchap } from './Fenetres';
import { modifier, supprimer } from '../donnees/api';
import { useSession } from '../donnees/SessionProvider';
import { estPresent } from '../domaine/calculs';
import { aujourdhui } from '../domaine/dates';
import { peutEditerProjet } from '../domaine/droits';
import { valeursDe } from '../domaine/referentiels';
import { personnesProposees } from '../domaine/vues';

interface Props {
  projetId: string;
  onFermer: () => void;
  /** Écran d'origine : « general » = Vue d’ensemble (toujours en lecture), « moi » = Mon dashboard (modifiable si j'ai le droit) */
  section?: 'general' | 'moi';
  /** « + Membre » : ouvre la fenêtre d'affectation sur ce projet (écrans de Mon dashboard) */
  onAssigner?: (projetId: string) => void;
}

export function PanneauProjet({ projetId, onFermer, section = 'general', onAssigner }: Props) {
  const { ctx, donnees, executer, notifier } = useSession();
  useFermerAvecEchap(onFermer);
  const projet = donnees?.projets.find(p => p.id === projetId);
  if (!ctx || !donnees || !projet) return null;
  const equipe = donnees.equipes.find(e => e.id === projet.equipeId);
  const chef = donnees.ressources.find(r => r.id === projet.chefId);
  const modifiable = section === 'moi' && peutEditerProjet(ctx, projet);
  const membres = donnees.affectations.filter(a => a.projetId === projet.id)
    .flatMap(a => donnees.ressources.filter(r => r.id === a.ressourceId && estPresent(r, aujourdhui())).map(r => ({ r, role: a.role })));
  const note = section === 'general' ? 'Vue d’ensemble : lecture seule. Modifiez ce projet depuis Mon dashboard.'
    : !modifiable ? 'Rôle Lecteur ou autre équipe : modification impossible.' : '';

  // Modification d'un champ du projet (enregistrée à la sortie du champ) ; champ vidé = valeur nulle (nom obligatoire)
  async function majChamp(champ: string, brut: string, actuel: string | null | undefined) {
    const valeur = brut.trim();
    if (champ === 'nom' && !valeur) return notifier('Le nom est obligatoire', 'erreur');
    if (valeur === (actuel ?? '')) return;
    await executer(() => modifier('projets', { id: 'eq.' + projetId }, { [champ]: valeur || null }), 'projets');
  }
  async function supprimerProjet() {
    if (!window.confirm('Supprimer ce projet ? Ses affectations et heures saisies seront supprimées.')) return;
    const reussi = await executer(() => supprimer('projets', { id: 'eq.' + projetId }), 'projets', 'affectations', 'temps');
    if (reussi) onFermer();
  }

  const surtitre = equipe && <div className="ligne-flex discret"><Pastille couleur={equipe.couleur ?? '#8A93A3'} />{equipe.nom}</div>;
  const corps = (
    <>
      {modifiable
        ? <textarea className="champ" rows={2} placeholder="Description" defaultValue={projet.description ?? ''} aria-label="Description" onBlur={e => void majChamp('description', e.target.value, projet.description)} />
        : projet.description && <div>{projet.description}</div>}
      <div className="infos">
        <span>Méthode</span>
        <span>
          {modifiable
            ? <Liste className="champ largeur-auto" aria-label="Méthode" valeur={projet.methode ?? ''} onChoisir={v => void majChamp('methode', v, projet.methode)}
              options={[{ valeur: '', libelle: '— à choisir —' }, ...valeursDe(donnees.valeurs, 'methode').map(v => v.libelle)]} />
            : projet.methode ? <BadgeRef valeurs={donnees.valeurs} referentielId="methode" libelle={projet.methode} /> : '—'}
        </span>
        <span>Chef de projet</span>
        <span className="ligne-flex">
          {modifiable
            ? <Liste className="champ largeur-auto" aria-label="Chef de projet" valeur={projet.chefId ?? ''} onChoisir={v => void majChamp('chefId', v, projet.chefId)}
              options={[{ valeur: '', libelle: '—' }, ...personnesProposees(donnees, projet.equipeId, aujourdhui())]} />
            : chef ? <><Avatar nom={chef.nom} />{chef.nom}</> : '—'}
        </span>
      </div>
      {note && <div className="discret texte-12">{note}</div>}
      <div>
        <div className="libelle">Équipe projet</div>
        {membres.length === 0 && <span className="pale">Aucun membre.</span>}
        {membres.map(({ r, role }) => (
          <div key={r.id} className="ligne-flex ligne-liste">
            <Avatar nom={r.nom} /><span className="extensible">{r.nom}</span><BadgeRef valeurs={donnees.valeurs} referentielId="role" libelle={role} />
          </div>
        ))}
        {modifiable && onAssigner && <button type="button" className="lien-btn" onClick={() => onAssigner(projetId)}>+ Membre</button>}
      </div>
      {modifiable && (
        <div style={{ borderTop: '1px solid var(--bordure-fine)', paddingTop: 12 }}>
          <Bouton variante="danger" onClick={() => void supprimerProjet()}>Supprimer le projet</Bouton>
        </div>
      )}
    </>
  );

  if (!modifiable) return <Panneau titre={projet.nom} onFermer={onFermer} surtitre={surtitre}>{corps}</Panneau>;
  // Modifiable : le nom est un champ de saisie dans l'en-tête (au lieu du titre)
  return (
    <>
      <div className="voile" data-testid="voile" onClick={onFermer} />
      <div className="panneau" role="dialog" aria-modal="true" aria-label={projet.nom}>
        <div className="panneau-entete">
          <div className="extensible">
            {surtitre}
            <input key={projet.nom} className="champ" style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }} defaultValue={projet.nom} required aria-label="Nom du projet"
              onBlur={e => { void majChamp('nom', e.target.value, projet.nom); if (!e.target.value.trim()) e.target.value = projet.nom; }} />
          </div>
          <button type="button" className="fermer" aria-label="Fermer" onClick={onFermer}>✕</button>
        </div>
        <div className="panneau-corps">{corps}</div>
      </div>
    </>
  );
}
