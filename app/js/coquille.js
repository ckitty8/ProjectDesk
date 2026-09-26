/* ============================================================
   Coquille de l'application (maquette Pilotage_Projet.dc.html)
   ------------------------------------------------------------
   Barre latérale (sections « Général » en lecture et « Mon dashboard »
   en édition), en-tête (fil d'Ariane + badge de mode), zone d'écran,
   panneau latéral et fenêtre modale. Les écrans plein écran
   (connexion, choix d'équipe, espace demandeur) n'ont pas de coquille.
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
    time: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18', daily: 'M6 3h9l4 4v14H6zM9 10h7M9 14h7M9 18h4'
  };
  const icone = nom => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONES[nom]}"></path></svg>`;

  // Menus : id d'écran, libellé, icône ; « enfants » = sous-menu
  const MENU_GENERAL = [
    { id: 'dashboard', libelle: 'Dashboard général', icone: 'dash' },
    { id: 'projets', libelle: 'Projets et Roadmap', icone: 'proj' },
    { id: 'ressources', libelle: 'Gestion des ressources', icone: 'ress' },
    { id: 'administration', libelle: 'Administration', icone: 'admin' },
    { id: 'timesheet', libelle: 'Timesheet', icone: 'time' },
    { id: 'dailyEquipes', libelle: 'Daily des équipes', icone: 'daily' }
  ];
  const MENU_MOI = [
    { id: 'daily', libelle: 'Daily', icone: 'daily' },
    { id: 'mesProjets', libelle: 'Projets et Roadmap', icone: 'road' },
    { id: 'conges', libelle: 'Gestion des ressources', icone: 'ress',
      enfants: [{ id: 'conges', libelle: 'Congés & capacité' }, { id: 'listeRessources', libelle: 'Liste des ressources' }] },
    { id: 'monTimesheet', libelle: 'Mon timesheet', icone: 'time' },
    { id: 'monAdmin', libelle: 'Administration', icone: 'admin' }
  ];
  const PLEIN_ECRAN = ['connexion', 'choixEquipe', 'demandeur'];

  function lienMenu(item) {
    const actif = etat.ecran === item.id && !item.enfants;
    const html = `<a class="menu-lien${actif ? ' actif' : ''}" data-action="aller" data-ecran="${item.id}">${icone(item.icone)}<span>${esc(item.libelle)}</span></a>`;
    if (!item.enfants) return html;
    return html + `<div class="sous-menu">${item.enfants.map(e =>
      `<a class="sous-lien${etat.ecran === e.id ? ' actif' : ''}" data-action="aller" data-ecran="${e.id}">${esc(e.libelle)}</a>`).join('')}</div>`;
  }

  function barreLaterale() {
    const eq = equipe(etat.equipeCourante);
    const nom = etat.session.user.name || etat.session.user.email;
    return `
    <aside class="laterale">
      <div class="marque">
        <div class="logo"><i style="height:8px"></i><i style="height:14px"></i><i style="height:11px;background:#9DB6FF"></i></div>
        <div class="marque-nom">${esc(CONFIG.NOM_APPLICATION)}</div>
      </div>
      <nav>
        <div class="menu-titre"><span>Général ${C.aide('sectionGeneral')}</span><span>lecture</span></div>
        ${MENU_GENERAL.map(lienMenu).join('')}
        <div class="menu-titre"><span>Mon dashboard ${C.aide('sectionMoi')}</span><span>édition</span></div>
        ${MENU_MOI.map(lienMenu).join('')}
      </nav>
      <div class="bloc-utilisateur">
        <div class="bloc-equipe">${C.pastille(eq.couleur)}<span class="discret">Équipe</span><b>${etat.equipeCourante ? esc(eq.nom) : 'aucune'}</b>
          ${mesEquipes().length ? '<a data-action="changerEquipe">Changer</a>' : ''}</div>
        <div class="bloc-moi">${C.avatar(nom, true)}<div><div class="moi-nom">${esc(nom)}</div>
          <a class="moi-sortie" data-action="deconnexion">Se déconnecter</a></div></div>
      </div>
    </aside>`;
  }

  function enTete(ecran) {
    const general = ecran.section === 'general';
    return `
    <header class="entete">
      <div class="fil"><span class="discret">${general ? 'Général' : 'Mon dashboard'}</span><span class="sep">/</span>
        <b>${esc(ecran.titre)}</b>
        ${general ? C.badge('Lecture seule', '#4A5363', '#F1F3F7') : C.badge('Édition', '#0033AD', '#E8EEFF')}</div>
      <div class="recherche" title="Recherche : prévue dans une prochaine version">Rechercher un projet, un ticket…<span>⌘K</span></div>
    </header>`;
  }

  // « Mon dashboard » demande une équipe ouverte (cas d'un administrateur sans équipe)
  function sansEquipe() {
    return `<div class="ecran"><div class="carte" style="padding:20px;max-width:640px">
      <h2>Aucune équipe ouverte</h2>
      <p class="discret">Les écrans « Mon dashboard » travaillent dans une équipe. La section « Général » reste consultable.</p>
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
    if (PLEIN_ECRAN.includes(etat.ecran)) return Ecrans[etat.ecran].rendre();
    const ecran = Ecrans[etat.ecran] || Ecrans.dashboard;
    return `
    <div class="appli">
      ${barreLaterale()}
      <main class="principal">
        ${enTete(ecran)}
        <div class="contenu">${ecran.section === 'moi' && !etat.equipeCourante && !(ecran.sansEquipePermis && ecran.sansEquipePermis()) ? sansEquipe() : ecran.rendre()}</div>
      </main>
      ${etat.panneau ? `<div class="voile" data-action="fermer"></div>${Panneau.rendre()}` : ''}
      ${etat.modale ? `<div class="voile" data-action="fermer"></div>${Modale.rendre()}` : ''}
    </div>`;
  }

  return { rendre };
})();

// Actions de la coquille
Object.assign(Actions, {
  reessayer: () => demarrer(),
  changerEquipe: () => allerA('choixEquipe'),
  async deconnexion() {
    await Api.deconnecter().catch(() => {});
    majEtat({ session: null, equipeCourante: null, ecran: 'connexion', d: {} });
  }
});
