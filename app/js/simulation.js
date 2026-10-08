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
  /* Rôles proposés (ceux qui existent aujourd'hui) : libellé, description, couleur de la carte,
     et personnes qui ont ce rôle (fiches ressources présentes). Les rôles de « Rôles et droits »
     (Direction, Projet, Utilisateur, Lecture seule) s'ajouteront ici. */
  ROLES: [
    { cle: 'admin', libelle: 'Administrateur', couleur: '#003CC8',
      description: 'Tous les écrans, Administration (équipes, référentiels, comptes en attente).' },
    { cle: 'responsable', libelle: 'Responsable d’équipe', couleur: '#7A3FC2',
      description: 'Son équipe et les unités rattachées : valide les timesheets, lit tous les daily de l’unité.' },
    { cle: 'chef', libelle: 'Chef de projet', couleur: '#0F8A6B',
      description: 'Ses projets : plan de charge, envoi du daily, sprints ; saisit son daily et ses heures.' },
    { cle: 'membre', libelle: 'Membre de projet', couleur: '#4A5363',
      description: 'Saisit son daily, ses heures et ses congés ; lit le daily de ses projets.' },
    { cle: 'lecteur', libelle: 'Lecteur de projet', couleur: '#8A93A3',
      description: 'Consulte les projets où il est Lecteur, sans les modifier.' },
    { cle: 'sansEquipe', libelle: 'Compte sans équipe', couleur: '#B25E09',
      description: 'Ce que voit une personne inscrite tant qu’on ne lui a pas donné l’accès.' }
  ],

  // Onglet réservé au créateur (masqué pendant une simulation : le bandeau permet d'en changer ou d'en sortir)
  estDisponible: () => etat.estCreateur,

  /* Personnes qui ont un rôle (fiches présentes aujourd'hui), avec un libellé « Nom · précision » */
  personnes(cle) {
    const affectees = role => etat.d.affectations.filter(a => a.role === role && estActive(a.ressourceId))
      .map(a => ({ r: ressource(a.ressourceId), precision: (projet(a.projetId) || {}).code }));
    const listes = {
      admin: () => ressourcesActives().filter(r => r.userId && etat.d.administrateurs.some(a => a.userId === r.userId)).map(r => ({ r, precision: 'administrateur' })),
      responsable: () => etat.d.equipes.filter(e => e.responsableId && estActive(e.responsableId)).map(e => ({ r: ressource(e.responsableId), precision: e.nom })),
      chef: () => affectees(ROLES_PROJET.CHEF),
      membre: () => affectees(ROLES_PROJET.MEMBRE),
      lecteur: () => affectees(ROLES_PROJET.LECTEUR),
      sansEquipe: () => []
    };
    // Une ligne par personne (la première précision trouvée), triées par nom
    const vues = new Map();
    listes[cle]().filter(x => x.r).forEach(x => { if (!vues.has(x.r.id)) vues.set(x.r.id, x); });
    return [...vues.values()].sort((a, b) => a.r.nom.localeCompare(b.r.nom))
      .map(x => ({ valeur: x.r.id, libelle: `${x.r.nom}${x.precision ? ' · ' + x.precision : ''}` }));
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
    etat.session = { ...etat.reel.session, user: { id: r && r.userId ? r.userId : 'simulation', name: r ? r.nom : 'Compte de test', email: r && r.email ? r.email : 'compte.sans.equipe@exemple.fr' } };
    etat.estCreateur = false;
    etat.estAdmin = cle === 'admin';
    etat.organisations = equipeSimulee ? [{ id: equipeSimulee.id, name: equipeSimulee.nom }] : [];
    etat.rolesEquipe = equipeSimulee ? { [equipeSimulee.id]: equipeSimulee.responsableId === r.id ? 'owner' : 'member' } : {};
    etat.comptesEnAttente = etat.estAdmin ? etat.reel.comptesEnAttente : [];
    majEtat({ equipeCourante: equipeSimulee ? equipeSimulee.id : null, panneau: null, modale: null,
      ecran: cle === 'sansEquipe' ? 'choixEquipe' : 'dashboard' });
  },

  // Fin de la simulation : identité réelle restaurée, retour à l'onglet de simulation
  arreter() {
    Object.assign(etat, etat.reel);
    etat.reel = null; etat.simulation = null;
    majUi('monAdmin', { onglet: 'simulation' }, { rendre: false });
    majEtat({ ecran: 'monAdmin', panneau: null, modale: null });
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
      <span style="flex:1"></span>
      ${C.liste([{ valeur: '', libelle: 'Changer de rôle…' }, ...choix], '', 'class="champ" style="width:auto;height:28px" data-action-change="changerSimulation"')}
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
    return `<div class="carte" style="padding:12px 16px;background:#F5F0FD;border-color:#D9C7F5">
        <b>Réservé au créateur.</b> Choisissez un rôle et une personne qui l’a : l’application s’affiche exactement comme pour elle
        (menus, écrans, boutons, données visibles). <b>Lecture seule</b> : pendant la simulation rien n’est enregistré, pour ne jamais
        modifier les données réelles avec vos droits de créateur.</div>
      <div class="grille-simulation">${cartes}</div>
      <div class="discret" style="font-size:12px">Les rôles Direction, Projet, Utilisateur et Lecture seule s’ajouteront ici avec « Rôles et droits ».</div>`;
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
