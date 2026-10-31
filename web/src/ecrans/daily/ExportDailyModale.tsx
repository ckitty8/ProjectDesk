/* ============================================================
   Fenêtre « Exporter le daily en Excel » (maquette docs/maquettes/export-daily-excel/ ; portage de Modale.exportDaily et de
   telechargerDailyExcel de app/js — phase 5, vague B)
   Période (raccourcis ou dates), projets dont je peux lire le daily, contenu du fichier. Les notes de la période sont lues en base (la base
   ne renvoie que celles que je peux lire), puis le fichier est fabriqué dans le navigateur (domaine/excel.ts).
   ============================================================ */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Bouton } from '../../composants/Bouton';
import { Modale } from '../../composants/Fenetres';
import { lire } from '../../donnees/api';
import { useSession } from '../../donnees/SessionProvider';
import { aujourdhui, ecartJours } from '../../domaine/dates';
import { telecharger } from '../../domaine/excel';
import { feuillesExport, lignesExport, periodeExport } from '../../domaine/exportDaily';
import type { RaccourciPeriode } from '../../domaine/exportDaily';
import type { NoteDaily, Projet } from '../../domaine/types';

const RACCOURCIS: [RaccourciPeriode, string][] = [['jour', 'Ce jour'], ['semaine', 'Cette semaine'], ['mois', 'Ce mois'], ['moisPrecedent', 'Mois précédent']];

interface Props { projets: readonly Projet[]; projetsCoches: readonly string[]; onFermer: () => void }

export function ExportDailyModale({ projets, projetsCoches, onFermer }: Props) {
  const { donnees } = useSession();
  const [raccourci, setRaccourci] = useState<RaccourciPeriode | null>('mois');
  const [periode, setPeriode] = useState(() => periodeExport('mois', aujourdhui()));
  const [coches, setCoches] = useState<string[]>([...projetsCoches]);
  const [manquants, setManquants] = useState(true);
  const [avecBlocages, setAvecBlocages] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  if (!donnees) return null;

  const choisir = (cle: RaccourciPeriode) => { setRaccourci(cle); setPeriode(periodeExport(cle, aujourdhui())); };

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    if (!donnees) return;
    const { debut, fin } = periode;
    if (debut > fin) return setErreur('La date de début doit précéder la date de fin');
    if (ecartJours(debut, fin) > 366) return setErreur('Période limitée à un an');
    if (!coches.length) return setErreur('Cochez au moins un projet');
    try {
      const notes = await lire('notes_daily_projet', { order: 'jour,projet_id,user_id', and: `(jour.gte.${debut},jour.lte.${fin})` }) as unknown as NoteDaily[];
      const feries = new Set(donnees.joursFeries.map(j => j.jour));
      const lignes = lignesExport(donnees, debut, fin, projets.filter(p => coches.includes(p.id)), notes, manquants, feries);
      telecharger(`Daily_${debut}_au_${fin}.xlsx`, feuillesExport(lignes, avecBlocages));
      onFermer();
    } catch (err) { setErreur((err as Error).message); }
  }

  return (
    <Modale titre="Exporter le daily en Excel" onFermer={onFermer}
      pied={<><Bouton onClick={onFermer}>Annuler</Bouton><Bouton variante="primaire" type="submit" form="export-daily">Télécharger le fichier Excel</Bouton></>}>
      <form id="export-daily" className="pile" onSubmit={e => void envoyer(e)}>
        {erreur && <div className="message-erreur" role="alert">{erreur}</div>}
        <div>
          <div className="libelle">Période</div>
          <div className="puces" style={{ marginBottom: 8 }}>
            {RACCOURCIS.map(([cle, libelle]) => (
              <button key={cle} type="button" className={'puce' + (raccourci === cle ? ' active' : '')} onClick={() => choisir(cle)}>{libelle}</button>
            ))}
          </div>
          <div className="deux-colonnes">
            <div><label className="libelle">Du<input className="champ" type="date" required value={periode.debut}
              onChange={e => { setRaccourci(null); setPeriode({ ...periode, debut: e.target.value }); }} /></label></div>
            <div><label className="libelle">Au<input className="champ" type="date" required value={periode.fin}
              onChange={e => { setRaccourci(null); setPeriode({ ...periode, fin: e.target.value }); }} /></label></div>
          </div>
        </div>
        <div>
          <div className="libelle">Projets (ceux dont vous pouvez lire le daily)</div>
          {projets.map(p => (
            <label key={p.id} className="ligne-flex" style={{ padding: '4px 0' }}>
              <input type="checkbox" checked={coches.includes(p.id)} onChange={e => setCoches(c => (e.target.checked ? [...c, p.id] : c.filter(x => x !== p.id)))} />
              <span>{p.nom}</span>
            </label>
          ))}
        </div>
        <div>
          <div className="libelle">Contenu du fichier</div>
          <div className="discret" style={{ padding: '3px 0' }}>Onglet « Daily » : une ligne par personne, par projet et par jour ouvré</div>
          <label className="ligne-flex" style={{ padding: '3px 0' }}>
            <input type="checkbox" checked={manquants} onChange={e => setManquants(e.target.checked)} />Inclure les absents et les daily manquants
          </label>
          <label className="ligne-flex" style={{ padding: '3px 0' }}>
            <input type="checkbox" checked={avecBlocages} onChange={e => setAvecBlocages(e.target.checked)} />Ajouter l’onglet « Blocages » : uniquement les blocages signalés
          </label>
        </div>
      </form>
    </Modale>
  );
}
