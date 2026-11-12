/* ============================================================
   Pastille « Configuration » (porteur, 2026-11-06 ; maquette assistant-configuration/proposition-3-detaillee.png)
   Encadré réductible en bas à droite de chaque écran, visible des administrateurs (mode administrateur) tant que la configuration initiale n'est pas
   terminée : progression, neuf étapes, détail d'une étape (pourquoi, bouton qui ouvre le bon écran, « J'ai vérifié », « Passer »). Réduite / fermée :
   mémorisé sur ce poste. La liste complète est aussi dans Administration › Démarrage (ListeEtapes).
   ============================================================ */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bouton } from './Bouton';
import { creer, supprimer } from '../donnees/api';
import { useSession } from '../donnees/SessionProvider';
import { etatsConfiguration, progressionConfiguration } from '../domaine/configuration';
import type { EtapeEtat } from '../domaine/configuration';
import { cheminDe } from '../routes';

const CLE_REDUITE = 'pp_config_reduite';
const CLE_FERMEE = 'pp_config_fermee';
const lire = (cle: string): boolean => { try { return localStorage.getItem(cle) === '1'; } catch { return false; } };
const memoriser = (cle: string, valeur: boolean): void => { try { localStorage.setItem(cle, valeur ? '1' : '0'); } catch { /* navigation privée */ } };

const SYMBOLE: Record<EtapeEtat['etat'], string> = { fait: '✔', a_faire: '○', ignoree: '⊘' };

/** Liste des étapes avec leur détail ; « enCours » = étape mise en avant (la première à faire) */
export function ListeEtapes({ etapes, compacte }: { etapes: readonly EtapeEtat[]; compacte: boolean }) {
  const { ctx, executer } = useSession();
  const navigate = useNavigate();
  const [ouverte, setOuverte] = useState<string | null>(null);
  if (!ctx) return null;
  const { suivante } = progressionConfiguration(etapes);
  const aller = (c: EtapeEtat['cible']) => navigate(cheminDe(c.ecran), { state: c.onglet ? { onglet: c.onglet, entree: c.entree } : undefined });
  const ouvrir = (e: EtapeEtat) => aller(e.cible);
  const retenir = (e: EtapeEtat, statut: 'confirmee' | 'ignoree') => executer(() => creer('etapes_configuration', { etape: e.id, statut }, 'etape'), 'etapesConfiguration');
  const rouvrir = (e: EtapeEtat) => executer(() => supprimer('etapes_configuration', { etape: 'eq.' + e.id }), 'etapesConfiguration');
  return (
    <div className={'liste-etapes' + (compacte ? ' compacte' : '')}>
      {etapes.map((e, i) => {
        const enCours = suivante?.id === e.id;
        return (
          <div key={e.id} className={'etape etape-' + e.etat + (enCours ? ' en-cours' : '')}>
            <button type="button" className="etape-ligne" aria-expanded={ouverte === e.id} onClick={() => setOuverte(ouverte === e.id ? null : e.id)}>
              <span className="etape-symbole">{enCours ? '●' : SYMBOLE[e.etat]}</span>
              <span className="etape-libelle">{i + 1}. {e.libelle}</span>
              {enCours && <span className="etape-ici">vous êtes ici</span>}
            </button>
            {(enCours || ouverte === e.id) && <div className="discret texte-12 etape-detail">{e.detail}</div>}
            {ouverte === e.id && (
              <div className="etape-corps">
                <div className="texte-12">Pourquoi : {e.pourquoi}</div>
                <div className="ligne-flex etape-actions">
                  <Bouton variante="primaire" petit onClick={() => ouvrir(e)}>{e.libelleBouton}</Bouton>
                  {e.confirmable && e.etat !== 'fait' && <Bouton petit onClick={() => void retenir(e, 'confirmee')}>J’ai vérifié</Bouton>}
                  {e.etat === 'a_faire' && <button type="button" className="lien-btn" onClick={() => void retenir(e, 'ignoree')}>Passer cette étape</button>}
                  {e.etat !== 'a_faire' && ctx.etapesConfiguration.some(x => x.etape === e.id) && <button type="button" className="lien-btn" onClick={() => void rouvrir(e)}>Rouvrir</button>}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Pastille flottante : se montre aux administrateurs en mode administrateur, hors simulation, tant que la configuration n'est pas fermée */
export function PastilleConfiguration() {
  const { ctx, simulation } = useSession();
  const navigate = useNavigate();
  const [reduite, setReduite] = useState(() => lire(CLE_REDUITE));
  const [fermee, setFermee] = useState(() => lire(CLE_FERMEE));
  if (!ctx || !ctx.estAdmin || simulation || fermee) return null;
  const etapes = etatsConfiguration(ctx);
  const { faites, total, terminee, suivante } = progressionConfiguration(etapes);
  const aller = (c: EtapeEtat['cible']) => navigate(cheminDe(c.ecran), { state: c.onglet ? { onglet: c.onglet, entree: c.entree } : undefined });
  const basculer = () => { memoriser(CLE_REDUITE, !reduite); setReduite(!reduite); };
  const fermer = () => { memoriser(CLE_FERMEE, true); setFermee(true); };
  const allerSuivante = () => { if (suivante) aller(suivante.cible); };
  const barre = <div className="barre-config"><i style={{ width: `${Math.round(faites / total * 100)}%` }} /></div>;
  if (terminee) {
    return (
      <div className="pastille-config terminee" role="status">
        <b>✔ Configuration terminée</b>
        <div className="discret texte-12">Votre application est prête. La liste reste disponible dans Administration › Démarrage.</div>
        <Bouton petit variante="succes" onClick={fermer}>Fermer</Bouton>
      </div>
    );
  }
  return (
    <div className="pastille-config" role="complementary" aria-label="Configuration">
      <button type="button" className="pastille-entete" aria-expanded={!reduite} onClick={basculer}>
        <b>Configuration · {faites}/{total}</b><span className="discret texte-12">{reduite ? '▴ ouvrir' : '▾ réduire'}</span>
      </button>
      {barre}
      {reduite
        ? <div className="discret texte-12">Prochaine : {suivante?.libelle}</div>
        : (
          <>
            <ListeEtapes etapes={etapes} compacte />
            <div className="ligne-flex etape-actions"><Bouton variante="primaire" petit onClick={allerSuivante}>Étape suivante ›</Bouton></div>
          </>
        )}
    </div>
  );
}
