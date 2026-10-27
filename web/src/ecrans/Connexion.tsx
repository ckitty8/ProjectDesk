/* ============================================================
   Connexion (provisoire, phase 3 de la migration) : email et mot de passe via Neon Auth.
   L'écran définitif (inscription, code de vérification, mot de passe oublié) est migré en vague A de la phase 5.
   ============================================================ */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useSession } from '../donnees/SessionProvider';

export function Connexion() {
  const { seConnecter } = useSession();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  async function envoyer(evenement: FormEvent) {
    evenement.preventDefault();
    setErreur(null);
    setEnvoiEnCours(true);
    try { await seConnecter(email.trim(), motDePasse); }
    catch (e) { setErreur((e as Error).message); }
    finally { setEnvoiEnCours(false); }
  }

  return (
    <main className="boite-socle">
      <h1>Connexion</h1>
      <form onSubmit={envoyer} className="formulaire-socle">
        <label>Email
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required />
        </label>
        <label>Mot de passe
          <input type="password" value={motDePasse} onChange={e => setMotDePasse(e.target.value)} autoComplete="current-password" required />
        </label>
        {erreur && <p role="alert" className="erreur-socle">{erreur}</p>}
        <button type="submit" className="btn" disabled={envoiEnCours}>Se connecter</button>
      </form>
    </main>
  );
}
