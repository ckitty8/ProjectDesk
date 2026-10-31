/* ============================================================
   Équipe : création / modification, membres et invitations (portage de Modale.equipe, enregistrerEquipe et inviterDansEquipe de
   app/js/modale.js — phase 5, vague D)
   ------------------------------------------------------------
   Direction et équipe sont des espaces de travail (membres, projets) ; une direction peut en plus regrouper des équipes. Nom, préfixe, couleur,
   type, rattachement et statut : administrateurs seulement. Création : organisation Neon Auth (le créateur en devient propriétaire) + ligne
   « equipes » de même identifiant. Invitation : par le responsable de l'équipe ; la personne l'accepte à sa connexion (migration 026).
   ============================================================ */
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Avatar, BadgeTon } from '../Badge';
import { Bouton } from '../Bouton';
import { Cadre } from '../Fenetres';
import { creer, creerOrganisation, inviterMembre, lireOrganisation, modifier } from '../../donnees/api';
import type { OrganisationDetaillee } from '../../donnees/api';
import { useSession } from '../../donnees/SessionProvider';
import { COULEURS } from '../../domaine/config';
import { peutGererEquipe, responsablesDe } from '../../domaine/droits';

interface Props {
  /** Équipe à modifier ; sinon création */
  id: string | null;
  /** Type proposé à la création (« equipe » par défaut) et rattachement */
  typeUnite?: string;
  parentId?: string | null;
  onFermer: () => void;
}

/** Identifiant d'URL d'une organisation : nom sans accents ni ponctuation + suffixe unique */
export const slugEquipe = (nom: string, suffixe: string): string =>
  nom.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-') + '-' + suffixe;

export function ModaleEquipe({ id, typeUnite = 'equipe', parentId = null, onFermer }: Props) {
  const { ctx, donnees, equipeCourante, executer, notifier, actualiser, choisirEquipe } = useSession();
  const [organisation, setOrganisation] = useState<OrganisationDetaillee | null>(null);
  const equipe = id ? donnees?.equipes.find(e => e.id === id) : undefined;
  const [type, setType] = useState(equipe?.type ?? typeUnite);
  const [version, setVersion] = useState(0);

  // Membres et invitations de l'équipe (comptes Neon Auth) : lus à l'ouverture, puis après chaque invitation
  useEffect(() => {
    if (!id) return undefined;
    let actif = true;
    lireOrganisation(id).then(o => { if (actif) setOrganisation(o); })
      .catch(e => notifier('Membres illisibles : ' + (e as Error).message, 'erreur'));
    return () => { actif = false; };
  }, [id, version, notifier]);

  if (!ctx || !donnees) return null;
  const admin = ctx.estAdmin;
  const libelleType = type === 'direction' ? 'Direction' : 'Équipe';
  const directions = donnees.equipes.filter(x => x.type === 'direction' && x.id !== id);
  const invitations = (organisation?.invitations ?? []).filter(i => i.status === 'pending');
  const peutInviter = !!id && peutGererEquipe(ctx, id);

  // Le créateur est invité dans chaque équipe créée par un autre administrateur ; il accepte d'office à sa connexion (fonction SQL
  // accepter_mes_invitations, migration 026) et peut ainsi y donner l'accès à des personnes.
  async function inviterCreateur(equipeId: string) {
    const createur = ctx?.createur[0] as { email?: string } | undefined;
    if (createur?.email && !ctx?.estCreateur) await inviterMembre(equipeId, createur.email, 'admin').catch(() => undefined);
  }

  async function enregistrer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    // Une direction n'est rattachée à rien ; champ vide = pas de rattachement (la base contrôle aussi)
    const champs = { nom: f.nom ?? '', prefixe: (f.prefixe ?? '').toUpperCase(), couleur: f.couleur ?? COULEURS.primaire, type: f.type ?? 'equipe',
      actif: f.actif !== 'false', parentId: f.type === 'direction' ? null : (f.parentId || null) };
    let nouvelleId = '';
    const reussi = await executer(async () => {
      if (id) { await modifier('equipes', { id: 'eq.' + id }, champs); return; }
      const org = await creerOrganisation(champs.nom, slugEquipe(champs.nom, Date.now().toString(36)));
      nouvelleId = org.id;
      await inviterCreateur(org.id);
      await creer('equipes', { id: org.id, ...champs });
    }, 'equipes');
    if (!reussi) return;
    if (nouvelleId) {
      await actualiser();                                    // nouvelle équipe dans les organisations du compte
      if (!equipeCourante) choisirEquipe(nouvelleId);       // première équipe de l'utilisateur : elle devient l'équipe ouverte
    }
    onFermer();
  }

  async function inviter(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget, f = new FormData(form);
    try {
      await inviterMembre(id ?? '', String(f.get('email')), String(f.get('role')));
      notifier('Invitation envoyée');
      form.reset();
      setVersion(v => v + 1);
    } catch (err) { notifier((err as Error).message, 'erreur'); }
  }

  return (
    <Cadre classe="modale" titre={equipe ? `${libelleType} ${equipe.nom}` : type === 'direction' ? 'Nouvelle direction' : 'Nouvelle équipe'} onFermer={onFermer}>
      <form className="pile" onSubmit={e => void enregistrer(e)}>
        <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'contents' }} disabled={!admin}>
          <div className="deux-colonnes">
            <div><label className="libelle">Nom<input className="champ" name="nom" defaultValue={equipe?.nom ?? ''} required /></label></div>
            <div className="deux-colonnes">
              <div>
                <label className="libelle">Préfixe projets
                  <input className="champ" name="prefixe" defaultValue={equipe?.prefixe ?? ''} maxLength={4} required style={{ textTransform: 'uppercase' }} />
                </label>
              </div>
              <div>
                <label className="libelle">Couleur
                  <input type="color" className="couleur-choix" style={{ width: '100%', height: 34 }} name="couleur" defaultValue={equipe?.couleur ?? COULEURS.primaire} />
                </label>
              </div>
            </div>
          </div>
          <div className="deux-colonnes">
            <div>
              <label className="libelle">Type
                <select className="champ" name="type" value={type} onChange={e => setType(e.target.value)}>
                  <option value="equipe">Équipe</option><option value="direction">Direction</option>
                </select>
              </label>
            </div>
            <div>
              <label className="libelle">Rattachée à (équipe seulement)
                <select className="champ" name="parentId" defaultValue={equipe?.parentId ?? parentId ?? ''}>
                  <option value="">— aucune direction —</option>
                  {directions.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
                </select>
              </label>
            </div>
          </div>
          <div className="deux-colonnes">
            <div>
              <label className="libelle">Statut
                <select className="champ" name="actif" defaultValue={String(equipe?.actif !== false)}><option value="true">Active</option><option value="false">Inactive</option></select>
              </label>
            </div>
            <div>
              {id && (
                <>
                  <div className="libelle">Responsable(s)</div>
                  <div className="discret">{responsablesDe(ctx, id).map(r => r.nom).join(', ') || 'aucun'} — à choisir dans Administration › Rôles</div>
                </>
              )}
            </div>
          </div>
          <div className="discret texte-12">
            Direction et équipe sont des espaces de travail (membres, projets) ; une direction peut en plus regrouper des équipes.
            Changer le type ne change ni les membres ni les projets.
          </div>
          {admin
            ? <div style={{ textAlign: 'right' }}><Bouton variante="primaire" type="submit">{id ? 'Enregistrer' : 'Créer'}</Bouton></div>
            : <div className="discret texte-12">Nom, préfixe et couleur : modifiables par un administrateur.</div>}
        </fieldset>
      </form>
      {id && (
        <>
          <div>
            <div className="libelle">Membres (comptes de connexion)</div>
            {!organisation && <span className="pale">Chargement…</span>}
            {organisation?.members?.map(m => (
              <div key={m.id} className="ligne-flex ligne-liste">
                <Avatar nom={m.user?.name ?? '?'} /><span className="extensible">{m.user ? `${m.user.name} · ${m.user.email}` : m.userId}</span><BadgeTon texte={m.role} ton="neutre" />
              </div>
            ))}
            {invitations.map(i => <div key={i.id} className="ligne-flex discret ligne-liste">✉ {i.email} · {i.role} · invitation en attente</div>)}
          </div>
          {peutInviter && (
            <>
              <form className="ligne-flex" onSubmit={e => void inviter(e)}>
                <input className="champ" type="email" name="email" placeholder="email@entreprise.fr" required aria-label="Email à inviter" />
                <select className="champ largeur-auto" name="role" defaultValue="member" aria-label="Rôle dans l’équipe">
                  <option value="member">member</option><option value="admin">admin (valide les temps)</option>
                </select>
                <Bouton type="submit">Inviter</Bouton>
              </form>
              <div className="discret texte-12">La personne invitée crée son compte avec cet email : l’invitation apparaît sur son écran de choix d’équipe.</div>
            </>
          )}
        </>
      )}
    </Cadre>
  );
}
