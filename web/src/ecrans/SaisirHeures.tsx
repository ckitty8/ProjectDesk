/* ============================================================
   Mon dashboard › Saisir mes heures (menu à part depuis le 2026-10-22 ; maquette complements/mon-timesheet.png ; portage de
   app/js/ecrans/mon-timesheet.js — phase 5, vague C)
   Saisie MENSUELLE : ses heures par jour du mois sur les projets où l'on est affecté (hors rôle Lecteur), puis « Soumettre le mois ».
   La validation / le renvoi par le responsable se font dans Suivi de mes équipes › Timesheet. Droits contrôlés en base (trigger).
   ============================================================ */
import { useState } from 'react';
import type { FocusEvent } from 'react';
import { BadgeFeuille } from '../composants/Badge';
import { Bouton } from '../composants/Bouton';
import { Carte, EnteteEcran, Vide } from '../composants/Carte';
import { CompteSansFiche } from '../composants/CompteSansFiche';
import { creer, supprimer } from '../donnees/api';
import { useSession } from '../donnees/SessionProvider';
import { debutMois, dureeAbsence, estPresent, heuresAttenduesMois, heuresMois, joursSemaineMois } from '../domaine/calculs';
import { ROLES_PROJET } from '../domaine/config';
import { teinte } from '../domaine/couleurs';
import { aujourdhui, depuisIso, JOURS_INITIALES, libelleMois, nombre } from '../domaine/dates';
import { maRessource } from '../domaine/droits';
import { decalerMois, statutFeuille } from '../domaine/feuilles';
import { couleurDe } from '../domaine/referentiels';
import { lireHeures } from '../domaine/saisies';
import { absenceDe } from '../domaine/vues';

export function SaisirHeures() {
  const { ctx, donnees, executer, notifier } = useSession();
  const j = depuisIso(aujourdhui());
  const [mois, setMois] = useState({ annee: j.getFullYear(), mois: j.getMonth() });
  if (!ctx || !donnees) return null;
  const moi = maRessource(ctx);
  const entete = (
    <EnteteEcran titre="Saisir mes heures" sousTitre="Votre temps du mois sur les projets où vous êtes affecté(e), puis soumettez le mois à votre chef d’équipe"
      actions={(
        <div className="ligne-flex">
          <Bouton aria-label="Mois précédent" onClick={() => setMois(m => decalerMois(m.annee, m.mois, -1))}>‹</Bouton>
          <b style={{ minWidth: 130, textAlign: 'center' }}>{libelleMois(mois.annee, mois.mois)}</b>
          <Bouton aria-label="Mois suivant" onClick={() => setMois(m => decalerMois(m.annee, m.mois, 1))}>›</Bouton>
        </div>
      )} />
  );
  if (!moi) return <div className="ecran">{entete}<CompteSansFiche /></div>;

  const feries = new Set(donnees.joursFeries.map(f => f.jour));
  const jours = joursSemaineMois(mois.annee, mois.mois);
  const cle = debutMois(mois.annee, mois.mois);
  const statut = statutFeuille(donnees.feuilles, moi.id, cle);
  const verrouille = ['soumise', 'validee'].includes(statut);
  const feuille = donnees.feuilles.find(f => f.ressourceId === moi.id && f.semaine === cle);
  // Projets proposés : mes affectations (hors Lecteur) + projets déjà saisis ce mois
  const ids = new Set(donnees.affectations.filter(a => a.ressourceId === moi.id && a.role !== ROLES_PROJET.LECTEUR).map(a => a.projetId));
  donnees.temps.filter(t => t.ressourceId === moi.id && jours.includes(t.jour)).forEach(t => ids.add(t.projetId));
  const mesProjets = donnees.projets.filter(p => ids.has(p.id));
  const heure = (projetId: string, jour: string): number =>
    Number(donnees.temps.find(t => t.ressourceId === moi.id && t.projetId === projetId && t.jour === jour)?.heures ?? 0);
  const h = heuresMois(moi.id, mois.annee, mois.mois, donnees.temps);
  const attendu = heuresAttenduesMois(moi, mois.annee, mois.mois, donnees.absences, feries);
  // Début de semaine : trait vertical pour repérer les semaines dans le mois
  const classe = (jour: string) => (depuisIso(jour).getDay() === 1 ? 'debut-semaine' : undefined);

  // Saisie d'une case à la sortie du champ : nombre (virgule acceptée) ; vide = suppression de la saisie
  async function saisir(e: FocusEvent<HTMLInputElement>, projetId: string, jour: string) {
    const lu = lireHeures(e.target.value);
    if (lu.action === 'invalide') { notifier('Heures invalides (0 à 24)', 'erreur'); e.target.value = heure(projetId, jour) ? nombre(heure(projetId, jour)) : ''; return; }
    if (!moi) return;
    const filtre = { ressource_id: 'eq.' + moi.id, projet_id: 'eq.' + projetId, jour: 'eq.' + jour };
    if (lu.action === 'supprimer' && !heure(projetId, jour)) return;            // rien à supprimer
    if (lu.action === 'enregistrer' && lu.heures === heure(projetId, jour)) return;   // inchangé
    await executer(() => (lu.action === 'supprimer' ? supprimer('temps_saisis', filtre)
      : creer('temps_saisis', { ressourceId: moi.id, projetId, jour, heures: lu.heures }, 'ressource_id,projet_id,jour')), 'temps');
  }

  // Case d'un jour : absence d'une journée, férié, hors présence → non saisissable
  const caseJour = (projetId: string, jour: string) => {
    const abs = absenceDe(donnees.absences, moi.id, jour);
    if (feries.has(jour)) return <td key={jour} className={classe(jour)}><span className="jour-off" title="Jour férié">JF</span></td>;
    if (!estPresent(moi, jour)) return <td key={jour} className={classe(jour)}><span className="jour-off" title="Hors période de présence">—</span></td>;
    if (abs && dureeAbsence(abs) >= 1) {
      return <td key={jour} className={classe(jour)}><span className="jour-off" style={{ background: teinte(couleurDe(donnees.valeurs, 'abs', abs.type ?? '')) }} title={abs.type}>Abs</span></td>;
    }
    const valeur = heure(projetId, jour);
    return (
      <td key={jour} className={classe(jour)}>
        {/* key = valeur enregistrée : après relecture, la case reprend la valeur de la base */}
        <input key={valeur} className="saisie-mois" inputMode="decimal" defaultValue={valeur ? nombre(valeur) : ''} disabled={verrouille}
          title={abs ? `${abs.type} (demi-journée)` : ''} aria-label={`${jour}`} onBlur={e => void saisir(e, projetId, jour)} />
      </td>
    );
  };

  return (
    <div className="ecran">
      {entete}
      <Carte>
        <div className="defilement-x">
          <table className="tableau grille-mois">
            <thead>
              <tr>
                <th className="col-projet">Projet</th>
                {jours.map(jour => <th key={jour} className={classe(jour)}>{JOURS_INITIALES[depuisIso(jour).getDay()]}<br />{depuisIso(jour).getDate()}</th>)}
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {mesProjets.length === 0 && <tr><td colSpan={jours.length + 2}><Vide texte="Aucun projet : vous n’êtes affecté(e) à aucun projet (hors rôle Lecteur)." /></td></tr>}
              {mesProjets.map(p => (
                <tr key={p.id}>
                  <td className="col-projet">{p.nom}</td>
                  {jours.map(jour => caseJour(p.id, jour))}
                  <td className="num"><b>{nombre(jours.reduce((s, jour) => s + heure(p.id, jour), 0))} h</b></td>
                </tr>
              ))}
              <tr className="groupe">
                <td className="col-projet">Total du jour</td>
                {h.parJour.map((x, i) => <td key={jours[i]} className={classe(jours[i] ?? '')}>{x ? nombre(x) : ''}</td>)}
                <td className="num sans-retour">{nombre(h.total)} h</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="carte-titre" style={{ borderTop: '1px solid var(--bordure-fine)', borderBottom: 0 }}>
          <span className="ligne-flex">
            Statut : <BadgeFeuille statut={statut} /><b>{nombre(h.total)} h</b><span className="discret">sur {nombre(attendu)} h attendues</span>
            {statut === 'a_completer' && feuille?.commentaire && <span className="texte-attention">« {feuille.commentaire} »</span>}
            <span className="discret">JF = jour férié · Abs = absence posée (Congés) ; une demi-journée reste saisissable.</span>
          </span>
          {!verrouille && (
            <Bouton variante="primaire" onClick={() => void executer(() => creer('feuilles_temps', { ressourceId: moi.id, semaine: cle, statut: 'soumise', commentaire: null }, 'ressource_id,semaine'), 'feuilles')}>
              Soumettre le mois
            </Bouton>
          )}
        </div>
      </Carte>
    </div>
  );
}
