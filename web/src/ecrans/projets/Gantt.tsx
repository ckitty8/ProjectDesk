/* ============================================================
   Gantt de Vue d’ensemble › Projet (onglet Gantt ; porteur 2026-11-02, maquette menu-projet-gantt/ ; évolution du planning projet 2.38)
   Une ligne par projet, groupée par équipe : les sprints en barres (dates exactes, le sprint en cours en bleu) et les mises en production
   (MEP) en losanges + version, de la couleur de leur statut (STATUTS_MEP). Trait vertical = aujourd'hui, détail au survol, clic sur un projet =
   son panneau en lecture. Zoom semaine / mois / trimestre, période décalable, filtre par projet. Lecture seule : la saisie des sprints et des
   MEP se fait dans Mon dashboard › Projet. Calculs de période : domaine/planning.ts.
   ============================================================ */
import { useState } from 'react';
import { Bouton } from '../../composants/Bouton';
import { Pastille } from '../../composants/Badge';
import { Carte, Vide } from '../../composants/Carte';
import { Liste } from '../../composants/Liste';
import { useSession } from '../../donnees/SessionProvider';
import { COULEURS, STATUTS_MEP, TONS } from '../../domaine/config';
import { aujourdhui, formatAvecAnnee, formatCourt } from '../../domaine/dates';
import { barreSprint, dansPeriode, debutParDefaut, decalerDebut, periodePlanning, ZOOMS } from '../../domaine/planning';
import type { PeriodePlanning, ZoomGantt } from '../../domaine/planning';
import type { Equipe, Projet } from '../../domaine/types';
import { misesEnProductionDe, sprintsDuProjet } from '../../domaine/vues';
import type { MepDatee, SprintDatee } from '../../domaine/vues';

/** Barre d'un sprint : « S » + numéro (+ version), sprint en cours en bleu, dates exactes en infobulle */
function BarreSprint({ s, per, jour }: { s: SprintDatee; per: PeriodePlanning; jour: string }) {
  const { gauche, largeur } = barreSprint(per, s.debut, s.fin), numero = s.numeroSprint || s.numero;
  const titre = `Sprint ${numero}${s.nom ? ' · ' + s.nom : ''} : ${formatCourt(s.debut)} → ${formatCourt(s.fin)}`;
  return (
    <div className={'gantt-sprint' + (s.debut <= jour && jour <= s.fin ? ' en-cours' : '')} style={{ left: `${gauche}%`, width: `${largeur}%` }} title={titre}>
      S{numero}{s.nom ? ` · ${s.nom}` : ''}
    </div>
  );
}

/** Mise en production : losange + version à sa date, couleur de son statut, détail (tickets livrés) en infobulle */
function LosangeMep({ m, per }: { m: MepDatee; per: PeriodePlanning }) {
  const statut = STATUTS_MEP.find(x => x.valeur === m.statut) ?? STATUTS_MEP[0];
  if (!statut) return null;
  // Tickets livrés (migration 044) : « 5 US · 3 bugs · 1 incidents », vide si aucun
  const tickets = m.nbBugs || m.nbIncidents || m.nbUs ? ` : ${m.nbUs || 0} US · ${m.nbBugs || 0} bugs · ${m.nbIncidents || 0} incidents` : '';
  const titre = `MEP ${m.version || ''} · ${formatCourt(m.jour)} · ${statut.libelle}${tickets}`;
  return <div className="gantt-mep" style={{ left: `${per.position(m.jour)}%`, color: TONS[statut.ton].texte }} title={titre}><i className="losange" />{m.version || 'MEP'}</div>;
}

interface PropsLigne { p: Projet; per: PeriodePlanning; jour: string; onOuvrir: (projetId: string) => void }

/** Ligne d'un projet : son nom (clic = panneau), puis sur la piste l'échelle, aujourd'hui, ses sprints et ses MEP de la période */
function LigneGantt({ p, per, jour, onOuvrir }: PropsLigne) {
  const { donnees } = useSession();
  if (!donnees) return null;
  const sprints = sprintsDuProjet(donnees.sprintsProjet, p.id).filter(s => dansPeriode(per, s.debut, s.fin));
  const meps = misesEnProductionDe(donnees.misesEnProduction, [p]).filter(m => dansPeriode(per, m.jour, m.jour));
  return (
    <div className="gantt-ligne">
      <div><button type="button" className="lien-btn gantt-projet" onClick={() => onOuvrir(p.id)}>{p.nom}</button></div>
      <div className="gantt-piste">
        {per.graduations.map(g => <div key={g.libelle + g.gauche} className="gantt-trait" style={{ left: `${g.gauche}%` }} />)}
        {jour >= per.debut && jour <= per.fin && <div className="gantt-jour" style={{ left: `${per.position(jour)}%` }} />}
        {sprints.map(s => <BarreSprint key={s.numero} s={s} per={per} jour={jour} />)}
        {meps.map(m => <LosangeMep key={m.id ?? m.jour} m={m} per={per} />)}
      </div>
    </div>
  );
}

interface PropsGantt { projets: readonly Projet[]; equipes: readonly Equipe[]; onOuvrir: (projetId: string) => void }

/** Onglet Gantt : barre d'outils (période, zoom, filtre projet), puis les projets groupés par équipe, une ligne chacun */
export function Gantt({ projets, equipes, onOuvrir }: PropsGantt) {
  const { donnees } = useSession();
  const [zoom, setZoom] = useState<ZoomGantt>('mois');
  const [choisi, setChoisi] = useState<string | null>(null);
  const [projetId, setProjetId] = useState('tous');
  if (!donnees) return null;
  const jour = aujourdhui();
  const debut = choisi ?? debutParDefaut(jour, zoom);
  const per = periodePlanning(debut, zoom);
  const visibles = projets.filter(p => projetId === 'tous' || p.id === projetId);
  const groupes = equipes.map(e => ({ e, siens: visibles.filter(p => p.equipeId === e.id) })).filter(g => g.siens.length);
  const changerZoom = (z: ZoomGantt) => { setZoom(z); setChoisi(null); };

  return (
    <>
      <div className="ligne-flex entre encart-compact">
        <div className="ligne-flex">
          <Bouton onClick={() => setChoisi(null)}>Aujourd’hui</Bouton>
          <Bouton aria-label="Période précédente" onClick={() => setChoisi(decalerDebut(debut, -1, zoom))}>‹</Bouton>
          <b>{formatAvecAnnee(per.debut)} → {formatAvecAnnee(per.fin)}</b>
          <Bouton aria-label="Période suivante" onClick={() => setChoisi(decalerDebut(debut, 1, zoom))}>›</Bouton>
        </div>
        <div className="ligne-flex">
          <div className="puces" role="group" aria-label="Zoom">
            {ZOOMS.map(z => <button key={z.valeur} type="button" className={'puce' + (zoom === z.valeur ? ' active' : '')} onClick={() => changerZoom(z.valeur)}>{z.libelle}</button>)}
          </div>
          <Liste className="champ champ-compact" aria-label="Projet" valeur={projetId} onChoisir={setProjetId}
            options={[{ valeur: 'tous', libelle: 'Tous les projets' }, ...projets.map(p => ({ valeur: p.id, libelle: p.nom }))]} />
        </div>
      </div>
      <Carte classe="gantt-carte">
        <div className="gantt-mois">
          <div className="libelle gantt-titre-col">Projet</div>
          <div className="mois">{per.graduations.map(g => <div key={g.libelle + g.gauche} style={{ width: `${g.largeur}%` }}>{g.libelle}</div>)}</div>
        </div>
        {groupes.length === 0 && <Vide texte="Aucun projet à afficher." />}
        {groupes.map(({ e, siens }) => (
          <div key={e.id}>
            <div className="gantt-groupe"><span className="ligne-flex"><Pastille couleur={e.couleur ?? COULEURS.pale} />{e.nom}<span className="discret poids-normal">{siens.length} projets</span></span></div>
            {siens.map(p => <LigneGantt key={p.id} p={p} per={per} jour={jour} onOuvrir={onOuvrir} />)}
          </div>
        ))}
      </Carte>
      <div className="discret texte-12">
        <span className="couleur-primaire">—</span> Aujourd’hui · barre : sprint (en bleu : en cours) · ◆ : mise en production (bleu prévue, vert faite, orange reportée) · survol : détail ·
        sprints et MEP : saisis dans Mon dashboard › Projet
      </div>
    </>
  );
}
