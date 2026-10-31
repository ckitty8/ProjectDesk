/* ============================================================
   Administration › Rôles : « Utilisateurs et rôles » (administrateurs ; maquettes docs/maquettes/liste-roles/ et affecter-roles/ ; portage de
   app/js/roles.js — phase 5, vague D)
   Le rôle d'accès de chaque personne se choisit dans la liste de sa ligne et s'enregistre aussitôt (fonction affecter_role, migration 029). Personne
   pas encore connectée (ou email non vérifié) : rôle prévu, appliqué à sa connexion. Matrice et « qui a quel rôle » : Administration créateur.
   ============================================================ */
import { useState } from 'react';
import { Aide } from '../../composants/Aide';
import { Avatar, BadgeTon, Pastille } from '../../composants/Badge';
import { BarreOutils, Carte, Vide } from '../../composants/Carte';
import { executer as appelerFonction } from '../../donnees/api';
import { useSession } from '../../donnees/SessionProvider';
import { roleChoisi } from '../../domaine/annuaire';
import { ROLES_ACCES, ROLES_CHOISISSABLES } from '../../domaine/config';
import { aujourdhui } from '../../domaine/dates';
import { aDroit, rolePrevu } from '../../domaine/droits';
import { AIDES } from '../../domaine/textes';
import type { Ressource } from '../../domaine/types';
import { projetsAvecRoleDe, ressourcesPresentes } from '../../domaine/vues';

export function Roles() {
  const { ctx, donnees, notifier, actualiser } = useSession();
  const [recherche, setRecherche] = useState('');
  const [equipe, setEquipe] = useState('');
  const [role, setRole] = useState('');
  if (!ctx || !donnees) return null;
  const texte = recherche.trim().toLowerCase();
  const personnes = ressourcesPresentes(donnees, aujourdhui())
    .filter(r => !equipe || r.equipeId === equipe).filter(r => !role || roleChoisi(ctx, r) === role)
    .filter(r => !texte || `${r.nom} ${r.email ?? ''}`.toLowerCase().includes(texte))
    .sort((a, b) => (donnees.equipes.find(e => e.id === a.equipeId)?.nom ?? '').localeCompare(donnees.equipes.find(e => e.id === b.equipeId)?.nom ?? '') || a.nom.localeCompare(b.nom));
  const nommer = aDroit(ctx, 'nommer_admin'), verrou = !aDroit(ctx, 'roles');

  // Rôle d'accès choisi dans la liste d'une ligne (administrateurs ; la base contrôle le droit)
  async function affecter(r: Ressource, nouveau: string) {
    try {
      const resultat = await appelerFonction('affecter_role', { p_ressource: r.id, p_role: nouveau });
      await actualiser();
      notifier(resultat === 'prevu' ? 'Rôle prévu : il s’appliquera à la connexion de la personne' : 'Rôle d’accès enregistré');
    } catch (e) { notifier((e as Error).message, 'erreur'); }
  }

  const ligne = (r: Ressource) => {
    const eq = donnees.equipes.find(e => e.id === r.equipeId), prevu = rolePrevu(ctx, r), choisi = roleChoisi(ctx, r);
    // Administrateur : choisi ou retiré seulement avec le droit « Nommer un administrateur »
    const options = ROLES_CHOISISSABLES.map(cle => ({ valeur: cle, libelle: ROLES_ACCES[cle].libelle, desactive: !nommer && (cle === 'admin' || choisi === 'admin') && cle !== choisi }));
    const effet = prevu ? 'rôle prévu : appliqué à sa connexion (email vérifié)' : r.userId ? 'appliqué' : '';
    return (
      <tr key={r.id}>
        <td><span className="ligne-flex"><Avatar nom={r.nom} /><b>{r.nom}</b></span><div className="discret texte-12">{r.email || 'email à renseigner sur la fiche'}</div></td>
        <td><span className="ligne-flex"><Pastille couleur={eq?.couleur ?? '#8A93A3'} />{eq?.nom}</span></td>
        <td>
          {projetsAvecRoleDe(donnees, r.id).filter(x => donnees.affectations.some(a => a.ressourceId === r.id && a.projetId === x.projet.id))
            .map(x => <div key={x.projet.id} className="ligne-flex projet-role">{x.projet.nom} <span className="discret texte-12">· {x.role}</span></div>)}
          {!donnees.affectations.some(a => a.ressourceId === r.id) && <span className="pale">aucun projet</span>}
        </td>
        <td>{r.userId ? <BadgeTon texte="Compte lié" ton="succes" /> : <BadgeTon texte="Pas encore connecté" ton="attention" />}</td>
        <td>{r.poste || '—'}</td>
        <td>
          <select className="champ champ-mini" aria-label={`Rôle de ${r.nom}`} value={choisi} disabled={verrou} onChange={e => void affecter(r, e.target.value)}>
            {options.map(o => <option key={o.valeur} value={o.valeur} disabled={o.desactive}>{o.libelle}</option>)}
          </select>
          {effet && <div className="discret texte-12">{effet}</div>}
        </td>
      </tr>
    );
  };

  return (
    <>
      <BarreOutils
        gauche={(
          <>
            <input className="champ" style={{ width: 260 }} placeholder="Rechercher une personne…" value={recherche}
              onChange={e => setRecherche(e.target.value)} aria-label="Rechercher une personne" />
            <select className="champ champ-compact" aria-label="Équipe" value={equipe} onChange={e => setEquipe(e.target.value)}>
              <option value="">Toutes les équipes</option>{donnees.equipes.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
            </select>
            <select className="champ champ-compact" aria-label="Rôle" value={role} onChange={e => setRole(e.target.value)}>
              <option value="">Tous les rôles</option>{ROLES_CHOISISSABLES.map(c => <option key={c} value={c}>{ROLES_ACCES[c].libelle}</option>)}
            </select>
          </>
        )}
        droite={<span className="discret">Rôles de projet (Chef de projet, Membre, Lecteur) : projet par projet, dans Liste des ressources</span>} />
      <Carte>
        <div className="carte-titre"><h2>Utilisateurs et rôles</h2><span className="discret">{personnes.length} personne(s)</span></div>
        <div className="defilement-x">
          <table className="tableau tableau-roles-acces">
            <thead>
              <tr><th>Utilisateur</th><th>Équipe</th><th>Projet(s)</th><th>Compte relié</th><th>Poste</th><th>Rôle <Aide texte={AIDES.roleAcces} /></th></tr>
            </thead>
            <tbody>{personnes.length === 0 ? <tr><td colSpan={6}><Vide texte="Personne ne correspond aux filtres." /></td></tr> : personnes.map(ligne)}</tbody>
          </table>
        </div>
      </Carte>
    </>
  );
}
