/* ============================================================
   Écran pas encore migré (phase 5 de la migration, vagues B à D)
   L'écran existe dans l'application actuelle (/app/) ; la nouvelle application affiche cette page à sa place, avec la barre latérale
   complète, jusqu'à la migration de l'écran (docs/specifications/migration-react.md).
   ============================================================ */
import { Carte, EnteteEcran } from '../composants/Carte';
import type { Route } from '../routes';

export function EcranAMigrer({ route }: { route: Route }) {
  return (
    <div className="ecran">
      <EnteteEcran titre={route.titre} />
      <Carte classe="encart-info-ecran">
        <h2>Cet écran n’est pas encore migré</h2>
        <p className="discret">
          Il est disponible dans l’application actuelle ; il arrivera dans la nouvelle lors d’une prochaine vague de la migration.
        </p>
        <a className="btn primaire" href="/app/">Ouvrir l’application actuelle</a>
      </Carte>
    </div>
  );
}
