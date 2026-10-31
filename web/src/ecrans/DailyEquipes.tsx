/* ============================================================
   Suivi de mes équipes › Daily des équipes (maquettes docs/maquettes/daily-equipes-design/retenu/, 2026-10-15 ; portage de
   app/js/ecrans/daily-equipes.js — phase 5, vague B)
   Semaine choisie (lundi → vendredi ouvrés), projets dont je peux lire le daily (même règle qu'en base). Lecture seule.
   - Onglet « Fil des dailys » : les dailys du plus récent au plus ancien, groupés par jour ; filtres projets / personnes à gauche ;
     blocages ouverts et résumé du jour à droite.
   - Onglet « Synthèse de l'équipe » (droit « onglet_daily_synthese ») : chiffres clés, carte membre × jour (✓ daily, ⚠ blocage, — manquant,
     🌴 absent) ; un clic ouvre le daily à droite.
   Les calculs sont dans domaine/dailyEquipes.ts ; export Excel : ExportDailyModale.
   ============================================================ */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ExportDailyModale } from './daily/ExportDailyModale';
import { Avatar } from '../composants/Badge';
import { Bouton } from '../composants/Bouton';
import { AucunOnglet, Carte, EnteteEcran, Kpi, Vide } from '../composants/Carte';
import { Onglets } from '../composants/Onglets';
import { useSession } from '../donnees/SessionProvider';
import { JOURS_DAILY } from '../donnees/tables';
import { blocagesDaily, estRubriqueBlocages, rubriquesDaily } from '../domaine/daily';
import { blocagesOuverts, entreesDaily, etatCase, jourDuResume, joursSemaine, personnesDaily, syntheseSemaine } from '../domaine/dailyEquipes';
import type { DonneesDaily, EntreeDaily, EtatCase } from '../domaine/dailyEquipes';
import { aujourdhui, ajouterJours, formatAvecAnnee, formatCourt, formatLong, lundi } from '../domaine/dates';
import { ongletPermis } from '../domaine/droits';
import type { Iso, NoteDaily, Projet, Ressource } from '../domaine/types';
import { decalerJourOuvre, noteNonVide, projetsDailyVisibles } from '../domaine/vues';

const SYMBOLES: Record<EtatCase, string> = { ok: '✓', bloc: '⚠', manque: '—', abs: '🌴', avenir: '', hors: '' };
const CLASSES: Record<EtatCase, string> = { ok: 'case-ok', bloc: 'case-bloc', manque: 'case-manque', abs: 'case-abs', avenir: '', hors: '' };
const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];

/** Note complète (rubriques en gras, « Blocages » en rouge sauf « Aucun ») : panneau de lecture de la Synthèse */
function NoteComplete({ texte }: { texte: string }) {
  return (
    <>
      {rubriquesDaily(texte).map((r, i) => {
        const classe = estRubriqueBlocages(r.titre) && blocagesDaily(texte).length ? 'texte-danger' : undefined;
        return (
          <span key={i}>
            {r.titre && <><b className={classe}>{r.titre}</b><br /></>}
            {r.lignes.map((l, k) => <span key={k} className={classe}>• {l}<br /></span>)}
          </span>
        );
      })}
    </>
  );
}

/** Un daily du fil : qui, projet, heure d'enregistrement, ses rubriques, puis ses blocages en pastilles rouges */
function EntreeFil({ e }: { e: EntreeDaily }) {
  const heure = e.note.modifieLe ? new Date(e.note.modifieLe).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
  const rubriques = rubriquesDaily(e.note.texte).filter(x => !estRubriqueBlocages(x.titre));
  return (
    <div className="fil-entree">
      <Avatar nom={e.ressource.nom} />
      <div className="extensible">
        <div className="ligne-flex"><b>{e.ressource.nom}</b><span className="etiquette">{e.projet.nom}</span><span className="pale texte-12">{heure}</span></div>
        <div className="fil-texte">
          {rubriques.map((x, i) => <span key={i}>{x.titre && <><b>{x.titre}</b><br /></>}{x.lignes.map((l, k) => <span key={k}>• {l}<br /></span>)}</span>)}
        </div>
        {blocagesDaily(e.note.texte).map(b => <span key={b} className="pastille-blocage">⚠ {b}</span>)}
      </div>
    </div>
  );
}

export function DailyEquipes() {
  const { ctx, donnees, rechargerTables } = useSession();
  const [jour, setJour] = useState<Iso>(aujourdhui());
  const [projetFiltre, setProjetFiltre] = useState('tous');
  const [personneFiltre, setPersonneFiltre] = useState('tous');
  const [choix, setChoix] = useState('fil');
  const [caseChoisie, setCaseChoisie] = useState<{ ressource: string; jour: Iso } | null>(null);
  const [export_, setExport] = useState(false);
  // Les notes du daily changent chaque jour : relues à l'ouverture de l'écran
  useEffect(() => { void rechargerTables('notesProjet').catch(() => undefined); }, [rechargerTables]);
  if (!ctx || !donnees) return null;

  const d: DonneesDaily = donnees;
  const feries = new Set(donnees.joursFeries.map(j => j.jour));
  const jours = joursSemaine(jour, feries);
  const debut = lundi(jour);
  const visibles = projetsDailyVisibles(ctx, donnees.projets);
  const projets = visibles.filter(p => projetFiltre === 'tous' || p.id === projetFiltre);
  const aujourd = aujourdhui();
  const noteDe = (r: Ressource, p: Projet, j: Iso): NoteDaily | null => noteNonVide(donnees.notesProjet, r, p.id, j);

  const entete = (
    <EnteteEcran titre="Daily des équipes" sousTitre="Daily de la semaine des membres de vos projets · lecture seule"
      actions={(
        <>
          {visibles.length > 0 && <Bouton variante="primaire" onClick={() => setExport(true)}>⬇ Exporter en Excel</Bouton>}
          <Bouton onClick={() => { setJour(aujourd); setCaseChoisie(null); }}>Cette semaine</Bouton>
          <Bouton title="Semaine précédente" aria-label="Semaine précédente" onClick={() => { setJour(ajouterJours(jour, -7)); setCaseChoisie(null); }}>‹</Bouton>
          <b className="libelle-semaine">Semaine du {formatCourt(debut)} au {formatAvecAnnee(ajouterJours(debut, 4))}</b>
          <Bouton title="Semaine suivante" aria-label="Semaine suivante" onClick={() => { setJour(ajouterJours(jour, 7)); setCaseChoisie(null); }}>›</Bouton>
        </>
      )} />
  );
  if (!visibles.length) return <div className="ecran">{entete}<Carte><Vide texte="Aucun projet en cours dont vous pouvez lire le daily." /></Carte></div>;

  // Onglets selon leur droit (matrice, migration 038) ; la barre n'apparaît que s'il y a le choix
  const liste = [{ id: 'fil', libelle: 'Fil des dailys' }, { id: 'synthese', libelle: 'Synthèse de l’équipe' }].filter(o => ongletPermis(ctx, 'dailyEquipes', o.id));
  const onglet = (liste.find(o => o.id === choix) ?? liste[0])?.id;
  if (!onglet) return <div className="ecran">{entete}<AucunOnglet /></div>;

  const fil = () => {
    const entrees = entreesDaily(d, projets, jours, personneFiltre);
    const nbProjet = (id: string) => entreesDaily(d, visibles.filter(p => id === 'tous' || p.id === id), jours).length;
    const nbPersonne = (id: string) => entreesDaily(d, projets, jours).filter(e => id === 'tous' || e.ressource.id === id).length;
    const ligne = (id: string, nom: string, n: number, actif: boolean, choisir: () => void) => (
      <a key={id} className={'filtre-fil' + (actif ? ' actif' : '')} onClick={choisir} role="button" tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter') choisir(); }}>{nom}<span>{n}</span></a>
    );
    const parJour = [...new Set(entrees.map(e => e.jour))];
    const ouverts = blocagesOuverts(d, projets, jours, aujourd);
    const jourResume = jourDuResume(jours, aujourd);
    const etats = jourResume ? personnesDaily(d, projets, [jourResume]).map(r => ({ r, etat: etatCase(d, r, projets, jourResume, aujourd) })) : [];
    const noms = (e: EtatCase) => etats.filter(x => x.etat === e).map(x => x.r.nom).join(', ');
    const nbOk = etats.filter(x => ['ok', 'bloc'].includes(x.etat)).length;
    return (
      <div className="grille-fil">
        <Carte classe="filtres-fil">
          <div className="libelle-filtres">Projets</div>
          {ligne('tous', 'Tous', nbProjet('tous'), projetFiltre === 'tous', () => { setProjetFiltre('tous'); setPersonneFiltre('tous'); setCaseChoisie(null); })}
          {visibles.map(p => ligne(p.id, p.nom, nbProjet(p.id), projetFiltre === p.id, () => { setProjetFiltre(p.id); setPersonneFiltre('tous'); setCaseChoisie(null); }))}
          <div className="libelle-filtres">Personnes</div>
          {ligne('tous-p', 'Toutes', nbPersonne('tous'), personneFiltre === 'tous', () => setPersonneFiltre('tous'))}
          {personnesDaily(d, projets, jours).map(r => ligne(r.id, r.nom, nbPersonne(r.id), personneFiltre === r.id, () => setPersonneFiltre(r.id)))}
        </Carte>
        <div>
          {parJour.length === 0 && <Carte><Vide texte="Aucun daily cette semaine pour ces filtres." /></Carte>}
          {parJour.map(j => (
            <Carte key={j} classe="fil-jour">
              <div className="fil-jour-titre">{formatLong(j)}</div>
              {entrees.filter(e => e.jour === j).map(e => <EntreeFil key={e.projet.id + e.ressource.id + j} e={e} />)}
            </Carte>
          ))}
        </div>
        <div>
          <Carte classe="encart-blocages bloc-droite">
            <b className="texte-danger">Blocages ouverts · {ouverts.length}</b>
            {ouverts.map((o, i) => (
              <div key={i} className="ligne-flex ligne-droite"><Avatar nom={o.ressource.nom} /><span className="extensible">{o.texte}</span>
                <span className="pale texte-12">{o.age > 0 ? o.age + ' j' : 'auj.'}</span></div>
            ))}
            {ouverts.length === 0 && <div className="pale texte-12">Aucun blocage.</div>}
          </Carte>
          {jourResume && (
            <Carte classe="bloc-droite">
              <b>{jourResume === aujourd ? 'Aujourd’hui' : formatLong(jourResume)}</b>
              <div className="ligne-droite">✅ {nbOk} daily{nbOk > 1 ? 's' : ''} renseigné{nbOk > 1 ? 's' : ''}</div>
              {noms('abs') && <div className="ligne-droite">🌴 Absent(e) : {noms('abs')}</div>}
              {noms('manque') && <div className="ligne-droite">⏳ Pas encore de daily : {noms('manque')}</div>}
            </Carte>
          )}
        </div>
      </div>
    );
  };

  // Panneau de lecture : jour ouvré précédent / suivant (la semaine affichée suit)
  const decaler = (c: { ressource: string; jour: Iso }, sens: number) => {
    const j = decalerJourOuvre(c.jour, sens);
    setJour(j);
    setCaseChoisie({ ...c, jour: j });
  };

  const synthese = () => {
    const s = syntheseSemaine(d, projets, jours, aujourd);
    const r = caseChoisie ? donnees.ressources.find(x => x.id === caseChoisie.ressource) : undefined;
    const notes = r && caseChoisie ? projets.map(p => ({ p, n: noteDe(r, p, caseChoisie.jour) })).filter(x => x.n) : [];
    return (
      <>
        <div className="grille-kpi q4">
          <Kpi libelle="Dailys renseignés" valeur={`${s.taux} %`} complement={`${s.renseignes} / ${s.attendus} attendus`} />
          <Kpi libelle="Jours avec blocage" valeur={s.compte.bloc} /><Kpi libelle="Dailys manquants" valeur={s.compte.manque} /><Kpi libelle="Jours d’absence" valeur={s.compte.abs} />
        </div>
        <div className="grille-synthese">
          <Carte classe="defilement-x">
            <table className="tableau tableau-synthese">
              <thead>
                <tr><th>Membre</th>{jours.map(j => <th key={j} className="centre">{JOURS_COURTS[(new Date(j).getUTCDay() + 6) % 7]} {formatCourt(j)}</th>)}<th className="num">Taux</th></tr>
              </thead>
              <tbody>
                {s.grille.length === 0 && <tr><td colSpan={jours.length + 2}><Vide texte="Aucun membre cette semaine." /></td></tr>}
                {s.grille.map(({ ressource, etats }) => {
                  const faits = etats.filter(e => e === 'ok' || e === 'bloc').length, attendus = faits + etats.filter(e => e === 'manque').length;
                  return (
                    <tr key={ressource.id}>
                      <td className="nowrap"><span className="ligne-flex"><Avatar nom={ressource.nom} /><b>{ressource.nom}</b></span></td>
                      {etats.map((e, i) => {
                        const actif = caseChoisie?.ressource === ressource.id && caseChoisie.jour === jours[i];
                        const cliquable = e === 'ok' || e === 'bloc';
                        return (
                          <td key={i}>
                            <div className={`case-synthese ${CLASSES[e]}${actif ? ' active' : ''}`} {...(cliquable ? { role: 'button', tabIndex: 0,
                              onClick: () => setCaseChoisie({ ressource: ressource.id, jour: jours[i] ?? jour }) } : {})}>{SYMBOLES[e]}</div>
                          </td>
                        );
                      })}
                      <td className="num"><b>{faits}/{attendus}</b></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="discret texte-12 legende-synthese">✓ daily · ⚠ blocage signalé · — manquant · 🌴 absent · case vide : à venir ou hors présence</div>
          </Carte>
          {!r || !caseChoisie
            ? <Carte classe="panneau-lecture"><Vide texte="Cliquez sur une case ✓ ou ⚠ pour lire le daily." /></Carte>
            : (
              <Carte classe="panneau-lecture actif">
                <div className="ligne-flex">
                  <Avatar nom={r.nom} />
                  <div className="extensible"><b>{r.nom}</b><div className="discret texte-12">{formatLong(caseChoisie.jour)}</div></div>
                  <button type="button" className="lien-btn" title="Fermer" aria-label="Fermer le daily" onClick={() => setCaseChoisie(null)}>✕</button>
                </div>
                {notes.map(x => (
                  <div key={x.p.id} className="lecture-note"><span className="etiquette">{x.p.nom}</span><div className="fil-texte"><NoteComplete texte={x.n?.texte ?? ''} /></div></div>
                ))}
                {notes.length === 0 && <Vide texte="Pas de daily ce jour-là." />}
                <div className="ligne-flex">
                  <Bouton onClick={() => decaler(caseChoisie, -1)}>‹ Jour précédent</Bouton>
                  <Bouton onClick={() => decaler(caseChoisie, 1)}>Jour suivant ›</Bouton>
                </div>
              </Carte>
            )}
        </div>
      </>
    );
  };

  const corps: ReactNode = onglet === 'synthese' ? synthese() : fil();
  return (
    <div className="ecran">
      {entete}
      {liste.length > 1 && <Onglets liste={liste} actif={onglet} onChoisir={setChoix} />}
      {corps}
      <div className="discret texte-12">
        Notes conservées à l’affichage sur {JOURS_DAILY} jours (au-delà : export Excel). Vous voyez le daily de vos projets ;
        le responsable d’une unité voit tous les projets de son unité.
      </div>
      {export_ && <ExportDailyModale projets={visibles} projetsCoches={projets.map(p => p.id)} onFermer={() => setExport(false)} />}
    </div>
  );
}
