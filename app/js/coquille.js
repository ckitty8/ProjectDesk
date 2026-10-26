/* ============================================================
   Coquille de l'application (maquette Pilotage_Projet.dc.html)
   ------------------------------------------------------------
   Barre latérale (sections « Suivi de mes équipes » en lecture — ex-« Général », renommée le 2026-10-12 — et « Mon dashboard »
   en édition), en-tête (fil d'Ariane + badge de mode), zone d'écran,
   panneau latéral et fenêtre modale. Les écrans plein écran
   (connexion, choix d'équipe) n'ont pas de coquille.
   ============================================================ */
'use strict';

const Coquille = (() => {
  const esc = C.esc;

  // Icônes (tracés SVG repris de la maquette)
  const ICONES = {
    dash: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z', proj: 'M3 6h18M3 12h12M3 18h7',
    road: 'M3 6h8M7 12h10M13 18h8',
    ress: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M21 19v-1a4 4 0 0 0-3-3.8M16 4.2a3 3 0 0 1 0 5.6',
    admin: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
    time: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18', daily: 'M6 3h9l4 4v14H6zM9 10h7M9 14h7M9 18h4',
    idee: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3'
  };
  const icone = nom => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="${ICONES[nom]}"></path></svg>`;

  // Menus : id d'écran, libellé, icône ; « enfants » = sous-menu
  // Suivi de mes équipes (identifiant de section : general) : même ordre que Mon dashboard (demande du porteur 2026-10-12) — Daily, Projets, Ressources
  // (avec le Timesheet, comme « Mon timesheet » est rangé dans Gestion des ressources), Administration
  /* Menus de Suivi de mes équipes : chacun affiché si le droit de son menu n'est pas « Non » (matrice, migration 037)
     et si au moins un de ses onglets est permis (ecranOuvert, migration 038 ; idem pour Mon dashboard) */
  const MENU_GENERAL = [
    { id: 'dashboard', libelle: 'Dashboard général', icone: 'dash', droit: 'suivi_dashboard' },
    { id: 'dailyEquipes', libelle: 'Daily des équipes', icone: 'daily', droit: 'daily_equipes' },
    { id: 'projets', libelle: 'Projets et Roadmap', icone: 'proj', droit: 'suivi_projets' },
    { id: 'ressources', libelle: 'Gestion des ressources', icone: 'ress', droit: 'suivi_ressources' },
    // Pas d'Administration dans Suivi de mes équipes (porteur, 2026-10-22) : elle est dans Mon dashboard
    { id: 'timesheet', libelle: 'Timesheet', icone: 'time', droit: 'suivi_timesheet' }
  ];
  const MENU_MOI = [
    // Daily et Saisir mes heures : droit « mon_dashboard » (Daily · Saisir mes heures) ; chaque autre menu suit ses propres lignes de la matrice
    { id: 'daily', libelle: 'Daily', icone: 'daily', droit: 'mon_dashboard' },
    // Projets et Roadmap : sous-menus comme Gestion des ressources (porteur 2026-10-23, maquette menu-projets-roadmap/)
    // Chaque sous-menu suit sa ligne de la matrice : Mises en production = droit « projets », Sprints = son onglet (porteur 2026-10-25)
    { id: 'mesProjets', libelle: 'Projets et Roadmap', icone: 'road',
      enfants: [{ id: 'mesProjets', libelle: 'Mises en production', droit: 'projets' }, { id: 'mesSprints', libelle: 'Sprints' }] },
    { id: 'conges', libelle: 'Gestion des ressources', icone: 'ress',
      enfants: [{ id: 'conges', libelle: 'Congés' },
        // Liste des ressources : ouverte si le rôle a l'un de ses deux droits (fiches, affectations) — le rôle Utilisateur n'en a aucun
        { id: 'listeRessources', libelle: 'Liste des ressources', droit: ['fiches_ressources', 'affecter'] }] },
    // Saisir mes heures : menu à part, sorti de Gestion des ressources (porteur, 2026-10-22) ; le suivi des équipes
    // et la validation se font dans Suivi de mes équipes › Timesheet
    { id: 'monTimesheet', libelle: 'Saisir mes heures', icone: 'time', droit: 'mon_dashboard' },
    { id: 'astuces', libelle: 'Trucs et astuces', icone: 'idee' },
    // Pastille rouge : comptes inscrits qui attendent un accès (administrateurs, migration 024)
    { id: 'monAdmin', libelle: 'Administration', icone: 'admin', alerte: () => etat.comptesEnAttente.filter(c => !c.invite).length },
    // Administration créateur : réservée au créateur (porteur, 2026-10-23) — Simulation des rôles
    { id: 'adminCreateur', libelle: 'Administration créateur', icone: 'admin', visible: () => Simulation.estDisponible() }
  ];
  const PLEIN_ECRAN = ['connexion', 'choixEquipe'];

  /* Menu ouvert à un rôle (le mien si aucun rôle n'est précisé) : son écran (ou, pour un menu à sous-menus, l'un de
     ses sous-menus) a un onglet permis, et le droit propre du sous-menu n'est pas « Non » */
  const droitOuvert = (droit, role) => [].concat(droit).some(d => niveauPour(d, role) !== 'non');   // un droit, ou une liste dont un seul suffit
  const enfantOuvert = (e, role) => (!e.droit || droitOuvert(e.droit, role)) && ecranOuvert(e.id, role);
  const menuOuvert = (item, role) => item.enfants ? item.enfants.some(e => enfantOuvert(e, role))
    : (!item.droit || droitOuvert(item.droit, role)) && ecranOuvert(item.id, role);

  /* Menus que voit un rôle, d'après la matrice : { suivi, moi } (listes de menus avec leurs sous-menus ouverts).
     Sert à la barre latérale (mon rôle) et aux cartes des rôles (Simulation, Qui a quel rôle) : un seul calcul, donc
     jamais d'écart entre ce qui est décrit et ce qui est affiché. Le menu du créateur n'est pas un menu de rôle. */
  function menusDuRole(role) {
    const suivi = MENU_GENERAL.filter(item => niveauPour(item.droit, role) !== 'non' && ecranOuvert(item.id, role));
    // Mon dashboard est fermé en Lecture seule (migration 030) ; sinon chaque menu suit ses droits : le droit « Daily · Saisir
    // mes heures » ne ferme que Daily et Saisir mes heures (porteur 2026-10-26), pas toute la section
    const moi = (role || monRole()) === 'lecture' ? []
      : MENU_MOI.filter(item => (role ? !item.visible : (!item.visible || item.visible())) && menuOuvert(item, role))
        .map(item => ({ ...item, enfants: item.enfants && item.enfants.filter(e => enfantOuvert(e, role)) }));
    return { suivi, moi };
  }
  // « Suivi : Dashboard général, Timesheet · Mon dashboard : Daily, Gestion des ressources (Congés, …) » pour un rôle
  function resumeDuRole(role) {
    const { suivi, moi } = menusDuRole(role);
    const nom = m => m.libelle + (m.enfants ? ` (${m.enfants.map(e => e.libelle).join(', ')})` : '');
    return `Suivi : ${suivi.map(nom).join(', ') || 'aucun menu'} · Mon dashboard : ${moi.map(nom).join(', ') || 'aucun menu'}`;
  }

  function lienMenu(item) {
    const actif = etat.ecran === item.id && !item.enfants;
    const alerte = item.alerte ? item.alerte() : 0;
    const html = `<a class="menu-lien${actif ? ' actif' : ''}" data-action="aller" data-ecran="${item.id}">${icone(item.icone)}
      <span>${esc(item.libelle)}</span>${alerte ? `<span class="pastille-alerte">${alerte}</span>` : ''}</a>`;
    if (!item.enfants) return html;
    return html + `<div class="sous-menu">${item.enfants.map(e =>
      `<a class="sous-lien${etat.ecran === e.id ? ' actif' : ''}" data-action="aller" data-ecran="${e.id}">${esc(e.libelle)}</a>`).join('')}</div>`;
  }

  // Barre latérale : logo, menus des deux sections (filtrés selon le rôle), bloc équipe et utilisateur
  function barreLaterale() {
    const eq = equipe(etat.equipeCourante);
    const nom = etat.session.user.name || etat.session.user.email;
    const menus = menusDuRole();
    return `
    <aside class="laterale${ui('menuLateral', { ouvert: false }).ouvert ? ' ouverte' : ''}">
      ${C.marque()}
      <nav>
        ${menus.suivi.length ? `<div class="menu-titre"><span>Suivi de mes équipes ${C.aide('sectionGeneral')}</span><span>lecture</span></div>
        ${menus.suivi.map(lienMenu).join('')}` : ''}
        ${!menus.moi.length ? '' : `<div class="menu-titre"><span>Mon dashboard ${C.aide('sectionMoi')}</span><span>édition</span></div>
        ${menus.moi.map(lienMenu).join('')}`}
      </nav>
      <div class="bloc-utilisateur">
        <div class="bloc-equipe">${C.pastille(eq.couleur)}<span class="discret">Équipe</span><b>${etat.equipeCourante ? esc(eq.nom) : 'aucune'}</b>
          ${unChoixDEquipe() ? '<a data-action="changerEquipe">Changer</a>' : ''}</div>
        <div class="bloc-moi">${C.avatar(nom, true)}<div><div class="moi-nom">${esc(nom)}</div>
          ${etat.estCreateur ? '<span class="badge-createur" title="Rôle Créateur : tous les droits, toutes les équipes">★ Créateur</span>' : ''}
          ${etat.simulation ? '<span class="badge-createur" title="Simulation des rôles en cours">simulation</span>' : ''}
          ${etat.session.user.emailVerified === false && !etat.simulation ? '<a class="moi-sortie" data-action="verifierMonEmail">Vérifier mon email</a> · ' : ''}
          <a class="moi-sortie" data-action="deconnexion">Se déconnecter</a></div></div>
        ${C.mentionPropriete()}
      </div>
    </aside>`;
  }

  // En-tête de l'écran : fil d'Ariane, badge Lecture seule / Édition selon la section, recherche, Aide
  function enTete(ecran) {
    const general = ecran.section === 'general';
    return `
    <header class="entete">
      <button class="btn bouton-menu" data-action="basculerMenuLateral" aria-label="Menu" title="Menu">☰</button>
      <div class="fil"><span class="discret">${general ? 'Suivi de mes équipes' : 'Mon dashboard'}</span><span class="sep">/</span>
        <b>${esc(ecran.titre)}</b>
        ${general ? C.badgeTon('Lecture seule', 'neutre') : C.badgeTon('Édition', 'info')}</div>
      <div class="ligne-flex">
        <div class="recherche" title="Recherche : prévue dans une prochaine version">Rechercher un projet, une personne…<span>⌘K</span></div>
        ${menuAide()}</div>
    </header>`;
  }

  // Bouton « Aide » et son menu (guides : config.js, GUIDE_ECRANS et GUIDES)
  function menuAide() {
    const ouvert = ui('menuAide', { ouvert: false }).ouvert;
    const entree = (sujet, icone, libelle) => `<a class="menu-aide-entree" data-action="ouvrirAide" data-sujet="${sujet}">
      <span class="menu-aide-icone">${icone}</span>${libelle}</a>`;
    return `<div class="menu-aide">
      <button class="btn" data-action="basculerMenuAide" aria-expanded="${ouvert}"><span class="menu-aide-icone">?</span> Aide</button>
      ${ouvert ? `<div class="menu-aide-liste">
        ${entree('ecran', '▶', 'Aide sur cet écran')}${entree('premiersPas', '⚑', 'Premiers pas')}${entree('roles', '⛨', 'Rôles et droits')}
        ${CONFIG.CONTACT_AIDE ? `<div class="menu-aide-sep"></div><a class="menu-aide-entree" href="mailto:${esc(CONFIG.CONTACT_AIDE)}?subject=ProjectDesk">
          <span class="menu-aide-icone">✉</span>Contacter l’administrateur</a>` : ''}
        <div class="menu-aide-sep"></div><div class="menu-aide-propos">À propos : ${esc(CONFIG.NOM_APPLICATION)} © ${CONFIG.ANNEE_DROITS} ${esc(CONFIG.PROPRIETAIRE)}</div>
      </div>` : ''}</div>`;
  }

  // Écran de Mon dashboard ouvert sans équipe, alors qu'il en demande une (sauf écran permis sans équipe)
  const attendUneEquipe = ecran => ecran.section === 'moi' && !etat.equipeCourante && !(ecran.sansEquipePermis && ecran.sansEquipePermis());

  // « Changer » d'équipe n'a de sens que s'il y a un choix : au moins deux équipes, ou une invitation à accepter
  const unChoixDEquipe = () => mesEquipes().length > 1 || etat.invitations.length > 0;

  // L'écran ouvert (menu ou sous-menu de Mon dashboard) fait-il partie de ceux que mon rôle voit dans la barre latérale ?
  const ecranMoiPermis = () => menusDuRole().moi.some(m => m.id === etat.ecran || (m.enfants || []).some(e => e.id === etat.ecran));

  // Contenu de l'écran : écran fermé à mon rôle, équipe demandée si besoin, sinon l'écran
  function contenuEcran(ecran) {
    if (ecran.section === 'moi' && !ecranMoiPermis()) {
      return `<div class="ecran"><div class="carte" style="padding:20px;max-width:640px"><h2>Écran non ouvert à votre rôle</h2>
        <p class="discret">Votre rôle permet de consulter « Suivi de mes équipes » ; cet écran de « Mon dashboard » n’est pas ouvert par la matrice des droits.</p>
        <button class="btn primaire" data-action="aller" data-ecran="dashboard">Ouvrir le Dashboard général</button></div></div>`;
    }
    return attendUneEquipe(ecran) ? sansEquipe() : ecran.rendre();
  }

  // « Mon dashboard » demande une équipe ouverte (cas d'un administrateur sans équipe)
  function sansEquipe() {
    return `<div class="ecran"><div class="carte" style="padding:20px;max-width:640px">
      <h2>Aucune équipe ouverte</h2>
      <p class="discret">Les écrans « Mon dashboard » travaillent dans une équipe. La section « Suivi de mes équipes » reste consultable.</p>
      ${mesEquipes().length ? '<button class="btn primaire" data-action="changerEquipe">Choisir une équipe</button>'
        : etat.estAdmin ? '<button class="btn primaire" data-action="aller" data-ecran="monAdmin">Créer une équipe (Administration)</button>' : ''}
    </div></div>`;
  }

  // Rendu complet de la page selon l'état
  function rendre() {
    if (etat.chargement) return `<div class="plein-ecran"><div class="chargement">Chargement…</div></div>`;
    if (etat.erreur) return `<div class="plein-ecran"><div class="carte boite"><h2>Connexion aux données impossible</h2>
      <p>${esc(etat.erreur)}</p><button class="btn primaire" data-action="reessayer">Réessayer</button>
      <button class="btn" data-action="deconnexion">Se déconnecter</button></div></div>`;
    if (PLEIN_ECRAN.includes(etat.ecran)) return Simulation.bandeau() + Ecrans[etat.ecran].rendre();
    const ecran = Ecrans[etat.ecran] || Ecrans.dashboard;
    return `
    <div class="appli">
      ${barreLaterale()}
      ${ui('menuLateral', { ouvert: false }).ouvert ? '<div class="voile voile-menu" data-action="basculerMenuLateral"></div>' : ''}
      <main class="principal">
        ${enTete(ecran)}
        <div class="contenu">${Simulation.bandeau()}${contenuEcran(ecran)}</div>
      </main>
      ${etat.panneau ? `<div class="voile" data-action="fermer"></div>${Panneau.rendre()}` : ''}
      ${etat.modale ? `<div class="voile" data-action="fermer"></div>${Modale.rendre()}` : ''}
    </div>`;
  }

  return { rendre, resumeDuRole };
})();

// Actions de la coquille
Object.assign(Actions, {
  reessayer: () => demarrer(),
  // Ouvre le choix d'équipe en mémorisant l'écran d'où l'on vient, pour que la croix de la fenêtre y revienne
  changerEquipe: () => { majUi('choixEquipe', { retour: etat.ecran }, { rendre: false }); allerA('choixEquipe'); },
  async deconnexion() {
    await Api.deconnecter().catch(() => {});
    majEtat({ session: null, equipeCourante: null, ecran: 'connexion', d: {}, simulation: null, reel: null });
  }
});

/* Bouton Aide : ouverture du menu, affichage d'un guide dans une fenêtre */
Object.assign(Actions, {
  // Écran étroit : le menu latéral s'ouvre par-dessus le contenu (bouton ☰ de l'en-tête)
  basculerMenuLateral: () => majUi('menuLateral', { ouvert: !ui('menuLateral', { ouvert: false }).ouvert }),
  basculerMenuAide: () => majUi('menuAide', { ouvert: !ui('menuAide', { ouvert: false }).ouvert }),
  ouvrirAide(d) {
    majUi('menuAide', { ouvert: false }, { rendre: false });
    majEtat({ modale: { type: 'aide', sujet: d.sujet } });
  }
});
