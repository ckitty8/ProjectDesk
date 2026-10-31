/* ============================================================
   Compte non relié à une fiche ressource (Daily, Saisir mes heures) : la marche à suivre (portage de C.compteSansFiche)
   ============================================================ */
import { Carte } from './Carte';

export const CompteSansFiche = () => (
  <Carte classe="encart">
    Votre compte n’est lié à aucune fiche ressource : renseignez l’email de votre compte sur votre fiche (Liste des ressources), puis reconnectez-vous.
  </Carte>
);
