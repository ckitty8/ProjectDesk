/* ============================================================
   Mon dashboard › Daily — un daily PAR PROJET (maquette docs/maquettes/daily-par-projet/ ; portage de app/js/ecrans/daily.js — phase 5, vague C)
   - Une carte par projet où je suis affecté(e) (Chef de projet, Membre ; projet en cours), trois champs : Hier (la veille), Aujourd'hui,
     Blocages ; enregistrement automatique (800 ms après la dernière frappe). Stockage : notes_daily_projet (migration 018), un texte par
     projet et par jour au format des rubriques (decouperDaily / composerDaily).
   - Lien avec les congés : un jour d'absence d'une journée, aucun daily n'est attendu (cartes repliées) ; une demi-journée laisse la saisie ouverte.
   - Aide à la saisie : « Hier » rappelle l'« Aujourd'hui » noté le jour ouvré précédent.
   ============================================================ */
import { useEffect, useRef, useState } from 'react';
import { Aide } from '../composants/Aide';
import { Badge, BadgeTon } from '../composants/Badge';
import { Bouton } from '../composants/Bouton';
import { Carte, EnteteEcran, Vide } from '../composants/Carte';
import { CompteSansFiche } from '../composants/CompteSansFiche';
import { creer } from '../donnees/api';
import { useSession } from '../donnees/SessionProvider';
import { composerDaily, decouperDaily } from '../domaine/daily';
import { aujourdhui, formatLong } from '../domaine/dates';
import type { ChampsDaily } from '../domaine/daily';
import { maRessource } from '../domaine/droits';
import { couleurDe } from '../domaine/referentiels';
import { absentToutLeJour, historiqueJours, mesProjetsDaily } from '../domaine/saisies';
import { AIDES } from '../domaine/textes';
import type { Iso, Projet } from '../domaine/types';
import { absenceDe, decalerJourOuvre, noteProjet } from '../domaine/vues';

type Etat = 'attente' | 'enregistrement' | 'enregistre' | { echec: string };

/** Carte d'un projet : état (renseigné / à saisir / absent), rappel de la veille, trois zones de saisie enregistrées automatiquement */
function CarteProjet({ projet, jour, texte, texteVeille, absentJournee, onSaisie }: {
  projet: Projet; jour: Iso; texte: string; texteVeille: string; absentJournee: boolean; onSaisie: (projetId: string, champs: ChampsDaily) => void;
}) {
  const champs = decouperDaily(texte);
  const veille = decouperDaily(texteVeille).aujourdhui.split('\n')[0];
  const rempli = !!(champs.hier.trim() || champs.aujourdhui.trim() || champs.blocages.trim());
  const refs = { hier: useRef<HTMLTextAreaElement>(null), aujourdhui: useRef<HTMLTextAreaElement>(null), blocages: useRef<HTMLTextAreaElement>(null) };
  const etatCarte = absentJournee ? <BadgeTon texte="Absent(e)" ton="neutre" /> : rempli ? <BadgeTon texte="Renseigné" ton="succes" /> : <BadgeTon texte="À saisir" ton="attention" />;
  const entete = <div className="carte-titre"><span className="ligne-flex"><h2 style={{ fontSize: 15 }}>{projet.nom}</h2></span>{etatCarte}</div>;
  if (absentJournee && !rempli) return <Carte>{entete}</Carte>;               // carte repliée un jour d'absence
  // Frappe : on recompose le texte du projet à partir des trois champs, sans nouveau rendu (le curseur reste en place)
  const saisir = () => onSaisie(projet.id, { hier: refs.hier.current?.value ?? '', aujourdhui: refs.aujourdhui.current?.value ?? '', blocages: refs.blocages.current?.value ?? '' });
  const champ = (cle: keyof ChampsDaily, titre: string, aide: string) => (
    <label className="champ-daily" style={{ padding: '8px 0 0' }}>
      <span className="libelle">{titre}</span>
      {/* key = projet + jour : changer de jour recharge le texte ; ensuite la zone reste libre (non contrôlée) */}
      <textarea key={`${projet.id}-${jour}`} ref={refs[cle]} className="note-daily" style={{ minHeight: 62 }} defaultValue={champs[cle]} placeholder={aide} onChange={saisir} />
    </label>
  );
  return (
    <Carte>
      {entete}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 12, padding: '0 16px 14px' }}>
        {champ('hier', 'Hier (la veille)', veille ? `Rappel d’hier : « ${veille} »` : 'Ce que j’ai fait hier…')}
        {champ('aujourdhui', 'Aujourd’hui', 'Ce que je fais aujourd’hui…')}
        {champ('blocages', 'Blocages', 'Ce qui me bloque (vide si rien)…')}
      </div>
    </Carte>
  );
}

export function Daily() {
  const { ctx, donnees, compte, rechargerTables } = useSession();
  const [jour, setJour] = useState<Iso>(aujourdhui());
  const [etat, setEtat] = useState<Etat>('attente');
  const minuteurs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Les notes du daily changent chaque jour : relues à l'ouverture de l'écran
  useEffect(() => { void rechargerTables('notesProjet').catch(() => undefined); }, [rechargerTables]);
  // À la fermeture de l'écran, les enregistrements différés en attente sont annulés (la saisie est déjà partie à chaque pause de 800 ms)
  useEffect(() => { const m = minuteurs.current; return () => Object.values(m).forEach(clearTimeout); }, []);
  if (!ctx || !donnees || !compte) return null;

  const userId = compte.session.user.id;
  const moi = maRessource(ctx);
  const entete = (
    <EnteteEcran titre="Daily" sousTitre="Un daily par projet sur lequel vous êtes affecté(e) · lié à vos congés"
      actions={(
        <>
          <Bouton onClick={() => setJour(aujourdhui())}>Aujourd’hui</Bouton>
          <Bouton title="Jour précédent" aria-label="Jour précédent" onClick={() => setJour(decalerJourOuvre(jour, -1))}>‹</Bouton>
          <Bouton title="Jour suivant" aria-label="Jour suivant" onClick={() => setJour(decalerJourOuvre(jour, 1))}>›</Bouton>
        </>
      )} />
  );
  if (!moi) return <div className="ecran">{entete}<CompteSansFiche /></div>;

  const projets = mesProjetsDaily(ctx, donnees);
  const texteDe = (projetId: string, j: Iso) => noteProjet(donnees.notesProjet, userId, projetId, j)?.texte ?? '';
  // Bilan d'un jour : nombre de projets renseignés, et absence éventuelle (congés)
  const bilan = (j: Iso) => {
    const absence = absenceDe(donnees.absences, moi.id, j);
    return { absence, absentJournee: absentToutLeJour(absence), renseignes: projets.filter(p => texteDe(p.id, j).trim()).length };
  };
  const b = bilan(jour);
  const historique = historiqueJours(aujourdhui());

  // Enregistrement différé par projet : on attend 800 ms sans frappe avant d'écrire en base
  async function enregistrer(projetId: string, j: Iso, texte: string) {
    try {
      // texte vide gardé tel quel (colonne non nulle) : effacer ses notes laisse une ligne vide
      await creer('notes_daily_projet', { userId, jour: j, projetId, texte }, 'user_id,jour,projet_id', ['texte']);
      await rechargerTables('notesProjet');
      setEtat('enregistre');
    } catch (e) { setEtat({ echec: (e as Error).message }); }
  }
  const saisie = (projetId: string, champs: ChampsDaily) => {
    setEtat('enregistrement');
    clearTimeout(minuteurs.current[projetId]);
    minuteurs.current[projetId] = setTimeout(() => void enregistrer(projetId, jour, composerDaily(champs)), 800);
  };

  return (
    <div className="ecran ecran-daily">
      <div className="pile" style={{ gap: 16 }}>
        {entete}
        <Carte classe="encart-compact">
          <div className="ligne-flex entre">
            <span className="ligne-flex"><h2 style={{ fontSize: 16, margin: 0 }}>{formatLong(jour)}</h2>{jour === aujourdhui() && <BadgeTon texte="Aujourd’hui" ton="info" />}</span>
            <span className="ligne-flex">
              <b>{b.absentJournee ? 'Absent(e)' : `${b.renseignes} / ${projets.length} projets renseignés`}</b>
              <span className="discret" role="status">
                · {etat === 'attente' ? 'enregistrement automatique' : etat === 'enregistrement' ? 'enregistrement…'
                  : etat === 'enregistre' ? <><span style={{ color: 'var(--succes)' }}>●</span> enregistré</>
                    : <><span className="texte-danger">●</span> échec : {etat.echec}</>}
              </span>
            </span>
          </div>
        </Carte>
        {b.absence && (
          <Carte classe="encart-compact encart-alerte">
            {b.absentJournee
              ? <>Vous êtes en <b>{b.absence.type}</b> ce jour : aucun daily attendu.</>
              : <>Demi-journée de <b>{b.absence.type}</b> ce jour : la saisie reste ouverte.</>}
          </Carte>
        )}
        {projets.map(p => (
          <CarteProjet key={p.id} projet={p} jour={jour} texte={texteDe(p.id, jour)} texteVeille={texteDe(p.id, decalerJourOuvre(jour, -1))}
            absentJournee={b.absentJournee} onSaisie={saisie} />
        ))}
        {projets.length === 0 && <Carte><Vide texte="Aucun projet en cours : vous n’êtes affecté(e) à aucun projet (hors rôle Lecteur)." /></Carte>}
      </div>
      <Carte classe="historique">
        <div className="carte-titre"><h2>Historique <Aide texte={AIDES.dailyVisibilite} /></h2></div>
        {historique.map(h => {
          const bh = bilan(h);
          return (
            <a key={h} className={h === jour ? 'actif' : ''} onClick={() => setJour(h)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') setJour(h); }}>
              <b>{formatLong(h).split(' ').slice(0, 3).join(' ')}</b>
              <div>
                {bh.absence && bh.absentJournee
                  ? <Badge texte={bh.absence.type ?? ''} couleur={couleurDe(donnees.valeurs, 'abs', bh.absence.type ?? '')} />
                  : <span className={bh.renseignes ? '' : 'pale'}>{bh.renseignes} / {projets.length} projets</span>}
              </div>
            </a>
          );
        })}
      </Carte>
    </div>
  );
}
