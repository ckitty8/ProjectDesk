/* ============================================================
   Sections repliées de la barre latérale (porteur, 2026-11-04 : « les 3 sections peuvent être pliées et/ou dépliées »)
   Le choix est mémorisé sur ce poste ; par défaut, tout est déplié.
   ============================================================ */
const CLE_SECTIONS_REPLIEES = 'pp_sections_repliees';

export function lireSectionsRepliees(): ReadonlySet<string> {
  try { return new Set(JSON.parse(localStorage.getItem(CLE_SECTIONS_REPLIEES) ?? '[]') as string[]); } catch { return new Set(); }
}

export function memoriserSectionsRepliees(repliees: ReadonlySet<string>): void {
  try { localStorage.setItem(CLE_SECTIONS_REPLIEES, JSON.stringify([...repliees])); } catch { /* navigation privée */ }
}
