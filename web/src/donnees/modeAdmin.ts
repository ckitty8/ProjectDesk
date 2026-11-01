/* ============================================================
   Mode administrateur (porteur, 2026-11-01) : un administrateur ou le créateur voit par défaut l'application avec son rôle ; le bouton
   « Passer en administrateur » de Mon profil active la vue complète. Le choix est mémorisé sur ce poste jusqu'au retour manuel.
   ============================================================ */
const CLE_MODE_ADMIN = 'pp_mode_admin';

export function lireModeAdmin(): boolean {
  try { return localStorage.getItem(CLE_MODE_ADMIN) === '1'; } catch { return false; }
}

export function memoriserModeAdmin(actif: boolean): void {
  try { localStorage.setItem(CLE_MODE_ADMIN, actif ? '1' : '0'); } catch { /* navigation privée */ }
}
