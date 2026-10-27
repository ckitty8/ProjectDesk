/* ============================================================
   Bulle d'information « ⓘ » (portage de C.aide) : texte visible au survol ou au clavier (tabulation)
   Le texte vient de l'appelant (les textes d'aide de l'application sont regroupés au même endroit).
   ============================================================ */
import { useRef } from 'react';
import { positionBulle } from './bulle';

export function Aide({ texte }: { texte: string }) {
  const icone = useRef<HTMLSpanElement>(null);
  const bulle = useRef<HTMLSpanElement>(null);

  // Place la bulle à l'ouverture (survol ou focus), une fois affichée : sa hauteur est alors connue
  function placer() {
    if (!icone.current || !bulle.current) return;
    const modale = icone.current.closest('.modale');
    const p = positionBulle(icone.current.getBoundingClientRect(), bulle.current.offsetHeight,
      { largeur: window.innerWidth, hauteur: window.innerHeight }, modale ? modale.getBoundingClientRect() : undefined);
    bulle.current.style.left = p.left + 'px';
    bulle.current.style.top = p.top + 'px';
  }

  return (
    <span ref={icone} className="aide" tabIndex={0} role="note" aria-label={texte} onMouseEnter={placer} onFocus={placer}>
      ⓘ<span ref={bulle} className="bulle">{texte}</span>
    </span>
  );
}
