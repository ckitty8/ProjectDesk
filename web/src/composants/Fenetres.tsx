/* ============================================================
   Panneau latéral et fenêtre modale (portage de Panneau.rendre / Modale.rendre de app/js, structure .voile + .panneau / .modale)
   (phase 4 de la migration)
   ------------------------------------------------------------
   Les deux partagent le même cadre : voile cliquable, titre avec une croix ✕ pour fermer (porteur 2026-10-22 : une croix, pas de
   bouton « Déconnecter »), corps défilant et pied d'actions. La touche Échap ferme aussi. Le contenu (formulaires) est fourni par
   l'écran : ces composants ne connaissent aucune règle métier.
   ============================================================ */
import { useEffect } from 'react';
import type { ReactNode } from 'react';

interface PropsFenetre {
  titre: string;
  /** Ligne au-dessus du titre (ex. l'équipe d'un projet) */
  surtitre?: ReactNode;
  onFermer: () => void;
  children: ReactNode;
  /** Boutons d'action en bas (Annuler, Enregistrer…) */
  pied?: ReactNode;
}

/** Ferme la fenêtre avec la touche Échap tant qu'elle est ouverte */
export function useFermerAvecEchap(onFermer: () => void): void {
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => { if (e.key === 'Escape') onFermer(); };
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
  }, [onFermer]);
}

export function Cadre({ classe, titre, surtitre, onFermer, children, pied }: PropsFenetre & { classe: 'panneau' | 'modale' }) {
  useFermerAvecEchap(onFermer);
  return (
    <>
      <div className="voile" data-testid="voile" onClick={onFermer} />
      <div className={classe} role="dialog" aria-modal="true" aria-label={titre}>
        <div className="panneau-entete">
          <div className="extensible">{surtitre}<h2>{titre}</h2></div>
          <button type="button" className="fermer" aria-label="Fermer" onClick={onFermer}>✕</button>
        </div>
        <div className="panneau-corps">{children}</div>
        {pied && <div className="panneau-pied">{pied}</div>}
      </div>
    </>
  );
}

/** Panneau latéral droit (ex. détail d'un projet) */
export const Panneau = (props: PropsFenetre) => <Cadre classe="panneau" {...props} />;

/** Fenêtre modale centrée (ex. affectations d'une ressource) */
export const Modale = (props: PropsFenetre) => <Cadre classe="modale" {...props} />;
