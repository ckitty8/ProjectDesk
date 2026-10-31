/* ============================================================
   Mon dashboard › Administration (maquette 10-mAdmin.png ; portage de app/js/ecrans/mon-admin.js — phase 5, vague D)
   Onglets selon le périmètre puis le droit de chaque onglet (matrice, migration 038) : Comptes en attente et Rôles (administrateurs), Équipes
   (administrateurs et responsables), Référentiels, Jours fériés, Envoi du daily (projets que je pilote). Les demandes ne sont plus gérées ici (Azure DevOps,
   2026-10-05) ; les sprints sont dans Projets et Roadmap › Sprints. Accessible sans équipe ouverte pour un administrateur (création de la première équipe).
   ============================================================ */
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Comptes } from './administration/Comptes';
import { EnvoiDaily } from './administration/EnvoiDaily';
import { JoursFeries } from './administration/JoursFeries';
import { Referentiels } from './administration/Referentiels';
import { Roles } from './administration/Roles';
import { Equipes } from './administration/Equipes';
import { AucunOnglet, EnteteEcran } from '../composants/Carte';
import { Onglets } from '../composants/Onglets';
import { useSession } from '../donnees/SessionProvider';
import { ongletsAdministration } from '../domaine/admin';
import { aDroit } from '../domaine/droits';

export function Administration() {
  const { ctx, donnees, comptesEnAttente } = useSession();
  const { state } = useLocation() as { state: { onglet?: string } | null };
  const enAttente = comptesEnAttente.filter(c => !c.invite).length;
  // Onglet par défaut : demandé par l'écran d'origine (fiche › « Modifier dans Administration › Rôles »), sinon les comptes en attente s'il y en a
  const [choix, setChoix] = useState(state?.onglet ?? '');
  if (!ctx || !donnees) return null;
  const liste = ongletsAdministration(ctx, { enAttente, referentiels: donnees.referentiels.length, feries: donnees.joursFeries.length,
    envoisActifs: donnees.envoisDaily.filter(x => x.mode !== 'aucun').length });
  const parDefaut = ctx.estAdmin && enAttente ? 'comptes' : '';
  const onglet = (liste.find(o => o.id === (choix || parDefaut)) ?? liste[0])?.id;
  const modifieReferentiels = ctx.estAdmin && aDroit(ctx, 'administration');      // référentiels et jours fériés : sinon consultation
  return (
    <div className="ecran ecran-large">
      <EnteteEcran titre="Administration" sousTitre="Réglages de vos équipes, de vos projets et des accès" />
      {!onglet ? <AucunOnglet /> : (
        <>
          <Onglets liste={liste} actif={onglet} onChoisir={setChoix} />
          {onglet === 'comptes' && <Comptes />}
          {onglet === 'equipes' && <Equipes />}
          {onglet === 'referentiels' && <Referentiels modifiable={modifieReferentiels} />}
          {onglet === 'feries' && <JoursFeries modifiable={modifieReferentiels} />}
          {onglet === 'envoiDaily' && <EnvoiDaily />}
          {onglet === 'roles' && <Roles />}
        </>
      )}
    </div>
  );
}
