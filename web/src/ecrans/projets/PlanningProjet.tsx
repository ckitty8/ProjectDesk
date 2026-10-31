/* ============================================================
   Onglet Planning projet (maquette planning-projet/, porteur 2026-10-23 ; portage de PlanningProjet de app/js/ecrans/projets.js)
   Une ligne par projet ayant un sprint ou une MEP sur la période, sur une frise de 6 mois : sprints en blocs « S12 » (sprint en cours en
   bleu) et mises en production en repères ▲ + version (couleur du statut, STATUTS_MEP) ; trait vertical = aujourd'hui, détail au survol.
   ============================================================ */
import { useState } from 'react';
import { Bouton } from '../../composants/Bouton';
import { Carte, Vide } from '../../composants/Carte';
import { useSession } from '../../donnees/SessionProvider';
import { STATUTS_MEP, TONS } from '../../domaine/config';
import { aujourdhui, depuisIso, formatCourt, libelleMois } from '../../domaine/dates';
import { debutParDefaut, dansPeriode, decalerDebut, periodePlanning } from '../../domaine/planning';
import type { PeriodePlanning } from '../../domaine/planning';
import type { Projet } from '../../domaine/types';
import { misesEnProductionDe, sprintsDuProjet } from '../../domaine/vues';
import type { MepDatee, SprintDatee } from '../../domaine/vues';

const anneeMois = (iso: string): [number, number] => { const d = depuisIso(iso); return [d.getFullYear(), d.getMonth()]; };

/** Bloc d'un sprint : « S » + numéro de sprint, sprint en cours mis en avant, version et dates en infobulle */
function BlocSprint({ s, per, jour }: { s: SprintDatee; per: PeriodePlanning; jour: string }) {
  const gauche = per.position(s.debut), largeur = Math.max(per.position(s.fin) - gauche, 0.5), numero = s.numeroSprint || s.numero;
  const titre = `Sprint ${numero}${s.nom ? ' · ' + s.nom : ''} : ${formatCourt(s.debut)} → ${formatCourt(s.fin)}`;
  return <div className={'gantt-sprint' + (s.debut <= jour && jour <= s.fin ? ' en-cours' : '')} style={{ left: `${gauche}%`, width: `${largeur}%` }} title={titre}>S{numero}</div>;
}

/** Repère d'une mise en production : ▲ + version à sa date, couleur de son statut, détail en infobulle */
function RepereMep({ m, per }: { m: MepDatee; per: PeriodePlanning }) {
  const statut = STATUTS_MEP.find(x => x.valeur === m.statut) ?? STATUTS_MEP[0];
  if (!statut) return null;
  // Tickets livrés (migration 044) : « 5 US · 3 bugs · 1 incidents », vide si aucun
  const tickets = m.nbBugs || m.nbIncidents || m.nbUs ? ` : ${m.nbUs || 0} US · ${m.nbBugs || 0} bugs · ${m.nbIncidents || 0} incidents` : '';
  const titre = `MEP ${m.version || ''} · ${formatCourt(m.jour)} · ${statut.libelle}${tickets}`;
  return <div className="gantt-mep" style={{ left: `${per.position(m.jour)}%`, color: TONS[statut.ton].texte }} title={titre}>▲ {m.version || 'MEP'}</div>;
}

export function PlanningProjet({ projets }: { projets: readonly Projet[] }) {
  const { donnees } = useSession();
  const [choisi, setChoisi] = useState<string | null>(null);
  if (!donnees) return null;
  const jour = aujourdhui();
  const debut = choisi ?? debutParDefaut(jour);
  const per = periodePlanning(debut);
  const lignes = projets.map(p => ({
    p,
    sprints: sprintsDuProjet(donnees.sprintsProjet, p.id).filter(s => dansPeriode(per, s.debut, s.fin)),
    meps: misesEnProductionDe(donnees.misesEnProduction, [p]).filter(m => dansPeriode(per, m.jour, m.jour))
  })).filter(x => x.sprints.length || x.meps.length);
  return (
    <>
      <div className="ligne-flex entre encart-compact">
        <div className="ligne-flex">
          <Bouton onClick={() => setChoisi(null)}>Aujourd’hui</Bouton>
          <Bouton aria-label="Période précédente" onClick={() => setChoisi(decalerDebut(debut, -1))}>‹</Bouton>
          <b>{libelleMois(...anneeMois(per.debut))} → {libelleMois(...anneeMois(per.fin))}</b>
          <Bouton aria-label="Période suivante" onClick={() => setChoisi(decalerDebut(debut, 1))}>›</Bouton>
        </div>
        <span className="discret texte-12">Sprints et MEP : saisis dans Mon dashboard › Projets et Roadmap</span>
      </div>
      <Carte classe="planning-projet">
        <div className="gantt-mois">
          <div className="libelle gantt-titre-col">Projet</div>
          <div className="mois">{per.mois.map(m => <div key={m.libelle} style={{ width: `${m.largeur}%` }}>{m.libelle}</div>)}</div>
        </div>
        {lignes.length === 0 && <Vide texte="Aucun sprint ni mise en production sur cette période." />}
        {lignes.map(({ p, sprints, meps }) => (
          <div key={p.id} className="gantt-ligne">
            <div><div>{p.nom}</div></div>
            <div className="gantt-piste">
              {jour >= per.debut && jour <= per.fin && <div className="gantt-jour" style={{ left: `${per.position(jour)}%` }} />}
              {sprints.map(s => <BlocSprint key={s.numero} s={s} per={per} jour={jour} />)}
              {meps.map(m => <RepereMep key={m.id ?? m.jour} m={m} per={per} />)}
            </div>
          </div>
        ))}
      </Carte>
      <div className="discret texte-12">
        <span className="couleur-primaire">—</span> Aujourd’hui · S… : sprint (en bleu : en cours) · ▲ : mise en production (bleu prévue, vert faite, orange reportée) · survol : détail
      </div>
    </>
  );
}
