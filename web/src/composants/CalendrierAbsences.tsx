/* ============================================================
   Calendrier des absences partagé (portage du composant Calendrier de app/js/ecrans/ressources.js — phase 5, vagues B et C)
   Utilisé par Gestion des ressources (lecture) et Mon dashboard › Congés (édition : clic sur une case). Vue « Par équipe » (chaque personne une
   fois, étiquettes de projets, synthèse des absents par projet) ou « Par projet » ; navigation de mois ; les lignes viennent du modèle
   pur de domaine/vues.ts.
   ============================================================ */
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Aide } from './Aide';
import { Pastille } from './Badge';
import { Calendrier, NavigationMois } from './Calendrier';
import type { LigneCalendrier } from './Calendrier';
import { Carte, Vide } from './Carte';
import { Icone } from './Icone';
import { Liste } from './Liste';
import type { Donnees } from '../donnees/tables';
import { contexteMois } from '../domaine/calendrier';
import { COULEURS } from '../domaine/config';
import type { ContexteDroits } from '../domaine/droits';
import { valeursDe } from '../domaine/referentiels';
import { AIDES } from '../domaine/textes';
import { modeleParEquipe, modeleParProjet, projetsAvecMembres, unitesRacines } from '../domaine/vues';
import type { ElementCalendrier } from '../domaine/vues';

const MAX_ETIQUETTES = 3;

/** Projets d'une personne en étiquettes (vue « Par équipe ») : 3 au plus, puis « +N » ; liste complète en infobulle */
function Etiquettes({ noms }: { noms: readonly string[] }) {
  return (
    <>
      {noms.slice(0, MAX_ETIQUETTES).map(n => <span key={n} className="etiquette" title={n}>{n}</span>)}
      {noms.length > MAX_ETIQUETTES && <span className="etiquette" title={noms.slice(MAX_ETIQUETTES).join(', ')}>+{noms.length - MAX_ETIQUETTES}</span>}
    </>
  );
}

/** Éléments du modèle (domaine/vues.ts) → lignes du composant Calendrier */
function lignesCalendrier(elements: readonly ElementCalendrier[], modifiable: (ressourceId: string) => boolean): LigneCalendrier[] {
  return elements.map((el, i): LigneCalendrier => {
    switch (el.genre) {
      case 'unite':
        return { genre: 'groupe', id: 'u' + el.equipe.id, niveau: el.niveau, contenu: (
          <><Icone nom={el.equipe.type === 'direction' ? 'direction' : 'equipe'} taille={14} /><Pastille couleur={el.equipe.couleur ?? COULEURS.pale} />{el.equipe.nom}</>
        ) };
      case 'intertitre':
        return { genre: 'groupe', id: 'i' + i, niveau: el.niveau, secondaire: true, contenu: <>Projets — absents / membres par jour <Aide texte={AIDES.syntheseProjets} /></> };
      case 'projet':
        return { genre: 'groupe', id: 'p' + el.projet.id, niveau: el.niveau, contenu: (
          <><Icone nom="projet" taille={14} />{el.projet.nom} <span className="discret poids-normal">{el.nbMembres} membres</span></>
        ) };
      case 'synthese':
        return { genre: 'synthese', id: 's' + el.projet.id, niveau: el.niveau, ids: el.ids, contenu: <><Icone nom="projet" taille={14} />{el.projet.nom}</> };
      case 'personne':
        return { genre: 'personne', ressource: el.ressource, niveau: el.niveau, modifiable: modifiable(el.ressource.id), complement: (
          <>{el.responsable && <span className="discret texte-11">responsable</span>}<Etiquettes noms={el.projets} /></>
        ) };
    }
  });
}

interface Props {
  ctx: ContexteDroits;
  donnees: Donnees;
  mois: { annee: number; mois: number };
  onMois: (m: { annee: number; mois: number }) => void;
  /** Écran d'édition (Congés) : totaux par personne et cases cliquables */
  editable?: boolean;
  /** Case modifiable pour cette personne (droit de la matrice) ; en lecture, toujours faux */
  modifiable?: (ressourceId: string) => boolean;
  onBasculer?: (ressourceId: string, jour: string) => void;
  /** Vue personnelle (Mon dashboard › Congés hors administrateur) : pas de bascule « Par projet » ; les données reçues ne contiennent déjà que la personne */
  soiSeul?: boolean;
  /** À droite de la barre : légende (lecture) ou choix du pinceau (édition) */
  droite: ReactNode;
}

export function CalendrierAbsences({ ctx, donnees, mois, onMois, editable = false, modifiable = () => false, onBasculer, droite, soiSeul = false }: Props) {
  const [vue, setVue] = useState<'equipe' | 'projet'>('equipe');
  const [projetId, setProjetId] = useState<string | null>(null);
  const types = valeursDe(donnees.valeurs, 'abs', true);
  const mc = contexteMois(mois.annee, mois.mois, donnees.joursFeries, types, donnees.absences, editable);
  const debut = mc.jours[0] ?? '', fin = mc.jours[mc.jours.length - 1] ?? debut;
  const proposes = projetsAvecMembres(donnees);
  const projet = proposes.find(p => p.id === projetId) ?? proposes[0];
  const elements = vue === 'projet' && !soiSeul
    ? (projet ? modeleParProjet(donnees, debut, fin, projet) : [])
    : unitesRacines(donnees.equipes).flatMap(e => modeleParEquipe(ctx, donnees, debut, fin, e));
  return (
    <Carte>
      <div className="carte-titre">
        <div className="ligne-flex">
          <NavigationMois annee={mois.annee} mois={mois.mois} onChanger={(annee, m) => onMois({ annee, mois: m })} />
          <div className="ligne-flex" style={{ marginLeft: 14 }}>
            <div className="puces">
              <button type="button" className={'puce' + (vue === 'equipe' ? ' active' : '')} onClick={() => setVue('equipe')}>Par équipe</button>
              {!soiSeul && <button type="button" className={'puce' + (vue === 'projet' ? ' active' : '')} onClick={() => setVue('projet')}>Par projet</button>}
            </div>
            {vue === 'projet' && (
              <Liste className="champ champ-compact" aria-label="Projet" valeur={projet?.id} onChoisir={setProjetId} options={proposes.map(p => ({ valeur: p.id, libelle: p.nom }))} />
            )}
          </div>
        </div>
        {droite}
      </div>
      {elements.length === 0 ? <Vide texte="Aucune ressource." /> : <Calendrier ctx={mc} lignes={lignesCalendrier(elements, modifiable)} onBasculer={onBasculer} />}
    </Carte>
  );
}
