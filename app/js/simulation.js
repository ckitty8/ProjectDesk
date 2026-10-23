/* ============================================================
   Simulation des rôles — réservée au créateur (maquette docs/maquettes/simulation-roles/)
   ------------------------------------------------------------
   Besoin (porteur du projet, 2026-10-08) : depuis Administration, voir l'application
   exactement comme une personne d'un rôle donné, pour tester l'affichage et les
   fonctionnalités de chaque rôle.
   Principe : on remplace, le temps de la simulation, l'identité utilisée par les écrans
   (session, droits d'administrateur, équipes et rôle dans l'équipe, fiche ressource) par
   celle de la personne choisie, calculée à partir de sa fiche (équipe, responsable,
   affectations). L'identité réelle est gardée dans etat.reel et restaurée à l'arrêt.
   LECTURE SEULE : la base applique toujours les droits réels du créateur ; une écriture
   ne testerait donc pas le rôle et modifierait les vraies données. Api refuse toute
   écriture pendant la simulation (Api.refuserEnSimulation).
   ============================================================ */
'use strict';

const Simulation = {
  /* Rôles proposés : les 6 rôles d'accès d'Administration › Rôles et de la matrice des droits (ROLES_CHOISISSABLES,
     ROLES_ACCES, config.js), puis « Compte en attente » (compte inscrit sans équipe) — porteur 2026-10-22,
     maquette docs/maquettes/simulation-six-roles/. Le Créateur n'y figure pas (c'est le rôle de départ). */
  get ROLES() {
    return [...ROLES_CHOISISSABLES.map(cle => ({ cle, libelle: ROLES_ACCES[cle].libelle, description: ROLES_ACCES[cle].description,
      couleur: ROLES_ACCES[cle].texte })),
    { cle: 'sansEquipe', libelle: 'Compte en attente', description: 'Inscrit, sans accès tant qu’un administrateur ne l’a pas donné.',
      couleur: COULEURS.orange }];
  },

  // Onglet réservé au créateur (masqué pendant une simulation : le bandeau permet d'en changer ou d'en sortir)
  estDisponible: () => etat.estCreateur,

  /* Personnes proposées pour un rôle : toutes les fiches actives, celles qui ont déjà ce rôle en tête
     (« · a ce rôle »), puis les autres avec leur rôle actuel. Le rôle de la carte leur est appliqué le temps
     de la simulation (monRole) ; leurs équipes et leurs projets restent les leurs. Fiches sans compte
     comprises, marquées « (sans compte) » (phase de recette, porteur 2026-10-23, maquette simulation-sans-compte/) :
     leurs écrans personnels (Daily, Saisir mes heures) sont vides. */
  personnes(cle) {
    const actuel = r => Roles.roleChoisi(r);
    return ressourcesActives()
      .sort((a, b) => (actuel(b) === cle) - (actuel(a) === cle) || a.nom.localeCompare(b.nom))
      .map(r => ({ valeur: r.id, libelle: `${r.nom}${r.userId ? '' : ' (sans compte)'} · ${actuel(r) === cle ? 'a ce rôle' : 'aujourd’hui ' + ROLES_ACCES[actuel(r)].libelle}` }));
  },

  /* Démarre (ou change) la simulation : identité réelle mise de côté, identité simulée posée.
     Équipes de la personne = l'unité de sa fiche ; rôle dans l'équipe = « owner » si elle en est
     la responsable, sinon « member ». « Compte sans équipe » : aucune équipe, aucun droit. */
  demarrer(cle, ressourceId) {
    if (!etat.reel) etat.reel = { session: etat.session, estAdmin: etat.estAdmin, estCreateur: etat.estCreateur,
      organisations: etat.organisations, rolesEquipe: etat.rolesEquipe, comptesEnAttente: etat.comptesEnAttente,
      equipeCourante: etat.equipeCourante };
    const r = ressourceId ? ressource(ressourceId) : null;
    const equipeSimulee = r && cle !== 'sansEquipe' ? equipe(r.equipeId) : null;
    etat.simulation = { cle, ressourceId: r ? r.id : null };
    const utilisateur = { id: r && r.userId ? r.userId : 'simulation', name: r ? r.nom : 'Compte de test',
      email: r && r.email ? r.email : 'compte.sans.equipe@exemple.fr' };
    etat.session = { ...etat.reel.session, user: utilisateur };
    etat.estCreateur = false;
    etat.estAdmin = cle === 'admin';
    etat.organisations = equipeSimulee ? [{ id: equipeSimulee.id, name: equipeSimulee.nom }] : [];
    etat.rolesEquipe = equipeSimulee ? { [equipeSimulee.id]: responsablesDe(equipeSimulee.id).includes(r) ? 'owner' : 'member' } : {};
    etat.comptesEnAttente = etat.estAdmin ? etat.reel.comptesEnAttente : [];
    appliquerPerimetre();   // données limitées à ce que verrait la personne (migration 042)
    majEtat({ equipeCourante: equipeSimulee ? equipeSimulee.id : null, panneau: null, modale: null,
      ecran: cle === 'sansEquipe' ? 'choixEquipe' : 'dashboard' });
  },

  // Fin de la simulation : identité réelle restaurée, retour à Administration créateur
  arreter() {
    Object.assign(etat, etat.reel);
    etat.reel = null; etat.simulation = null;
    appliquerPerimetre();   // données complètes du créateur de nouveau
    majEtat({ ecran: 'adminCreateur', panneau: null, modale: null });
  },

  libelleEnCours() {
    const role = this.ROLES.find(x => x.cle === etat.simulation.cle), r = ressource(etat.simulation.ressourceId);
    return `<b>${C.esc(role.libelle)}</b>${r ? ` (${C.esc(r.nom)})` : ''}`;
  },

  /* Bandeau violet en haut de chaque écran pendant la simulation : rôle simulé, changement de rôle,
     retour au rôle de créateur */
  bandeau() {
    if (!etat.simulation) return '';
    const choix = this.ROLES.flatMap(role => role.cle === 'sansEquipe' ? [{ valeur: 'sansEquipe|', libelle: role.libelle }]
      : this.personnes(role.cle).map(p => ({ valeur: `${role.cle}|${p.valeur}`, libelle: `${role.libelle} — ${p.libelle}` })));
    return `<div class="bandeau-simulation">
      <span>★ <b>Simulation</b> : vous voyez l’application en tant que ${this.libelleEnCours()} — lecture seule, rien n’est enregistré</span>
      <span class="extensible"></span>
      ${C.liste([{ valeur: '', libelle: 'Changer de rôle…' }, ...choix], '', 'class="champ champ-mini" data-action-change="changerSimulation"')}
      <button class="btn petit" data-action="arreterSimulation">Revenir à mon rôle de créateur</button></div>`;
  },

  // Onglet Administration › Simulation des rôles : une carte par rôle, choix de la personne
  onglet() {
    const esc = C.esc;
    const cartes = this.ROLES.map(role => {
      const personnes = this.personnes(role.cle), sansPersonne = role.cle === 'sansEquipe';
      const choix = sansPersonne ? '<div class="discret" style="height:34px;display:flex;align-items:center">un compte inscrit sans équipe</div>'
        : personnes.length ? C.liste(personnes, personnes[0].valeur, `class="champ" name="personne-${role.cle}"`)
          : '<div class="discret" style="height:34px;display:flex;align-items:center">personne n’a ce rôle aujourd’hui</div>';
      return `<div class="carte" style="padding:14px 16px;border-top:4px solid ${role.couleur}">
        <b style="font-size:15px;color:${role.couleur}">${esc(role.libelle)}</b>
        <div class="discret" style="margin:6px 0 10px;min-height:36px">${esc(role.description)}</div>
        <div class="libelle">En tant que</div>${choix}
        <button class="btn primaire" style="margin-top:10px;width:100%" data-action="demarrerSimulation" data-role="${role.cle}"
          ${sansPersonne || personnes.length ? '' : 'disabled'}>Voir l’application en tant que ${esc(role.libelle.toLowerCase())}</button></div>`;
    }).join('');
    return `<div class="carte encart-createur">
        <b>Réservé au créateur.</b> Choisissez un rôle et une personne : l’application s’affiche comme pour elle avec ce rôle
        (menus, écrans, boutons, données visibles). <b>Lecture seule</b> : pendant la simulation rien n’est enregistré, pour ne jamais
        modifier les données réelles avec vos droits de créateur.</div>
      <div class="grille-simulation">${cartes}</div>
      <div class="discret texte-12">Le rôle choisi s’applique à la personne pendant la simulation (droits de ce rôle dans la matrice) ;
        ses équipes et ses projets restent les siens.</div>`;
  }
};

Object.assign(Actions, {
  // Bouton d'une carte : personne choisie dans la liste de la carte
  demarrerSimulation(d) {
    const liste = document.querySelector(`select[name="personne-${d.role}"]`);
    Simulation.demarrer(d.role, liste ? liste.value : null);
  },
  // Liste du bandeau : valeur « rôle|fiche »
  changerSimulation(d, el) {
    if (!el.value) return;
    const [role, ressourceId] = el.value.split('|');
    Simulation.demarrer(role, ressourceId || null);
  },
  arreterSimulation: () => Simulation.arreter()
});

/* Mon dashboard › Administration créateur (porteur, 2026-10-23) : menu réservé au créateur, à côté
   d'Administration. Onglets : Simulation des rôles (auparavant onglet d'Administration), Matrice des droits
   et Qui a quel rôle (auparavant vues d'Administration › Rôles ; maquette matrice-createur/). */
Ecrans.adminCreateur = {
  titre: 'Administration créateur',
  section: 'moi',
  ONGLETS: [{ id: 'simulation', libelle: 'Simulation des rôles' }, { id: 'matrice', libelle: 'Matrice des droits' },
    { id: 'qui', libelle: 'Qui a quel rôle' }],
  rendre() {
    const onglet = ui('adminCreateur', { onglet: 'simulation' }).onglet;
    const contenus = { simulation: () => Simulation.onglet(), matrice: () => Roles.matrice(),
      qui: () => `<div class="grille-roles">${Roles.cartesParRole()}</div>` };
    const corps = !Simulation.estDisponible() ? `<div class="carte">${C.vide('Écran réservé au créateur.')}</div>`
      : C.onglets(this.ONGLETS, onglet, 'ongletAdminCreateur') + (contenus[onglet] || contenus.simulation)();
    return `<div class="ecran ecran-large">${C.entete('Administration créateur',
      'Réservée au créateur · simulation des rôles, matrice des droits, qui a quel rôle')}${corps}</div>`;
  }
};
Object.assign(Actions, { ongletAdminCreateur: d => majUi('adminCreateur', { onglet: d.id }) });
