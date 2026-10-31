/* ============================================================
   Coquille de l'application : barre latérale, en-tête, zone d'écran
   (portage de app/js/coquille.js — phase 5 de la migration, vague A)
   ------------------------------------------------------------
   Barre latérale (sections « Suivi de mes équipes » en lecture et « Mon dashboard » en édition, menus filtrés par la matrice des
   droits : domaine/menus.ts), en-tête (fil d'Ariane, badge de mode, menu Aide) et bandeau de simulation. Les écrans plein écran
   (connexion, choix d'équipe) n'ont pas de coquille.
   ============================================================ */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
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
import { CONFIG } from './domaine/config';
import { mesEquipes } from './domaine/droits';
import { menusDuRole } from './domaine/menus';
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

function BarreLaterale({ idActif, ouverte }: { idActif: string; ouverte: boolean }) {
  const { ctx, compte, equipeCourante, comptesEnAttente, simulation, seDeconnecter } = useSession();
  if (!ctx || !compte) return null;
  const equipes = mesEquipes(ctx);
  const equipe = ctx.equipes.find(e => e.id === equipeCourante);
  const menus = menusDuRole(ctx);
  const nom = compte.session.user.name || compte.session.user.email;
  // « Changer » d'équipe n'a de sens que s'il y a un choix : au moins deux équipes, ou une invitation à accepter
  const unChoix = equipes.length > 1 || compte.invitations.length > 0;
  const enAttente = comptesEnAttente.filter(c => !c.invite).length;
  return (
    <aside className={'laterale' + (ouverte ? ' ouverte' : '')}>
      <Marque />
      <nav>
        {menus.suivi.length > 0 && (
          <>
            <div className="menu-titre"><span>Suivi de mes équipes <Aide texte={AIDES.sectionGeneral} /></span><span>lecture</span></div>
            {menus.suivi.map(m => <LienMenu key={m.id} menu={m} idActif={idActif} alerte={0} />)}
          </>
        )}
        {menus.moi.length > 0 && (
          <>
            <div className="menu-titre"><span>Mon dashboard <Aide texte={AIDES.sectionMoi} /></span><span>édition</span></div>
            {menus.moi.map(m => <LienMenu key={m.id} menu={m} idActif={idActif} alerte={m.id === 'monAdmin' ? enAttente : 0} />)}
          </>
        )}
      </nav>
      <div className="bloc-utilisateur">
        <div className="bloc-equipe">
          {equipe && <Pastille couleur={equipe.couleur ?? '#8A93A3'} />}<span className="discret">Équipe</span><b>{equipe ? equipe.nom : 'aucune'}</b>
          {unChoix && <Link to={cheminDe('choixEquipe')} state={{ retour: idActif }}>Changer</Link>}
        </div>
        <div className="bloc-moi">
          <Avatar nom={nom} grand />
          <div>
            <div className="moi-nom">{nom}</div>
            {ctx.estCreateur && !simulation && <span className="badge-createur" title="Rôle Créateur : tous les droits, toutes les équipes">★ Créateur</span>}
            {simulation && <span className="badge-createur" title="Simulation des rôles en cours">simulation</span>}
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

function BandeauConnecte() {
  const { simulation, ctx, choixSimulation, demarrerSimulation, arreterSimulation } = useSession();
  if (!simulation || !ctx) return null;
  const fiche = ctx.ressources.find(r => r.id === simulation.ressourceId);
  return (
    <BandeauSimulation libelleRole={libelleRoleSimule(simulation.cle)} nomPersonne={fiche?.nom} choix={choixSimulation}
      onChanger={v => demarrerSimulation(decoderChoixSimulation(v))} onArreter={arreterSimulation} />
  );
}

/* ---------- Page : coquille + contenu de l'écran ---------- */

/** Écran de « Mon dashboard » ouvert sans équipe, alors qu'il en demande une (sauf écran permis sans équipe) */
const SANS_EQUIPE_PERMIS = ['astuces'];
// … et pour un administrateur : la vue d'organisation (Liste des ressources) et l'Administration, pour créer la première équipe
const SANS_EQUIPE_ADMIN = ['listeRessources', 'monAdmin', 'adminCreateur'];

/** L'écran fait-il partie de ceux que le rôle voit dans la barre latérale (menus de Mon dashboard) ? */
const ecranPermis = (route: Route, menus: ReturnType<typeof menusDuRole>): boolean => route.section === 'general'
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
        <p className="discret">Les écrans « Mon dashboard » travaillent dans une équipe. La section « Suivi de mes équipes » reste consultable.</p>
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
            <span className="discret">{general ? 'Suivi de mes équipes' : 'Mon dashboard'}</span><span className="sep">/</span><b>{route.titre}</b>
            {general ? <BadgeTon texte="Lecture seule" ton="neutre" /> : <BadgeTon texte="Édition" ton="info" />}
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
