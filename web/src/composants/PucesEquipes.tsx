/* ============================================================
   Filtre « Toutes les équipes / une équipe » en puces (Suivi de mes équipes › Projet : Gantt et Liste)
   Même rangée de puces sur les deux écrans, d'où un composant commun (règle n°4 : réutiliser avant de recréer).
   ============================================================ */
import { Pastille } from './Badge';
import { COULEURS } from '../domaine/config';
import type { Equipe } from '../domaine/types';

export function PucesEquipes({ equipes, choisie, onChoisir }: { equipes: readonly Equipe[]; choisie: string; onChoisir: (id: string) => void }) {
  const puce = (id: string, nom: string, couleur: string) => (
    <button key={id} type="button" className={'puce' + (choisie === id ? ' active' : '')} onClick={() => onChoisir(id)}><Pastille couleur={couleur} />{nom}</button>
  );
  return <div className="puces">{puce('toutes', 'Toutes les équipes', COULEURS.pale)}{equipes.map(e => puce(e.id, e.nom, e.couleur ?? COULEURS.pale))}</div>;
}
