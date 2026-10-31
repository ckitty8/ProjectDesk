/* ============================================================
   Mon dashboard › Projets et Roadmap › Sprints (maquette sprints-mon-dashboard/, porteur 2026-10-23 ; portage de app/js/ecrans/sprints.js
   — phase 5, vague C)
   Création et modification des sprints de chaque projet (table sprints_projet) : numéro, année, version, début, fin. Modifiable par ceux
   qui peuvent modifier le projet (peutEditerProjet). Les sprints s'affichent dans Suivi de mes équipes › Projets et Roadmap › Planning projet
   et servent aussi à la roadmap (docs/specifications/roadmap.md § 2). Règles de saisie : domaine/saisies.ts.
   ============================================================ */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Aide } from '../composants/Aide';
import { Bouton, BoutonIcone } from '../composants/Bouton';
import { Carte, EnteteEcran, Vide } from '../composants/Carte';
import { Liste } from '../composants/Liste';
import { creer, modifier, supprimer } from '../donnees/api';
import { useSession } from '../donnees/SessionProvider';
import { aujourdhui, formatAvecAnnee } from '../domaine/dates';
import { peutEditerProjet } from '../domaine/droits';
import { anneeSprint, erreurModificationSprint, lireChampSprint, numeroSprintSuivant, numeroTechniqueSuivant, sprintDejaPris } from '../domaine/saisies';
import type { ChampSprint } from '../domaine/saisies';
import { AIDES } from '../domaine/textes';
import type { Projet } from '../domaine/types';
import { sprintsDuProjet } from '../domaine/vues';
import type { SprintDatee } from '../domaine/vues';

/** Sprints d'un projet pour une année : une ligne par sprint (n°, année, version, début, fin), puis une ligne d'ajout */
function TableSprints({ projet, editable, annee, onAnnee }: { projet: Projet; editable: boolean; annee: number; onAnnee: (a: number) => void }) {
  const { donnees, executer, notifier } = useSession();
  if (!donnees) return null;
  const jour = aujourdhui();
  const sprints = sprintsDuProjet(donnees.sprintsProjet, projet.id).filter(s => anneeSprint(s) === annee);

  // Modification d'un champ avec ses contrôles : on remet l'ancienne valeur dans le champ si la saisie est refusée
  async function majChamp(s: SprintDatee, champ: ChampSprint, el: HTMLInputElement) {
    const valeur = lireChampSprint(champ, el.value);
    const erreur = erreurModificationSprint(donnees?.sprintsProjet ?? [], s, champ, valeur);
    if (erreur) { el.value = String((champ === 'annee' ? anneeSprint(s) : s[champ]) ?? ''); notifier(erreur, 'erreur'); return; }
    if (valeur === (s[champ] ?? null)) return;
    await executer(() => modifier('sprints_projet', { projet_id: 'eq.' + s.projetId, numero: 'eq.' + s.numero }, { [champ]: valeur }), 'sprintsProjet');
  }

  async function supprimerSprint(s: SprintDatee) {
    if (!window.confirm('Supprimer ce sprint ? Ses points et sa répartition saisis seront supprimés.')) return;
    await executer(async () => {
      await supprimer('repartitions_sprint', { projet_id: 'eq.' + s.projetId, numero: 'eq.' + s.numero });
      await supprimer('sprints_projet', { projet_id: 'eq.' + s.projetId, numero: 'eq.' + s.numero });
    }, 'sprintsProjet', 'repartitionsSprint');
  }

  async function ajouter(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget, f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const numeroSprint = Number(f.numeroSprint), anneeSaisie = Number(f.annee), debut = f.debut ?? '', fin = f.fin ?? '';
    if (fin < debut) return notifier('La date de fin précède la date de début', 'erreur');
    if (sprintDejaPris(donnees?.sprintsProjet ?? [], projet.id, anneeSaisie, numeroSprint)) {
      return notifier(`Le sprint ${numeroSprint} existe déjà en ${anneeSaisie} pour ce projet`, 'erreur');
    }
    const repartitions = (donnees?.repartitionsSprint ?? []) as { projetId: string; numero?: number }[];
    const numero = numeroTechniqueSuivant(donnees?.sprintsProjet ?? [], repartitions, projet.id);
    const reussi = await executer(() => creer('sprints_projet', { projetId: projet.id, numero, numeroSprint, annee: anneeSaisie, nom: (f.nom ?? '').trim() || null, debut, fin }), 'sprintsProjet');
    if (reussi) { form.reset(); onAnnee(anneeSaisie); }
  }

  const champ = (s: SprintDatee, nom: ChampSprint, valeur: string | number, props: Record<string, unknown> = {}) => (
    <input key={`${s.numero}-${nom}-${valeur}`} defaultValue={valeur} {...props} onBlur={e => void majChamp(s, nom, e.target)} />
  );

  return (
    <div>
      <div className="discret" style={{ margin: '4px 0 8px' }}>
        {editable ? 'Saisissez le numéro du sprint, son année, le nom de la version, la date de début et la date de fin.' : 'Lecture seule : vous ne pouvez pas modifier ce projet.'}{' '}
        <Aide texte={AIDES.sprintsProjet} />
      </div>
      <table className="tableau tableau-sprints">
        <thead><tr><th>Sprint</th><th>Année</th><th>Version</th><th>Début</th><th>Fin</th><th /></tr></thead>
        <tbody>
          {sprints.length === 0 && !editable && <tr><td colSpan={6} className="pale">Aucun sprint en {annee}.</td></tr>}
          {sprints.map(s => {
            const enCours = s.debut <= jour && jour <= s.fin;
            return editable
              ? (
                <tr key={s.numero}>
                  <td><span className="ligne-flex">Sprint{champ(s, 'numeroSprint', s.numeroSprint || '', { className: 'champ champ-numero', type: 'number', min: 1, 'aria-label': 'Numéro du sprint' })}</span></td>
                  <td>{champ(s, 'annee', anneeSprint(s), { className: 'champ champ-numero', type: 'number', min: 2000, max: 2100, 'aria-label': 'Année' })}</td>
                  <td>{champ(s, 'nom', s.nom || '', { className: 'champ', placeholder: 'Version', 'aria-label': 'Version' })}</td>
                  <td>{champ(s, 'debut', s.debut, { className: 'champ champ-date', type: 'date', 'aria-label': 'Début' })}</td>
                  <td>{champ(s, 'fin', s.fin, { className: 'champ champ-date', type: 'date', 'aria-label': 'Fin' })}{enCours && <> <span className="discret texte-11">en cours</span></>}</td>
                  <td><BoutonIcone icone="supprimer" titre="Supprimer ce sprint" onClick={() => void supprimerSprint(s)} /></td>
                </tr>
              )
              : (
                <tr key={s.numero}>
                  <td>{s.numeroSprint ? 'Sprint ' + s.numeroSprint : <span className="pale">—</span>}{enCours && <> <span className="discret texte-11">en cours</span></>}</td>
                  <td>{anneeSprint(s)}</td><td>{s.nom}</td><td>{formatAvecAnnee(s.debut)}</td><td>{formatAvecAnnee(s.fin)}</td><td />
                </tr>
              );
          })}
          {editable && (
            <tr className="ligne-ajout">
              <td><span className="ligne-flex">Sprint<input className="champ champ-numero" type="number" min={1} name="numeroSprint" form="ajout-sprint" defaultValue={numeroSprintSuivant(sprints)} key={`n${sprints.length}${annee}`} required aria-label="Nouveau sprint : numéro" /></span></td>
              <td><input className="champ champ-numero" type="number" min={2000} max={2100} name="annee" form="ajout-sprint" defaultValue={annee} key={`a${annee}`} required aria-label="Nouveau sprint : année" /></td>
              <td><input className="champ" name="nom" form="ajout-sprint" placeholder="Version (ex. V3.2)" aria-label="Nouveau sprint : version" /></td>
              <td><input className="champ champ-date" type="date" name="debut" form="ajout-sprint" required aria-label="Nouveau sprint : début" /></td>
              <td><input className="champ champ-date" type="date" name="fin" form="ajout-sprint" required aria-label="Nouveau sprint : fin" /></td>
              <td><Bouton variante="primaire" type="submit" form="ajout-sprint" title="Ajouter le sprint">+</Bouton></td>
            </tr>
          )}
        </tbody>
      </table>
      {editable && <form id="ajout-sprint" onSubmit={e => void ajouter(e)} />}
    </div>
  );
}

export function Sprints() {
  const { ctx, donnees } = useSession();
  const [projetId, setProjetId] = useState<string | null>(null);
  const [anneeChoisie, setAnnee] = useState<number | null>(null);
  if (!ctx || !donnees) return null;
  const projets = donnees.projets;
  const projet = projets.find(p => p.id === projetId) ?? projets.find(p => p.nom === 'CDO') ?? projets[0];
  const entete = <EnteteEcran titre="Sprints" sousTitre="Sprints de vos projets · affichés dans Suivi de mes équipes › Projets et Roadmap › Planning projet" />;
  if (!projet) return <div className="ecran">{entete}<Carte><Vide texte="Aucun projet." /></Carte></div>;
  // Affichage par année (demande du porteur, 2026-10-05) : années des sprints du projet + année en cours
  const anneeCourante = Number(aujourdhui().slice(0, 4));
  const annee = anneeChoisie ?? anneeCourante;
  const annees = [...new Set([...sprintsDuProjet(donnees.sprintsProjet, projet.id).map(anneeSprint), annee, anneeCourante])].sort();
  return (
    <div className="ecran">
      {entete}
      <Carte>
        <div className="carte-titre">
          <div className="ligne-flex">
            <h2>Sprints</h2>
            <Liste className="champ champ-compact" aria-label="Projet" valeur={projet.id} onChoisir={setProjetId} options={projets.map(p => ({ valeur: p.id, libelle: p.nom }))} />
            <div className="puces">
              {annees.map(a => <button key={a} type="button" className={'puce' + (a === annee ? ' active' : '')} onClick={() => setAnnee(a)}>{a}</button>)}
            </div>
          </div>
          <span className="discret">chaque projet a ses propres sprints</span>
        </div>
        <div style={{ padding: '0 16px 14px' }}>
          <TableSprints projet={projet} editable={peutEditerProjet(ctx, projet)} annee={annee} onAnnee={setAnnee} />
        </div>
      </Carte>
    </div>
  );
}
