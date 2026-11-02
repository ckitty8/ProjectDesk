/* ============================================================
   Administration › Référentiels (portage de Administration.referentiels de app/js/ecrans/administration.js — phase 5, vague D)
   Les listes métier (types, priorités, statuts, rôles, absences…) sont en base : table valeurs_referentiel (règle n°4 de CLAUDE.md). Modifiable
   (renommer, recolorer, activer, ajouter) par un administrateur avec le droit « administration » ; sinon consultation.
   Le même composant sert l'onglet Référentiels (les listes hors ressources) et l'onglet Ressources (rôles de projet et profils, 2026-11-02, avec en plus
   des entrées en lecture seule : « extras »).
   ============================================================ */
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Aide } from '../../composants/Aide';
import { Pastille } from '../../composants/Badge';
import { Bouton } from '../../composants/Bouton';
import { Carte } from '../../composants/Carte';
import { creer, modifier } from '../../donnees/api';
import { useSession } from '../../donnees/SessionProvider';
import { COULEURS } from '../../domaine/config';
import { referentielsAffiches, valeursDe } from '../../domaine/referentiels';
import { AIDES } from '../../domaine/textes';
import type { Referentiel } from '../../domaine/types';

/** Entrée de la liste de gauche qui n'est pas un référentiel en base (ex. les rôles d'accès, fixes) : son contenu s'affiche à droite, en lecture seule */
export interface EntreeLecture { id: string; nom: string; compte: number; contenu: ReactNode }

interface PropsReferentiels {
  modifiable: boolean;
  /** Référentiels montrés (leurs identifiants) ; tous si absent */
  montrer?: readonly string[];
  /** Référentiels cachés (ceux d'un autre onglet) */
  cacher?: readonly string[];
  extras?: readonly EntreeLecture[];
  /** Entrée choisie à l'ouverture (identifiant d'un référentiel ou d'une entrée en lecture) ; la première sinon */
  entreeInitiale?: string;
}

/** Valeurs d'un référentiel : tableau (renommer, recolorer, activer si modifiable) et ligne d'ajout */
function PanneauReferentiel({ referentiel, modifiable }: { referentiel: Referentiel; modifiable: boolean }) {
  const { donnees, executer } = useSession();
  if (!donnees) return null;
  const valeurs = valeursDe(donnees.valeurs, referentiel.id, true);

  // Renommer : la base propage le nouveau libellé aux données (projets, affectations…)
  const renommer = (id: string, actuel: string, libelle: string) => {
    if (libelle.trim() && libelle.trim() !== actuel) void executer(() => modifier('valeurs_referentiel', { id: 'eq.' + id }, { libelle: libelle.trim() }), 'valeurs', 'projets', 'affectations', 'absences', 'ressources');
  };
  async function ajouter(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget, libelle = String(new FormData(form).get('libelle') ?? '').trim();
    if (!libelle) return;
    if (await executer(() => creer('valeurs_referentiel', { referentielId: referentiel.id, libelle, ordre: valeurs.length + 1, couleur: COULEURS.neutre }), 'valeurs')) form.reset();
  }

  return (
    <Carte>
      <div className="carte-titre"><h2>{referentiel.nom} {valeurs.some(v => v.systeme) && <Aide texte={AIDES.referentielSysteme} />}</h2></div>
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
  );
}

/** Lien de la liste de gauche (référentiel ou entrée en lecture seule) : le clic choisit ce qui s'affiche à droite */
function LienListe({ nom, compte, courant, onChoisir }: { nom: string; compte: number; courant: boolean; onChoisir: () => void }) {
  return (
    <a className={'menu-lien lien-referentiel' + (courant ? ' ligne-courante' : '')} role="button" tabIndex={0} onClick={onChoisir}
      onKeyDown={e => { if (e.key === 'Enter') onChoisir(); }}>
      <span>{nom}</span><span className="pale">{compte}</span>
    </a>
  );
}

/** Liste des référentiels à gauche, valeurs du référentiel choisi (ou contenu d'une entrée en lecture seule) à droite */
export function Referentiels({ modifiable, montrer, cacher = [], extras = [], entreeInitiale = '' }: PropsReferentiels) {
  const { donnees } = useSession();
  const [choisi, setChoisi] = useState(entreeInitiale);
  if (!donnees) return null;
  const listes = referentielsAffiches(donnees.referentiels, montrer, cacher);
  const extra = extras.find(x => x.id === choisi);
  const courant = extra ? undefined : (listes.find(r => r.id === choisi) ?? listes[0]);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
      <Carte classe="liste-referentiels"><div style={{ padding: 8 }}>
        {listes.map(r => (
          <LienListe key={r.id} nom={r.nom} compte={valeursDe(donnees.valeurs, r.id, true).length} courant={r.id === courant?.id}
            onChoisir={() => setChoisi(r.id)} />
        ))}
        {extras.map(x => (
          <LienListe key={x.id} nom={x.nom} compte={x.compte} courant={x.id === extra?.id} onChoisir={() => setChoisi(x.id)} />
        ))}
      </div></Carte>
      {extra ? extra.contenu : courant && <PanneauReferentiel referentiel={courant} modifiable={modifiable} />}
    </div>
  );
}
