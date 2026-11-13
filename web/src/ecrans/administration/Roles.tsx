/* ============================================================
   Administration › Ressources › Paramétrage des rôles (ex-onglet Rôles) : « Utilisateurs et rôles » (administrateurs ; maquettes docs/maquettes/liste-roles/,
   affecter-roles/ et roles-dans-ressources/ ; portage de app/js/roles.js — phase 5, vague D)
   Le rôle d'accès de chaque personne se choisit dans la liste de sa ligne et s'enregistre aussitôt (fonction affecter_role, migration 029). Personne
   pas encore connectée (ou email non vérifié) : rôle prévu, appliqué à sa connexion. Matrice et « qui a quel rôle » : Administration créateur.
   ============================================================ */
import { useState } from 'react';
import { Aide } from '../../composants/Aide';
import { Avatar, BadgeTon, Pastille } from '../../composants/Badge';
import { BarreOutils, Carte, Vide } from '../../composants/Carte';
import { executer as appelerFonction, modifier, supprimer } from '../../donnees/api';
import { renommerCompte } from '../../donnees/compte';
import { useSession } from '../../donnees/SessionProvider';
import { nomComplet, prenomEtNom, roleChoisi } from '../../domaine/annuaire';
import { COULEURS, ROLES_ACCES, ROLES_ATTRIBUABLES } from '../../domaine/config';
import { aujourdhui } from '../../domaine/dates';
import { aDroit, estAdministrateur, estAdministrateurPrevu, peutModifierFiche, rolePrevu } from '../../domaine/droits';
import { valeursDe } from '../../domaine/referentiels';
import { AIDES } from '../../domaine/textes';
import type { Ressource } from '../../domaine/types';
import { optionsUnites, projetsDe, ressourcesPresentes } from '../../domaine/vues';

/** Actions de l'écran : chacune appelle la base (la base contrôle le droit), relit les données puis confirme par un message */
export function useActionsRoles() {
  const { ctx, notifier, actualiser, executer } = useSession();

  // Rôle d'accès choisi dans la liste d'une ligne (administrateurs ; la base contrôle le droit)
  async function affecter(r: Ressource, nouveau: string) {
    try {
      const resultat = await appelerFonction('affecter_role', { p_ressource: r.id, p_role: nouveau });
      await actualiser();
      notifier(resultat === 'prevu' ? 'Rôle prévu : il s’appliquera à la connexion de la personne' : 'Rôle d’accès enregistré');
    } catch (e) { notifier((e as Error).message, 'erreur'); }
  }

  // Prénom et nom (migration 048) : enregistrés dans leurs colonnes, et le nom complet « Prénom Nom » (colonne nom, affichée partout) est recomposé.
  // Même droit que la fiche de Liste des ressources (peutModifierFiche, règle RLS de la table ressources) ; enregistré en quittant le champ.
  async function renommer(r: Ressource, prenom: string, nomFamille: string): Promise<boolean> {
    const nom = nomComplet(prenom, nomFamille);
    if (!nom) { notifier('Le prénom et le nom ne peuvent pas être tous les deux vides', 'erreur'); return false; }
    // Le nom du compte de connexion relié suit la fiche (migration 049)
    const reussi = await executer(async () => {
      await modifier('ressources', { id: 'eq.' + r.id }, { prenom: prenom.trim(), nomFamille: nomFamille.trim(), nom });
      if (r.userId) await renommerCompte(r.id, nom);
    }, 'ressources');
    if (reussi) {
      notifier(r.userId ? 'Nom enregistré, compte de connexion mis à jour' : 'Nom enregistré');
      if (r.userId && r.userId === ctx?.userId) await actualiser();   // mon propre nom, affiché sous le menu
    }
    return reussi;
  }

  // Case « Administrateur » : cumule ou retire le statut sans toucher au rôle (fonction affecter_administrateur, migration 046)
  async function definirAdministrateur(r: Ressource, actif: boolean) {
    try {
      const resultat = await appelerFonction('affecter_administrateur', { p_ressource: r.id, p_actif: actif });
      await actualiser();
      // « prevu » : fiche sans compte, le statut s'applique à la première connexion (migration 047)
      notifier(resultat === 'prevu' ? 'Administrateur prévu : le statut s’appliquera à sa première connexion (email vérifié)'
        : actif ? 'Administrateur ajouté : il peut passer en mode administrateur depuis son profil' : 'Statut d’administrateur retiré');
    } catch (e) { notifier((e as Error).message, 'erreur'); }
  }

  // Profil (poste, référentiel « poste ») et équipe d'une personne : listes de sa ligne (porteur, 2026-11-12 : « en tant qu'administrateur je dois pouvoir
  // configurer tous les rôles, équipes, profils »). Même droit que la fiche (règle RLS de la table ressources), enregistré aussitôt.
  async function changerFiche(r: Ressource, champs: { poste?: string | null; equipeId?: string }, message: string) {
    if (await executer(() => modifier('ressources', { id: 'eq.' + r.id }, champs), 'ressources')) notifier(message);
  }

  // Suppression d'une fiche (porteur, 2026-11-13 : « je ne peux pas supprimer de ressources ») : même appel que la fiche de Liste des ressources ;
  // les affectations, absences et temps de la personne sont supprimés avec elle (clés étrangères en cascade). La base contrôle le droit.
  async function supprimerFiche(r: Ressource) {
    if (!window.confirm(`Supprimer ${r.nom} ? Ses affectations, absences et temps seront supprimés.`)) return;
    if (await executer(() => supprimer('ressources', { id: 'eq.' + r.id }), 'ressources', 'affectations', 'absences', 'temps')) notifier('Personne supprimée');
  }

  return { affecter, renommer, definirAdministrateur, changerFiche, supprimerFiche };
}

interface PropsLigneRole {
  r: Ressource;
  /** Peut nommer un administrateur : droit de la matrice ET créateur (la fonction affecter_administrateur de la base est réservée au créateur) */
  nommer: boolean;
  /** Rôles verrouillés : le droit « roles » de la matrice n'est pas accordé */
  verrou: boolean;
  actions: ReturnType<typeof useActionsRoles>;
}

/** Une personne : nom et prénom modifiables, équipe, projets, compte, profil, rôle d'accès (liste) et case « Administrateur » */
function LigneRole({ r, nommer, verrou, actions }: PropsLigneRole) {
  const { ctx, donnees } = useSession();
  if (!ctx || !donnees) return null;
  const eq = donnees.equipes.find(e => e.id === r.equipeId), prevu = rolePrevu(ctx, r), choisi = roleChoisi(ctx, r);
  const options = ROLES_ATTRIBUABLES.map(cle => ({ valeur: cle, libelle: ROLES_ACCES[cle].libelle }));
  // Administrateur : case à part, cumulée avec le rôle ; cochée ou décochée par le créateur seul, pour toute fiche : sans compte, le statut
  // est « prévu » et s'applique à la première connexion (migration 047)
  const adminPrevu = estAdministrateurPrevu(ctx, r), admin = estAdministrateur(ctx, r) || adminPrevu;
  const estLeCreateur = ctx.createur.some(c => c.userId === r.userId);
  // Profil et équipe : listes modifiables pour qui peut modifier la fiche ; le profil actuel est gardé même s'il n'est plus dans le référentiel
  const modifiable = peutModifierFiche(ctx, r);
  const profilsProposes = [...new Set([...valeursDe(donnees.valeurs, 'poste').map(v => v.libelle), ...(r.poste ? [r.poste] : [])])];
  const effet = prevu ? 'rôle prévu : appliqué à sa connexion (email vérifié)' : r.userId ? 'appliqué' : '';
  const effetAdmin = adminPrevu ? 'administrateur prévu : appliqué à sa connexion (email vérifié)' : '';
  return (
    <tr>
      <td>
        <span className="ligne-flex">
          <Avatar nom={r.nom} />
          <ChampsNom key={r.id + r.nom + (r.prenom ?? '') + (r.nomFamille ?? '')} r={r} modifiable={peutModifierFiche(ctx, r)} enregistrer={(p, n) => actions.renommer(r, p, n)} />
        </span><div className="discret texte-12">{r.email || 'email à renseigner sur la fiche'}</div></td>
      <td>
        {modifiable
          ? (
            <select className="champ champ-mini" aria-label={`Équipe de ${r.nom}`} value={r.equipeId} disabled={!ctx.estAdmin}
              onChange={e => void actions.changerFiche(r, { equipeId: e.target.value }, 'Équipe enregistrée')}>
              {optionsUnites(donnees.equipes).map(o => <option key={o.valeur} value={o.valeur}>{o.libelle}</option>)}
            </select>
          )
          : <span className="ligne-flex"><Pastille couleur={eq?.couleur ?? COULEURS.pale} />{eq?.nom}</span>}
      </td>
      <td>
        {projetsDe(donnees, r.id).map(p => <div key={p.id} className="ligne-flex projet-role">{p.nom}</div>)}
        {!donnees.affectations.some(a => a.ressourceId === r.id) && <span className="pale">aucun projet</span>}
      </td>
      <td>{r.userId ? <BadgeTon texte="Compte lié" ton="succes" /> : <BadgeTon texte="Pas encore connecté" ton="attention" />}</td>
      <td>
        {modifiable
          ? (
            <select className="champ champ-mini" aria-label={`Profil de ${r.nom}`} value={r.poste ?? ''}
              onChange={e => void actions.changerFiche(r, { poste: e.target.value || null }, 'Profil enregistré')}>
              <option value="">—</option>
              {profilsProposes.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          )
          : r.poste || '—'}
      </td>
      <td>
        <select className="champ champ-mini" aria-label={`Rôle de ${r.nom}`} value={choisi} disabled={verrou} onChange={e => void actions.affecter(r, e.target.value)}>
          {options.map(o => <option key={o.valeur} value={o.valeur}>{o.libelle}</option>)}
        </select>
        {effet && <div className="discret texte-12">{effet}</div>}
      </td>
      <td>
        <label className="ligne-flex">
          <input type="checkbox" aria-label={`Administrateur : ${r.nom}`} checked={admin} disabled={!nommer || estLeCreateur} title={nommer ? undefined : 'Réservé au créateur'}
            onChange={e => void actions.definirAdministrateur(r, e.target.checked)} />
          {estLeCreateur && <span className="discret texte-12">(créateur)</span>}
        </label>
        {effetAdmin && <div className="discret texte-12">{effetAdmin}</div>}
      </td>
      <td>
        {/* Ni le créateur ni sa propre fiche : on ne se supprime pas soi-même */}
        {ctx.estAdmin && !estLeCreateur && r.userId !== ctx.userId
          && <button type="button" className="lien-btn" aria-label={`Supprimer ${r.nom}`} onClick={() => void actions.supprimerFiche(r)}>Supprimer</button>}
      </td>
    </tr>
  );
}

/** Onglet Rôles : filtres (texte, équipe, rôle) puis une ligne par personne présente, triée par équipe puis par nom */
export function Roles() {
  const { ctx, donnees } = useSession();
  const actions = useActionsRoles();
  const [recherche, setRecherche] = useState('');
  const [equipe, setEquipe] = useState('');
  const [role, setRole] = useState('');
  if (!ctx || !donnees) return null;
  const texte = recherche.trim().toLowerCase();
  const nomEquipe = (id: string) => donnees.equipes.find(e => e.id === id)?.nom ?? '';
  const personnes = ressourcesPresentes(donnees, aujourdhui())
    .filter(r => !equipe || r.equipeId === equipe).filter(r => !role || roleChoisi(ctx, r) === role)
    .filter(r => !texte || `${r.nom} ${r.email ?? ''}`.toLowerCase().includes(texte))
    .sort((a, b) => nomEquipe(a.equipeId).localeCompare(nomEquipe(b.equipeId)) || a.nom.localeCompare(b.nom));
  const nommer = aDroit(ctx, 'nommer_admin') && ctx.estCreateur, verrou = !aDroit(ctx, 'roles');

  return (
    <>
      <BarreOutils
        gauche={(
          <>
            <input className="champ" style={{ width: 260 }} placeholder="Rechercher une personne…" value={recherche}
              onChange={e => setRecherche(e.target.value)} aria-label="Rechercher une personne" />
            <select className="champ champ-compact" aria-label="Équipe" value={equipe} onChange={e => setEquipe(e.target.value)}>
              <option value="">Toutes les équipes</option>{optionsUnites(donnees.equipes).map(o => <option key={o.valeur} value={o.valeur}>{o.libelle}</option>)}
            </select>
            <select className="champ champ-compact" aria-label="Rôle" value={role} onChange={e => setRole(e.target.value)}>
              <option value="">Tous les rôles</option>{ROLES_ATTRIBUABLES.map(c => <option key={c} value={c}>{ROLES_ACCES[c].libelle}</option>)}
            </select>
          </>
        )}
        droite={<span className="discret">Un seul rôle par personne : le même sur tous ses projets</span>} />
      <Carte>
        <div className="carte-titre"><h2>Utilisateurs et rôles</h2><span className="discret">{personnes.length} personne(s)</span></div>
        <div className="defilement-x">
          <table className="tableau tableau-roles-acces">
            <thead>
              <tr>
                <th>Prénom · Nom</th><th>Équipe</th><th>Projet(s)</th><th>Compte</th><th>Profil</th>
                <th>Rôle <Aide texte={AIDES.roleAcces} /></th><th title="Statut d’administrateur : se cumule avec le rôle">Admin</th><th></th>
              </tr>
            </thead>
            <tbody>
              {personnes.length === 0 ? <tr><td colSpan={8}><Vide texte="Personne ne correspond aux filtres." /></td></tr>
                : personnes.map(r => <LigneRole key={r.id} r={r} nommer={nommer} verrou={verrou} actions={actions} />)}
            </tbody>
          </table>
        </div>
      </Carte>
    </>
  );
}

interface PropsNom { r: Ressource; modifiable: boolean; enregistrer: (prenom: string, nomFamille: string) => Promise<boolean> }

/** Prénom et nom d'une personne dans sa ligne : deux champs enregistrés en quittant l'un d'eux (Entrée valide, Échap annule) ; remis à
 *  leur valeur si l'enregistrement échoue. Le composant est recréé (clé de la ligne) quand les données changent. */
function ChampsNom({ r, modifiable, enregistrer }: PropsNom) {
  const initial = prenomEtNom(r);
  const [prenom, setPrenom] = useState(initial.prenom);
  const [nomFamille, setNomFamille] = useState(initial.nomFamille);
  const remettre = () => { setPrenom(initial.prenom); setNomFamille(initial.nomFamille); };
  async function sauver() {
    if (prenom === initial.prenom && nomFamille === initial.nomFamille) return;
    if (!(await enregistrer(prenom, nomFamille))) remettre();
  }
  const touche = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur();
    if (e.key === 'Escape') { remettre(); e.currentTarget.blur(); }
  };
  return (
    <>
      <input className="champ champ-nom" aria-label={`Prénom de ${r.nom}`} placeholder="Prénom" value={prenom} disabled={!modifiable}
        onChange={e => setPrenom(e.target.value)} onBlur={() => void sauver()} onKeyDown={touche} />
      <input className="champ champ-nom" aria-label={`Nom de ${r.nom}`} placeholder="Nom" value={nomFamille} disabled={!modifiable}
        onChange={e => setNomFamille(e.target.value)} onBlur={() => void sauver()} onKeyDown={touche} />
    </>
  );
}
