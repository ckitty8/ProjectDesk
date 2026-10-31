/* ============================================================
   Fiche ressource (portage de Modale.ressource, enregistrerRessource et supprimerRessource de app/js/modale.js — phase 5, vague D)
   ------------------------------------------------------------
   Nom, poste, type de contrat, capacité, dates de présence, date de naissance (facultative, migration 036 : donnée personnelle, la date complète
   n'apparaît que dans la fiche), email (lien automatique avec son compte). Le rôle d'accès est en lecture : il se choisit dans Administration › Rôles
   (porteur, 2026-10-13). Création depuis « + Membre » : retour à la fenêtre d'affectation avec la personne sélectionnée.
   ============================================================ */
import type { FormEvent, ReactNode } from 'react';
import { Badge, BadgeRef } from '../Badge';
import { Aide } from '../Aide';
import { Bouton } from '../Bouton';
import { Cadre } from '../Fenetres';
import { creer, modifier, supprimer } from '../../donnees/api';
import { useSession } from '../../donnees/SessionProvider';
import { roleAcces } from '../../domaine/annuaire';
import { ROLES_ACCES } from '../../domaine/config';
import { rolePrevu } from '../../domaine/droits';
import { valeursDe } from '../../domaine/referentiels';
import { AIDES } from '../../domaine/textes';
import { projetsAvecRoleDe } from '../../domaine/vues';

interface Props {
  /** Fiche à modifier ; sinon création dans « equipeId » */
  id: string | null;
  equipeId: string | null;
  /** Création lancée depuis « + Membre » d'un projet : on revient ensuite à l'affectation */
  retourProjet: string;
  onFermer: () => void;
  onAffecter: (ressourceId: string) => void;
  onRetourAffectation: (ressourceId: string, projetId: string) => void;
  onRoles: () => void;
}

export function ModaleRessource({ id, equipeId, retourProjet, onFermer, onAffecter, onRetourAffectation, onRoles }: Props) {
  const { ctx, donnees, executer, notifier } = useSession();
  if (!ctx || !donnees) return null;
  const fiche = id ? donnees.ressources.find(r => r.id === id) : undefined;
  const eqId = fiche?.equipeId ?? equipeId ?? '';
  const equipe = donnees.equipes.find(e => e.id === eqId);
  const naissance = donnees.ressources.some(r => 'dateNaissance' in r);

  // Liste d'un référentiel (postes, contrats) ; garde la valeur actuelle même si elle est désactivée
  const liste = (refId: string, nom: string, valeur?: string | null): ReactNode => {
    const valeurs = valeursDe(donnees.valeurs, refId).map(v => v.libelle);
    if (valeur && !valeurs.includes(valeur)) valeurs.unshift(valeur);
    return <select className="champ" name={nom} defaultValue={valeur ?? ''}><option value="">—</option>{valeurs.map(v => <option key={v} value={v}>{v}</option>)}</select>;
  };

  async function enregistrer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const brut = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const dateArrivee = brut.dateArrivee || null, dateDepart = brut.dateDepart || null;
    if (dateArrivee && dateDepart && dateDepart < dateArrivee) return notifier('La date de départ précède la date d’arrivée', 'erreur');
    const champs: Record<string, unknown> = { ...brut, capacite: Number(brut.capacite), dateArrivee, dateDepart };
    if ('dateNaissance' in brut) champs.dateNaissance = brut.dateNaissance || null;      // champ présent après la migration 036
    let creeeId = '';
    const reussi = await executer(async () => {
      if (id) { await modifier('ressources', { id: 'eq.' + id }, champs); return; }
      const [creee] = await creer('ressources', { ...champs, equipeId: eqId });
      creeeId = String(creee?.id ?? '');
    }, 'ressources', 'administrateurs');
    if (!reussi) return;
    if (!id && retourProjet && creeeId) onRetourAffectation(creeeId, retourProjet); else onFermer();
  }

  async function supprimerFiche() {
    if (!id || !window.confirm('Supprimer cette personne ? Ses affectations, absences et temps seront supprimés.')) return;
    if (await executer(() => supprimer('ressources', { id: 'eq.' + id }), 'ressources', 'affectations', 'absences', 'temps')) onFermer();
  }

  const acces = fiche ? ROLES_ACCES[roleAcces(ctx, fiche) as keyof typeof ROLES_ACCES] : null;
  const prevu = fiche ? rolePrevu(ctx, fiche) : null;
  // Affectations de la personne à des projets existants (le chef inscrit seulement sur la fiche projet n'y figure pas)
  const projets = fiche
    ? projetsAvecRoleDe(donnees, fiche.id).filter(x => donnees.affectations.some(a => a.ressourceId === fiche.id && a.projetId === x.projet.id))
    : [];

  return (
    <Cadre classe="modale" titre={fiche ? 'Fiche de ' + fiche.nom : `Nouveau membre · ${equipe?.nom ?? ''}`} onFermer={onFermer}
      pied={(
        <>
          {fiche && <Bouton variante="danger" onClick={() => void supprimerFiche()}>Supprimer</Bouton>}
          <span className="extensible" />
          <Bouton onClick={onFermer}>Annuler</Bouton><Bouton variante="primaire" type="submit" form="fiche-ressource">Enregistrer</Bouton>
        </>
      )}>
      <form id="fiche-ressource" className="pile" onSubmit={e => void enregistrer(e)}>
        <div><label className="libelle">Nom complet<input className="champ" name="nom" defaultValue={fiche?.nom ?? ''} required /></label></div>
        <div className="deux-colonnes">
          <div><label className="libelle">Poste{liste('poste', 'poste', fiche?.poste)}</label></div>
          <div><label className="libelle">Type de contrat{liste('contrat', 'typeContrat', fiche?.typeContrat)}</label></div>
        </div>
        <div>
          <label className="libelle">Capacité (%)
            <input className="champ" type="number" min={0} max={100} name="capacite" defaultValue={fiche?.capacite ?? 100} required style={{ width: 120 }} />
          </label>
        </div>
        <div className="deux-colonnes">
          <div><label className="libelle">Date d’arrivée <Aide texte={AIDES.datesPresence} /><input className="champ" type="date" name="dateArrivee" defaultValue={fiche?.dateArrivee ?? ''} /></label></div>
          <div><label className="libelle">Date de départ<input className="champ" type="date" name="dateDepart" defaultValue={fiche?.dateDepart ?? ''} /></label></div>
        </div>
        {naissance && (
          <div>
            <label className="libelle">Date de naissance<input className="champ" type="date" name="dateNaissance" defaultValue={fiche?.dateNaissance ?? ''} style={{ width: 180 }} /></label>
            <div className="discret texte-11">Donnée personnelle : la date complète n’est visible que dans la fiche ; les écrans n’affichent que le jour et le mois.</div>
          </div>
        )}
        <div><label className="libelle">Email (lien automatique avec son compte)<input className="champ" type="email" name="email" defaultValue={fiche?.email ?? ''} /></label></div>
        {fiche && acces && (
          <>
            <div>
              <div className="libelle">Rôle d’accès <Aide texte={AIDES.roleAcces} /></div>
              <div>
                <Badge texte={acces.libelle} couleur={acces.texte} fond={acces.fond} />
                {prevu && <> <span className="discret">rôle prévu : {ROLES_ACCES[prevu as keyof typeof ROLES_ACCES]?.libelle ?? prevu}</span></>}
                {ctx.estAdmin && <> · <button type="button" className="lien-btn" onClick={onRoles}>Modifier dans Administration › Rôles</button></>}
              </div>
            </div>
            <div className="projets-fiche">
              <b>Sur ses projets</b> (le rôle de projet s’ajoute au rôle d’accès) :{' '}
              {projets.length === 0 ? <span className="pale">aucun</span>
                : projets.map(x => <span key={x.projet.id}> <BadgeRef valeurs={donnees.valeurs} referentielId="role" libelle={`${x.projet.nom} · ${x.role}`} /></span>)}
              {' '}<button type="button" className="lien-btn" onClick={() => onAffecter(fiche.id)}>Modifier ses projets</button>
            </div>
          </>
        )}
        <div className="discret">
          {fiche?.userId ? 'Compte de connexion lié' : 'Pas encore de compte : le rôle s’appliquera à sa première connexion avec cet email'} · équipe {equipe?.nom}.
        </div>
      </form>
    </Cadre>
  );
}
