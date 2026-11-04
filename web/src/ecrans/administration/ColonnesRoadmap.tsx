/* ============================================================
   Mon dashboard › Administration › Roadmap — colonnes du tableau de Vue d’ensemble › Roadmap
   ------------------------------------------------------------
   Porteur, 2026-11-03 : « un onglet roadmap où je peux ajouter ou supprimer les colonnes de mon tableau ; pour chaque colonne, choisir si c'est
   une liste déroulante ou une saisie libre » (maquette docs/maquettes/admin-roadmap-colonnes/, validée). Une ligne par colonne (table
   colonnes_roadmap, migration 056) : ordre dans son bloc, nom, bloc, type, puis les valeurs de la liste (panneau, référentiel « rdm_ ») ou le
   format de la saisie libre (Texte, Nombre, Date). Rang et Score sont calculés : ni supprimables, ni changés de type (contrôlé aussi en base).
   Écriture réservée aux administrateurs avec le droit « administration » (règle de la base) ; sinon consultation.
   ============================================================ */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Bouton, BoutonIcone } from '../../composants/Bouton';
import { Carte } from '../../composants/Carte';
import { Panneau } from '../../composants/Fenetres';
import { PanneauReferentiel } from './Referentiels';
import { creer, modifier, supprimer } from '../../donnees/api';
import { useSession } from '../../donnees/SessionProvider';
import { BLOCS_ROADMAP, FORMATS_SAISIE } from '../../domaine/config';
import { valeursDe } from '../../domaine/referentiels';
import { colonnesOrdonnees, echangeOrdre, nouvelIdListe, ordreEnFin, resumeValeurs } from '../../domaine/roadmap';
import type { ColonneRoadmap } from '../../domaine/types';

type TypeSaisi = 'liste' | 'libre';
const TABLE = 'colonnes_roadmap';
const titreBloc = (cle: string): string => BLOCS_ROADMAP.find(b => b.cle === cle)?.titre ?? cle;

interface PropsChoixType { valeur: TypeSaisi; onChoisir: (t: TypeSaisi) => void; libelle: string; desactive?: boolean }

/** Choix « Liste déroulante / Saisie libre » (deux puces) */
function ChoixType({ valeur, onChoisir, libelle, desactive = false }: PropsChoixType) {
  return (
    <div className="puces choix-type" role="group" aria-label={libelle}>
      {([['liste', '▾ Liste déroulante'], ['libre', '✎ Saisie libre']] as const).map(([t, texte]) => (
        <button key={t} type="button" className={'puce' + (valeur === t ? ' active' : '')} aria-pressed={valeur === t} disabled={desactive}
          onClick={() => { if (valeur !== t) onChoisir(t); }}>{texte}</button>
      ))}
    </div>
  );
}

/** Liste des blocs, pour un menu déroulant */
const OptionsBlocs = () => <>{BLOCS_ROADMAP.map(b => <option key={b.cle} value={b.cle}>{b.titre}</option>)}</>;

/** Onglet Roadmap : tableau des colonnes, ligne d'ajout, panneau des valeurs d'une liste déroulante */
export function ColonnesRoadmap({ modifiable }: { modifiable: boolean }) {
  const { donnees, executer } = useSession();
  const [listeOuverte, setListeOuverte] = useState<string | null>(null);
  const [typeAjout, setTypeAjout] = useState<TypeSaisi>('liste');
  if (!donnees) return null;
  const colonnes = colonnesOrdonnees(donnees.colonnesRoadmap);
  const ouverte = colonnes.find(c => c.id === listeOuverte);
  const referentielOuvert = ouverte?.referentielId ? donnees.referentiels.find(r => r.id === ouverte.referentielId) : undefined;

  // Chaque écriture relit les colonnes et les listes (la base reste juge des droits)
  const ecrire = (action: () => Promise<unknown>) => executer(action, 'colonnesRoadmap', 'referentiels', 'valeurs');
  const changer = (c: ColonneRoadmap, champs: Partial<ColonneRoadmap>) => ecrire(() => modifier(TABLE, { id: 'eq.' + c.id }, champs));

  /** Nouveau référentiel (vide) pour les valeurs d'une liste déroulante */
  async function creerListe(libelle: string): Promise<string> {
    const id = nouvelIdListe(crypto.randomUUID());
    await creer('referentiels', { id, nom: 'Roadmap · ' + libelle, ordre: 100 + donnees!.referentiels.length });
    return id;
  }

  // Renommer : la liste déroulante garde le même nom que sa colonne
  function renommer(c: ColonneRoadmap, libelle: string) {
    const nom = libelle.trim();
    if (!nom || nom === c.libelle) return;
    void ecrire(async () => {
      await modifier(TABLE, { id: 'eq.' + c.id }, { libelle: nom });
      if (c.referentielId) await modifier('referentiels', { id: 'eq.' + c.referentielId }, { nom: 'Roadmap · ' + nom });
    });
  }

  // Changer de type : une saisie libre prend le format Texte ; une liste reprend ses valeurs (gardées) ou en crée une vide
  function changerType(c: ColonneRoadmap, type: TypeSaisi) {
    if (type === 'libre') return void changer(c, { type, format: c.format ?? 'texte' });
    void ecrire(async () => {
      // La liste des sprints (Sprint DSI) n'a pas de référentiel ; une colonne qui en a déjà un le garde
      const aSesValeurs = c.listeSprints || !!c.referentielId;
      const referentielId = aSesValeurs ? c.referentielId : await creerListe(c.libelle);
      await modifier(TABLE, { id: 'eq.' + c.id }, { type, referentielId });
    });
  }

  // Changer de bloc : la colonne se range en fin de son nouveau bloc
  const changerBloc = (c: ColonneRoadmap, bloc: string) => void changer(c, { bloc: bloc as ColonneRoadmap['bloc'], ordre: ordreEnFin(colonnes) });

  function deplacer(c: ColonneRoadmap, sens: -1 | 1) {
    const echange = echangeOrdre(colonnes, c.id, sens);
    if (echange) void ecrire(() => Promise.all(echange.map(e => modifier(TABLE, { id: 'eq.' + e.id }, { ordre: e.ordre }))));
  }

  // Supprimer : la base supprime aussi la liste déroulante de la colonne et ses valeurs (migration 056)
  function supprimerColonne(c: ColonneRoadmap) {
    if (window.confirm(`Supprimer la colonne « ${c.libelle} » du tableau Roadmap ?${c.referentielId ? ' Les valeurs de sa liste déroulante seront supprimées.' : ''}`))
      void ecrire(() => supprimer(TABLE, { id: 'eq.' + c.id }));
  }

  async function ajouter(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget, f = new FormData(form);
    const libelle = String(f.get('libelle') ?? '').trim(), bloc = String(f.get('bloc'));
    if (!libelle) return;
    const ok = await ecrire(async () => {
      const referentielId = typeAjout === 'liste' ? await creerListe(libelle) : null;
      await creer(TABLE, { libelle, bloc, type: typeAjout, format: typeAjout === 'libre' ? 'texte' : null, referentielId, ordre: ordreEnFin(colonnes) });
    });
    if (ok) form.reset();
  }

  /** Dernière cellule : valeurs de la liste, format de la saisie libre, ou formule d'une colonne calculée */
  function detail(c: ColonneRoadmap) {
    if (c.type === 'calcul') return <span className="pale">{c.cle === 'score' ? '(0,5 × client + 0,3 × collab.) ÷ (0,2 × complexité)' : 'Stratégique, puis priorité, puis score'}</span>;
    if (c.type === 'libre') {
      return modifiable
        ? <select className="champ champ-format" value={c.format ?? 'texte'} aria-label={`Format de ${c.libelle}`}
          onChange={e => void changer(c, { format: e.target.value as ColonneRoadmap['format'] })}>
          {FORMATS_SAISIE.map(x => <option key={x.cle} value={x.cle}>{x.libelle}</option>)}
        </select>
        : FORMATS_SAISIE.find(x => x.cle === c.format)?.libelle;
    }
    if (c.listeSprints) return <span className="pale">Sprints et mises en production du projet (Mon dashboard › Projet)</span>;
    return (
      <span className="ligne-flex">
        <span>{resumeValeurs(valeursDe(donnees!.valeurs, c.referentielId ?? '', true))}</span>
        {c.referentielId && <Bouton petit onClick={() => setListeOuverte(c.id)}>Valeurs…</Bouton>}
      </span>
    );
  }

  return (
    <Carte>
      <div className="carte-titre ligne-flex entre">
        <h2>Colonnes du tableau Roadmap <span className="pale normal">· {colonnes.length} colonnes</span></h2>
        <span className="pale">Les changements s’appliquent au tableau de Vue d’ensemble › Roadmap</span>
      </div>
      <div className="defilement-x">
        <table className="tableau tableau-colonnes-roadmap">
          <thead><tr><th>Ordre</th><th>Colonne</th><th>Bloc</th><th>Type</th><th>Valeurs / format</th><th /></tr></thead>
          <tbody>
            {colonnes.map(c => {
              const calculee = c.type === 'calcul';
              return (
                <tr key={c.id}>
                  <td className="nowrap">
                    <button type="button" className="btn-icone" aria-label={`Monter ${c.libelle}`} disabled={!modifiable || !echangeOrdre(colonnes, c.id, -1)} onClick={() => deplacer(c, -1)}>↑</button>
                    <button type="button" className="btn-icone" aria-label={`Descendre ${c.libelle}`} disabled={!modifiable || !echangeOrdre(colonnes, c.id, 1)} onClick={() => deplacer(c, 1)}>↓</button>
                  </td>
                  <td>
                    {modifiable && !calculee
                      ? <input key={c.libelle} className="champ" defaultValue={c.libelle} maxLength={60} aria-label={`Nom de la colonne ${c.libelle}`} onBlur={e => renommer(c, e.target.value)} />
                      : <b>{c.libelle}</b>}
                  </td>
                  <td>
                    {modifiable
                      ? <select className="champ" value={c.bloc} aria-label={`Bloc de ${c.libelle}`} onChange={e => changerBloc(c, e.target.value)}><OptionsBlocs /></select>
                      : titreBloc(c.bloc)}
                  </td>
                  <td>
                    {calculee
                      ? <span className="badge badge-calculee">ƒ Calculée</span>
                      : <ChoixType valeur={c.type as TypeSaisi} libelle={`Type de ${c.libelle}`} desactive={!modifiable} onChoisir={t => changerType(c, t)} />}
                  </td>
                  <td className="nowrap">{detail(c)}</td>
                  <td className="nowrap">
                    {calculee
                      ? <span className="pale" title="Colonne calculée : non supprimable">🔒</span>
                      : modifiable && <BoutonIcone icone="supprimer" titre={`Supprimer la colonne ${c.libelle}`} onClick={() => supprimerColonne(c)} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {modifiable && (
        <form className="ligne-flex encart-compact ajout-colonne" onSubmit={e => void ajouter(e)}>
          <input className="champ" name="libelle" placeholder="Nouvelle colonne" required maxLength={60} aria-label="Nom de la nouvelle colonne" />
          <select className="champ" name="bloc" defaultValue="developpement" aria-label="Bloc de la nouvelle colonne"><OptionsBlocs /></select>
          <ChoixType valeur={typeAjout} libelle="Type de la nouvelle colonne" onChoisir={setTypeAjout} />
          <Bouton variante="primaire" type="submit">Ajouter la colonne</Bouton>
        </form>
      )}
      {ouverte && referentielOuvert && (
        <Panneau titre={ouverte.libelle} surtitre={<div className="pale">Colonne · Liste déroulante</div>} onFermer={() => setListeOuverte(null)}>
          <p className="pale">Valeurs proposées dans la liste déroulante de cette colonne.</p>
          <PanneauReferentiel referentiel={referentielOuvert} modifiable={modifiable} titre="Valeurs" />
        </Panneau>
      )}
    </Carte>
  );
}
