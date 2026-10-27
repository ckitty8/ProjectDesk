/* ============================================================
   Écran « Connexion » (maquette complements/connexion.png ; portage de app/js/ecrans/connexion.js — phase 5, vague A)
   Onglets Connexion / Créer un compte (email et mot de passe ; connexion Google retirée le 2026-10-27), « Mot de passe oublié ? »
   (email de réinitialisation, puis choix du nouveau mot de passe au retour du lien).
   Vérification de l'email (maquette docs/maquettes/verification-email/) : code à 6 chiffres envoyé par Neon Auth, demandé une seule
   fois — après la création du compte, à la connexion d'un compte non vérifié (quand la vérification est exigée), ou à la demande
   (« Vérifier mon email » dans le bloc utilisateur, adresse /verifier-email).
   ============================================================ */
import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Carte } from '../composants/Carte';
import { Marque, MentionPropriete } from '../composants/Marque';
import { Onglets } from '../composants/Onglets';
import { connecter, demanderReinitialisation, envoyerCodeVerification, inscrire, lireSession, reinitialiserMotDePasse, verifierEmail } from '../donnees/api';
import { emailNonVerifie, messageConnexion } from '../donnees/messages';
import { useSession } from '../donnees/SessionProvider';

type Etape = 'connexion' | 'creation' | 'verification' | 'oubli' | 'nouveau';

const Message = ({ type, texte }: { type: 'erreur' | 'info'; texte: string | null }) =>
  texte ? <div className={type === 'erreur' ? 'message-erreur' : 'message-info'} role={type === 'erreur' ? 'alert' : 'status'}>{texte}</div> : null;

const Champ = ({ libelle, children }: { libelle: string; children: ReactNode }) => <div><label className="libelle">{libelle}{children}</label></div>;

/** Boîte centrée des écrans de connexion */
const Boite = ({ children, avecMarque = true }: { children: ReactNode; avecMarque?: boolean }) => (
  <div className="plein-ecran"><Carte classe="boite pile">{avecMarque && <Marque grand />}{children}<MentionPropriete complete /></Carte></div>
);

/** Saisie du code reçu par email (une seule fois par compte) */
function Verification({ email, info: infoInitiale, erreur: erreurInitiale, onRetour, onVerifie }: {
  email: string; info?: string | null; erreur?: string | null; onRetour: () => void; onVerifie: () => void;
}) {
  // Messages venus de l'écran parent tant que l'utilisateur n'a rien fait ; ensuite ceux de la saisie du code
  const [local, setLocal] = useState<{ erreur: string | null; info: string | null } | null>(null);
  const erreur = local ? local.erreur : erreurInitiale ?? null, info = local ? local.info : infoInitiale ?? null;
  const setErreur = (e: string | null) => setLocal(l => ({ info: l ? l.info : null, erreur: e }));
  const setInfo = (i: string | null) => setLocal(l => ({ erreur: l ? l.erreur : null, info: i }));

  async function valider(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get('code') ?? '').trim();
    try { await verifierEmail(email, code); onVerifie(); }
    catch (err) { setErreur(messageConnexion(err as Error, location.origin)); setInfo(null); }
  }
  async function renvoyer() {
    try { await envoyerCodeVerification(email); setErreur(null); setInfo('Nouveau code envoyé : utilisez le dernier email reçu.'); }
    catch (err) { setErreur(messageConnexion(err as Error, location.origin)); setInfo(null); }
  }

  return (
    <Boite>
      <h2 style={{ margin: '6px 0 0' }}>Vérifiez votre adresse email</h2>
      <div className="discret">
        Pour protéger votre compte, saisissez le code à 6 chiffres envoyé à <b style={{ color: 'var(--texte)' }}>{email}</b>
        {' '}(expéditeur « Neon Auth » — pensez aux indésirables). Cette étape n’a lieu qu’une seule fois.
      </div>
      <Message type="erreur" texte={erreur} /><Message type="info" texte={info} />
      <form className="pile" onSubmit={valider}>
        <input className="champ code-verification" name="code" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}"
          maxLength={6} placeholder="••••••" aria-label="Code à 6 chiffres" />
        <button className="btn primaire btn-connexion">Valider et me connecter</button>
      </form>
      <div className="ligne-flex" style={{ justifyContent: 'space-between', fontSize: 12.5 }}>
        <button type="button" className="lien-btn" onClick={() => void renvoyer()}>Renvoyer un code</button>
        <button type="button" className="lien-btn" onClick={onRetour}>Changer d’adresse ou de compte</button>
      </div>
    </Boite>
  );
}

/** Mot de passe oublié : « oubli » = demande de l'email ; « nouveau » = choix du nouveau mot de passe (retour du lien) */
function MotDePasseOublie({ nouveau, jeton, onRetour, onEnregistre }: {
  nouveau: boolean; jeton: string | null; onRetour: () => void; onEnregistre: () => void;
}) {
  const [email, setEmail] = useState('');
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (nouveau) {
      if (f.get('motDePasse') !== f.get('confirmation')) return setErreur('Les deux mots de passe sont différents.');
      try { await reinitialiserMotDePasse(jeton ?? '', String(f.get('motDePasse'))); onEnregistre(); }
      catch (err) {
        const lienPerime = /token|expired|invalid/i.test((err as Error).message || '');
        setErreur(lienPerime ? 'Lien expiré ou déjà utilisé : refaites une demande « Mot de passe oublié ? ».' : messageConnexion(err as Error, location.origin));
      }
      return;
    }
    const adresse = String(f.get('email'));
    setEmail(adresse);
    try { await demanderReinitialisation(adresse); setEnvoye(true); setErreur(null); }
    catch (err) { setErreur(messageConnexion(err as Error, location.origin)); }
  }

  return (
    <Boite avecMarque={false}>
      <h2>{nouveau ? 'Choisir un nouveau mot de passe' : 'Mot de passe oublié'}</h2>
      {envoye
        ? (
          <div className="message-info">
            Si un compte existe pour {email || 'cet email'}, un email de réinitialisation vient d’être envoyé (expéditeur « Neon Auth »).
            Ouvrez le lien qu’il contient ; pensez à regarder les indésirables.
          </div>
        )
        : (
          <form className="pile" onSubmit={envoyer}>
            <Message type="erreur" texte={erreur} />
            {nouveau
              ? (
                <>
                  <Champ libelle="Nouveau mot de passe (8 caractères minimum)">
                    <input className="champ" name="motDePasse" type="password" required minLength={8} autoComplete="new-password" />
                  </Champ>
                  <Champ libelle="Confirmer">
                    <input className="champ" name="confirmation" type="password" required minLength={8} autoComplete="new-password" />
                  </Champ>
                </>
              )
              : <Champ libelle="Email du compte"><input className="champ" name="email" type="email" required autoComplete="email" defaultValue={email} /></Champ>}
            <button className="btn primaire btn-connexion">{nouveau ? 'Enregistrer le mot de passe' : 'Recevoir le lien par email'}</button>
          </form>
        )}
      <button type="button" className="lien-btn centre texte-12-5" onClick={onRetour}>Retour à la connexion</button>
    </Boite>
  );
}

/** Écran de connexion : se connecter, créer un compte, vérifier l'email, réinitialiser le mot de passe */
export function Connexion() {
  const { actualiser } = useSession();
  const [recherche, setRecherche] = useSearchParams();
  // Retour du lien « Mot de passe oublié » (?token=…) : le jeton est gardé puis retiré de l'adresse
  const [jeton] = useState(() => recherche.get('token'));
  const [etape, setEtape] = useState<Etape>(jeton ? 'nouveau' : 'connexion');
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [nom, setNom] = useState('');
  useEffect(() => {
    if (!recherche.has('token')) return;
    const reste = new URLSearchParams(recherche);
    reste.delete('token');
    setRecherche(reste, { replace: true });
  }, [recherche, setRecherche]);

  const aller = (prochaine: Etape, message: string | null = null) => { setEtape(prochaine); setErreur(null); setInfo(message); };

  // Envoie un code à l'adresse et affiche la saisie du code
  async function ouvrirVerification(adresse: string) {
    try { await envoyerCodeVerification(adresse); aller('verification'); }
    catch (e) { setEtape('verification'); setErreur(messageConnexion(e as Error, location.origin)); setInfo(null); }
    setEmail(adresse);
  }

  // Connexion refusée parce que l'email n'est pas vérifié (vérification exigée) : envoi d'un code et saisie
  async function seConnecter(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget), adresse = String(f.get('email'));
    try { await connecter(adresse, String(f.get('motDePasse'))); await actualiser(); }
    catch (err) {
      if (emailNonVerifie(err as Error)) return ouvrirVerification(adresse);
      setErreur(messageConnexion(err as Error, location.origin)); setEmail(adresse);   // on garde l'email saisi
    }
  }

  // Création : si Neon Auth n'ouvre pas de session, c'est qu'il attend la vérification (code déjà envoyé)
  async function creerCompte(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget), adresse = String(f.get('email'));
    try {
      await inscrire(String(f.get('nom')), adresse, String(f.get('motDePasse')));
      if (await lireSession()) return actualiser();
      setEmail(adresse); aller('verification');
    } catch (err) { setErreur(messageConnexion(err as Error, location.origin)); setEmail(adresse); setNom(String(f.get('nom'))); }
  }

  if (etape === 'verification') {
    return <Verification email={email} info={info} erreur={erreur} onRetour={() => aller('connexion')}
      onVerifie={async () => { if (await lireSession()) return actualiser(); setEmail(email); aller('connexion', 'Adresse vérifiée : connectez-vous avec votre mot de passe.'); }} />;
  }
  if (etape === 'oubli' || etape === 'nouveau') {
    return <MotDePasseOublie nouveau={etape === 'nouveau'} jeton={jeton} onRetour={() => aller('connexion')}
      onEnregistre={() => aller('connexion', 'Mot de passe enregistré : connectez-vous avec votre email et ce nouveau mot de passe.')} />;
  }

  const creation = etape === 'creation';
  return (
    <Boite>
      <Onglets liste={[{ id: 'connexion', libelle: 'Connexion' }, { id: 'creation', libelle: 'Créer un compte' }]} actif={etape}
        onChoisir={id => aller(id as Etape)} />
      <form className="pile" style={{ marginTop: 18 }} onSubmit={creation ? creerCompte : seConnecter}>
        <Message type="erreur" texte={erreur} />{!creation && <Message type="info" texte={info} />}
        {creation && <Champ libelle="Nom complet"><input className="champ" name="nom" required autoComplete="name" defaultValue={nom} /></Champ>}
        <Champ libelle="Email"><input className="champ" name="email" type="email" required autoComplete="email" defaultValue={email} /></Champ>
        <Champ libelle="Mot de passe">
          <input className="champ" name="motDePasse" type="password" required minLength={8} autoComplete={creation ? 'new-password' : 'current-password'} />
        </Champ>
        <button className="btn primaire btn-connexion">{creation ? 'Créer mon compte' : 'Se connecter'}</button>
        {!creation && <button type="button" className="lien-btn centre texte-12-5" onClick={() => aller('oubli')}>Mot de passe oublié ?</button>}
      </form>
      <p className="discret" style={{ fontSize: 12, textAlign: 'center', margin: '18px 0 0' }}>
        Après la création d’un compte, l’accès aux équipes se fait sur invitation d’un administrateur.
      </p>
    </Boite>
  );
}

/** Adresse /verifier-email : vérifier l'email d'un compte déjà connecté (lien « Vérifier mon email » de la barre latérale) */
export function VerifierMonEmail() {
  const { compte, actualiser } = useSession();
  const navigate = useNavigate();
  const email = compte?.session.user.email ?? '';
  const [erreur, setErreur] = useState<string | null>(null);
  // Le code est envoyé à l'ouverture de l'écran, une seule fois (même si React rejoue l'effet en développement)
  const envoye = useRef(false);
  useEffect(() => {
    if (envoye.current) return;
    envoye.current = true;
    envoyerCodeVerification(email).catch(e => setErreur(messageConnexion(e as Error, location.origin)));
  }, [email]);
  return <Verification email={email} erreur={erreur} onRetour={() => navigate('/')} onVerifie={async () => { await actualiser(); navigate('/'); }} />;
}
