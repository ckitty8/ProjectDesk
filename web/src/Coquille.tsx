/* ============================================================
   Coquille de l'application : barre latérale, en-tête, zone d'écran
   (portage de app/js/coquille.js — phase 5 de la migration, vague A)
   ------------------------------------------------------------
   Barre latérale (sections « Vue d’ensemble » en lecture et « Mon dashboard » en édition, menus filtrés par la matrice des
   droits : domaine/menus.ts), en-tête (fil d'Ariane, badge de mode, menu Aide) et bandeau de simulation. Les écrans plein écran
   (connexion, choix d'équipe) n'ont pas de coquille.
   ============================================================ */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Aide } from './composants/Aide';
import { Avatar, BadgeTon, Pastille } from './composants/Badge';
import { BandeauSimulation } from './composants/BandeauSimulation';
import { Bouton } from './composants/Bouton';
import { Carte } from './composants/Carte';
import { Modale } from './composants/Fenetres';
import { IconeMenu } from './composants/IconeMenu';
import { Marque, MentionPropriete } from './composants/Marque';
import { useSession } from './donnees/SessionProvider';
import { decoderChoixSimulation, libelleRoleSimule } from './donnees/simulation';
import { CONFIG, COULEURS, LIBELLES_ROLES } from './domaine/config';
import type { RoleAcces } from './domaine/config';
import { maRessource, mesEquipes, monRoleSansAdmin } from './domaine/droits';
import { estMenuVueEnsemble, menusDuRole } from './domaine/menus';
import { lireSectionsRepliees, memoriserSectionsRepliees } from './donnees/sectionsRepliees';
import type { Menu } from './domaine/menus';
import { AIDES, GUIDES, GUIDE_ECRANS } from './domaine/textes';
import { cheminDe } from './routes';
import type { Route } from './routes';

/* ---------- Barre latérale ---------- */

function LienMenu({ menu, idActif, alerte }: { menu: Menu; idActif: string; alerte: number }) {
  const actif = idActif === menu.id && !menu.enfants;
  return (
    <>
      <Link className={'menu-lien' + (actif ? ' actif' : '')} to={cheminDe(menu.id)}>
        <IconeMenu nom={menu.icone} /><span>{menu.libelle}</span>
        {alerte > 0 && <span className="pastille-alerte">{alerte}</span>}
      </Link>
      {menu.enfants && (
        <div className="sous-menu">
          {menu.enfants.map(e => (
            <Link key={e.id} className={'sous-lien' + (idActif === e.id ? ' actif' : '')} to={cheminDe(e.id)}>{e.libelle}</Link>
          ))}
        </div>
      )}
    </>
  );
}

/** Titre d'une section de la barre latérale : un clic la replie ou la déplie (flèche ▾ / ▸) */
function TitreSection({ cle, titre, aide, mention, repliee, onBasculer }:
  { cle: string; titre: string; aide: string; mention: string; repliee: ReadonlySet<string>; onBasculer: (cle: string) => void }) {
  return (
    <div className="menu-titre">
      <button type="button" className="menu-titre-bouton" aria-expanded={!repliee.has(cle)} onClick={() => onBasculer(cle)}>
        <span className="menu-titre-fleche">{repliee.has(cle) ? '▸' : '▾'}</span>{titre}
      </button>
      <span><Aide texte={aide} /> {mention}</span>
    </div>
  );
}

function BarreLaterale({ idActif, ouverte }: { idActif: string; ouverte: boolean }) {
  const { ctx, compte, equipeCourante, comptesEnAttente, simulation, modeAdmin, seDeconnecter } = useSession();
  // Sections repliables (porteur, 2026-11-04) : l'état est mémorisé sur ce poste
  const [repliee, setRepliee] = useState<ReadonlySet<string>>(lireSectionsRepliees);
  const basculer = (cle: string) => setRepliee(avant => {
    const suite = new Set(avant);
    if (!suite.delete(cle)) suite.add(cle);
    memoriserSectionsRepliees(suite);
    return suite;
  });
  if (!ctx || !compte) return null;
  const equipes = mesEquipes(ctx);
  const equipe = ctx.equipes.find(e => e.id === equipeCourante);
  const menus = menusDuRole(ctx);
  // Pendant une simulation, le bloc montre la personne simulée (pas le compte du créateur)
  const fiche = simulation ? maRessource(ctx) : null;
  const nom = fiche?.nom || compte.session.user.name || compte.session.user.email;
  // « Changer » d'équipe n'a de sens que s'il y a un choix : au moins deux équipes, ou une invitation à accepter
  const unChoix = equipes.length > 1 || compte.invitations.length > 0;
  const enAttente = comptesEnAttente.filter(c => !c.invite).length;
  return (
    <aside className={'laterale' + (ouverte ? ' ouverte' : '')}>
      <Marque />
      <nav>
        {menus.vue.length > 0 && (
          <>
            <TitreSection repliee={repliee} onBasculer={basculer} cle="vue" titre="Vue d’ensemble" aide={AIDES.sectionVue} mention="lecture" />
            {!repliee.has('vue') && menus.vue.map(m => <LienMenu key={m.id} menu={m} idActif={idActif} alerte={0} />)}
          </>
        )}
        {menus.equipes.length > 0 && (
          <>
            <TitreSection repliee={repliee} onBasculer={basculer} cle="equipes" titre="Suivi de mes équipes" aide={AIDES.sectionGeneral} mention="lecture" />
            {!repliee.has('equipes') && menus.equipes.map(m => <LienMenu key={m.id} menu={m} idActif={idActif} alerte={0} />)}
          </>
        )}
        {menus.moi.some(m => !m.horsBarre) && (
          <>
            <TitreSection repliee={repliee} onBasculer={basculer} cle="moi" titre="Mon dashboard" aide={AIDES.sectionMoi} mention="édition" />
            {!repliee.has('moi') && menus.moi.filter(m => !m.horsBarre).map(m => <LienMenu key={m.id} menu={m} idActif={idActif} alerte={m.id === 'monAdmin' ? enAttente : 0} />)}
          </>
        )}
      </nav>
      <div className="bloc-utilisateur">
        <div className="bloc-equipe">
          {equipe && <Pastille couleur={equipe.couleur ?? COULEURS.pale} />}<span className="discret">Équipe</span><b>{equipe ? equipe.nom : 'aucune'}</b>
          {unChoix && <Link to={cheminDe('choixEquipe')} state={{ retour: idActif }}>Changer</Link>}
        </div>
        <div className="bloc-moi">
          <Link className="moi-profil" to={cheminDe('profil')} title="Voir mon profil"><Avatar nom={nom} grand /></Link>
          <div>
            <Link className="moi-nom moi-profil" to={cheminDe('profil')} title="Voir mon profil">{nom}</Link>
            {simulation && <span className="badge-createur" title="Simulation des rôles en cours">simulation</span>}
            {modeAdmin && !simulation && <span className="badge-createur" title="Mode administrateur actif">administrateur</span>}
            {compte.session.user.emailVerified === false && !simulation && <><Link className="moi-sortie" to="/verifier-email">Vérifier mon email</Link> · </>}
            <button type="button" className="moi-sortie lien-btn" onClick={() => void seDeconnecter()}>Se déconnecter</button>
          </div>
        </div>
        <MentionPropriete />
      </div>
    </aside>
  );
}

/* ---------- En-tête et menu Aide ---------- */

/** Fenêtre d'aide : guide de l'écran ouvert, ou page générale (premiers pas, rôles et droits) */
function FenetreAide({ sujet, route, onFermer }: { sujet: string; route: Route; onFermer: () => void }) {
  const guide = sujet === 'ecran'
    ? { titre: 'Aide · ' + route.titre, paragraphes: (GUIDE_ECRANS as Record<string, readonly string[]>)[route.id] ?? ['Pas encore d’aide pour cet écran.'] }
    : (GUIDES as Record<string, { titre: string; paragraphes: readonly string[] }>)[sujet];
  if (!guide) return null;
  return (
    <Modale titre={guide.titre} onFermer={onFermer}>
      {guide.paragraphes.map(p => <p key={p} className="sans-marge">{p}</p>)}
      <p className="discret" style={{ margin: 0, fontSize: 12 }}>Astuce : survolez les ⓘ pour le détail d’un chiffre ou d’une règle.</p>
    </Modale>
  );
}

function MenuAide({ route }: { route: Route }) {
  const [ouvert, setOuvert] = useState(false);
  const [sujet, setSujet] = useState<string | null>(null);
  const entree = (cle: string, icone: string, libelle: string) => (
    <button type="button" className="menu-aide-entree" onClick={() => { setSujet(cle); setOuvert(false); }}>
      <span className="menu-aide-icone">{icone}</span>{libelle}
    </button>
  );
  return (
    <div className="menu-aide">
      <Bouton aria-expanded={ouvert} onClick={() => setOuvert(!ouvert)}><span className="menu-aide-icone">?</span> Aide</Bouton>
      {ouvert && (
        <div className="menu-aide-liste">
          {entree('ecran', '▶', 'Aide sur cet écran')}{entree('premiersPas', '⚑', 'Premiers pas')}{entree('roles', '⛨', 'Rôles et droits')}
          {CONFIG.CONTACT_AIDE && (
            <>
              <div className="menu-aide-sep" />
              <a className="menu-aide-entree" href={`mailto:${CONFIG.CONTACT_AIDE}?subject=${CONFIG.NOM_APPLICATION}`}>
                <span className="menu-aide-icone">✉</span>Contacter l’administrateur
              </a>
            </>
          )}
          <div className="menu-aide-sep" />
          <div className="menu-aide-propos">À propos : {CONFIG.NOM_APPLICATION} © {CONFIG.ANNEE_DROITS} {CONFIG.PROPRIETAIRE}</div>
        </div>
      )}
      {sujet && <FenetreAide sujet={sujet} route={route} onFermer={() => setSujet(null)} />}
    </div>
  );
}

/* ---------- Bandeau de simulation (en haut de chaque écran pendant la simulation) ---------- */

export function BandeauConnecte() {
  const { simulation, ctx, choixSimulation, demarrerSimulation, arreterSimulation, modeAdmin, definirModeAdmin } = useSession();
  const navigate = useNavigate();
  if (!ctx) return null;
  // Mode administrateur (porteur, 2026-11-01) : rappel en haut de chaque écran, avec le retour au rôle habituel
  if (modeAdmin && !simulation) {
    return (
      <div className="bandeau-mode-admin" role="status">
        <span>★ <b>Mode administrateur</b> : vous voyez tout ce que voit un administrateur</span>
        <span className="extensible" />
        <Bouton petit onClick={() => { definirModeAdmin(false); navigate('/'); }}>Revenir à mon rôle ({LIBELLES_ROLES[monRoleSansAdmin(ctx) as RoleAcces] ?? '—'})</Bouton>
      </div>
    );
  }
  if (!simulation) return null;
  const fiche = ctx.ressources.find(r => r.id === simulation.ressourceId);
  return (
    <BandeauSimulation libelleRole={libelleRoleSimule(simulation.cle)} nomPersonne={fiche?.nom} choix={choixSimulation}
      onChanger={v => demarrerSimulation(decoderChoixSimulation(v))}
      onArreter={() => { arreterSimulation(); navigate(cheminDe('adminCreateur')); }} />
  );
}

/* ---------- Page : coquille + contenu de l'écran ---------- */

/** Écran de « Mon dashboard » ouvert sans équipe, alors qu'il en demande une (sauf écran permis sans équipe) */
const SANS_EQUIPE_PERMIS = ['astuces', 'profil'];
// … et pour un administrateur : la vue d'organisation (Liste des ressources) et l'Administration, pour créer la première équipe
const SANS_EQUIPE_ADMIN = ['listeRessources', 'monAdmin', 'adminCreateur'];

/** L'écran fait-il partie de ceux que le rôle voit dans la barre latérale (menus de Mon dashboard) ? */
const ecranPermis = (route: Route, menus: ReturnType<typeof menusDuRole>): boolean => route.id === 'profil' ? true : route.section === 'general'
  ? menus.suivi.some(m => m.id === route.id)
  : menus.moi.some(m => m.id === route.id || (m.enfants ?? []).some(e => e.id === route.id));

export function Page({ route, children }: { route: Route; children: ReactNode }) {
  const { ctx, equipeCourante } = useSession();
  const [menuOuvert, setMenuOuvert] = useState(false);
  if (!ctx) return null;
  const general = route.section === 'general';
  const menus = menusDuRole(ctx);
  let contenu = children;
  if (!ecranPermis(route, menus)) {
    contenu = (
      <div className="ecran"><Carte classe="encart-info-ecran">
        <h2>Écran non ouvert à votre rôle</h2>
        <p className="discret">Votre rôle ne permet pas d’ouvrir cet écran : la matrice des droits ne l’ouvre pas.</p>
        <Link className="btn primaire" to={cheminDe(menus.suivi[0]?.id ?? menus.moi[0]?.id ?? 'choixEquipe')}>Ouvrir un écran disponible</Link>
      </Carte></div>
    );
  } else if (route.section === 'moi' && !equipeCourante && !SANS_EQUIPE_PERMIS.includes(route.id) && !(ctx.estAdmin && SANS_EQUIPE_ADMIN.includes(route.id))) {
    contenu = (
      <div className="ecran"><Carte classe="encart-info-ecran">
        <h2>Aucune équipe ouverte</h2>
        <p className="discret">Les écrans « Mon dashboard » travaillent dans une équipe. La section « Vue d’ensemble » reste consultable.</p>
        {mesEquipes(ctx).length > 0
          ? <Link className="btn primaire" to={cheminDe('choixEquipe')}>Choisir une équipe</Link>
          : ctx.estAdmin && <Link className="btn primaire" to={cheminDe('monAdmin')}>Créer une équipe (Administration)</Link>}
      </Carte></div>
    );
  }
  return (
    <div className="appli">
      <BarreLaterale idActif={route.id} ouverte={menuOuvert} />
      {menuOuvert && <div className="voile voile-menu" onClick={() => setMenuOuvert(false)} />}
      <main className="principal">
        <header className="entete">
          <Bouton className="bouton-menu" aria-label="Menu" title="Menu" onClick={() => setMenuOuvert(!menuOuvert)}>☰</Bouton>
          <div className="fil">
            {route.id === 'profil' ? <b>{route.titre}</b> : (
              <>
                <span className="discret">{!general ? 'Mon dashboard' : estMenuVueEnsemble(menus.vue.find(v => v.id === route.id) ?? { pourTous: false }) ? 'Vue d’ensemble' : 'Suivi de mes équipes'}</span><span className="sep">/</span><b>{route.titre}</b>
                {general ? <BadgeTon texte="Lecture seule" ton="neutre" /> : <BadgeTon texte="Édition" ton="info" />}
              </>
            )}
          </div>
          <div className="ligne-flex">
            <div className="recherche" title="Recherche : prévue dans une prochaine version">Rechercher un projet, une personne…<span>⌘K</span></div>
            <MenuAide route={route} />
          </div>
        </header>
        <div className="contenu"><BandeauConnecte />{contenu}</div>
      </main>
    </div>
  );
}
