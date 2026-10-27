/* ============================================================
   Tableau de données (classes .tableau de theme.css)
   ------------------------------------------------------------
   Décrit par des colonnes : { cle, titre, cellule(ligne) } ; une ligne peut être cliquable (ouverture d'un panneau) et grisée
   (« inactive »). Les écrans migrés l'utilisent à la place du HTML construit à la main.
   ============================================================ */
import type { ReactNode } from 'react';

export interface Colonne<L> {
  cle: string;
  titre: ReactNode;
  cellule: (ligne: L) => ReactNode;
  /** Classe de la cellule (ex. « num », « nowrap ») */
  classe?: string;
}

interface PropsTableau<L> {
  colonnes: readonly Colonne<L>[];
  lignes: readonly L[];
  /** Identifiant stable d'une ligne */
  idLigne: (ligne: L) => string;
  /** Rend la ligne cliquable (et accessible au clavier) */
  onOuvrir?: (ligne: L) => void;
  /** Ligne grisée (ex. personne inactive) */
  inactive?: (ligne: L) => boolean;
  /** Message affiché quand il n'y a aucune ligne */
  videTexte?: string;
}

export function Tableau<L>({ colonnes, lignes, idLigne, onOuvrir, inactive, videTexte = 'Aucun élément.' }: PropsTableau<L>) {
  if (!lignes.length) return <div className="vide">{videTexte}</div>;
  return (
    <table className="tableau">
      <thead><tr>{colonnes.map(c => <th key={c.cle} scope="col">{c.titre}</th>)}</tr></thead>
      <tbody>
        {lignes.map(ligne => {
          const classes = [onOuvrir ? 'cliquable' : '', inactive?.(ligne) ? 'inactive' : ''].filter(Boolean).join(' ');
          return (
            <tr key={idLigne(ligne)} className={classes || undefined} tabIndex={onOuvrir ? 0 : undefined}
              onClick={onOuvrir && (() => onOuvrir(ligne))}
              onKeyDown={onOuvrir && (e => { if (e.key === 'Enter') onOuvrir(ligne); })}>
              {colonnes.map(c => <td key={c.cle} className={c.classe}>{c.cellule(ligne)}</td>)}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
