/* ============================================================
   Bandeau violet de la simulation de rôle (portage de Simulation.bandeau de app/js/simulation.js — phase 4 de la migration)
   ------------------------------------------------------------
   Affiché en haut de chaque écran pendant la simulation : rôle simulé, changement de rôle, retour au rôle de créateur.
   Composant sans état : l'écran lui donne le libellé et les choix (voir choixSimulation, donnees/simulation.ts).
   ============================================================ */
import { Bouton } from './Bouton';
import { Liste } from './Liste';
import type { OptionListe } from './Liste';

interface PropsBandeau {
  /** Rôle simulé, ex. « Utilisateur » */
  libelleRole: string;
  /** Personne simulée (absente pour un compte sans équipe) */
  nomPersonne?: string;
  choix: readonly OptionListe[];
  onChanger: (valeur: string) => void;
  onArreter: () => void;
}

export function BandeauSimulation({ libelleRole, nomPersonne, choix, onChanger, onArreter }: PropsBandeau) {
  return (
    <div className="bandeau-simulation" role="status">
      <span>
        ★ <b>Simulation</b> : vous voyez l’application en tant que <b>{libelleRole}</b>{nomPersonne ? ` (${nomPersonne})` : ''}
        {' '}— lecture seule, rien n’est enregistré
      </span>
      <span className="extensible" />
      <Liste className="champ champ-mini" aria-label="Changer de rôle" valeur="" onChoisir={v => { if (v) onChanger(v); }}
        options={[{ valeur: '', libelle: 'Changer de rôle…' }, ...choix]} />
      <Bouton petit onClick={onArreter}>Revenir à mon rôle de créateur</Bouton>
    </div>
  );
}
