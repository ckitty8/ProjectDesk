/* ============================================================
   Cartes et blocs de page (portage de C.entete, C.kpi, C.barreOutils, C.vide, C.aucunOnglet de app/js/composants.js)
   (phase 4 de la migration)
   ============================================================ */
import type { ReactNode } from 'react';
import { Aide } from './Aide';

export const Carte = ({ children, classe = '' }: { children: ReactNode; classe?: string }) =>
  <div className={`carte ${classe}`.trim()}>{children}</div>;

/** Message « rien à afficher » */
export const Vide = ({ texte }: { texte: string }) => <div className="vide">{texte}</div>;

/** Carte affichée quand aucun onglet d'un écran n'est ouvert au rôle (droits par onglet, migration 038) */
export const AucunOnglet = () => <Carte><Vide texte="Aucun onglet de cet écran n’est ouvert à votre rôle." /></Carte>;

/** Titre d'écran + sous-titre + zone d'actions à droite */
export function EnteteEcran({ titre, sousTitre, actions }: { titre: string; sousTitre?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="entete-ecran">
      <div><h1>{titre}</h1><div className="sous-titre">{sousTitre}</div></div>
      <div className="actions-ecran">{actions}</div>
    </div>
  );
}

/** Carte indicateur (KPI) ; « aide » = texte de la bulle ⓘ à côté du libellé */
export function Kpi({ libelle, valeur, complement, aide }: { libelle: string; valeur: ReactNode; complement?: ReactNode; aide?: string }) {
  return (
    <div className="carte kpi">
      <div className="kpi-libelle">{libelle}{aide && <>{' '}<Aide texte={aide} /></>}</div>
      <div className="kpi-valeur">{valeur}<span className="kpi-complement">{complement}</span></div>
    </div>
  );
}

/** Barre d'outils en haut d'un onglet : carte avec les choix à gauche, boutons ou note à droite */
export function BarreOutils({ gauche, droite }: { gauche: ReactNode; droite?: ReactNode }) {
  return (
    <div className="carte encart-compact">
      <div className="ligne-flex entre"><div className="ligne-flex">{gauche}</div>{droite}</div>
    </div>
  );
}
