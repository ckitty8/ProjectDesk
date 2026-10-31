/* ============================================================
   Administration › Comptes en attente (administrateurs ; maquette docs/maquettes/comptes-en-attente/ ; portage de app/js/ecrans/mon-admin.js)
   Personnes inscrites sans équipe (fonction comptes_en_attente, migration 024). Pour chacune : équipe, fiche ressource (existante sans compte,
   proposée si l'email ou le prénom correspond, ou nouvelle fiche), rôle dans l'équipe ; « Donner l'accès » ; « Ignorer » écarte un compte (doublon, inconnu).
   ============================================================ */
import { useState } from 'react';
import { Avatar, BadgeTon } from '../../composants/Badge';
import { Bouton } from '../../composants/Bouton';
import { Carte, Vide } from '../../composants/Carte';
import { creer, inviterMembre, modifier } from '../../donnees/api';
import { useSession } from '../../donnees/SessionProvider';
import { choixParDefaut } from '../../domaine/admin';
import type { ChoixCompte } from '../../domaine/admin';
import { aujourdhui, formatAvecAnnee } from '../../domaine/dates';
import { ressourcesPresentes } from '../../domaine/vues';

export function Comptes() {
  const { donnees, comptesEnAttente, executer, notifier, actualiser } = useSession();
  const [choix, setChoix] = useState<Record<string, Partial<ChoixCompte>>>({});
  if (!donnees) return null;
  if (!comptesEnAttente.length) return <Carte><Vide texte="Aucun compte en attente : toutes les personnes inscrites ont accès à une équipe." /></Carte>;
  const libres = ressourcesPresentes(donnees, aujourdhui()).filter(r => !r.userId);
  const equipes = donnees.equipes.filter(e => e.actif !== false);
  const enAttente = comptesEnAttente.filter(c => !c.invite).length;
  const choixDe = (c: { userId: string; nom: string; email: string }): ChoixCompte => ({ ...choixParDefaut(libres, c), ...choix[c.userId] });
  // Changer d'équipe vide la fiche
  const choisir = (userId: string, champ: keyof ChoixCompte, valeur: string, base: ChoixCompte) =>
    setChoix(x => ({ ...x, [userId]: { ...base, ...x[userId], [champ]: valeur, ...(champ === 'equipe' ? { fiche: '' } : {}) } }));

  /* Donner l'accès : la fiche choisie reçoit l'email du compte (lier_ma_ressource la relie à la connexion) ou une fiche est créée, puis invitation
     dans l'équipe (Neon Auth), acceptée d'office à la connexion de la personne (fonction SQL accepter_mes_invitations, migration 026). */
  async function donnerAcces(userId: string) {
    const compte = comptesEnAttente.find(c => c.userId === userId);
    if (!compte) return;
    const c = choixDe(compte);
    if (!c.equipe || !c.fiche) return notifier('Choisissez l’équipe et la fiche ressource', 'erreur');
    const reussi = await executer(async () => {
      if (c.fiche === 'nouvelle') await creer('ressources', { nom: compte.nom || compte.email, email: compte.email, equipeId: c.equipe });
      else await modifier('ressources', { id: 'eq.' + c.fiche }, { email: compte.email });
      await inviterMembre(c.equipe, compte.email, c.role);
    }, 'ressources');
    if (reussi) { await actualiser(); notifier(`Accès donné à ${compte.nom || compte.email}`); }
  }
  async function ignorer(userId: string) {
    if (!window.confirm('Écarter ce compte de la liste ? Il n’aura pas accès à l’application.')) return;
    if (await executer(() => creer('comptes_ignores', { userId }))) await actualiser();
  }

  return (
    <>
      {enAttente > 0 && (
        <Carte classe="encart-compact encart-alerte">
          <b>{enAttente} personne{enAttente > 1 ? 's se sont inscrites et attendent' : ' s’est inscrite et attend'} un accès.</b>{' '}
          Choisissez l’équipe et la fiche ressource, puis « Donner l’accès » : la personne entre dans l’application à sa prochaine connexion
          (ou en cliquant « Actualiser »), sans autre démarche.
        </Carte>
      )}
      <Carte>
        <table className="tableau">
          <thead><tr><th>Compte inscrit</th><th>Inscrit le</th><th>Équipe</th><th>Fiche ressource</th><th>Rôle dans l’équipe</th><th /></tr></thead>
          <tbody>
            {comptesEnAttente.map(c => {
              const ch = choixDe(c);
              const fiches = libres.filter(r => r.equipeId === ch.equipe);
              return (
                <tr key={c.userId}>
                  <td><span className="ligne-flex"><Avatar nom={c.nom || c.email} /><span><b>{c.nom || '—'}</b><div className="discret texte-12">{c.email}</div></span></span></td>
                  <td>{formatAvecAnnee((c.inscritLe || '').slice(0, 10))}</td>
                  <td>
                    <select className="champ largeur-auto" aria-label="Équipe" value={ch.equipe} onChange={e => choisir(c.userId, 'equipe', e.target.value, ch)}>
                      <option value="">— choisir —</option>{equipes.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
                    </select>
                  </td>
                  <td>
                    <select className="champ largeur-auto" aria-label="Fiche ressource" value={ch.fiche} onChange={e => choisir(c.userId, 'fiche', e.target.value, ch)}>
                      <option value="">— choisir —</option>
                      {fiches.map(r => <option key={r.id} value={r.id}>{r.nom + (r.email ? '' : ' (sans email)')}</option>)}
                      <option value="nouvelle">+ Créer sa fiche</option>
                    </select>
                  </td>
                  <td>
                    <select className="champ largeur-auto" aria-label="Rôle dans l’équipe" value={ch.role} onChange={e => choisir(c.userId, 'role', e.target.value, ch)}>
                      <option value="member">Membre</option><option value="admin">Admin d’équipe</option>
                    </select>
                  </td>
                  <td className="num sans-retour">
                    <Bouton petit onClick={() => void ignorer(c.userId)}>Ignorer</Bouton>{' '}
                    {c.invite
                      ? <BadgeTon texte="Accès donné · en attente de sa connexion" ton="succes" />
                      : <Bouton petit variante="primaire" onClick={() => void donnerAcces(c.userId)}>Donner l’accès</Bouton>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="discret" style={{ fontSize: 12, padding: '8px 16px' }}>
          Fiche ressource : la fiche existante de la personne (proposée si l’email ou le prénom correspond) reçoit l’email du compte et s’y relie
          à sa connexion ; sinon une fiche est créée. Une personne inscrite deux fois (email personnel et professionnel) : donner l’accès au compte
          utilisé, « Ignorer » l’autre.
        </div>
      </Carte>
    </>
  );
}
