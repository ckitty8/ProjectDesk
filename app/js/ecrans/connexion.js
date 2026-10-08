/* ============================================================
   Écran « Connexion » (maquette complements/connexion.png)
   Onglets Connexion / Créer un compte, connexion Google, « Mot de passe oublié ? »
   (email de réinitialisation, puis choix du nouveau mot de passe au retour du lien).
   Vérification de l'email (maquette docs/maquettes/verification-email/) : code à 6 chiffres
   envoyé par Neon Auth, demandé une seule fois — après la création du compte, à la connexion
   d'un compte non vérifié (quand la vérification est exigée), ou à la demande (« Vérifier mon
   email » dans le bloc utilisateur).
   ============================================================ */
'use strict';

Ecrans.connexion = {
  titre: 'Connexion',
  rendre() {
    const u = ui('connexion', { onglet: 'connexion' });
    if (u.onglet === 'oubli' || u.onglet === 'nouveau') return this.motDePasseOublie(u);
    if (u.onglet === 'verification') return this.verification(u);
    const creation = u.onglet === 'creation';
    return `
    <div class="plein-ecran"><div class="carte boite">
      <div class="marque"><div class="logo" style="width:32px;height:32px"><i style="height:8px"></i><i style="height:15px"></i><i style="height:11px;background:#9DB6FF"></i></div>
        <div class="marque-nom">${C.esc(CONFIG.NOM_APPLICATION)}</div></div>
      ${C.onglets([{ id: 'connexion', libelle: 'Connexion' }, { id: 'creation', libelle: 'Créer un compte' }], u.onglet, 'ongletConnexion')}
      <form class="pile" style="margin-top:18px" data-action-envoi="${creation ? 'creerCompte' : 'seConnecter'}">
        ${u.erreur ? `<div class="message-erreur">${C.esc(u.erreur)}</div>` : ''}
        ${u.info && !creation ? `<div class="message-info">${C.esc(u.info)}</div>` : ''}
        ${creation ? `<div><label class="libelle">Nom complet</label><input class="champ" name="nom" required autocomplete="name" value="${C.esc(u.nom || '')}"></div>` : ''}
        <div><label class="libelle">Email</label><input class="champ" name="email" type="email" required autocomplete="email" value="${C.esc(u.email || '')}"></div>
        <div><label class="libelle">Mot de passe</label><input class="champ" name="motDePasse" type="password" required minlength="8"
          autocomplete="${creation ? 'new-password' : 'current-password'}"></div>
        <button class="btn primaire" style="height:38px;justify-content:center">${creation ? 'Créer mon compte' : 'Se connecter'}</button>
        ${creation ? '' : '<a data-action="motDePasseOublie" style="text-align:center;font-size:12.5px">Mot de passe oublié ?</a>'}
      </form>
      <div style="text-align:center;color:var(--pale);margin:14px 0;font-size:12px">ou</div>
      <button class="btn" style="width:100%;height:38px;justify-content:center" data-action="connexionGoogle">Continuer avec Google</button>
      <p class="discret" style="font-size:12px;text-align:center;margin:18px 0 0">Après la création d’un compte, l’accès aux équipes se fait
        sur invitation d’un administrateur.</p>
    </div></div>`;
  },

  // Saisie du code reçu par email (une seule fois par compte)
  verification(u) {
    const esc = C.esc;
    return `<div class="plein-ecran"><div class="carte boite pile">
      <div class="marque"><div class="logo" style="width:32px;height:32px"><i style="height:8px"></i><i style="height:15px"></i><i style="height:11px;background:#9DB6FF"></i></div>
        <div class="marque-nom">${esc(CONFIG.NOM_APPLICATION)}</div></div>
      <h2 style="margin:6px 0 0">Vérifiez votre adresse email</h2>
      <div class="discret">Pour protéger votre compte, saisissez le code à 6 chiffres envoyé à <b style="color:var(--texte)">${esc(u.email)}</b>
        (expéditeur « Neon Auth » — pensez aux indésirables). Cette étape n’a lieu qu’une seule fois.</div>
      ${u.erreur ? `<div class="message-erreur">${esc(u.erreur)}</div>` : ''}${u.info ? `<div class="message-info">${esc(u.info)}</div>` : ''}
      <form class="pile" data-action-envoi="validerCodeEmail">
        <input class="champ code-verification" name="code" required inputmode="numeric" autocomplete="one-time-code"
          pattern="[0-9]{6}" maxlength="6" placeholder="••••••" aria-label="Code à 6 chiffres">
        <button class="btn primaire" style="height:38px;justify-content:center">Valider et me connecter</button>
      </form>
      <div class="ligne-flex" style="justify-content:space-between;font-size:12.5px">
        <a data-action="renvoyerCodeEmail">Renvoyer un code</a><a data-action="ongletConnexion" data-id="connexion">Changer d’adresse ou de compte</a></div>
    </div></div>`;
  },

  // Mot de passe oublié : 'oubli' = demande de l'email ; 'nouveau' = choix du nouveau mot de passe
  motDePasseOublie(u) {
    const esc = C.esc, nouveau = u.onglet === 'nouveau';
    const corps = u.envoye
      ? `<div class="message-info">Si un compte existe pour ${esc(u.email || 'cet email')}, un email de réinitialisation vient d’être envoyé
          (expéditeur « Neon Auth »). Ouvrez le lien qu’il contient ; pensez à regarder les indésirables.</div>`
      : `<form class="pile" data-action-envoi="${nouveau ? 'choisirMotDePasse' : 'envoyerReinitialisation'}">
          ${u.erreur ? `<div class="message-erreur">${esc(u.erreur)}</div>` : ''}
          ${nouveau
            ? `<div><label class="libelle">Nouveau mot de passe (8 caractères minimum)</label><input class="champ" name="motDePasse" type="password" required minlength="8" autocomplete="new-password"></div>
               <div><label class="libelle">Confirmer</label><input class="champ" name="confirmation" type="password" required minlength="8" autocomplete="new-password"></div>`
            : `<div><label class="libelle">Email du compte</label><input class="champ" name="email" type="email" required autocomplete="email" value="${esc(u.email || '')}"></div>`}
          <button class="btn primaire" style="height:38px;justify-content:center">${nouveau ? 'Enregistrer le mot de passe' : 'Recevoir le lien par email'}</button>
        </form>`;
    return `<div class="plein-ecran"><div class="carte boite pile">
      <h2>${nouveau ? 'Choisir un nouveau mot de passe' : 'Mot de passe oublié'}</h2>${corps}
      <a data-action="ongletConnexion" data-id="connexion" style="text-align:center;font-size:12.5px">Retour à la connexion</a></div></div>`;
  }
};

// Neon Auth refuse la connexion d'un compte dont l'email n'est pas vérifié (quand c'est exigé)
const emailNonVerifie = e => e.code === 'EMAIL_NOT_VERIFIED' || /email (is )?not verified/i.test(e.message || '');

// Envoie un code à l'adresse et affiche la saisie du code (écran plein écran de connexion)
async function ouvrirVerificationEmail(email) {
  try {
    await Api.envoyerCodeVerification(email);
    majUi('connexion', { onglet: 'verification', email, erreur: null, info: null }, { rendre: false });
  } catch (e) {
    majUi('connexion', { onglet: 'verification', email, erreur: messageConnexion(e), info: null }, { rendre: false });
  }
  majEtat({ ecran: 'connexion' });
}

// Traduit les erreurs de Neon Auth en messages compréhensibles
function messageConnexion(e) {
  const m = e.message || '';
  if (/invalid email or password|invalid password|user not found/i.test(m)) return 'Email ou mot de passe incorrect.';
  if (/otp|code/i.test(m) && /invalid|expired|incorrect|too many/i.test(m)) return 'Code incorrect ou expiré (valable quelques minutes). Vérifiez le dernier email reçu, ou demandez un nouveau code.';
  if (/callbackurl|origin/i.test(m)) return `Cette adresse (${location.origin}) n’est pas autorisée par Neon Auth : `
    + 'l’administrateur doit l’ajouter aux domaines de confiance (Console Neon › Auth).';
  if (/already exists|already registered|déjà/i.test(m)) return 'Un compte existe déjà avec cet email : utilisez l’onglet Connexion.';
  if (/failed to fetch|networkerror/i.test(m)) return 'Service de connexion injoignable. Vérifiez votre réseau puis réessayez.';
  if (/access_denied/i.test(m)) return 'Connexion Google annulée.';
  if (/invalid_token/i.test(m)) return 'Lien de réinitialisation expiré ou déjà utilisé : refaites une demande « Mot de passe oublié ? ».';
  if (/state|oauth|account_not_linked|unable_to_link|email_not_found/i.test(m)) return `La connexion Google a échoué (code : ${m}). Réessayez ou utilisez email et mot de passe.`;
  return m;
}

Object.assign(Actions, {
  ongletConnexion: d => majUi('connexion', { onglet: d.id, erreur: null }),

  // Connexion refusée parce que l'email n'est pas vérifié (vérification exigée) : envoi d'un code et saisie
  async seConnecter(_, form) {
    const f = new FormData(form), email = f.get('email');
    try { await Api.connecter(email, f.get('motDePasse')); majUi('connexion', { erreur: null }, { rendre: false }); await demarrer(); }
    catch (e) {
      if (emailNonVerifie(e)) return ouvrirVerificationEmail(email);
      majUi('connexion', { erreur: messageConnexion(e), email });   // on garde l'email saisi
    }
  },

  // Création : si Neon Auth n'ouvre pas de session, c'est qu'il attend la vérification (code déjà envoyé)
  async creerCompte(_, form) {
    const f = new FormData(form), email = f.get('email');
    try {
      await Api.inscrire(f.get('nom'), email, f.get('motDePasse'));
      if (await Api.lireSession()) return demarrer();
      majUi('connexion', { onglet: 'verification', email, erreur: null, info: null });
    } catch (e) { majUi('connexion', { erreur: messageConnexion(e), email, nom: f.get('nom') }); }
  },

  async validerCodeEmail(_, form) {
    const { email } = ui('connexion');
    try {
      await Api.verifierEmail(email, new FormData(form).get('code').trim());
      if (await Api.lireSession()) { majUi('connexion', { onglet: 'connexion', erreur: null, info: null }, { rendre: false }); return demarrer(); }
      majUi('connexion', { onglet: 'connexion', email, erreur: null, info: 'Adresse vérifiée : connectez-vous avec votre mot de passe.' });
    } catch (e) { majUi('connexion', { erreur: messageConnexion(e), info: null }); }
  },
  async renvoyerCodeEmail() {
    const { email } = ui('connexion');
    try { await Api.envoyerCodeVerification(email); majUi('connexion', { erreur: null, info: 'Nouveau code envoyé : utilisez le dernier email reçu.' }); }
    catch (e) { majUi('connexion', { erreur: messageConnexion(e), info: null }); }
  },
  // Depuis l'application (bloc utilisateur) : vérifier son email avant que ce soit exigé
  verifierMonEmail: () => ouvrirVerificationEmail(etat.session.user.email),

  motDePasseOublie: () => majUi('connexion', { onglet: 'oubli', erreur: null, envoye: false }),
  async envoyerReinitialisation(_, form) {
    const email = new FormData(form).get('email');
    try { await Api.demanderReinitialisation(email); majUi('connexion', { envoye: true, email, erreur: null }); }
    catch (e) { majUi('connexion', { erreur: messageConnexion(e), email }); }
  },
  async choisirMotDePasse(_, form) {
    const f = new FormData(form);
    if (f.get('motDePasse') !== f.get('confirmation')) return majUi('connexion', { erreur: 'Les deux mots de passe sont différents.' });
    try {
      await Api.reinitialiserMotDePasse(ui('connexion').jeton, f.get('motDePasse'));
      majUi('connexion', { onglet: 'connexion', jeton: null, erreur: null, info: 'Mot de passe enregistré : connectez-vous avec votre email et ce nouveau mot de passe.' });
    } catch (e) { majUi('connexion', { erreur: /token|expired|invalid/i.test(e.message || '') ? 'Lien expiré ou déjà utilisé : refaites une demande « Mot de passe oublié ? ».' : messageConnexion(e) }); }
  },

  async connexionGoogle() {
    try { await Api.connecterGoogle(); } catch (e) { majUi('connexion', { erreur: messageConnexion(e) }); }
  }
});
