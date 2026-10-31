/* ============================================================
   Suivi de mes équipes › Timesheet (maquette 05-gTime.png ; portage de app/js/ecrans/timesheet.js — phase 5, vague B)
   Heures déclarées par personne sur un mois, toutes équipes ; validation des feuilles par les responsables d'équipe (seule écriture
   de la section « Suivi de mes équipes », contrôlée en base). La saisie se fait dans Mon dashboard › Saisir mes heures.
   La saisie et la validation des heures sont MENSUELLES (porteur du projet, 2026-10-05) : une feuille par personne et par mois.
   ============================================================ */
import { useState } from 'react';
import { Avatar, BadgeFeuille, Pastille } from '../composants/Badge';
import { Barre } from '../composants/Barre';
import { Bouton } from '../composants/Bouton';
import { Carte, EnteteEcran, Kpi, Vide } from '../composants/Carte';
import { Modale } from '../composants/Fenetres';
import { creer } from '../donnees/api';
import { useSession } from '../donnees/SessionProvider';
import { debutMois } from '../domaine/calculs';
import { aujourdhui, depuisIso, libelleMois, nombre, pourcent } from '../domaine/dates';
import { mesEquipes, peutValiderEquipe } from '../domaine/droits';
import { decalerMois, suiviFeuilles } from '../domaine/feuilles';
import type { LigneFeuille } from '../domaine/feuilles';
import { COULEURS } from '../domaine/config';

/** Écrit (ou remplace) la feuille d'une personne pour un mois : une ligne par personne et par mois */
const ecrireFeuille = (ressourceId: string, semaine: string, statut: string, commentaire: string | null = null) =>
  creer('feuilles_temps', { ressourceId, semaine, statut, commentaire }, 'ressource_id,semaine');

export function Timesheet() {
  const { ctx, donnees, rechargerTables } = useSession();
  const aujourd = depuisIso(aujourdhui());
  const [mois, setMois] = useState({ annee: aujourd.getFullYear(), mois: aujourd.getMonth() });
  const [erreur, setErreur] = useState<string | null>(null);
  const [renvoi, setRenvoi] = useState<LigneFeuille | null>(null);
  const [motif, setMotif] = useState('Merci de compléter le mois');
  if (!ctx || !donnees) return null;

  const valide = mesEquipes(ctx).some(e => peutValiderEquipe(ctx, e.id));
  const feries = new Set(donnees.joursFeries.map(j => j.jour));
  const suivi = suiviFeuilles(ctx, donnees, donnees.equipes, mois.annee, mois.mois, feries);
  const cle = debutMois(mois.annee, mois.mois);
  const completude = suivi.attendu ? suivi.saisi / suivi.attendu * 100 : 0;
  const nbColonnes = valide ? 7 : 6;

  // Écriture puis relecture des feuilles ; une erreur de la base (droits…) est affichée
  async function ecrire(l: LigneFeuille, statut: string, commentaire: string | null = null) {
    try { await ecrireFeuille(l.ressource.id, cle, statut, commentaire); setErreur(null); await rechargerTables('feuilles'); }
    catch (e) { setErreur((e as Error).message); }
  }

  return (
    <div className="ecran">
      <EnteteEcran titre="Timesheet"
        sousTitre={`Heures déclarées par personne sur le mois · toutes équipes${valide ? ' · validation des feuilles de vos équipes' : ''}`}
        actions={(
          <div className="ligne-flex">
            <Bouton aria-label="Mois précédent" onClick={() => setMois(m => decalerMois(m.annee, m.mois, -1))}>‹</Bouton>
            <b style={{ minWidth: 130, textAlign: 'center' }}>{libelleMois(mois.annee, mois.mois)}</b>
            <Bouton aria-label="Mois suivant" onClick={() => setMois(m => decalerMois(m.annee, m.mois, 1))}>›</Bouton>
          </div>
        )} />
      {erreur && <div className="message-erreur" role="alert">{erreur}</div>}
      <div className={'grille-kpi ' + (valide ? 'q4' : 'q3')}>
        <Kpi libelle="Heures saisies" valeur={nombre(suivi.saisi) + ' h'} complement={`sur ${nombre(suivi.attendu)} h attendues`} />
        <Kpi libelle="Taux de complétude" valeur={pourcent(completude)} aide="Heures saisies ÷ heures attendues du mois." />
        <Kpi libelle="Feuilles à compléter" valeur={suivi.aCompleter} />
        {valide && <Kpi libelle="Feuilles à valider" valeur={suivi.aValider} aide="Feuilles soumises par les membres de vos équipes." />}
      </div>
      <Carte>
        <table className="tableau">
          <thead>
            <tr><th>Personne</th><th>Projets</th><th className="num">Saisi / attendu</th><th>Complétude</th><th className="num">%</th><th>Statut</th>{valide && <th />}</tr>
          </thead>
          <tbody>
            {suivi.groupes.length === 0 && <tr><td colSpan={nbColonnes}><Vide texte="Aucune ressource." /></td></tr>}
            {suivi.groupes.map(g => (
              <GroupeFeuilles key={g.equipe.id} nom={g.equipe.nom} couleur={g.equipe.couleur ?? COULEURS.pale} colonnes={nbColonnes}>
                {g.lignes.map(l => (
                  <tr key={l.ressource.id}>
                    <td><span className="ligne-flex"><Avatar nom={l.ressource.nom} />{l.ressource.nom}</span></td>
                    <td>{l.projets.map(p => <span key={p.id} className="etiquette">{p.nom}</span>)}</td>
                    <td className="num"><b>{nombre(l.saisi)} h</b> <span className="discret">/ {nombre(l.attendu)} h</span></td>
                    <td style={{ width: '18%' }}><Barre pct={Math.min(100, l.completude)} /></td>
                    <td className="num">{l.attendu ? pourcent(l.completude) : '—'}</td>
                    <td><BadgeFeuille statut={l.statut} /></td>
                    {valide && (
                      <td className="num sans-retour">
                        {l.validable && (
                          <>
                            <Bouton petit onClick={() => setRenvoi(l)}>Renvoyer</Bouton>{' '}
                            <Bouton petit variante="succes" onClick={() => void ecrire(l, 'validee')}>Valider</Bouton>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </GroupeFeuilles>
            ))}
          </tbody>
        </table>
      </Carte>
      {renvoi && (
        <Modale titre={`Renvoyer la feuille de ${renvoi.ressource.nom}`} onFermer={() => setRenvoi(null)}
          pied={(
            <>
              <Bouton onClick={() => setRenvoi(null)}>Annuler</Bouton>
              <Bouton variante="primaire" onClick={() => { void ecrire(renvoi, 'a_completer', motif); setRenvoi(null); }}>Renvoyer la feuille</Bouton>
            </>
          )}>
          <label className="libelle">Motif du renvoi (visible par la personne)
            <textarea className="champ" rows={3} value={motif} onChange={e => setMotif(e.target.value)} />
          </label>
        </Modale>
      )}
    </div>
  );
}

/** Ligne de titre d'une équipe, suivie de ses personnes */
function GroupeFeuilles({ nom, couleur, colonnes, children }: { nom: string; couleur: string; colonnes: number; children: React.ReactNode }) {
  return (
    <>
      <tr className="groupe"><td colSpan={colonnes}><span className="ligne-flex"><Pastille couleur={couleur} />{nom}</span></td></tr>
      {children}
    </>
  );
}
