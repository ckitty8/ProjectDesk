/* ============================================================
   Fiche ressource (portage de Modale.ressource, enregistrerRessource et supprimerRessource de app/js/modale.js — phase 5, vague D)
   ------------------------------------------------------------
   Nom, poste, type de contrat, capacité, dates de présence, date de naissance (facultative, migration 036 : donnée personnelle, la date complète
   n'apparaît que dans la fiche), email (lien automatique avec son compte). Le rôle (unique, Direction… Lecture seule) est en lecture :
   il se choisit dans Administration › Ressources › Paramétrage des rôles
   (porteur, 2026-10-13). Création depuis « + Membre » : retour à la fenêtre d'affectation avec la personne sélectionnée.
   ============================================================ */
import type { FormEvent, ReactNode } from 'react';
import { BadgeRole } from '../Badge';
import { Aide } from '../Aide';
import { Bouton } from '../Bouton';
import { Cadre } from '../Fenetres';
import { creer, modifier, supprimer } from '../../donnees/api';
import { renommerCompte } from '../../donnees/compte';
import { useSession } from '../../donnees/SessionProvider';
import { nomComplet, prenomEtNom } from '../../domaine/annuaire';
import { LIBELLES_ROLES } from '../../domaine/config';
import type { RoleAcces } from '../../domaine/config';
import { roleDeLaFiche, rolePrevu } from '../../domaine/droits';
import { valeursDe } from '../../domaine/referentiels';
import { AIDES } from '../../domaine/textes';
import { projetsDe } from '../../domaine/vues';

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

/** Fiche d'une personne (création ou modification) : prénom, nom, profil, contrat, dates, rôle d'accès en lecture et ses projets */
export function ModaleRessource({ id, equipeId, retourProjet, onFermer, onAffecter, onRetourAffectation, onRoles }: Props) {
  const { ctx, donnees, executer, notifier, actualiser } = useSession();
  if (!ctx || !donnees) return null;
  const fiche = id ? donnees.ressources.find(r => r.id === id) : undefined;
  const noms = fiche ? prenomEtNom(fiche) : { prenom: '', nomFamille: '' };
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
    // Prénom et nom (migration 048) : le nom complet « Prénom Nom » (colonne nom) est recomposé, il reste affiché sur tous les écrans
    const champs: Record<string, unknown> = { ...brut, nom: nomComplet(brut.prenom ?? '', brut.nomFamille ?? ''), capacite: Number(brut.capacite), dateArrivee, dateDepart };
    if ('dateNaissance' in brut) champs.dateNaissance = brut.dateNaissance || null;      // champ présent après la migration 036
    let creeeId = '';
    const reussi = await executer(async () => {
      if (id) {
        await modifier('ressources', { id: 'eq.' + id }, champs);
        if (fiche?.userId && champs.nom !== fiche.nom) await renommerCompte(id, String(champs.nom));   // nom du compte de connexion (migration 049)
        return;
      }
      const [creee] = await creer('ressources', { ...champs, equipeId: eqId });
      creeeId = String(creee?.id ?? '');
    }, 'ressources', 'administrateurs');
    if (!reussi) return;
    if (fiche?.userId && fiche.userId === ctx?.userId) await actualiser();   // mon propre nom, affiché sous le menu
    if (!id && retourProjet && creeeId) onRetourAffectation(creeeId, retourProjet); else onFermer();
  }

  async function supprimerFiche() {
    if (!id || !window.confirm('Supprimer cette personne ? Ses affectations, absences et temps seront supprimés.')) return;
    if (await executer(() => supprimer('ressources', { id: 'eq.' + id }), 'ressources', 'affectations', 'absences', 'temps')) onFermer();
  }

  const prevu = fiche ? rolePrevu(ctx, fiche) : null;
  // Projets où la personne est affectée (le chef inscrit seulement sur la fiche projet n'y figure pas)
  const projets = fiche ? projetsDe(donnees, fiche.id) : [];

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
        <div className="deux-colonnes">
          <div><label className="libelle">Prénom<input className="champ" name="prenom" defaultValue={noms.prenom} required /></label></div>
          <div><label className="libelle">Nom<input className="champ" name="nomFamille" defaultValue={noms.nomFamille} required /></label></div>
        </div>
        <div className="deux-colonnes">
          <div><label className="libelle">Profil{liste('poste', 'poste', fiche?.poste)}</label></div>
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
        {fiche && (
          <>
            <div>
              <div className="libelle">Rôle <Aide texte={AIDES.roleAcces} /></div>
              <div>
                <BadgeRole role={roleDeLaFiche(ctx, fiche)} />
                {prevu && prevu !== roleDeLaFiche(ctx, fiche) && <> <span className="discret">rôle prévu : {LIBELLES_ROLES[prevu as RoleAcces] ?? prevu}</span></>}
                {ctx.estAdmin && <> · <button type="button" className="lien-btn" onClick={onRoles}>Modifier dans Administration › Ressources › Paramétrage des rôles</button></>}
              </div>
            </div>
            <div className="projets-fiche">
              <b>Sur ses projets</b> (même rôle sur chacun) :{' '}
              {projets.length === 0 ? <span className="pale">aucun</span> : projets.map(p => <span key={p.id}> {p.nom}</span>)}
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
