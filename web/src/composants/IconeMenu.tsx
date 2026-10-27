/* ============================================================
   Icônes de la barre latérale (tracés SVG de la maquette pilotage-projet/ ; portage de coquille.js — phase 5, vague A)
   ============================================================ */
const TRACES: Record<string, string> = {
  dash: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  proj: 'M3 6h18M3 12h12M3 18h7',
  road: 'M3 6h8M7 12h10M13 18h8',
  ress: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M21 19v-1a4 4 0 0 0-3-3.8M16 4.2a3 3 0 0 1 0 5.6',
  admin: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  time: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18',
  daily: 'M6 3h9l4 4v14H6zM9 10h7M9 14h7M9 18h4',
  idee: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3'
};

export function IconeMenu({ nom }: { nom: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <path d={TRACES[nom] ?? ''} />
    </svg>
  );
}
