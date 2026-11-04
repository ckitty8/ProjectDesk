/* ============================================================
   Fiche d'une demande de la Roadmap (panneau latéral) — Mon dashboard › Projet › Roadmap
   ------------------------------------------------------------
   Maquette docs/maquettes/saisie-demandes-roadmap/2-fiche-demande.png (porteur, 2026-11-04 : « Go »). Un champ par colonne réglée dans
   Administration › Roadmap, rangé par bloc : liste déroulante (valeurs du référentiel « rdm_ », ou sprints et mises en production du projet
   pour Sprint DSI — 3.09), saisie libre
   au format de la colonne (texte, nombre, date). Rang et Score sont calculés en direct (domaine/roadmap.ts), jamais saisis.
   ============================================================ */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Bouton } from '../../composants/Bouton';
import { Panneau } from '../../composants/Fenetres';
import { creer, modifier } from '../../donnees/api';
import { useSession } from '../../donnees/SessionProvider';
import { valeursDe } from '../../domaine/referentiels';
import { blocsDuTableau, choixSprintVersion, demandesClassees, scoreAffiche, scoreDemande, valeursAEnregistrer } from '../../domaine/roadmap';
import type { ColonneRoadmap, DemandeRoadmap } from '../../domaine/types';

/** Un projet proposé : son id et son nom affiché (« CDO · AMOA » : nom et équipe, jamais le code — porteur, 2026-10-24) */
export interface ChoixProjet { id: string; libelle: string }

/** Projet choisi dans la fiche : son id, ou « » pour une demande sans projet (administrateurs) */
const SANS_PROJET = '';

interface PropsFiche {
  /** Demande à modifier ; absente pour une nouvelle demande */
  demande?: DemandeRoadmap;
  /** Projets proposés (ceux que je gère) ; « sansProjet » ajoute le choix « Sans projet » (administrateurs) */
  projets: readonly ChoixProjet[];
  sansProjet: boolean;
  projetInitial: string | null;
  onFermer: () => void;
}

export function FicheDemande({ demande, projets, sansProjet, projetInitial, onFermer }: PropsFiche) {
  const { donnees, executer, notifier } = useSession();
  const [projetId, setProjetId] = useState<string>(demande?.projetId ?? projetInitial ?? SANS_PROJET);
  const [saisie, setSaisie] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(demande?.valeurs ?? {}).map(([id, v]) => [id, v ?? ''])));
  if (!donnees) return null;
  const colonnes = donnees.colonnesRoadmap;

  // Rang et Score de la demande telle qu'elle est saisie, parmi toutes les autres
  const enCours: DemandeRoadmap = { id: demande?.id ?? 'nouvelle', projetId: projetId || null, valeurs: saisie, creeLe: demande?.creeLe ?? '9999' };
  const autres = donnees.demandesRoadmap.filter(d => d.id !== demande?.id);
  const rang = demandesClassees([...autres, enCours], colonnes).find(l => l.demande.id === enCours.id)?.rang;
  const score = scoreDemande(enCours, colonnes);
  const sprintsEtMep = choixSprintVersion(donnees.sprintsProjet, donnees.misesEnProduction, projetId || null);
  const changer = (id: string, valeur: string) => setSaisie(s => ({ ...s, [id]: valeur }));
  // Sprint / version : choisir une mise en production reprend sa date dans « Date de MEP », si celle-ci est encore vide
  const dateMep = colonnes.find(c => c.cle === 'dateMep');
  function changerSprint(id: string, valeur: string) {
    const jour = sprintsEtMep.find(o => o.libelle === valeur)?.jour;
    setSaisie(s => ({ ...s, [id]: valeur, ...(jour && dateMep && !s[dateMep.id] ? { [dateMep.id]: jour } : {}) }));
  }
  /** Colonnes en texte long, sur toute la largeur de la fiche */
  const texteLong = (c: ColonneRoadmap) => c.cle === 'demande' || c.cle === 'commentaires';

  async function enregistrer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const valeurs = valeursAEnregistrer(saisie, colonnes);
    const titre = colonnes.find(c => c.cle === 'demande');
    if (titre && !valeurs[titre.id]) return notifier(`Le champ « ${titre.libelle} » est obligatoire`, 'erreur');
    const ligne = { projetId: projetId || null, valeurs };
    const ok = await executer(() => (demande ? modifier('demandes_roadmap', { id: 'eq.' + demande.id }, ligne) : creer('demandes_roadmap', ligne)), 'demandesRoadmap');
    if (ok) onFermer();
  }

  /** Champ d'une colonne selon son type */
  function champ(c: ColonneRoadmap) {
    const valeur = saisie[c.id] ?? '';
    const commun = { id: 'champ-' + c.id, 'aria-label': c.libelle, value: valeur, className: 'champ', onChange: (e: { target: { value: string } }) => changer(c.id, e.target.value) };
    if (c.type === 'liste' && c.listeSprints) {
      const groupe = (g: string) => sprintsEtMep.filter(o => o.groupe === g).map(o => <option key={o.libelle} value={o.libelle}>{o.libelle}</option>);
      const inconnue = valeur && !sprintsEtMep.some(o => o.libelle === valeur);
      return (
        <select {...commun} onChange={e => changerSprint(c.id, e.target.value)}>
          <option value="">—</option>
          <optgroup label="Sprints">{groupe('Sprints')}</optgroup>
          <optgroup label="Mises en production">{groupe('Mises en production')}</optgroup>
          {inconnue && <option value={valeur}>{valeur}</option>}
        </select>
      );
    }
    if (c.type === 'liste') {
      const options = valeursDe(donnees!.valeurs, c.referentielId ?? '').map(v => v.libelle);
      // Une valeur enregistrée qui n'est plus dans la liste (désactivée, renommée) reste affichée
      if (valeur && !options.includes(valeur)) options.push(valeur);
      return <select {...commun}><option value="">—</option>{options.map(o => <option key={o} value={o}>{o}</option>)}</select>;
    }
    if (c.format === 'nombre') return <input {...commun} type="number" step="any" />;
    if (c.format === 'date') return <input {...commun} type="date" />;
    if (texteLong(c)) return <textarea {...commun} rows={2} />;
    return <input {...commun} maxLength={500} />;
  }

  const calcule = (texte: string) => <div className="champ champ-calcule">{texte}</div>;

  return (
    <Panneau titre={demande ? 'Modifier la demande' : 'Nouvelle demande'} surtitre={<div className="pale">Roadmap</div>} onFermer={onFermer}
      pied={<><Bouton onClick={onFermer}>Annuler</Bouton><Bouton variante="primaire" type="submit" form="fiche-demande">Enregistrer</Bouton></>}>
      <form id="fiche-demande" className="fiche-demande" onSubmit={e => void enregistrer(e)}>
        <label className="champ-fiche">
          <span>Projet</span>
          <select className="champ" value={projetId} aria-label="Projet de la demande" onChange={e => setProjetId(e.target.value)}>
            {sansProjet && <option value={SANS_PROJET}>Sans projet</option>}
            {projets.map(p => <option key={p.id} value={p.id}>{p.libelle}</option>)}
          </select>
        </label>
        {blocsDuTableau(colonnes).map(b => (
          <fieldset key={b.cle} className="bloc-fiche">
            <legend>{b.titre}</legend>
            {b.colonnes.map(c => (
              <label key={c.id} className={'champ-fiche' + (texteLong(c) ? ' pleine-largeur' : '')} htmlFor={c.type === 'calcul' ? undefined : 'champ-' + c.id}>
                <span>{c.libelle}{c.type === 'calcul' && <span className="pale"> (calculé)</span>}</span>
                {c.type === 'calcul'
                  ? calcule(c.cle === 'rang' ? String(rang ?? '—') : score === null ? 'complexité à saisir' : scoreAffiche(score))
                  : champ(c)}
              </label>
            ))}
          </fieldset>
        ))}
      </form>
    </Panneau>
  );
}
