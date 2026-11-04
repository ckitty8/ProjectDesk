/* ============================================================
   Mon dashboard › Administration (maquette 10-mAdmin.png ; portage de app/js/ecrans/mon-admin.js — phase 5, vague D)
   Onglets selon le périmètre puis le droit de chaque onglet (matrice, migration 038) : Comptes en attente (administrateurs), Équipes
   (administrateurs et responsables), Référentiels, Ressources (administrateurs : profils, rôles, paramétrage des rôles), Jours fériés,
   Envoi du daily (projets que je pilote), Roadmap (administrateurs : colonnes du tableau de Vue d’ensemble › Roadmap).
   Les demandes ne sont plus gérées ici (Azure DevOps,
   2026-10-05) ; les sprints sont dans Mon dashboard › Projet › Sprints. Accessible sans équipe ouverte pour un administrateur (création de la première équipe).
   ============================================================ */
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { RoadmapAdmin } from './administration/RoadmapAdmin';
import { Comptes } from './administration/Comptes';
import { EnvoiDaily } from './administration/EnvoiDaily';
import { JoursFeries } from './administration/JoursFeries';
import { Referentiels } from './administration/Referentiels';
import { RessourcesAdmin } from './administration/RessourcesAdmin';
import { Equipes } from './administration/Equipes';
import { AucunOnglet, EnteteEcran } from '../composants/Carte';
import { MatriceDroits } from './administration/MatriceDroits';
import { MenusEquipes } from './administration/MenusEquipes';
import { Onglets } from '../composants/Onglets';
import { useSession } from '../donnees/SessionProvider';
import { ongletsAdministration } from '../domaine/admin';
import { REFERENTIELS_RESSOURCES } from '../domaine/config';
import { referentielsAffiches } from '../domaine/referentiels';
import { estListeRoadmap } from '../domaine/roadmap';
import { aDroit } from '../domaine/droits';

/** Écran Administration : onglets permis au rôle (ongletsAdministration), puis le contenu de l'onglet choisi */
export function Administration() {
  const { ctx, donnees, comptesEnAttente } = useSession();
  const { state } = useLocation() as { state: { onglet?: string; entree?: string } | null };
  const enAttente = comptesEnAttente.filter(c => !c.invite).length;
  // Onglet par défaut : demandé par l'écran d'origine (fiche › « Modifier dans Ressources › Paramétrage des rôles »), sinon les comptes en attente s'il y en a
  const [choix, setChoix] = useState(state?.onglet ?? '');
  if (!ctx || !donnees) return null;
  // Référentiels montrés ailleurs : ceux de l'onglet Ressources, et les listes déroulantes de la Roadmap (réglées dans l'onglet Roadmap)
  const autresOnglets = [...REFERENTIELS_RESSOURCES, ...donnees.referentiels.filter(r => estListeRoadmap(r.id)).map(r => r.id)];
  const liste = ongletsAdministration(ctx, { enAttente, referentiels: referentielsAffiches(donnees.referentiels, undefined, autresOnglets).length,
    ressources: REFERENTIELS_RESSOURCES.length + 2, feries: donnees.joursFeries.length,
    envoisActifs: donnees.envoisDaily.filter(x => x.mode !== 'aucun').length, colonnesRoadmap: donnees.colonnesRoadmap.length });
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
          {onglet === 'referentiels' && <Referentiels modifiable={modifieReferentiels} cacher={autresOnglets} />}
          {onglet === 'ressources' && <RessourcesAdmin modifiable={modifieReferentiels} entreeInitiale={state?.entree} />}
          {onglet === 'feries' && <JoursFeries modifiable={modifieReferentiels} />}
          {onglet === 'envoiDaily' && <EnvoiDaily />}
          {onglet === 'roadmap' && <RoadmapAdmin modifiable={modifieReferentiels} />}
          {onglet === 'menusEquipes' && <MenusEquipes />}
          {onglet === 'matrice' && <MatriceDroits />}
        </>
      )}
    </div>
  );
}
