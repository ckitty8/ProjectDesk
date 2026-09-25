/* ============================================================
   Écran « Connexion » (maquette complements/connexion.png)
   Onglets Connexion / Créer un compte, connexion Google.
   ============================================================ */
'use strict';

Ecrans.connexion = {
  titre: 'Connexion',
  rendre() {
    const u = ui('connexion', { onglet: 'connexion' });
    const creation = u.onglet === 'creation';
    return `
    <div class="plein-ecran"><div class="carte boite">
      <div class="marque"><div class="logo" style="width:32px;height:32px"><i style="height:8px"></i><i style="height:15px"></i><i style="height:11px;background:#9DB6FF"></i></div>
        <div><div class="marque-nom">Pilotage Projet</div><div class="marque-sous">Multi-projets · Multi-équipes</div></div></div>
      ${C.onglets([{ id: 'connexion', libelle: 'Connexion' }, { id: 'creation', libelle: 'Créer un compte' }], u.onglet, 'ongletConnexion')}
      <form class="pile" style="margin-top:18px" data-action-envoi="${creation ? 'creerCompte' : 'seConnecter'}">
        ${u.erreur ? `<div class="message-erreur">${C.esc(u.erreur)}</div>` : ''}
        ${creation ? `<div><label class="libelle">Nom complet</label><input class="champ" name="nom" required autocomplete="name" value="${C.esc(u.nom || '')}"></div>` : ''}
        <div><label class="libelle">Email</label><input class="champ" name="email" type="email" required autocomplete="email" value="${C.esc(u.email || '')}"></div>
        <div><label class="libelle">Mot de passe</label><input class="champ" name="motDePasse" type="password" required minlength="8"
          autocomplete="${creation ? 'new-password' : 'current-password'}"></div>
        <button class="btn primaire" style="height:38px;justify-content:center">${creation ? 'Créer mon compte' : 'Se connecter'}</button>
      </form>
      <div style="text-align:center;color:var(--pale);margin:14px 0;font-size:12px">ou</div>
      <button class="btn" style="width:100%;height:38px;justify-content:center" data-action="connexionGoogle">Continuer avec Google</button>
      <p class="discret" style="font-size:12px;text-align:center;margin:18px 0 0">Un nouveau compte peut déposer des demandes ;
        l’accès aux équipes se fait sur invitation.</p>
    </div></div>`;
  }
};

// Traduit les erreurs de Neon Auth en messages compréhensibles
function messageConnexion(e) {
  const m = e.message || '';
  if (/invalid email or password|invalid password|user not found/i.test(m)) return 'Email ou mot de passe incorrect.';
  if (/callbackurl|origin/i.test(m)) return `Cette adresse (${location.origin}) n’est pas autorisée par Neon Auth : `
    + 'l’administrateur doit l’ajouter aux domaines de confiance (Console Neon › Auth).';
  if (/already exists|already registered|déjà/i.test(m)) return 'Un compte existe déjà avec cet email : utilisez l’onglet Connexion.';
  if (/failed to fetch|networkerror/i.test(m)) return 'Service de connexion injoignable. Vérifiez votre réseau puis réessayez.';
  if (/access_denied/i.test(m)) return 'Connexion Google annulée.';
  if (/state|oauth|account_not_linked|unable_to_link|email_not_found/i.test(m)) return `La connexion Google a échoué (code : ${m}). Réessayez ou utilisez email et mot de passe.`;
  return m;
}

Object.assign(Actions, {
  ongletConnexion: d => majUi('connexion', { onglet: d.id, erreur: null }),

  async seConnecter(_, form) {
    const f = new FormData(form);
    try { await Api.connecter(f.get('email'), f.get('motDePasse')); majUi('connexion', { erreur: null }, { rendre: false }); await demarrer(); }
    catch (e) { majUi('connexion', { erreur: messageConnexion(e), email: f.get('email') }); }   // on garde l'email saisi
  },

  async creerCompte(_, form) {
    const f = new FormData(form);
    try { await Api.inscrire(f.get('nom'), f.get('email'), f.get('motDePasse')); await demarrer(); }
    catch (e) { majUi('connexion', { erreur: messageConnexion(e), email: f.get('email'), nom: f.get('nom') }); }
  },

  async connexionGoogle() {
    try { await Api.connecterGoogle(); } catch (e) { majUi('connexion', { erreur: messageConnexion(e) }); }
  }
});
