/* ============================================================
   Administration › Référentiels (portage de Administration.referentiels de app/js/ecrans/administration.js — phase 5, vague D)
   Les listes métier (types, priorités, statuts, rôles, absences…) sont en base : table valeurs_referentiel (règle n°4 de CLAUDE.md). Modifiable
   (renommer, recolorer, activer, ajouter) par un administrateur avec le droit « administration » ; sinon consultation.
   ============================================================ */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Aide } from '../../composants/Aide';
import { Pastille } from '../../composants/Badge';
import { Bouton } from '../../composants/Bouton';
import { Carte } from '../../composants/Carte';
import { creer, modifier } from '../../donnees/api';
import { useSession } from '../../donnees/SessionProvider';
import { COULEURS } from '../../domaine/config';
import { valeursDe } from '../../domaine/referentiels';
import { AIDES } from '../../domaine/textes';

export function Referentiels({ modifiable }: { modifiable: boolean }) {
  const { donnees, executer } = useSession();
  const [choisi, setChoisi] = useState('stp');
  if (!donnees) return null;
  const ref = donnees.referentiels.find(r => r.id === choisi) ?? donnees.referentiels[0];
  if (!ref) return null;
  const valeurs = valeursDe(donnees.valeurs, ref.id, true);

  // Renommer : la base propage le nouveau libellé aux données (projets, affectations…)
  const renommer = (id: string, actuel: string, libelle: string) => {
    if (libelle.trim() && libelle.trim() !== actuel) void executer(() => modifier('valeurs_referentiel', { id: 'eq.' + id }, { libelle: libelle.trim() }), 'valeurs', 'projets', 'affectations', 'absences', 'ressources');
  };
  async function ajouter(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget, libelle = String(new FormData(form).get('libelle') ?? '').trim();
    if (!ref || !libelle) return;
    if (await executer(() => creer('valeurs_referentiel', { referentielId: ref.id, libelle, ordre: valeurs.length + 1, couleur: COULEURS.neutre }), 'valeurs')) form.reset();
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
      <Carte classe="liste-referentiels"><div style={{ padding: 8 }}>
        {donnees.referentiels.map(r => (
          <a key={r.id} className={'menu-lien lien-referentiel' + (r.id === ref.id ? ' ligne-courante' : '')} role="button" tabIndex={0} onClick={() => setChoisi(r.id)}
            onKeyDown={e => { if (e.key === 'Enter') setChoisi(r.id); }}>
            <span>{r.nom}</span><span className="pale">{valeursDe(donnees.valeurs, r.id, true).length}</span>
          </a>
        ))}
      </div></Carte>
      <Carte>
        <div className="carte-titre"><h2>{ref.nom} {valeurs.some(v => v.systeme) && <Aide texte={AIDES.referentielSysteme} />}</h2></div>
        <table className="tableau">
          <thead><tr><th>#</th><th>Valeur</th><th>Couleur</th><th>Active</th></tr></thead>
          <tbody>
            {valeurs.map((v, i) => (
              <tr key={v.id ?? v.libelle}>
                <td className="pale">{i + 1}</td>
                <td>
                  {modifiable
                    ? <input key={v.libelle} className="champ" defaultValue={v.libelle} aria-label={`Valeur ${i + 1}`} onBlur={e => renommer(v.id ?? '', v.libelle, e.target.value)} />
                    : v.libelle}
                  {v.systeme && <span className="pale" title="Utilisée par les calculs : renommable (les données suivent), non supprimable"> · système</span>}
                </td>
                <td>
                  {modifiable
                    ? <input type="color" className="couleur-choix" defaultValue={v.couleur} aria-label={`Couleur ${v.libelle}`}
                      onBlur={e => { if (e.target.value !== v.couleur) void executer(() => modifier('valeurs_referentiel', { id: 'eq.' + v.id }, { couleur: e.target.value }), 'valeurs'); }} />
                    : <Pastille couleur={v.couleur} />}
                </td>
                <td>
                  {modifiable
                    ? <button type="button" className={'interrupteur' + (v.actif ? ' actif' : '')} aria-label={`Activer ${v.libelle}`} aria-pressed={v.actif}
                      onClick={() => void executer(() => modifier('valeurs_referentiel', { id: 'eq.' + v.id }, { actif: !v.actif }), 'valeurs')} />
                    : (v.actif ? 'Oui' : <span className="pale">Non</span>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {modifiable && (
          <form className="ligne-flex encart-compact" onSubmit={e => void ajouter(e)}>
            <input className="champ" name="libelle" placeholder="Nouvelle valeur" required aria-label="Nouvelle valeur" /><Bouton type="submit">Ajouter</Bouton>
          </form>
        )}
      </Carte>
    </div>
  );
}
