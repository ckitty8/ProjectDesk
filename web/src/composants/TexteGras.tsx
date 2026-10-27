/* ============================================================
   Texte avec passages en gras : les parties encadrées par « ** » sont affichées en gras (React échappe tout le reste)
   ============================================================ */
export function TexteGras({ texte }: { texte: string }) {
  return <>{texte.split('**').map((morceau, i) => (i % 2 ? <b key={i}>{morceau}</b> : morceau))}</>;
}
