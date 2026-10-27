/* ============================================================
   Icônes (traits, couleur du texte) — portage de C.icone de app/js/composants.js (phase 4 de la migration)
   ============================================================ */
const TRACES = {
  direction: 'M4 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M16 9h3a1 1 0 0 1 1 1v11M8 7h4M8 11h4M8 15h4M3 21h18',
  equipe: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M21 19v-1a4 4 0 0 0-3-3.8M16 4.2a3 3 0 0 1 0 5.6',
  projet: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  modifier: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  supprimer: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  recherche: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3'
} as const;

export type NomIcone = keyof typeof TRACES;
export const NOMS_ICONES = Object.keys(TRACES) as NomIcone[];

export function Icone({ nom, taille = 16 }: { nom: NomIcone; taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" style={{ flex: '0 0 auto' }} aria-hidden="true">
      <path d={TRACES[nom]} />
    </svg>
  );
}
