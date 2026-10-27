/* ============================================================
   Messages de connexion
   (portage de messageConnexion et emailNonVerifie de app/js/ecrans/connexion.js — phase 5, vague A)
   ============================================================ */

/** Neon Auth refuse la connexion d'un compte dont l'email n'est pas vérifié (quand c'est exigé) */
export const emailNonVerifie = (e: { code?: string; message?: string }): boolean =>
  e.code === 'EMAIL_NOT_VERIFIED' || /email (is )?not verified/i.test(e.message || '');

/** Traduit les erreurs de Neon Auth en messages compréhensibles (origine = adresse du site, pour le message de domaine non autorisé) */
export function messageConnexion(e: { message?: string }, origine = ''): string {
  const m = e.message || '';
  if (/invalid email or password|invalid password|user not found/i.test(m)) return 'Email ou mot de passe incorrect.';
  if (/otp|code/i.test(m) && /invalid|expired|incorrect|too many/i.test(m)) {
    return 'Code incorrect ou expiré (valable quelques minutes). Vérifiez le dernier email reçu, ou demandez un nouveau code.';
  }
  if (/callbackurl|origin/i.test(m)) {
    return `Cette adresse (${origine}) n’est pas autorisée par Neon Auth : l’administrateur doit l’ajouter aux domaines de confiance (Console Neon › Auth).`;
  }
  if (/already exists|already registered|déjà/i.test(m)) return 'Un compte existe déjà avec cet email : utilisez l’onglet Connexion.';
  if (/failed to fetch|networkerror/i.test(m)) return 'Service de connexion injoignable. Vérifiez votre réseau puis réessayez.';
  if (/invalid_token/i.test(m)) return 'Lien de réinitialisation expiré ou déjà utilisé : refaites une demande « Mot de passe oublié ? ».';
  return m;
}
