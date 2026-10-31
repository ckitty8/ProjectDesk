/* ============================================================
   Administration › Jours fériés (table jours_feries, clé = la date) ; portage de app/js/ecrans/mon-admin.js — phase 5, vague D
   Liste par année, ajout (date, libellé), modification et suppression. Ils s'affichent dans les calendriers et sont exclus des jours ouvrés (capacité,
   timesheet). Modifiable : administrateur avec le droit « administration » (sinon consultation).
   ============================================================ */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Aide } from '../../composants/Aide';
import { Bouton, BoutonIcone } from '../../composants/Bouton';
import { Carte, Vide } from '../../composants/Carte';
import { creer, modifier, supprimer } from '../../donnees/api';
import { useSession } from '../../donnees/SessionProvider';
import { feriePar } from '../../domaine/admin';
import { ABSENCES } from '../../domaine/config';
import { aujourdhui, formatAvecAnnee } from '../../domaine/dates';
import { AIDES } from '../../domaine/textes';

export function JoursFeries({ modifiable }: { modifiable: boolean }) {
  const { donnees, executer, notifier } = useSession();
  const [anneeChoisie, setAnnee] = useState(aujourdhui().slice(0, 4));
  if (!donnees) return null;
  const feries = donnees.joursFeries;
  const annees = [...new Set([...feries.map(f => f.jour.slice(0, 4)), anneeChoisie])].sort();
  const lignes = feries.filter(f => f.jour.startsWith(anneeChoisie));

  async function ajouter(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget, f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    if (feriePar(feries, f.jour ?? '')) return notifier('Ce jour est déjà férié', 'erreur');
    if (await executer(() => creer('jours_feries', { jour: f.jour, libelle: (f.libelle ?? '').trim() }), 'joursFeries')) form.reset();
  }
  function changerDate(ancien: string, el: HTMLInputElement) {
    if (!el.value || el.value === ancien) return;
    if (feriePar(feries, el.value)) { el.value = ancien; return notifier('Ce jour est déjà férié', 'erreur'); }
    void executer(() => modifier('jours_feries', { jour: 'eq.' + ancien }, { jour: el.value }), 'joursFeries');
  }

  return (
    <Carte>
      <div className="carte-titre">
        <h2>Jours fériés <Aide texte={AIDES.joursFeries} /></h2>
        <div className="puces">{annees.map(a => <button key={a} type="button" className={'puce' + (a === anneeChoisie ? ' active' : '')} onClick={() => setAnnee(a)}>{a}</button>)}</div>
      </div>
      <table className="tableau">
        <thead><tr><th>Date</th><th>Libellé</th><th className="num" /></tr></thead>
        <tbody>
          {lignes.length === 0 && <tr><td colSpan={3}><Vide texte={`Aucun jour férié pour ${anneeChoisie}.`} /></td></tr>}
          {lignes.map(f => !modifiable
            ? <tr key={f.jour}><td>{formatAvecAnnee(f.jour)}</td><td>{f.libelle}</td><td /></tr>
            : (
              <tr key={f.jour}>
                <td><input key={f.jour} type="date" className="champ largeur-auto" defaultValue={f.jour} aria-label="Date" onBlur={e => changerDate(f.jour, e.target)} /></td>
                <td>
                  <input key={f.libelle} className="champ" defaultValue={f.libelle ?? ''} aria-label="Libellé"
                    onBlur={e => { const v = e.target.value.trim(); if (v && v !== f.libelle) void executer(() => modifier('jours_feries', { jour: 'eq.' + f.jour }, { libelle: v }), 'joursFeries'); }} />
                </td>
                <td className="num">
                  <BoutonIcone icone="supprimer" titre="Supprimer ce jour férié"
                    onClick={() => { if (window.confirm('Supprimer ce jour férié ?')) void executer(() => supprimer('jours_feries', { jour: 'eq.' + f.jour }), 'joursFeries'); }} />
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      {modifiable && (
        <form className="ligne-flex encart-compact" onSubmit={e => void ajouter(e)}>
          <input type="date" className="champ largeur-auto" name="jour" required aria-label="Nouvelle date" />
          <input className="champ" name="libelle" placeholder="Libellé (ex. Lundi de Pentecôte)" required aria-label="Nouveau libellé" /><Bouton type="submit">Ajouter</Bouton>
        </form>
      )}
      <div className="discret" style={{ fontSize: 12, padding: '0 16px 14px' }}>
        Affichés dans les calendriers avec le type « {ABSENCES.FERIE} » ; non comptés comme jours ouvrés (capacité, timesheet).
      </div>
    </Carte>
  );
}
