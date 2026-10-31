/* ============================================================
   Mon dashboard › Gestion des ressources › Congés (maquette 08-mCong.png ; portage de app/js/ecrans/conges.js — phase 5, vague C)
   Onglets (porteur, 2026-09-25) :
   - Grille mensuelle : choisir un type d'absence (« pinceau ») et une durée (journée / demi-journée), puis cliquer sur les jours pour
     l'appliquer ou le retirer ;
   - Récap annuel : jours travaillés / congés par mois et reste à prendre par rapport aux jours attendus par le client (par équipe et par année).
   Périmètre (porteur, 2026-10-31) : quel que soit le rôle, sauf Administrateur, Mon dashboard › Congés n'affiche et ne permet de saisir que SES congés
   (les congés des autres se consultent dans Suivi de mes équipes › Gestion des ressources). Règle RLS en base ; l'écran masque le reste.
   ============================================================ */
import { useState } from 'react';
import { Aide } from '../composants/Aide';
import { Avatar, Pastille } from '../composants/Badge';
import { Bouton } from '../composants/Bouton';
import { CalendrierAbsences } from '../composants/CalendrierAbsences';
import { AucunOnglet, Carte, EnteteEcran, Vide } from '../composants/Carte';
import { Icone } from '../composants/Icone';
import { Onglets } from '../composants/Onglets';
import { creer, supprimer } from '../donnees/api';
import { useSession } from '../donnees/SessionProvider';
import type { Donnees } from '../donnees/tables';
import { joursDuMois, estWeekend, aujourdhui, depuisIso, nombre } from '../domaine/dates';
import { ABSENCES, COULEURS } from '../domaine/config';
import { teinte } from '../domaine/couleurs';
import { aDroit, maRessource, ongletPermis } from '../domaine/droits';
import { modeleRecap } from '../domaine/recap';
import type { ElementRecap } from '../domaine/recap';
import { valeursDe } from '../domaine/referentiels';
import { actionAbsence, objectifValide } from '../domaine/saisies';
import { AIDES } from '../domaine/textes';
import { absenceDe, unitesRacines } from '../domaine/vues';

const MOIS = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];

/** Reste à prendre : vert = jours de congé encore disponibles, rouge = jours pris en trop */
const Reste = ({ v }: { v: number }) => <b className={v < 0 ? 'reste-negatif' : 'reste-positif'}>{v > 0 ? '+' : ''}{nombre(v)}</b>;

/** Récap annuel : jours travaillés / congés / reste à prendre, par unité et par personne */
function RecapAnnuel({ vue: donnees, annee, onAnnee }: { vue: Donnees; annee: number; onAnnee: (a: number) => void }) {
  const { ctx, executer, notifier } = useSession();
  if (!ctx) return null;
  const feries = new Set(donnees.joursFeries.map(j => j.jour));
  const ouvres = MOIS.map((_, m) => joursDuMois(annee, m).filter(j => !estWeekend(j)).length);
  const lignes: ElementRecap[] = unitesRacines(donnees.equipes).flatMap(e => modeleRecap(ctx, donnees, annee, feries, e));
  const colonnes = MOIS.length * 2 + 4;

  // Objectif client d'une équipe pour l'année (upsert sur la clé équipe + année)
  async function majObjectif(equipeId: string, valeur: string) {
    const jours = Number(valeur);
    if (!objectifValide(jours)) return notifier('Nombre de jours invalide', 'erreur');
    await executer(() => creer('objectifs_jours_travail', { equipeId, annee, jours }, 'equipe_id,annee'), 'objectifsTravail');
  }

  return (
    <Carte>
      <div className="carte-titre">
        <div className="ligne-flex">
          <Bouton onClick={() => onAnnee(depuisIso(aujourdhui()).getFullYear())}>Aujourd’hui</Bouton>
          <Bouton aria-label="Année précédente" onClick={() => onAnnee(annee - 1)}>‹</Bouton>
          <b style={{ minWidth: 60, textAlign: 'center' }}>{annee}</b>
          <Bouton aria-label="Année suivante" onClick={() => onAnnee(annee + 1)}>›</Bouton>
          <h2 style={{ marginLeft: 14 }}>Jours travaillés et congés <Aide texte={AIDES.recapTravail} /></h2>
        </div>
      </div>
      <div className="defilement">
        <table className="recap-travail">
          <thead>
            <tr>
              <th className="nom" rowSpan={2}>Personne</th>
              {MOIS.map(m => <th key={m} colSpan={2}>{m}</th>)}
              <th rowSpan={2}>Total<br />travaillé</th><th rowSpan={2}>Total<br />congés</th><th rowSpan={2}>Reste à<br />prendre</th>
            </tr>
            <tr>{MOIS.map(m => <FragmentTC key={m} />)}</tr>
            <tr>
              <td className="nom discret">Jours de semaine du mois</td>
              {ouvres.map((v, i) => <td key={i} colSpan={2} className="discret">{v}</td>)}
              <td className="discret">{ouvres.reduce((a, b) => a + b, 0)}</td><td /><td />
            </tr>
          </thead>
          <tbody>
            {lignes.length === 0 && <tr><td colSpan={colonnes}><Vide texte="Aucune ressource." /></td></tr>}
            {lignes.map(el => {
              if (el.genre === 'unite') {
                return (
                  <tr key={'u' + el.equipe.id} className="groupe">
                    <td colSpan={colonnes}>
                      <span className="ligne-flex" style={{ paddingLeft: el.niveau * 16 }}>
                        <Icone nom={el.equipe.type === 'direction' ? 'direction' : 'equipe'} taille={14} /><Pastille couleur={el.equipe.couleur ?? COULEURS.pale} />{el.equipe.nom}
                        <span className="discret" style={{ fontWeight: 400, marginLeft: 14 }}>Jours attendus par le client</span>
                        {el.modifiable
                          ? <input key={el.objectif} type="number" min={1} max={366} step={0.5} className="champ objectif-client" defaultValue={el.objectif} aria-label={`Objectif ${el.equipe.nom}`}
                            onBlur={e => { if (Number(e.target.value) !== el.objectif) void majObjectif(el.equipe.id, e.target.value); }} />
                          : <b>{nombre(el.objectif)}</b>}
                        <span className="discret poids-normal">jours / personne</span><Aide texte={AIDES.objectifClient} />
                      </span>
                    </td>
                  </tr>
                );
              }
              if (el.genre === 'total') {
                return (
                  <tr key={'t' + el.equipe.id} className="total">
                    <td className="nom" style={{ paddingLeft: (el.niveau + 1) * 16 + 12 }}>Total {el.equipe.nom}</td>
                    {el.mois.map((m, i) => <FragmentMois key={i} travailles={m.travailles} conges={m.conges} />)}
                    <td className="tot">{nombre(el.travailles)}</td><td className="tot conge">{nombre(el.conges)}</td><td className="tot" />
                  </tr>
                );
              }
              const rc = el.recap;
              return (
                <tr key={'p' + el.ressource.id}>
                  <td className="nom">
                    <span className="ligne-flex" style={{ paddingLeft: el.niveau * 16 }}>
                      <Avatar nom={el.ressource.nom} />{el.ressource.nom}
                      {el.mentions.map(m => <span key={m} className="discret texte-11">{m}</span>)}
                    </span>
                  </td>
                  {rc.mois.map((m, i) => (m.ouvres
                    ? <FragmentMois key={i} travailles={m.travailles} conges={m.conges} vide />
                    : <FragmentHors key={i} />))}
                  <td className="tot">{nombre(rc.travailles)}</td>
                  <td className="tot conge">{nombre(rc.conges)}</td>
                  <td className="tot">
                    <Reste v={rc.reste} />
                    {rc.objectif !== el.objectifUnite && <div className="discret" style={{ fontSize: 10, fontWeight: 400 }}>sur {nombre(rc.objectif)} j</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Carte>
  );
}

/** Deux cellules T (jours travaillés) et C (congés) d'un mois ; « vide » = congés à zéro affichés « · » */
function FragmentMois({ travailles, conges, vide = false }: { travailles: number; conges: number; vide?: boolean }) {
  return <><td>{nombre(travailles)}</td><td className="conge">{conges || !vide ? nombre(conges) : '·'}</td></>;
}
const FragmentHors = () => <><td className="pale">—</td><td className="conge pale">—</td></>;
const FragmentTC = () => <><th>T</th><th className="conge">C</th></>;

export function Conges() {
  const { ctx, donnees, executer } = useSession();
  const j = depuisIso(aujourdhui());
  const [mois, setMois] = useState({ annee: j.getFullYear(), mois: j.getMonth() });
  const [choix, setChoix] = useState('grille');
  const [pinceau, setPinceau] = useState<string>(ABSENCES.CP);
  const [duree, setDuree] = useState(1);
  if (!ctx || !donnees) return null;

  const liste = [{ id: 'grille', libelle: 'Grille mensuelle' }, { id: 'recap', libelle: `Récap annuel ${mois.annee}` }].filter(o => ongletPermis(ctx, 'conges', o.id));
  const onglet = (liste.find(o => o.id === choix) ?? liste[0])?.id;
  if (!onglet) return <div className="ecran"><EnteteEcran titre="Congés" /><AucunOnglet /></div>;
  const moi = maRessource(ctx);
  /* Hors administrateur, seule ma fiche est affichée (grille et récap) ; sans fiche reliée, rien à restreindre ni à saisir */
  const soiSeul = !ctx.estAdmin && !!moi;
  const vue = soiSeul ? { ...donnees, ressources: donnees.ressources.filter(r => r.id === moi?.id), projets: [] } : donnees;

  /* Une case est modifiable : sur ma ligne, si mon rôle a le droit « Mon dashboard » ou l'onglet Grille mensuelle (la Direction n'a que ce dernier) ;
     sur celle des autres, seulement pour l'administrateur (droit « congés des autres ») */
  const modifiable = (ressourceId: string) => (ressourceId === moi?.id
    ? aDroit(ctx, 'mon_dashboard') || aDroit(ctx, 'onglet_conges_grille')
    : ctx.estAdmin && aDroit(ctx, 'conges_equipe'));

  /* Clic sur un jour : pose le type et la durée choisis (journée ou demi-journée) ; retire l'absence si elle a déjà ce type et cette durée
     (ou avec « Effacer ») ; même type mais autre durée : la durée est changée */
  async function basculer(ressourceId: string, jour: string) {
    if (!donnees) return;
    const existante = absenceDe(donnees.absences, ressourceId, jour);
    const action = actionAbsence(existante, pinceau, duree);
    if (action === 'rien') return;
    await executer(() => (action === 'supprimer'
      ? supprimer('absences', { ressource_id: 'eq.' + ressourceId, jour: 'eq.' + jour })
      : creer('absences', { ressourceId, jour, type: pinceau, duree }, 'ressource_id,jour')), 'absences');
  }

  const pinceaux = [...valeursDe(donnees.valeurs, 'abs').map(t => ({ id: t.libelle, libelle: t.libelle, couleur: t.couleur })),
    { id: 'effacer', libelle: 'Effacer', couleur: COULEURS.effacer }];
  const choixPinceau = (
    <div className="puces">
      {pinceaux.map(p => (
        <button key={p.id} type="button" className={'puce' + (p.id === pinceau ? ' active' : '')} onClick={() => setPinceau(p.id)}>
          <span className="pastille" style={{ background: teinte(p.couleur, 0.2), border: `1px solid ${p.couleur}` }} />{p.libelle}
        </button>
      ))}
      <span className="separateur-puces" />
      {([[1, 'Journée'], [0.5, 'Demi-journée']] as const).map(([valeur, libelle]) => (
        <button key={valeur} type="button" className={'puce' + (valeur === duree ? ' active' : '')} onClick={() => setDuree(valeur)}>{libelle}</button>
      ))}
      <Aide texte={AIDES.pinceau} />
    </div>
  );

  return (
    <div className="ecran">
      <EnteteEcran titre="Congés" sousTitre={onglet === 'grille' ? 'Choisissez un type d’absence puis cliquez sur les jours pour l’appliquer ou le retirer' : 'Absences et récapitulatif annuel'} />
      <Onglets liste={liste} actif={onglet} onChoisir={setChoix} />
      {onglet === 'recap'
        ? <RecapAnnuel vue={vue} annee={mois.annee} onAnnee={annee => setMois(m => ({ ...m, annee }))} />
        : (
          <CalendrierAbsences ctx={ctx} donnees={vue} soiSeul={soiSeul} mois={mois} onMois={setMois} editable modifiable={modifiable}
            onBasculer={(r, jour) => void basculer(r, jour)} droite={choixPinceau} />
        )}
    </div>
  );
}
