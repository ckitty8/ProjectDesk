/* ============================================================
   Parcours de test de bout en bout (Playwright + serveur simulé)
   ------------------------------------------------------------
   1. Démarre tests/serveur-simule.js.
   2. Ouvre l'application en redirigeant Neon Auth et la Data API
      vers le serveur simulé (window.CONFIG_SURCHARGE).
   3. Parcourt tous les écrans, effectue les actions principales,
      vérifie l'absence d'erreur JavaScript et le résultat attendu.
   4. Enregistre les captures dans docs/maquettes/etat-actuel/.
   Usage : node tests/parcours.js
   Prérequis : Playwright installé globalement (npm root -g).
   ============================================================ */
'use strict';

const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 8124, BASE = `http://localhost:${PORT}`;
const CAPTURES = path.resolve(__dirname, '../docs/maquettes/etat-actuel');
const resultats = [];
const verifier = (nom, condition, detail = '') => { resultats.push({ nom, ok: !!condition, detail }); };

(async () => {
  const serveur = spawn('node', [path.join(__dirname, 'serveur-simule.js'), String(PORT)], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const navigateur = await chromium.launch();
  const contexte = await navigateur.newContext({ viewport: { width: 1440, height: 900 } });
  await contexte.addInitScript(base => { window.CONFIG_SURCHARGE = { NEON_AUTH_URL: base + '/auth', DATA_API_URL: base + '/rest/v1' }; }, BASE);
  await contexte.route('**/fonts.g*/**', r => r.abort());   // pas d'accès réseau aux polices
  const page = await contexte.newPage();
  const erreurs = [];
  page.on('pageerror', e => erreurs.push(e.message));
  // Les échecs de chargement réseau (polices bloquées, 401 volontaire du test) ne sont pas des erreurs JS
  page.on('console', m => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) erreurs.push(m.text()); });
  // Boîtes de dialogue : confirmations acceptées ; réponse des « prompt » modifiable par le test
  let reponsePrompt = 'Merci de compléter';
  page.on('dialog', d => d.accept(d.type() === 'prompt' ? reponsePrompt : undefined));

  /* Capture d'un écran. Le message temporaire (notification) est masqué : il disparaît au bout de
     quelques secondes et rendrait les captures différentes d'un lancement à l'autre. */
  const capture = async nom => {
    await page.waitForTimeout(250);
    await page.evaluate(() => { document.getElementById('notification').style.visibility = 'hidden'; });
    await page.screenshot({ path: path.join(CAPTURES, nom + '.png') });
    await page.evaluate(() => { document.getElementById('notification').style.visibility = ''; });
  };
  const aller = async ecran => { await page.click(`[data-action="aller"][data-ecran="${ecran}"]`); await page.waitForTimeout(250); };
  const texte = () => page.textContent('#app');

  try {
    /* --- Connexion --- */
    await page.goto(BASE + '/app/');
    await page.waitForSelector('form[data-action-envoi="seConnecter"]');
    await capture('01-connexion');
    verifier('Mention de propriété CIRITEC sur la connexion', (await page.textContent('.mention-propriete')).includes('© 2026 CIRITEC'));
    await page.fill('input[name=email]', 'camille@test.fr'); await page.fill('input[name=motDePasse]', 'faux-mdp');
    await page.click('form button'); await page.waitForTimeout(300);
    verifier('Connexion refusée avec un mauvais mot de passe', (await texte()).includes('incorrect'));
    // Mot de passe oublié : demande, lien reçu par email (simulé), nouveau mot de passe, connexion
    await page.click('[data-action="motDePasseOublie"]');
    await page.fill('form[data-action-envoi="envoyerReinitialisation"] input[name=email]', 'camille@test.fr');
    await page.click('form[data-action-envoi="envoyerReinitialisation"] button'); await page.waitForTimeout(300);
    const emailEnvoye = (await texte()).includes('email de réinitialisation');
    const lien = (await (await page.request.get(BASE + '/auth/dernier-lien-simule')).json()).lien;
    await page.goto(lien); await page.waitForSelector('form[data-action-envoi="choisirMotDePasse"]');
    const jetonRetire = !page.url().includes('token=');
    await page.fill('input[name=motDePasse]', 'motdepasse'); await page.fill('input[name=confirmation]', 'motdepasse');
    await page.click('form[data-action-envoi="choisirMotDePasse"] button'); await page.waitForTimeout(300);
    verifier('Mot de passe oublié : email, lien, nouveau mot de passe enregistré', emailEnvoye && jetonRetire
      && (await texte()).includes('Mot de passe enregistré') && !!(await page.$('form[data-action-envoi="seConnecter"]')));
    await page.fill('input[name=email]', 'camille@test.fr');
    await page.fill('input[name=motDePasse]', 'motdepasse'); await page.click('form button');
    await page.waitForSelector('.laterale');
    verifier('Une seule équipe : ouverture directe de l’outil (dashboard)', (await texte()).includes('Dashboard général'));
    // Administrateur membre de plusieurs équipes : pas d'écran de choix, ouverture directe (équipe par défaut)
    verifier('Administrateur avec plusieurs équipes : ouverture directe, sans choix d’équipe', await page.evaluate(async () => {
      const original = Api.listerOrganisations, memo = localStorage.getItem('pp_equipe');
      Api.listerOrganisations = async () => etat.d.equipes.slice(0, 2).map(e => ({ id: e.id, name: e.nom }));
      localStorage.removeItem('pp_equipe'); etat.ecran = 'connexion';
      await demarrer();
      const ok = etat.estAdmin && etat.ecran !== 'choixEquipe' && !!etat.equipeCourante;
      Api.listerOrganisations = original; if (memo) localStorage.setItem('pp_equipe', memo);
      await demarrer();
      return ok;
    }));
    await page.click('[data-action="changerEquipe"]'); await page.waitForSelector('[data-action="ouvrirEquipe"]');
    await capture('02-choix-equipe');
    verifier('Choix d’équipe : invitation reçue affichée', (await texte()).includes('Produit'));
    await page.click('[data-action="ouvrirEquipe"]');
    await page.waitForSelector('.laterale');

    /* --- Section Suivi de mes équipes (ex-Général, lecture) --- */
    await capture('03-dashboard');
    verifier('Mention de propriété CIRITEC en bas du menu', (await page.textContent('.bloc-utilisateur .mention-propriete')).includes('CIRITEC'));
    // Bulle ⓘ de la barre latérale : affichée en entier, hors de la barre qui défile (signalé le 2026-10-06)
    await page.hover('.menu-titre .aide >> nth=0'); await page.waitForTimeout(150);
    verifier('Bulle ⓘ de la barre latérale entière (non coupée)', await page.evaluate(() => {
      const b = document.querySelector('.menu-titre .aide .bulle').getBoundingClientRect();
      return b.width >= 270 && b.left >= 0 && b.right <= innerWidth && b.bottom <= innerHeight
        && document.elementFromPoint(b.right - 10, b.top + 10).closest('.bulle') !== null; }));
    await page.mouse.move(700, 600);
    await page.click('[data-action="choisirTrimestre"][data-t="4"]'); await page.waitForTimeout(200);
    verifier('Dashboard : 6 objectifs au T4', (await texte()).includes('6 objectifs'));
    await aller('projets'); await capture('04-projets');
    verifier('Projets : aucune notion de ticket (pilotage de projets uniquement)', !/ticket/i.test(await page.textContent('body'))
      && !(await page.$('[data-action="deplierProjet"]')));
    await page.click('tr.cliquable[data-action="ouvrirProjet"]'); await page.waitForTimeout(200);
    verifier('Projets : panneau en lecture seule', (await texte()).includes('Vue « Suivi de mes équipes » en lecture seule'));
    await page.click('.fermer');
    await aller('ressources'); await page.click('[data-action="moisSuivant"]'); await capture('05-ressources');
    /* Gestion des ressources (2026-10-16) : onglets Calendrier / Liste des ressources, dates de naissance
       (jour et mois seulement à l'écran ; 🎂 dans le calendrier, rappel des anniversaires du mois) */
    const ongletsRess = await page.$$eval('[data-action="ongletRessources"]', b => b.map(x => x.textContent.trim()));
    await page.evaluate(() => majUi('calendrier', { annee: 2026, mois: 10, mode: 'equipe' })); await page.waitForTimeout(150);
    const gateauNov = await page.$eval(`tr[data-personne="${await page.evaluate(() => etat.d.ressources.find(r => r.nom === 'Maxime Fournier').id)}"]`,
      tr => tr.querySelectorAll('.anniversaire').length);
    verifier('Gestion des ressources : onglets Calendrier et Liste des ressources, 🎂 le jour de l’anniversaire',
      ongletsRess.join('|') === 'Calendrier|Liste des ressources' && gateauNov === 1 && (await texte()).includes('🎂 Anniversaire'));
    await page.click('[data-action="calendrierAujourdhui"]');
    await page.click('[data-action="ongletRessources"][data-id="liste"]'); await page.waitForTimeout(150);
    const annuaireRess = await page.textContent('#annuaire-ressources'), pageRess = await texte();
    const attendusAnniv = await page.evaluate(() => Calculs.anniversairesDuMois(etat.d.ressources.filter(r => !estInactive(r)),
      Calculs.depuisIso(Calculs.aujourdhui()).getMonth()).map(r => r.nom));
    verifier('Gestion des ressources › Liste : colonne Anniversaire (jour et mois, sans l’année) et anniversaires du mois',
      annuaireRess.includes('Anniversaire') && annuaireRess.includes('28 oct.') && !annuaireRess.includes('1991')
      && pageRess.includes('Anniversaires') && attendusAnniv.every(n => pageRess.includes(n)), attendusAnniv.join(', '));
    const lignesVisibles = () => page.$$eval('#annuaire-ressources tbody tr[data-recherche]', t => t.filter(x => !x.hidden).length);
    const idData = await page.evaluate(() => etat.d.equipes.find(e => e.nom === 'Data').id);
    await page.selectOption('[data-action-change="filtrerEquipeRessources"]', idData); await page.waitForTimeout(150);
    const nbData = await lignesVisibles();
    await page.fill('[data-action-saisie="rechercherRessource"]', 'sar'); await page.waitForTimeout(150);
    const nbRecherche = await lignesVisibles();
    await page.selectOption('[data-action-change="filtrerStatutRessources"]', 'inactif'); await page.waitForTimeout(150);
    const nbInactifs = await lignesVisibles();
    verifier('Gestion des ressources › Liste : filtres équipe, recherche et statut', nbData === 3 && nbRecherche === 1 && nbInactifs === 0,
      `${nbData} / ${nbRecherche} / ${nbInactifs}`);
    await page.evaluate(() => majUi('ressources', { equipeId: '', statut: '', q: '' })); await page.waitForTimeout(150);
    await capture('05b-ressources-liste');
    await page.click('[data-action="ongletRessources"][data-id="calendrier"]');
    // Pas de menu Administration dans Suivi de mes équipes, pour aucun rôle (porteur, 2026-10-22)
    verifier('Suivi de mes équipes : pas de menu Administration', !(await page.$('.laterale [data-action="aller"][data-ecran="administration"]'))
      && !!(await page.$('.laterale [data-action="aller"][data-ecran="monAdmin"]')));
    await aller('timesheet'); await page.click('[data-action="moisTempsPrecedent"]'); await page.click('[data-action="moisTempsSuivant"]');
    await page.evaluate(() => majUi('moisTemps', { annee: 2026, mois: 8 })); await page.waitForTimeout(150);   // mois des données simulées
    verifier('Timesheet (Suivi de mes équipes) : feuilles du mois par personne', (await texte()).includes('septembre 2026') && (await texte()).includes('Saisi / attendu'));
    await capture('07-timesheet');

    /* --- Règle : la section « Suivi de mes équipes » (ex-« Général ») est en lecture seule ---
       Aucun champ, formulaire ou action d'écriture (tous onglets), sauf la validation des feuilles de temps. */
    const ACTIONS_LECTURE = ['aller', 'ouvrirProjet', 'fermer', 'choisirTrimestre', 'filtrerEquipeProjets', 'deplierProjet',
      'moisPrecedent', 'moisSuivant', 'calendrierAujourdhui', 'moisTempsPrecedent', 'moisTempsSuivant',
      'filtrerDailyEquipes', 'dailyEquipesAujourdhui', 'dailyEquipesDecaler', 'filtrerPersonneDaily', 'ongletDailyEquipes',
      'choisirCaseDaily', 'fermerCaseDaily', 'decalerCaseDaily', 'vueCalendrier', 'projetCalendrier',
      'ongletRessources', 'filtrerEquipeRessources', 'filtrerStatutRessources', 'rechercherRessource',
      'ouvrirExportDaily',    // export Excel : lecture seule (téléchargement de ce qui est affiché)
      'validerFeuille', 'renvoyerFeuille'];   // seule exception : validation des feuilles par le responsable (Timesheet)
    const ecritures = async () => page.$$eval('.contenu [data-action-change], .contenu [data-action-saisie], .contenu [data-action-envoi], .contenu [data-action]',
      (els, permises) => els.map(e => e.dataset.actionChange || e.dataset.actionSaisie || e.dataset.actionEnvoi || e.dataset.action)
        .filter(a => a && !permises.includes(a)), ACTIONS_LECTURE);
    const interdites = [];
    for (const ecran of ['dashboard', 'projets', 'ressources', 'timesheet', 'dailyEquipes']) {
      await aller(ecran);
      if (ecran === 'ressources') {
        for (const onglet of ['calendrier', 'liste']) { await page.click(`[data-action="ongletRessources"][data-id="${onglet}"]`); await page.waitForTimeout(150); interdites.push(...await ecritures()); }

      } else interdites.push(...await ecritures());
    }
    await aller('projets'); await page.click('tr.cliquable[data-action="ouvrirProjet"]'); await page.waitForTimeout(200);
    interdites.push(...await page.$$eval('.panneau [data-action-change], .panneau [data-action-envoi], .panneau [data-action-saisie]', els => els.map(e => 'panneau:' + (e.dataset.actionChange || e.dataset.actionEnvoi || e.dataset.actionSaisie))));
    await page.click('.fermer');
    verifier('Suivi de mes équipes : lecture seule (aucune action d’écriture hors validation des feuilles)', interdites.length === 0, [...new Set(interdites)].join(', '));

    /* --- Administration (Mon dashboard) : référentiels modifiables par l'administratrice --- */
    await aller('monAdmin'); await page.click('[data-action="ongletMonAdmin"][data-id="referentiels"]'); await page.waitForTimeout(200);
    await page.fill('form[data-action-envoi="ajouterValeur"] input', 'Demande légale');
    await page.click('form[data-action-envoi="ajouterValeur"] button'); await page.waitForTimeout(300);
    verifier('Mon admin : valeur de référentiel ajoutée', (await page.$$eval('input[data-action-change="renommerValeur"]', l => l.map(i => i.value))).includes('Demande légale'));
    // Valeur système renommable : le nouveau libellé est repris par les données et par les calculs
    await page.click('[data-action="choisirReferentiel"][data-id="role"]'); await page.waitForTimeout(200);
    const renommerRole = async (ancien, nouveau) => {
      const champ = `input[data-action-change="renommerValeur"][value="${ancien}"]`;
      await page.fill(champ, nouveau); await page.press(champ, 'Tab'); await page.waitForTimeout(400);
    };
    await renommerRole('Membre', 'Contributeur');
    verifier('Référentiels : valeur système renommée et propagée', (await page.evaluate(() => ROLES_PROJET.MEMBRE)) === 'Contributeur'
      && (await page.evaluate(() => etat.d.affectations.some(a => a.role === 'Contributeur') && !etat.d.affectations.some(a => a.role === 'Membre'))));
    await renommerRole('Contributeur', 'Membre');
    // Trucs et astuces : menu à part dans Mon dashboard (plus un onglet d'Administration)
    const ongletAstucesAdmin = !!(await page.$('[data-action="ongletMonAdmin"][data-id="astuces"]'));
    await aller('astuces'); await capture('19-astuces');
    verifier('Mon dashboard › Trucs et astuces : menu à part, KPI Scrum et Kanban avec exemples', !ongletAstucesAdmin && await page.$$eval('.tableau-kpi', t => t.map(x => x.textContent).join(' '))
      .then(txt => ['Vélocité', 'Burndown', 'Lead time', 'Cycle time', 'WIP'].every(k => txt.includes(k)))
      && (await page.$$('.tableau-kpi .badge-reel')).length > 0 && (await page.$$('.tableau-kpi .badge-illustratif')).length > 0);
    // Rôles Scrum : organigramme détaillé (PO fonctionnel, PO technique, tech lead, QA) et « qui fait quoi »
    await page.click('[data-action="ongletAstuces"][data-onglet="roles"]'); await page.waitForTimeout(200);
    verifier('Trucs et astuces › Rôles Scrum : organigramme détaillé et qui fait quoi', await page.evaluate(() => {
      const titres = [...document.querySelectorAll('.org-carte .org-titre')].map(t => t.textContent);
      return ['PO fonctionnel', 'PO technique', 'Scrum Master', 'Tech lead', 'QA / Testeurs', 'Développeurs'].every(t => titres.includes(t))
        && !!document.querySelector('.tableau-roles') && document.querySelectorAll('.tableau-roles tbody tr').length === QUI_FAIT_QUOI_SCRUM.lignes.length;
    }));
    await capture('25-roles-scrum');
    await page.click('[data-action="ongletAstuces"][data-onglet="kpi"]'); await page.waitForTimeout(150);
    // Thème Roadmap (maquette astuces-agile-roadmap) : fiche pratique, puis retour au thème Agile
    await page.click('[data-action="themeAstuces"][data-theme="roadmap"]'); await page.waitForTimeout(200);
    verifier('Trucs et astuces › Roadmap : chaîne vision → sprint, 3 formats, méthodes, bonnes pratiques', await page.evaluate(() =>
      document.querySelectorAll('.chaine-etape').length === ROADMAP_ASTUCES.chaine.length
      && document.querySelectorAll('.grille-formats > .carte').length === 3
      && ['Agile Scrum', 'Agile Kanban', 'Cascade', 'Cycle en V'].every(m => document.querySelector('.ecran').textContent.includes(m))
      && !document.querySelector('.tableau-kpi')));
    await capture('19b-astuces-roadmap');
    // Test & Learn (2026-10-15) : méthode des projets IA — boucle, carte d'expérience, phases, indicateurs
    await page.click('[data-action="themeAstuces"][data-theme="testLearn"]'); await page.waitForTimeout(200);
    verifier('Trucs et astuces › Test & Learn : boucle, carte d’expérience, phases IA et indicateurs', await page.evaluate(() =>
      ['La boucle Test & Learn', 'Carte d’expérience', 'Les phases d’un projet IA', 'Hallucinations', 'Pièges à éviter'].every(t => document.body.textContent.includes(t))));
    await capture('19c-astuces-test-learn');
    await page.click('[data-action="themeAstuces"][data-theme="agile"]'); await page.waitForTimeout(150);
    // Menu : Saisir mes heures en menu à part, juste sous Gestion des ressources (porteur, 2026-10-22)
    verifier('Menu : Saisir mes heures en menu à part sous Gestion des ressources, section « Suivi de mes équipes » renommée', await page.evaluate(() => {
      const sousMenus = [...document.querySelectorAll('.sous-menu')].map(m => m.textContent);
      const ids = [...document.querySelectorAll('.laterale [data-action="aller"]')].map(a => a.dataset.ecran);
      return sousMenus.some(t => t.includes('Congés') && !t.includes('Saisir mes heures'))
        && ids.indexOf('monTimesheet') === ids.indexOf('listeRessources') + 1
        && ![...document.querySelectorAll('.menu-lien')].some(a => a.textContent.trim() === 'Mon timesheet')
        && document.querySelector('.menu-titre').textContent.includes('Suivi de mes équipes');
    }));
    // Jours fériés administrables : ajout, renommage, suppression
    await aller('monAdmin'); await page.click('[data-action="ongletMonAdmin"][data-id="feries"]'); await page.waitForTimeout(200);
    await page.fill('form[data-action-envoi="ajouterFerie"] input[name=jour]', '2026-05-25');
    await page.fill('form[data-action-envoi="ajouterFerie"] input[name=libelle]', 'Lundi de Pentecôte');
    await page.click('form[data-action-envoi="ajouterFerie"] button'); await page.waitForTimeout(300);
    const champFerie = 'input[data-action-change="libelleFerie"][data-jour="2026-05-25"]';
    await page.fill(champFerie, 'Pentecôte'); await page.press(champFerie, 'Tab'); await page.waitForTimeout(300);
    const ferieModifie = await page.evaluate(() => (etat.d.joursFeries.find(f => f.jour === '2026-05-25') || {}).libelle);
    await page.click('[data-action="supprimerFerie"][data-jour="2026-05-25"]'); await page.waitForTimeout(300);
    verifier('Jours fériés : ajout, renommage et suppression', ferieModifie === 'Pentecôte'
      && !(await page.evaluate(() => etat.d.joursFeries.some(f => f.jour === '2026-05-25'))));
    await page.click('[data-action="ongletMonAdmin"][data-id="equipes"]'); await page.click('tr:has-text("Plateforme") [data-action="modifierEquipe"]'); await page.waitForTimeout(400);
    verifier('Mon admin : fenêtre équipe avec membres et invitation', (await page.textContent('.modale')).includes('Camille Laurent') && !!(await page.$('.modale form[data-action-envoi="inviterDansEquipe"]')));
    await page.click('.modale .fermer'); await page.click('[data-action="ongletMonAdmin"][data-id="sprints"]');
    verifier('Timesheet : pas de NaN', !(await texte()).includes('NaN'));

    // Daily des équipes PAR PROJET (migration 018) : notes du projet, blocages, règle de lecture
    await aller('dailyEquipes'); await page.waitForTimeout(300); await capture('17-daily-equipes');
    verifier('Daily des équipes : note d’un coéquipier sur un projet commun visible', (await texte()).includes('Mapping des rôles applicatifs'));
    // Fil des dailys (maquettes daily-equipes-design/retenu/) : blocages ouverts à droite, filtre par personne
    verifier('Daily des équipes : fil groupé par jour et blocages ouverts', (await texte()).includes('Blocages ouverts')
      && (await texte()).includes('Identifiants de recette expirés') && !!(await page.$('.fil-jour .fil-entree')));
    await page.click('[data-action="filtrerPersonneDaily"]:has-text("Thomas")'); await page.waitForTimeout(200);
    verifier('Daily des équipes : filtre par personne', (await texte()).includes('Mapping des rôles applicatifs') && !(await texte()).includes('Finaliser le plan de migration SSO'));
    await page.click('[data-action="filtrerPersonneDaily"][data-id="tous"]'); await page.waitForTimeout(200);
    // Synthèse (droit onglet_daily_synthese) : carte membre × jour, clic → panneau de lecture
    await page.click('[data-action="ongletDailyEquipes"][data-id="synthese"]'); await page.waitForTimeout(200);
    await page.click('.case-synthese.case-bloc'); await page.waitForTimeout(200);
    verifier('Daily des équipes › Synthèse : chiffres, carte membre × jour et lecture au clic', (await texte()).includes('Dailys renseignés')
      && await page.evaluate(() => document.querySelector('.tableau-synthese thead tr').children.length === Ecrans.dailyEquipes.joursSemaine().length + 2)
      && !!(await page.$('.panneau-lecture.actif')) && (await texte()).includes('Blocages'));
    await capture('33-daily-synthese');
    await page.click('[data-action="ongletDailyEquipes"][data-id="fil"]'); await page.waitForTimeout(200);
    // Droits par onglet (migration 038) : onglet masqué si son droit est « Non » pour mon rôle (créateur écarté le temps du contrôle)
    verifier('Daily des équipes : onglet Synthèse masqué si son droit est « Non » (matrice par onglet)', await page.evaluate(() => {
      const c = etat.estCreateur; etat.estCreateur = false;
      const ligne = etat.d.droitsRoles.find(d => d.role === monRole() && d.droit === 'onglet_daily_synthese'), avant = ligne.niveau;
      ligne.niveau = 'non'; rendre();
      const masque = !document.querySelector('[data-action="ongletDailyEquipes"]') && document.body.textContent.includes('Mapping des rôles applicatifs');
      ligne.niveau = avant; etat.estCreateur = c; rendre();
      return masque && !!document.querySelector('[data-action="ongletDailyEquipes"][data-id="synthese"]');
    }));
    await page.click('[data-action="dailyEquipesDecaler"][data-sens="-1"]'); await page.waitForTimeout(200);
    const semainePrecedente = await page.evaluate(() => Calculs.lundi(Ecrans.dailyEquipes.jour()) === Calculs.ajouterJours(Calculs.lundi(Calculs.aujourdhui()), -7)
      && !document.body.textContent.includes('Mapping des rôles applicatifs'));
    await page.click('[data-action="dailyEquipesAujourdhui"]'); await page.waitForTimeout(200);
    verifier('Daily des équipes : semaine précédente puis « Cette semaine »', semainePrecedente && (await texte()).includes('Mapping des rôles applicatifs'));
    verifier('Daily des équipes : seulement mes projets et ceux des unités (et sous-unités) dont je suis responsable', await page.evaluate(() => {
      // Camille est administratrice dans les données simulées : on vérifie la règle comme non-administratrice.
      // Elle est responsable de Plateforme (Data y est rattachée) et affectée à PR-03 ; Mobile et PR-06 ne la concernent pas.
      const admin = etat.estAdmin; etat.estAdmin = false;
      const codes = projetsDailyVisibles().map(p => p.code); etat.estAdmin = admin;
      return ['PF-14', 'DA-08', 'PR-03'].every(c => codes.includes(c)) && !codes.includes('MO-21') && !codes.includes('PR-06');
    }));
    await page.click(`[data-action="filtrerDailyEquipes"][data-id="${await page.evaluate(() => etat.d.projets.find(p => p.code === 'PF-14').id)}"]`); await page.waitForTimeout(200);
    verifier('Daily des équipes : filtre par projet', await page.evaluate(() =>
      [...document.querySelectorAll('.fil-entree .code')].every(c => c.textContent === 'PF-14') && !!document.querySelector('.filtre-fil.actif')));
    /* Daily importé d'une personne sans compte (CR Daily Excel, migration 034) : auteur « fiche:<id> », affiché sur sa carte */
    const sansCompte = await page.evaluate(() => {
      // Dernier jour de semaine (le samedi et le dimanche ne sont pas affichés par Daily des équipes)
      let jour = ui('dailyEquipes', {}).jour || Calculs.aujourdhui();
      while (Calculs.estWeekend(jour)) jour = Calculs.ajouterJours(jour, -1);
      const p = etat.d.projets.find(x => x.code === 'PF-14');
      const r = Ecrans.dailyEquipes.membres(p, jour).find(x => !x.userId);
      if (!r) return null;
      etat.d.notesProjet.push({ userId: 'fiche:' + r.id, projetId: p.id, jour, texte: 'Aujourd’hui\n- Daily importé du fichier Excel' });
      rendre(); return r.nom;
    });
    verifier('Daily des équipes : daily importé d’une personne sans compte affiché', !!sansCompte && (await texte()).includes('Daily importé du fichier Excel'));
    await page.evaluate(() => { etat.d.notesProjet = etat.d.notesProjet.filter(n => !n.userId.startsWith('fiche:')); rendre(); });

    // Export du daily en Excel (maquette export-daily-excel) : projet filtré coché, fichier .xlsx téléchargé
    await page.click('[data-action="ouvrirExportDaily"]'); await page.waitForTimeout(200);
    verifier('Export daily : fenêtre ouverte avec le seul projet filtré coché', await page.$$eval('.modale input[name=projet]:checked', l => l.length) === 1);
    await capture('22-export-daily-excel');
    await page.click('.modale [data-action="periodeExportDaily"][data-periode="jour"]');
    const [telechargement] = await Promise.all([page.waitForEvent('download'), page.click('.modale button.primaire')]);
    const fichierXlsx = require('fs').readFileSync(await telechargement.path());
    const contenuXlsx = fichierXlsx.toString('utf8');
    const jourOuvre = await page.evaluate(() => Calculs.estJourOuvre(Calculs.aujourdhui(), feries()));
    verifier('Export daily : vrai fichier .xlsx (archive ZIP, onglets Daily et Blocages)', telechargement.suggestedFilename().endsWith('.xlsx')
      && fichierXlsx.slice(0, 2).toString() === 'PK' && contenuXlsx.includes('name="Daily"') && contenuXlsx.includes('name="Blocages"'));
    verifier('Export daily : notes du jour et blocages dans le fichier', !jourOuvre
      || (contenuXlsx.includes('Finaliser le plan de migration SSO') && contenuXlsx.includes('Identifiants de recette expirés') && !contenuXlsx.includes('Aujourd’hui\n-')));

    /* --- Mon dashboard (édition) --- */
    await aller('daily'); await capture('08-daily');
    const nbCartes = await page.evaluate(() => mesProjetsDaily().length);
    verifier('Daily : une carte par projet affecté (Chef de projet, Membre)', nbCartes > 1 && (await page.$$('[data-carte-projet]')).length === nbCartes);
    await page.click('[data-action="dailyDecaler"][data-sens="-1"]'); await page.waitForTimeout(200);
    // Trois champs par projet ; un texte par projet et par jour en base, au format des rubriques
    const idPf14 = await page.evaluate(() => etat.d.projets.find(p => p.code === 'PF-14').id);
    await page.fill(`textarea[data-projet="${idPf14}"][data-champ="hier"]`, 'Test automatique\nDeuxième point');
    await page.fill(`textarea[data-projet="${idPf14}"][data-champ="aujourdhui"]`, 'Revue de code');
    await page.press(`textarea[data-projet="${idPf14}"][data-champ="aujourdhui"]`, 'Space'); await page.waitForTimeout(1200);
    const noteVeille = await page.evaluate(id => (noteProjet(etat.session.user.id, id, Ecrans.daily.jour()) || {}).texte || '', idPf14);
    await page.click('[data-action="dailyAujourdhui"]'); await page.waitForTimeout(200);
    verifier('Daily : note du projet enregistrée (Hier / Aujourd’hui) et rappelée le lendemain', noteVeille.startsWith('Hier\n- Test automatique\n- Deuxième point\n\nAujourd’hui\n- Revue de code')
      && await page.evaluate(id => document.querySelector(`textarea[data-projet="${id}"][data-champ="hier"]`).value !== '' || document.querySelector(`textarea[data-projet="${id}"][data-champ="hier"]`).placeholder.includes('Revue de code'), idPf14));
    verifier('Daily personnel : la note d’un coéquipier n’apparaît pas', !(await page.$$eval('.champ-daily textarea', l => l.map(t => t.value).join(' '))).includes('Mapping des rôles'));
    // Lien avec les congés : un jour d'absence d'une journée → aucun daily attendu, cartes repliées
    const jourConge = await page.evaluate(() => { const moi = maRessource(); const a = etat.d.absences.find(x => x.ressourceId === moi.id && Calculs.dureeAbsence(x) >= 1 && !Calculs.estWeekend(x.jour)); return a && a.jour; });
    await page.evaluate(j => majUi('daily', { jour: j }), jourConge); await page.waitForTimeout(200);
    verifier('Daily : jour de congé → « aucun daily attendu », cartes repliées', !!jourConge && (await texte()).includes('aucun daily attendu') && !(await page.$('textarea[data-champ="hier"]')));
    await page.click('[data-action="dailyAujourdhui"]'); await page.waitForTimeout(200);

    await aller('mesProjets'); await capture('09-mes-projets');
    await page.click('.gantt-ligne:has-text("PF-14") .gantt-barre');   // projet dont Camille est cheffe await page.waitForTimeout(200);
    await capture('10-panneau-projet');
    verifier('Panneau : ni objectif, ni période, ni statut, ni avancement, ni tickets',
      !(await page.$('.panneau [data-champ="statut"], .panneau [data-champ="fin"], .panneau input[type=range], .panneau form[data-action-envoi="ajouterTicket"]'))
      && !(await page.textContent('.panneau')).includes('Résultat clé'));
    await page.click('.fermer');
    await page.click('[data-action="ouvrirObjectifs"]'); await page.waitForTimeout(200);
    await page.fill('form[data-action-envoi="ajouterObjectif"] input', 'Objectif de test'); await page.click('form[data-action-envoi="ajouterObjectif"] button');
    await page.waitForTimeout(300);
    verifier('Objectifs : objectif ajouté', (await texte()).includes('Objectif de test'));
    await page.click('.fermer');
    await page.click('[data-action="nouveauProjet"]'); await page.waitForTimeout(200);
    await page.fill('form[data-action-envoi="creerProjet"] input[name=nom]', 'Projet de test');
    verifier('Nouveau projet : ni résultat clé, ni dates, ni statut', !(await page.$('form[data-action-envoi="creerProjet"] [name=resultatCleId], form[data-action-envoi="creerProjet"] [name=debut], form[data-action-envoi="creerProjet"] [name=fin], form[data-action-envoi="creerProjet"] [name=statut]')));
    // Méthode obligatoire (migration 022) : sans choix, le formulaire ne part pas
    await page.click('form[data-action-envoi="creerProjet"] .btn.primaire'); await page.waitForTimeout(200);
    verifier('Nouveau projet : méthode obligatoire (5 choix, dont Test & Learn)', await page.$$eval('input[name=methode]', l => l.length) === 5
      && !!(await page.$('input[name=methode][value="Test & Learn"]')) && !!(await page.$('form[data-action-envoi="creerProjet"]')));
    await page.check('input[name=methode][value="Agile Kanban"]');
    await page.click('form[data-action-envoi="creerProjet"] .btn.primaire'); await page.waitForTimeout(400);
    verifier('Nouveau projet créé et ouvert', (await page.inputValue('.panneau input[data-champ="nom"]')) === 'Projet de test');
    verifier('Nouveau projet : méthode enregistrée et modifiable dans la fiche', await page.inputValue('.panneau select[data-champ="methode"]') === 'Agile Kanban'
      && await page.evaluate(() => etat.d.projets.find(p => p.nom === 'Projet de test').methode === 'Agile Kanban'));
    await page.click('.fermer');

    // Bouton Aide : menu, guide de l'écran courant, fermeture
    await aller('dashboard'); await page.click('[data-action="basculerMenuAide"]');
    await page.click('[data-action="ouvrirAide"][data-sujet="ecran"]'); await page.waitForTimeout(150);
    verifier('Bouton Aide : guide de l’écran affiché', (await page.textContent('.modale')).includes('Vue d’ensemble') && !(await page.$('.menu-aide-liste')));
    await page.click('.modale .fermer');
    await page.click('[data-action="basculerMenuAide"]'); await page.click('[data-action="ouvrirAide"][data-sujet="roles"]'); await page.waitForTimeout(150);
    verifier('Bouton Aide : guide « Rôles et droits »', (await page.textContent('.modale')).includes('Lecteur'));
    await page.click('.modale .fermer');
    // Bulles d'information : présentes et lisibles au survol
    await aller('dashboard'); await page.hover('.kpi .aide'); await page.waitForTimeout(100);
    verifier('Bulles d’information : texte affiché au survol', await page.$eval('.kpi .aide .bulle', b => getComputedStyle(b).display !== 'none' && b.textContent.length > 20)
      && (await page.$$('.aide')).length >= 5);
    // Bouton « Aujourd'hui » : retour au mois en cours après navigation
    await aller('conges'); await page.click('[data-action="moisSuivant"]'); await page.click('[data-action="moisSuivant"]');
    await page.click('[data-action="calendrierAujourdhui"]'); await page.waitForTimeout(150);
    verifier('Congés : bouton « Aujourd’hui » → mois en cours', await page.evaluate(() => {
      const j = Calculs.depuisIso(Calculs.aujourdhui()), m = Calendrier.moisCourant(); return m.annee === j.getFullYear() && m.mois === j.getMonth(); }));
    await page.click('[data-action="moisSuivant"]');
    await page.click('[data-action="choisirPinceau"][data-id="Congés prévisionnel"]');
    await page.click('td[data-action="basculerAbsence"] >> nth=3'); await page.waitForTimeout(300);
    await capture('11-conges');
    // Vue « Par équipe » : une ligne par personne + synthèse par projet ; vue « Par projet » : ses membres seulement
    const personnesAffichees = async () => page.$$eval('.calendrier tr[data-personne]', t => t.map(x => x.dataset.personne));
    const parEquipe = await personnesAffichees();
    verifier('Congés : chaque personne une seule fois (vue par équipe)', parEquipe.length > 0 && new Set(parEquipe).size === parEquipe.length);
    verifier('Congés : synthèse des absents par projet', (await page.$$('.calendrier tr.ligne-synthese')).length > 0);
    await page.click('[data-action="vueCalendrier"][data-mode="projet"]'); await page.waitForTimeout(200);
    const parProjet = await personnesAffichees();
    const attendus = await page.evaluate(() => { const p = Calendrier.projetChoisi(); return etat.d.affectations.filter(a => a.projetId === p.id).map(a => a.ressourceId); });
    verifier('Congés : vue par projet = ses membres, une fois chacun', parProjet.length === attendus.length && parProjet.every(id => attendus.includes(id))
      && (await page.$$('.calendrier tr.ligne-synthese')).length === 1);
    await page.click('[data-action="vueCalendrier"][data-mode="equipe"]'); await page.waitForTimeout(150);
    await page.click('[data-action="ongletConges"][data-id="recap"]'); await page.waitForTimeout(200);
    // Récap annuel : T / C par mois et reste à prendre = total travaillé − objectif client de l'équipe
    verifier('Congés : récap annuel (travaillés, congés, reste à prendre)', (await texte()).includes('Reste à') && !(await page.$('td[data-action="basculerAbsence"]'))
      && await page.evaluate(() => { const r = Calculs.recapJoursTravailles('x', 2026, [], new Set(), 218); return r.travailles === 261 && r.reste === 43; }));
    await page.fill('input.objectif-client >> nth=0', '220'); await page.press('input.objectif-client >> nth=0', 'Tab'); await page.waitForTimeout(400);
    verifier('Congés : objectif client modifiable par équipe et par année', await page.evaluate(() => etat.d.objectifsTravail.some(o => Number(o.jours) === 220 && Number(o.annee) === 2026))
      && (await page.inputValue('input.objectif-client >> nth=0')) === '220');
    // Colonne C = congés seuls : novembre 2026 a 2 fériés en semaine (le 11 ; le 1er est un dimanche → 1)
    // et une demi-journée le 13 → C = 0,5, fériés comptés à part, T = 21 − 1 − 0,5
    verifier('Récap : les jours fériés ne sont pas comptés comme congés', await page.evaluate(() => {
      const m = Calculs.joursTravaillesMois('x', 2026, 10, [{ ressourceId: 'x', jour: '2026-11-13', type: 'Congés validé', duree: 0.5 }], new Set(['2026-11-01', '2026-11-11']));
      return m.conges === 0.5 && m.feries === 1 && m.travailles === 19.5;
    }));
    // Arrivée le 1er avril 2026 : janvier à mars hors présence, objectif 218 proratisé (197 / 261 jours de semaine)
    verifier('Récap : date d’arrivée — mois hors présence et objectif proratisé', await page.evaluate(() => {
      const rc = Calculs.recapJoursTravailles('x', 2026, [], new Set(), 218, { dateArrivee: '2026-04-01' });
      const cap = Calculs.capacitePeriode([{ id: 'x', capacite: 100, dateDepart: '2026-03-31' }], '2026-04-01', '2026-04-30', [], new Set());
      return rc.mois[2].ouvres === 0 && rc.mois[3].ouvres === 22 && rc.objectif === 164.5 && cap.theorique === 0;
    }));
    // Onglet Capacité : sans sprint saisi, message ; les sprints se saisissent dans Administration › Sprints
    await aller('capacite'); await page.waitForTimeout(200);
    const projetEditable = await page.evaluate(() => (Calendrier.projetsAvecMembres().find(x => peutEditerProjet(x)) || {}).id);
    await page.selectOption('select[data-action-change="projetCapaciteSaisie"]', projetEditable); await page.waitForTimeout(200);
    const sansSprint = (await texte()).includes('Aucun sprint saisi');
    // 4 sprints de 2 semaines autour d'aujourd'hui (le 3e est le sprint en cours), saisis dans Administration › Sprints
    const dates = await page.evaluate(() => { const l = Calculs.lundi(Calculs.aujourdhui());
      return [-4, -2, 0, 2].map(k => [Calculs.ajouterJours(l, k * 7), Calculs.ajouterJours(l, k * 7 + 11)]); });
    await page.click('[data-action="allerSprints"]'); await page.waitForTimeout(250);   // Administration › Sprints, sur ce projet
    for (let i = 0; i < dates.length; i++) {
      await page.fill('input[form="ajout-sprint"][name=nom]', 'V' + (i + 1));
      await page.fill('input[form="ajout-sprint"][name=debut]', dates[i][0]); await page.fill('input[form="ajout-sprint"][name=fin]', dates[i][1]);
      await page.click('button[form="ajout-sprint"]'); await page.waitForTimeout(300);
    }
    // Numéro (« Sprint 1 ») et année pré-remplis ; affichage par année (puces)
    const anneeCourante = Number(dates[2][0].slice(0, 4));
    await page.click(`[data-action="anneeSprints"][data-annee="${anneeCourante + 1}"]`).catch(() => {});
    const autreAnneeVide = await page.evaluate(() => !document.querySelector('input[data-action-change="majSprint"][data-champ="numeroSprint"]'));
    await page.evaluate(a => majUi('monAdmin', { anneeSprints: a }), anneeCourante); await page.waitForTimeout(150);
    verifier('Administration › Sprints : numéro « Sprint N », année, version, début, fin ; affichage par année', sansSprint
      && await page.evaluate(id => sprintsDuProjet(id).map(s => `${s.numeroSprint}/${s.nom}`).join() === '1/V1,2/V2,3/V3,4/V4', projetEditable)
      && await page.evaluate(id => sprintsDuProjet(id).every(s => anneeSprint(s) === Number(s.debut.slice(0, 4))), projetEditable)
      && (await page.$$('input[data-action-change="majSprint"][data-champ="numeroSprint"]')).length === 4
      && (!(await page.$(`[data-action="anneeSprints"][data-annee="${anneeCourante + 1}"]`)) || autreAnneeVide)
      && await page.evaluate(() => etat.ecran === 'monAdmin' && ui('monAdmin').onglet === 'sprints'));
    await page.click('[data-action="ongletMonAdmin"][data-id="sprints"]'); await page.waitForTimeout(150);   // onglet par défaut pour la suite
    await aller('capacite'); await page.waitForTimeout(200);
    verifier('Capacité : menu à part au-dessus du Plan de charge, plus d’onglet Capacité dans Congés', await page.evaluate(() => {
      const ids = [...document.querySelectorAll('.laterale [data-action="aller"]')].map(a => a.dataset.ecran);
      return ids.indexOf('capacite') > ids.indexOf('conges') && (ids.indexOf('previsionnel') < 0 || ids.indexOf('capacite') < ids.indexOf('previsionnel'))
        && !Ecrans.conges.onglets(2026).some(o => o.id === 'capacite');
    }));
    verifier('Capacité : sprint en cours du projet, indicateurs et capacité des membres', (await texte()).includes('V3 · en cours')
      && (await texte()).includes('Capacité engageable') && (await texte()).includes('Capacité des membres'));
    await capture('11b-capacite');
    await page.click('[data-action="sprintCapacite"] >> nth=0'); await page.waitForTimeout(150);
    const ailleurs = !(await texte()).includes('· en cours');
    await page.click('[data-action="capaciteAujourdhui"]'); await page.waitForTimeout(150);
    verifier('Capacité : bouton « Aujourd’hui » → sprint en cours', ailleurs && (await texte()).includes('· en cours'));
    // Saisie : points terminés du sprint précédent (V2) → vélocité ; jours réels d'une catégorie
    await page.fill('input[data-action-change="saisirPoints"][data-champ="pointsTermines"] >> nth=1', '21');
    await page.press('input[data-action-change="saisirPoints"][data-champ="pointsTermines"] >> nth=1', 'Tab'); await page.waitForTimeout(400);
    await page.fill('input[data-action-change="saisirRepartition"] >> nth=0', '11');
    await page.press('input[data-action-change="saisirRepartition"] >> nth=0', 'Tab'); await page.waitForTimeout(400);
    verifier('Capacité : saisie des points (vélocité) et des jours réels enregistrée', await page.evaluate(() =>
      etat.d.sprintsProjet.some(s => s.nom === 'V2' && Number(s.pointsTermines) === 21) && etat.d.repartitionsSprint.some(r => r.categorie === 'User stories' && Number(r.jours) === 11))
      && (await page.textContent('.grille-kpi')).includes('21 pts'));
    await page.click('[data-action="ouvrirMethodeCapacite"]'); await page.waitForTimeout(150);
    const methode = (await page.textContent('.modale')) || '';
    await page.click('.modale [data-action="fermer"]'); await page.waitForTimeout(150);
    verifier('Capacité : pop-in « Méthode de calcul Scrum »', ['Capacité engageable', 'Vélocité', 'Répartition idéale', 'Incidents (prod)', 'Cérémonies / réunions'].every(t => methode.includes(t)));
    await aller('conges'); await page.click('[data-action="ongletConges"][data-id="grille"]');
    // Novembre 2026 (Armistice, demi-journée de Léa le 13) : indépendant de la date du jour
    await page.evaluate(() => majUi('calendrier', { annee: 2026, mois: 10 })); await page.waitForTimeout(150);
    verifier('Congés : jours fériés affichés par défaut avec le type « Jours férié »', !!(await page.$('td.ferme .case-absence[title="Armistice"], td.ferme .case-absence')) && (await page.textContent('td.ferme .case-absence')).includes('JF'));
    verifier('Congés : demi-journée affichée « ½ »', (await page.textContent('tr:has-text("Léa Moreau")')).includes('½'));
    verifier('Calculs : demi-journée comptée 0,5', await page.evaluate(() => {
      const lea = etat.d.ressources.find(r => r.nom === 'Léa Moreau');
      return Calculs.joursTravaillesMois(lea.id, 2026, 10, [{ ressourceId: lea.id, jour: '2026-11-13', type: ABSENCES.CP, duree: 0.5 }], new Set()).conges === 0.5
        && Calculs.heuresAttendues(lea, '2026-11-09', [{ ressourceId: lea.id, jour: '2026-11-13', duree: 0.5 }], new Set(['2026-11-11'])) === 3.5 * CONFIG.HEURES_PAR_JOUR * (lea.capacite ?? 100) / 100;
    }));
    // Changement fait « ailleurs » (écriture directe, sans rechargement) : visible au changement d'écran, sans F5
    await page.evaluate(() => { const r = etat.d.ressources[0]; return Api.creer('absences', { ressourceId: r.id, jour: '2026-11-20', type: ABSENCES.CP, duree: 1 }, 'ressource_id,jour'); });
    const avantNavigation = await page.evaluate(() => etat.d.absences.some(a => a.jour === '2026-11-20'));
    await aller('ressources'); await page.waitForTimeout(400); await aller('conges'); await page.waitForTimeout(400);
    verifier('Données rafraîchies au changement d’écran (sans F5)', !avantNavigation && await page.evaluate(() => etat.d.absences.some(a => a.jour === '2026-11-20')));
    verifier('Lecture paginée : plus de 50 absences chargées malgré le plafond de 50 lignes par réponse', await page.evaluate(() => etat.d.absences.length > 50));
    verifier('Congés : absence posée', (await page.$$('td[data-action="basculerAbsence"] .case-absence')).length > 0);

    await aller('listeRessources');
    /* Liste des ressources (piste 3, 2026-10-09) : navigation à gauche, détail à droite.
       Projet PF-12 : Product Owner (rôle Chef de projet) puis membres. */
    const noeud = (type, nom) => `#nav-ressources .noeud.${type}:has-text("${nom}")`;
    verifier('Liste des ressources : navigation (équipes, projets) et détail de l’équipe ouverte', !!(await page.$(noeud('equipe', 'Data')))
      && !!(await page.$(noeud('projet', 'Migration Kubernetes'))) && (await page.textContent('#detail-ressources')).includes('Responsable de l’équipe'));
    await page.click(noeud('projet', 'Migration Kubernetes')); await page.waitForTimeout(200);
    const [poPf12, membresPf12] = await page.$$eval('#detail-ressources .carte', c => [c[1].textContent, c[2].textContent]);
    verifier('Liste des ressources : projet → Product Owners puis membres', poPf12.includes('Product Owners') && poPf12.includes('Julien Dubois')
      && membresPf12.includes('Thomas Bernard') && membresPf12.includes('Membre') && !membresPf12.includes('Julien Dubois'));
    // Date de fin saisie dans la fiche : la personne reste affichée « Inactif » (masquable avec le bouton)
    const idFin = await page.evaluate(() => etat.d.ressources.find(r => r.nom === 'Thomas Bernard').id);
    const ligneFin = `#detail-ressources tr[data-ressource="${idFin}"]`;
    const poserFin = async jour => {
      await page.click(`${ligneFin} [data-action="modifierRessource"]`);
      await page.fill('form[data-action-envoi="enregistrerRessource"] input[name=dateDepart]', jour);
      await page.click('form[data-action-envoi="enregistrerRessource"] .btn.primaire'); await page.waitForTimeout(400);
    };
    // Date de naissance (migration 036) : champ facultatif de la fiche, date complète conservée
    await page.click(`${ligneFin} [data-action="modifierRessource"]`);
    const naissanceLue = await page.inputValue('form[data-action-envoi="enregistrerRessource"] input[name=dateNaissance]');
    await page.fill('form[data-action-envoi="enregistrerRessource"] input[name=dateNaissance]', '1991-10-29');
    await page.click('form[data-action-envoi="enregistrerRessource"] .btn.primaire'); await page.waitForTimeout(400);
    verifier('Fiche : date de naissance lue et enregistrée', naissanceLue === '1991-10-28'
      && await page.evaluate(id => ressource(id).dateNaissance === '1991-10-29', idFin));
    await poserFin('2026-09-30');
    const revue = (await page.textContent(ligneFin)).includes('Inactif') && (await page.textContent(ligneFin)).includes('partie le 30 sept. 2026');
    // Sections Actifs / Inactifs repliables (demande du porteur, 2026-10-12)
    const dansInactifs = await page.$eval(ligneFin, tr => { let x = tr.previousElementSibling; while (x && !x.classList.contains('groupe')) x = x.previousElementSibling; return !!x && x.textContent.includes('Inactifs'); });
    const sectionInactifs = '#detail-ressources [data-action="replierSection"][data-id$=":inactifs"]';
    await page.click(sectionInactifs); await page.waitForTimeout(150);
    const masquee = !(await page.$(ligneFin)) && !!(await page.$('#detail-ressources tr[data-ressource]'));
    await page.click(sectionInactifs); await page.waitForTimeout(150);
    verifier('Liste des ressources : date de fin (fiche) → section « Inactifs » repliable, présence en clair',
      masquee && revue && dansInactifs && await page.evaluate(id => ressource(id).dateDepart === '2026-09-30', idFin));
    // Statut cliquable : « Inactif » → réactive (date de fin retirée) ; « Actif » → inactive (date de fin = aujourd'hui)
    await page.click(`[data-action="basculerActifRessource"][data-id="${idFin}"]`); await page.waitForTimeout(400);
    const reactivee = await page.evaluate(id => !ressource(id).dateDepart, idFin);
    await page.click(`[data-action="basculerActifRessource"][data-id="${idFin}"]`); await page.waitForTimeout(400);
    const inactivee = await page.evaluate(id => ressource(id).dateDepart === Calculs.aujourdhui(), idFin);
    verifier('Liste des ressources : statut Actif / Inactif cliquable', reactivee && inactivee);
    // Menus liés (signalé le 2026-10-06) : une personne partie le 30/09 disparaît des périodes APRÈS son
    // départ (octobre : grille, timesheet, suivi, annuaire) mais reste visible AVANT (septembre)
    await poserFin('2026-09-30');
    const nomFin = await page.evaluate(id => ressource(id).nom, idFin);
    const visibleDans = [];
    await page.evaluate(() => { majUi('calendrier', { annee: 2026, mois: 9 }); majUi('moisTemps', { annee: 2026, mois: 9 }); });
    // Texte de la zone d'écran seulement (le nom de la personne connectée figure aussi dans la barre latérale)
    const contenu = () => page.textContent('.contenu');
    for (const ecran of ['conges', 'timesheet']) { await aller(ecran); if ((await contenu()).includes(nomFin)) visibleDans.push(ecran); }
    // Gestion des ressources : absent du calendrier d'octobre, présent « Inactif » dans l'annuaire
    await aller('ressources');
    const [dansCalendrier, ligneAnnuaire] = await page.evaluate(nom => {
      const cartes = [...document.querySelectorAll('.contenu .carte')];
      const annuaire = cartes.find(c => c.textContent.includes('Liste des ressources'));
      const ligne = annuaire && [...annuaire.querySelectorAll('tbody tr')].find(tr => tr.textContent.includes(nom));
      return [cartes[0].textContent.includes(nom), ligne ? ligne.textContent : ''];
    }, nomFin);
    if (dansCalendrier) visibleDans.push('calendrier ressources');
    if (!ligneAnnuaire.includes('Inactif')) visibleDans.push('annuaire sans « Inactif »');
    await page.evaluate(() => { majUi('calendrier', { annee: 2026, mois: 8 }); majUi('moisTemps', { annee: 2026, mois: 8 }); });
    await aller('conges'); const avantDepart = (await contenu()).includes(nomFin);
    await aller('timesheet'); const avantDepartTs = (await contenu()).includes(nomFin);
    await aller('conges'); await page.click('[data-action="ongletConges"][data-id="recap"]').catch(() => {}); await page.waitForTimeout(150);
    const recapAnnee = (await contenu()).includes(nomFin);   // présente une partie de l'année → dans le récap annuel
    await page.click('[data-action="ongletConges"][data-id="grille"]').catch(() => {});
    verifier('Personne partie le 30/09 : absente des écrans d’octobre, présente en septembre et dans le récap annuel',
      visibleDans.length === 0 && avantDepart && avantDepartTs && recapAnnee, 'visible en octobre dans : ' + visibleDans.join(', ') + ' · fin = ' + await page.evaluate(id => ressource(id).dateDepart, idFin) + ' · ' + nomFin);
    await page.evaluate(() => { const d = new Date(); majUi('calendrier', { annee: d.getFullYear(), mois: d.getMonth() }); });
    await aller('listeRessources');   // inactifs toujours affichés (bouton cliqué plus haut)
    await page.click(`[data-action="basculerActifRessource"][data-id="${idFin}"]`); await page.waitForTimeout(400);   // réactivée pour la suite
    verifier('Personne réactivée : date de fin retirée', await page.evaluate(id => !ressource(id).dateDepart, idFin));
    /* Rôle d'accès (maquette affecter-roles/, 2026-10-13) : colonne « Accès » de la Liste des ressources,
       fiche en lecture (lien vers Administration › Rôles), choix dans Administration › Rôles par un
       administrateur (Camille, administratrice non créatrice). */
    await page.click(noeud('equipe', 'Plateforme')); await page.waitForTimeout(200);
    const idThomas = await page.evaluate(() => etat.d.ressources.find(r => r.nom === 'Thomas Bernard').id);
    const idLea = await page.evaluate(() => etat.d.ressources.find(r => r.nom === 'Léa Moreau').id);
    const accesThomas = async () => (await page.$eval(`#detail-ressources tr[data-ressource="${idThomas}"] td:nth-child(3)`, td => td.textContent.trim()));
    const accesInitial = await accesThomas();
    await page.click(`#detail-ressources tr[data-ressource="${idThomas}"] [data-action="modifierRessource"]`);
    const ficheEnLecture = !(await page.$('.modale input[name=roleAcces]')) && !!(await page.$('.modale [data-action="ouvrirRoles"]'));
    await page.click('.modale [data-action="ouvrirRoles"]'); await page.waitForTimeout(300);
    const ongletRoles = await page.evaluate(() => etat.ecran === 'monAdmin' && !etat.modale && !!document.querySelector('.tableau-roles-acces'));
    const choisirRole = async (id, role) => {
      await page.selectOption(`select[data-action-change="affecterRole"][data-id="${id}"]`, role); await page.waitForTimeout(500);
    };
    await choisirRole(idThomas, 'responsable');
    const thomasResponsable = await page.evaluate(id => membreOrganisation(ressource(id)).role === 'admin'
      && responsablesDe(ressource(id).equipeId).some(r => r.id === id) && roleAcces(ressource(id)) === 'responsable', idThomas);
    await choisirRole(idThomas, 'utilisateur');
    const thomasMembre = await page.evaluate(id => membreOrganisation(ressource(id)).role === 'member'
      && !responsablesDe(ressource(id).equipeId).some(r => r.id === id), idThomas);
    await choisirRole(idLea, 'admin');
    const leaPrevue = await page.evaluate(id => rolePrevu(ressource(id)) === 'admin' && !estAdministrateur(ressource(id))
      && document.querySelector(`select[data-id="${id}"]`).closest('td').textContent.includes('rôle prévu'), idLea);
    await capture('31-roles-administration');
    verifier('Rôles : fiche en lecture, choix dans Administration › Rôles par un administrateur (responsable, membre, rôle prévu sans compte)',
      accesInitial === 'Utilisateur' && ficheEnLecture && ongletRoles && thomasResponsable && thomasMembre && leaPrevue,
      JSON.stringify({ accesInitial, ficheEnLecture, ongletRoles, thomasResponsable, thomasMembre, leaPrevue }));
    /* Les six rôles de « Rôles et droits » (migration 030) : Direction = responsable de l'unité parente
       (Data → Plateforme) ; Lecture seule s'applique tout de suite, même sans compte (rôle qui restreint) */
    const optionsRoles = await page.$$eval(`select[data-action-change="affecterRole"][data-id="${idThomas}"] option`, o => o.map(x => x.value).join(','));
    const idHugo = await page.evaluate(() => etat.d.ressources.find(r => r.nom === 'Hugo Martin').id);
    await choisirRole(idLea, 'lecture');
    const leaLecture = await page.evaluate(id => roleDeclare(ressource(id)) === 'lecture' && !rolePrevu(ressource(id)), idLea);
    await choisirRole(idThomas, 'direction');
    const thomasDirection = await page.evaluate(id => roleDeclare(ressource(id)) === 'direction'
      && responsablesDe(ressource(id).equipeId).some(r => r.id === id) && membreOrganisation(ressource(id)).role === 'admin', idThomas);
    verifier('Rôles : les six rôles (Administrateur, Direction, Responsable, Projet, Utilisateur, Lecture seule) ; Lecture seule appliquée sans compte',
      optionsRoles === 'admin,direction,responsable,projet,utilisateur,lecture' && leaLecture && thomasDirection,
      JSON.stringify({ optionsRoles, leaLecture, thomasDirection, idHugo: !!idHugo }));
    await choisirRole(idThomas, 'utilisateur');
    await choisirRole(idLea, 'utilisateur');
    await aller('listeRessources');
    // Niveau « direction » masqué (« on oublie la direction DSI ») : une direction qui ne regroupe que des
    // équipes disparaît de la navigation, ses équipes sont listées directement ; vide, elle reste (supprimable)
    const creerUnite = async (nom, prefixe, type, parent) => {
      await page.click('[data-action="nouvelleUnite"]');
      await page.fill('form[data-action-envoi="enregistrerEquipe"] input[name=nom]', nom);
      await page.fill('form[data-action-envoi="enregistrerEquipe"] input[name=prefixe]', prefixe);
      await page.selectOption('select[name=type]', type);
      if (parent) await page.selectOption('select[name=parentId]', { label: parent });
      await page.click('form[data-action-envoi="enregistrerEquipe"] .btn.primaire'); await page.waitForTimeout(400);
    };
    const supprimerUnite = async nom => { await page.click(noeud('equipe', nom)); await page.click('#detail-ressources [data-action="supprimerEquipe"]'); await page.waitForTimeout(400); };
    await creerUnite('Direction Test', 'DT', 'direction');
    const directionVideVisible = !!(await page.$(noeud('equipe', 'Direction Test')));
    await creerUnite('Équipe Test', 'ET', 'equipe', 'Direction Test');
    verifier('Liste des ressources : direction masquée, ses équipes listées directement', directionVideVisible
      && !(await page.$(noeud('equipe', 'Direction Test'))) && !!(await page.$(noeud('equipe', 'Équipe Test'))));
    await supprimerUnite('Équipe Test'); await supprimerUnite('Direction Test');
    verifier('Liste des ressources : unités vides supprimées', !(await page.$(noeud('equipe', 'Équipe Test'))) && !(await page.$(noeud('equipe', 'Direction Test'))));
    await page.click(noeud('equipe', 'Data')); await page.waitForTimeout(150);
    /* Personnes proposées pour un projet (chef, membre) : toutes les personnes présentes, celles de l'équipe
       d'abord, avec équipe et poste — même liste pour Nouveau projet, panneau projet et affectation (2026-10-13) */
    verifier('Projet : toutes les personnes proposées (équipe d’abord, avec équipe et poste), même pour une équipe sans personne', await page.evaluate(() => {
      const data = etat.d.equipes.find(e => e.nom === 'Data'), liste = personnesProposees(data.id);
      const premiers = liste.slice(0, 3).map(x => ressource(x.valeur).equipeId);
      return liste.length === ressourcesActives().length && premiers.every(id => id === data.id)
        && liste.some(x => x.libelle.startsWith('Inès Roux — Mobile · Lead mobile'))
        && personnesProposees('equipe-sans-personne').length === ressourcesActives().length;
    }));
    /* Équipe › « + Personne existante » (maquette membres-equipe/, 2026-10-13) : dans une équipe SANS projet (IA),
       Julien (Plateforme) est rattaché : il s'affiche avec son équipe d'origine, qui ne change pas ; « Retirer » l'enlève */
    await page.evaluate(() => executer(() => Api.creer('equipes', { id: '00000000-0000-4000-8000-000000000033', nom: 'IA', prefixe: 'IA',
      couleur: etat.d.equipes[0].couleur, type: 'equipe', parentId: null, actif: true }), 'equipes'));
    await page.waitForTimeout(300);
    await page.click(noeud('equipe', 'IA')); await page.waitForTimeout(200);
    await page.click('#detail-ressources [data-action="rattacherPersonne"]'); await page.waitForTimeout(250);
    const idJulien = await page.evaluate(() => etat.d.ressources.find(r => r.nom === 'Julien Dubois').id);
    await page.selectOption('.modale select[name=ressource]', idJulien);
    await page.click('.modale .btn.primaire'); await page.waitForTimeout(400);
    const ligneJulien = await page.$eval(`#detail-ressources tr[data-rattachee][data-ressource="${idJulien}"]`, tr => tr.textContent).catch(() => '');
    verifier('Équipe sans projet › + Personne existante : rattachée, équipe d’origine inchangée', ligneJulien.includes('Équipe d’origine : Plateforme')
      && await page.evaluate(id => equipe(ressource(id).equipeId).nom === 'Plateforme', idJulien));
    await page.click(`#detail-ressources [data-action="retirerRattachement"][data-id="${idJulien}"]`); await page.waitForTimeout(400);
    verifier('Équipe › Retirer : le rattachement seul est supprimé', !(await page.$('#detail-ressources tr[data-rattachee]'))
      && await page.evaluate(id => !!ressource(id) && !etat.d.rattachements.length, idJulien));
    await page.evaluate(() => executer(() => Api.supprimer('equipes', { id: 'eq.00000000-0000-4000-8000-000000000033' }), 'equipes'));
    await page.waitForTimeout(300);
    await page.click(noeud('equipe', 'Mobile')); await page.waitForTimeout(200);
    verifier('Liste des ressources : suppression impossible d’une unité non vide', !!(await page.$('#detail-ressources button.btn-icone[disabled][title^="Équipe non vide"]')));
    await page.click(noeud('projet', 'Migration Kubernetes')); await page.waitForTimeout(200);
    await capture('12-liste-ressources');
    // Recherche : une personne → son équipe et ses projets seulement
    await page.fill('#nav-ressources input', 'sarah'); await page.waitForTimeout(150);
    const visibles = await page.$$eval('#nav-ressources [data-recherche]', l => l.filter(n => n.offsetParent).map(n => n.textContent.trim()));
    verifier('Liste des ressources : recherche d’une personne (son équipe et ses projets)', visibles.some(t => t.startsWith('Data'))
      && visibles.some(t => t.startsWith('Entrepôt')) && !visibles.some(t => t.startsWith('Mobile') || t.startsWith('Hugo')));
    await page.fill('#nav-ressources input', ''); await page.waitForTimeout(150);
    await page.click('#nav-ressources [data-action="choisirNoeud"][data-type="postes"]'); await page.waitForTimeout(200);
    await capture('18-postes');
    reponsePrompt = 'Développeur back-end';
    await page.click('tr:has-text("Dév. back-end") [data-action="renommerValeurListe"]'); await page.waitForTimeout(400);
    reponsePrompt = 'Merci de compléter';
    await page.click(noeud('projet', 'Migration Kubernetes')); await page.waitForTimeout(200);
    verifier('Postes : renommage propagé aux fiches ressources', (await texte()).includes('Développeur back-end'));
    await page.click('#detail-ressources [data-action="assigner"][data-projet]:not([data-role])'); await page.waitForTimeout(200);
    await page.selectOption('select[name=ressource]', { index: 3 }); await page.waitForTimeout(200);
    await page.check('input[name=projet] >> nth=0');
    await page.click('.modale .btn.primaire'); await page.waitForTimeout(300);
    verifier('Affectation enregistrée (modale fermée)', !(await page.$('.modale')));
    // « + Membre » → « + Nouveau membre » → retour à l'affectation, personne sélectionnée
    await page.click(noeud('projet', 'Portail développeurs')); await page.waitForTimeout(200);
    await page.click('#detail-ressources [data-action="assigner"][data-projet]:not([data-role])'); await page.waitForTimeout(200);
    await page.click('[data-action="nouvellePersonneAffectation"]'); await page.waitForTimeout(200);
    await page.fill('form[data-action-envoi="enregistrerRessource"] input[name=nom]', 'Nina Test');
    await page.click('form[data-action-envoi="enregistrerRessource"] .btn.primaire'); await page.waitForTimeout(400);
    const choisie = await page.$eval('select[name=ressource]', s => s.options[s.selectedIndex].text);
    const pf17Coche = await page.$eval('label:has-text("PF-17") input[name=projet]', c => c.checked);
    await page.click('.modale .btn.primaire'); await page.waitForTimeout(400);
    verifier('Affectation : personne créée depuis « + Membre » puis affectée', choisie.startsWith('Nina Test') && pf17Coche
      && await page.evaluate(() => etat.d.affectations.some(a => a.ressourceId === etat.d.ressources.find(r => r.nom === 'Nina Test').id)));
    // Projet modifiable depuis la Liste des ressources : nom, dates
    await page.click('#detail-ressources [data-action="ouvrirProjet"]'); await page.waitForTimeout(200);
    await page.fill('.panneau input[data-champ="nom"]', 'Portail développeurs v2'); await page.press('.panneau input[data-champ="nom"]', 'Tab'); await page.waitForTimeout(300);
    verifier('Projet : nom modifié depuis Liste des ressources',
      await page.evaluate(() => { const p = etat.d.projets.find(x => x.code === 'PF-17'); return p.nom === 'Portail développeurs v2'; }));
    await page.click('.panneau .fermer');

    // Saisie MENSUELLE : une colonne par jour de semaine du mois (septembre 2026 : 22 jours)
    await aller('monTimesheet'); await page.click('[data-action="moisTempsSuivant"]'); await page.waitForTimeout(200);
    await page.evaluate(() => majUi('moisTemps', { annee: 2026, mois: 8 })); await page.waitForTimeout(200);
    verifier('Saisir mes heures : grille du mois (22 jours de semaine, absences repérées)',
      (await page.$$('.grille-mois thead th')).length === 22 + 2 && (await page.$$('.grille-mois .jour-off')).length > 0);
    const saisie = await page.$('input.saisie-mois:not([disabled])');
    if (saisie) { await saisie.fill('3,5'); await saisie.press('Tab'); await page.waitForTimeout(300); }
    verifier('Mon timesheet : heure saisie', !!saisie && (await texte()).includes('3,5'));
    await capture('13-mon-timesheet');
    verifier('Saisir mes heures : plus de bloc « À valider »', !(await page.$('[data-action="validerFeuille"]')));
    await page.click('[data-action="soumettreMois"]'); await page.waitForTimeout(300);
    verifier('Mon timesheet : mois soumis (feuille au 1er du mois)', (await texte()).includes('Soumise')
      && await page.evaluate(() => etat.d.feuilles.some(f => f.ressourceId === maRessource().id && f.semaine === '2026-09-01' && f.statut === 'soumise')));
    // Validation des feuilles : dans Suivi de mes équipes › Timesheet (ex-Général), boutons pour MES équipes seulement
    verifier('Menu : Mon timesheet ne garde que « Saisir mes heures »', !(await page.$('[data-ecran="suiviEquipes"]')));
    await aller('timesheet'); await page.waitForTimeout(250);
    verifier('Timesheet : validation réservée aux équipes dont je suis responsable', (await texte()).includes('Feuilles à valider')
      && await page.evaluate(() => [...document.querySelectorAll('[data-action="validerFeuille"]')]
        .every(b => estResponsableDe(ressource(b.dataset.ressource).equipeId))));
    await capture('20-timesheet-validation');
    const avant = (await page.$$('[data-action="validerFeuille"]')).length;
    await page.click('[data-action="validerFeuille"] >> nth=0'); await page.waitForTimeout(300);
    verifier('Timesheet : feuille validée par le responsable', avant > 0 && (await page.$$('[data-action="validerFeuille"]')).length === avant - 1);

    await aller('monAdmin'); await capture('14-mon-admin');
    // Envoi du daily PAR PROJET (migration 019) : réglage par projet, mise en place Power Automate
    await page.click('[data-action="ongletMonAdmin"][data-id="envoiDaily"]'); await page.waitForTimeout(200);
    const idDa08 = await page.evaluate(() => etat.d.projets.find(p => p.code === 'DA-08').id);
    await page.selectOption(`select[data-action-change="majEnvoiDaily"][data-projet="${idDa08}"]`, 'power_automate'); await page.waitForTimeout(300);
    await page.click(`[data-action="basculerJourEnvoi"][data-projet="${idDa08}"][data-jour="5"]`); await page.waitForTimeout(300);
    verifier('Envoi du daily : mode et jours enregistrés par projet', await page.evaluate(id => {
      const r = etat.d.envoisDaily.find(x => x.projetId === id); return r && r.mode === 'power_automate' && r.jours === '1,2,3,4' && r.heure === '09:30'; }, idDa08));
    // Liste vide et aucun jour : enregistrés tels quels (bug du 2026-10-06 : '' envoyé en null, refusé par la base)
    for (const j of ['1', '2', '3', '4']) { await page.click(`[data-action="basculerJourEnvoi"][data-projet="${idDa08}"][data-jour="${j}"]`); await page.waitForTimeout(250); }
    verifier('Envoi du daily : destinataires vides et aucun jour acceptés', await page.evaluate(id => {
      const r = etat.d.envoisDaily.find(x => x.projetId === id); return r && r.jours === '' && r.destinataires === ''; }, idDa08)
      && !(await page.textContent('body')).includes('violates not-null'));
    for (const j of ['1', '2', '3', '4']) { await page.click(`[data-action="basculerJourEnvoi"][data-projet="${idDa08}"][data-jour="${j}"]`); await page.waitForTimeout(250); }
    verifier('Envoi du daily : une ligne par projet en cours (pas de projet terminé)', await page.evaluate(() => {
      const lignes = [...document.querySelectorAll('select[data-action-change="majEnvoiDaily"]')].map(x => projet(x.dataset.projet));
      return lignes.length > 0 && lignes.every(p => p && p.statut !== STATUTS_PROJET.TERMINE)
        && etat.d.projets.some(p => p.statut === STATUTS_PROJET.TERMINE); }));
    await capture('21-envoi-daily');
    await page.click(`[data-action="configurerPowerAutomate"][data-projet="${idDa08}"]`); await page.waitForTimeout(400);
    const corpsFlux = await page.evaluate(() => etat.modale && etat.modale.type === 'envoiPowerAutomate' && JSON.stringify({ p_projet: etat.modale.projetId, p_cle: etat.modale.cle }));
    verifier('Envoi du daily : fenêtre Power Automate du projet (URI, corps avec clé, aperçu)', !!corpsFlux && corpsFlux.includes('p_cle')
      && await page.evaluate(() => { const m = document.querySelector('.modale'); return !!m && m.innerHTML.includes('/rpc/daily_projet') && m.textContent.includes('Blocages du jour'); }));
    await page.click('.modale .fermer'); await page.click('[data-action="ongletMonAdmin"][data-id="sprints"]'); await page.waitForTimeout(150);
    // Demandes gérées dans Azure DevOps (retrait du 2026-10-05) : ni demandes entrantes, ni formulaire, ni espace demandeur
    verifier('Administration : plus de demandes entrantes ni de formulaire de demande', !(await page.$('[data-action="ongletMonAdmin"][data-id="demandes"], [data-action="ongletMonAdmin"][data-id="formulaire"]'))
      && !(await texte()).includes('Formulaire de demande') && (await texte()).includes('Sprints'));

    /* --- Plan de charge (migration 021) : réservé au créateur (porteur, 2026-10-22) ---
       Camille est administratrice (non créatrice) : menu absent ; le créateur est simulé le temps du bloc. */
    const planCacheAdmin = !(await page.$('[data-action="aller"][data-ecran="previsionnel"]'));
    await page.evaluate(() => { etat.estCreateur = true; rendre(); });
    verifier('Plan de charge : menu réservé au créateur (absent pour une administratrice)', planCacheAdmin
      && !!(await page.$('[data-action="aller"][data-ecran="previsionnel"]')));
    await aller('previsionnel'); await page.waitForTimeout(250);
    verifier('Prévisionnel : projets de la personne, % du projet et types de tâche (sous-total hors US)', (await texte()).includes('SSO & gestion des droits')
      && await page.$eval('input[data-action-change="partProjetPrevision"]', e => e.value) === '60' && (await texte()).includes('Total hors US'));
    verifier('Prévisionnel : jours = jours travaillés × % projet × % type', await page.evaluate(() => {
      const r = maRessource(), d = Calculs.depuisIso(Calculs.aujourdhui());
      const m = Calculs.previsionMois(r, d.getFullYear(), d.getMonth(), etat.d.absences, feries());
      const attendu = Previsionnel.format(m.disponibles * 0.6 * 0.36);
      const ligneUs = [...document.querySelectorAll('.contenu tr')].find(tr => (tr.querySelector('input.champ') || {}).value === 'US');
      return !!ligneUs && ligneUs.querySelectorAll('td.num')[1].textContent.trim() === attendu;
    }));
    await capture('23-previsionnel');
    await page.fill('input[data-action-change="partProjetPrevision"]', '50'); await page.dispatchEvent('input[data-action-change="partProjetPrevision"]', 'change'); await page.waitForTimeout(300);
    verifier('Prévisionnel : % du projet enregistré', await page.evaluate(() => Previsionnel.part(etat.d.projets.find(p => p.code === 'PF-14').id, maRessource().id) === 50));
    await page.fill('form[data-action-envoi="ajouterTypeTache"] input[name=libelle]', 'Revue de code'); await page.click('form[data-action-envoi="ajouterTypeTache"] button'); await page.waitForTimeout(300);
    verifier('Prévisionnel : type de tâche ajouté', await page.evaluate(() => etat.d.typesTache.some(t => t.libelle === 'Revue de code')));
    await page.click('[data-action="ongletPrevision"][data-onglet="reel"]'); await page.waitForTimeout(250);
    await page.evaluate(() => majUi('previsionnel', { sprint: 1 })); await page.waitForTimeout(200);
    verifier('Temps réel par sprint : heures saisies du sprint par projet', await page.evaluate(() => {
      const r = maRessource(), pf14 = etat.d.projets.find(p => p.code === 'PF-14');
      const reel = Calculs.heuresProjetPeriode(r.id, pf14.id, '2026-09-14', '2026-09-25', etat.d.temps);
      return reel > 0 && document.querySelector('.contenu').textContent.includes(Previsionnel.format(reel));
    }));
    await capture('24-previsionnel-reel');
    await page.evaluate(() => { etat.estCreateur = false; rendre(); });

    /* --- Compte sans équipe (migration 024) : en attente, accès donné par l'administratrice, entrée directe --- */
    const connecter = async email => {
      await page.click('[data-action="deconnexion"]'); await page.waitForSelector('form[data-action-envoi="seConnecter"]');
      await page.fill('input[name=email]', email); await page.fill('input[name=motDePasse]', 'motdepasse'); await page.click('form button');
      // Connexion terminée : session du bon compte et chargement fini (invitations acceptées comprises)
      await page.waitForFunction(adresse => etat.session && etat.session.user.email === adresse && !etat.chargement, email);
      await page.waitForTimeout(200);
    };
    // Lecture seule (migration 030) : Thomas consulte « Suivi de mes équipes », Mon dashboard est fermé
    const roleThomas = r => page.evaluate(role => Api.executer('affecter_role',
      { p_ressource: etat.d.ressources.find(x => x.nom === 'Thomas Bernard').id, p_role: role }), r);
    await roleThomas('lecture');
    await connecter('thomas@test.fr');
    const lectureSeule = await page.evaluate(() => estLectureSeule() && ![...document.querySelectorAll('.menu-titre')].some(t => t.textContent.includes('Mon dashboard'))
      && !document.querySelector('.laterale [data-ecran="daily"]'));
    await page.evaluate(() => allerA('daily')); await page.waitForTimeout(200);
    verifier('Lecture seule : Mon dashboard masqué et fermé, Suivi de mes équipes consultable', lectureSeule && (await texte()).includes('Votre rôle permet de consulter'));
    await connecter('camille@test.fr');
    await roleThomas('utilisateur');
    await connecter('elodie@test.fr');
    verifier('Compte sans équipe : « compte créé, en attente d’accès » avec Actualiser', (await texte()).includes('Votre compte est créé')
      && !!(await page.$('[data-action="reessayer"]')) && !(await page.$('form[data-action-envoi="deposerDemande"]')));
    await connecter('camille@test.fr');
    verifier('Comptes en attente : pastille sur Administration et compte listé', await page.evaluate(() =>
      !!document.querySelector('.menu-lien .pastille-alerte') && etat.comptesEnAttente.some(c => c.email === 'elodie@test.fr')));
    await aller('monAdmin'); await page.click('[data-action="ongletMonAdmin"][data-id="comptes"]'); await page.waitForTimeout(200);
    const ligneElodie = 'tr:has-text("elodie@test.fr")';
    await page.selectOption(`${ligneElodie} select[data-champ="equipe"]`, { label: 'Plateforme' }); await page.waitForTimeout(150);
    await page.selectOption(`${ligneElodie} select[data-champ="fiche"]`, 'nouvelle'); await page.waitForTimeout(150);
    await capture('26-comptes-en-attente');
    await page.click(`${ligneElodie} [data-action="donnerAcces"]`); await page.waitForTimeout(400);
    verifier('Comptes en attente : accès donné (fiche créée avec son email, invitation envoyée)', await page.evaluate(() =>
      etat.d.ressources.some(r => r.email === 'elodie@test.fr') && etat.comptesEnAttente.find(c => c.email === 'elodie@test.fr').invite
      && Number((document.querySelector('.menu-lien .pastille-alerte') || { textContent: 0 }).textContent) === etat.comptesEnAttente.filter(c => !c.invite).length));
    await connecter('elodie@test.fr');
    verifier('Compte sans équipe : entre directement après l’accès donné (invitation acceptée d’office)', await page.evaluate(() =>
      mesEquipes().length === 1 && etat.ecran !== 'choixEquipe' && !!maRessource()));

    /* --- Administratrice sans équipe : entrée directe dans l'outil, création d'équipe --- */
    await page.click('[data-action="deconnexion"]'); await page.waitForSelector('form[data-action-envoi="seConnecter"]');
    await page.fill('input[name=email]', 'admin@test.fr'); await page.fill('input[name=motDePasse]', 'motdepasse'); await page.click('form button');
    await page.waitForSelector('.laterale');
    verifier('Admin sans équipe : arrive dans l’outil', (await texte()).includes('Dashboard général'));
    await page.click('[data-action="aller"][data-ecran="daily"]'); await page.waitForTimeout(200);
    verifier('Admin sans équipe : Mon dashboard invite à ouvrir une équipe', (await texte()).includes('Aucune équipe ouverte'));
    await page.click('[data-action="aller"][data-ecran="listeRessources"]'); await page.waitForTimeout(200);
    verifier('Admin sans équipe : Liste des ressources ouverte (navigation par équipe)', !(await texte()).includes('Aucune équipe ouverte') && !!(await page.$('#nav-ressources')));
    await page.click('[data-action="aller"][data-ecran="monAdmin"]'); await page.click('[data-action="ongletMonAdmin"][data-id="equipes"]');
    await page.click('[data-action="nouvelleEquipe"]');
    await page.fill('form[data-action-envoi="enregistrerEquipe"] input[name=nom]', 'Direction Digitale');
    await page.fill('form[data-action-envoi="enregistrerEquipe"] input[name=prefixe]', 'dd');
    await page.click('form[data-action-envoi="enregistrerEquipe"] .btn.primaire'); await page.waitForTimeout(500);
    verifier('Admin : équipe créée et ouverte automatiquement', (await page.textContent('.bloc-equipe')).includes('Direction Digitale'));
    verifier('Admin (non créateur) : onglet Rôles disponible', !!(await page.$('[data-action="ongletMonAdmin"][data-id="roles"]')));

    /* --- Rôle Créateur (migration 025) : invitée d'office dans l'équipe créée, voit toutes les équipes --- */
    await connecter('createur@test.fr');
    verifier('Créateur : toutes les équipes, badge, invitation d’une nouvelle équipe acceptée d’office', await page.evaluate(() =>
      etat.estCreateur && etat.estAdmin && mesEquipes().length === etat.d.equipes.length && etat.ecran !== 'choixEquipe'
      && etat.organisations.some(o => o.name === 'Direction Digitale') && !!document.querySelector('.badge-createur')));
    await capture('27-createur');
    // Onglet Rôles (maquettes liste-roles, affecter-roles) : rôle d'accès de chaque personne, puis qui a quel rôle
    await aller('monAdmin'); await page.click('[data-action="ongletMonAdmin"][data-id="roles"]'); await page.waitForTimeout(200);
    verifier('Créateur : onglet Rôles, tableau Utilisateurs et rôles (colonnes demandées)', await page.evaluate(() =>
      [...document.querySelectorAll('.tableau-roles-acces tbody tr')].some(tr => tr.textContent.includes('Thomas Bernard') && tr.querySelector('select'))
      // Colonnes demandées (maquette tableau-roles) : utilisateur, équipe, projet(s), compte relié, poste, rôle
      && [...document.querySelectorAll('.tableau-roles-acces thead th')].map(th => th.childNodes[0].textContent.trim()).join('|')
        === 'Utilisateur|Équipe|Projet(s)|Compte relié|Poste|Rôle'
      && [...document.querySelectorAll('.tableau-roles-acces tbody tr')].some(tr => tr.textContent.includes('Thomas Bernard')
        && tr.textContent.includes(etat.d.ressources.find(r => r.nom === 'Thomas Bernard').poste) && tr.textContent.includes('Migration Kubernetes'))));
    await capture('27b-roles');
    // Matrice des droits (migration 031) : une ligne par droit, Administrateur × Rôles verrouillé, niveau modifié et enregistré
    await page.click('[data-action="vueRoles"][data-vue="matrice"]'); await page.waitForTimeout(200);
    const cellule = (role, droit) => `select[data-action-change="majDroit"][data-role="${role}"][data-droit="${droit}"]`;
    const matrice = await page.evaluate(() => document.querySelectorAll('.tableau-matrice tbody tr').length === DROITS.length + 1 + SECTIONS_DROITS.length + MENUS_SANS_DROIT.length);
    const verrou = await page.$eval(cellule('admin', 'roles'), el => el.disabled);
    await page.selectOption(cellule('utilisateur', 'projets'), 'oui'); await page.waitForTimeout(400);
    const enregistre = await page.evaluate(() => etat.d.droitsRoles.find(d => d.role === 'utilisateur' && d.droit === 'projets').niveau === 'oui');
    const sectionsMatrice = await page.$$eval('.tableau-matrice tbody tr.groupe', t => t.map(x => x.textContent.trim()));
    verifier('Matrice des droits : sections Suivi de mes équipes / Mon dashboard, une ligne par onglet modifiable',
      sectionsMatrice.includes('Suivi de mes équipes') && sectionsMatrice.includes('Mon dashboard') && await page.evaluate(() =>
        document.querySelectorAll('.tableau-matrice .ligne-onglet').length === DROITS.filter(d => d.onglet).length
        && document.querySelector('.tableau-matrice').textContent.includes('↳ Onglet « Synthèse de l’équipe »')
        && !document.querySelector('select[data-role="responsable"][data-droit="onglet_daily_synthese"]').disabled), sectionsMatrice.join(' | '));
    await capture('32-matrice-droits');
    await page.selectOption(cellule('utilisateur', 'projets'), 'lecture'); await page.waitForTimeout(400);
    await page.click('[data-action="vueRoles"][data-vue="qui"]'); await page.waitForTimeout(200);
    verifier('Matrice des droits : une ligne par droit, garde-fou Administrateur × Rôles, niveau enregistré ; vue « qui a quel rôle » sur les 6 rôles',
      matrice && verrou && enregistre && await page.evaluate(() => [...document.querySelectorAll('.grille-roles > .carte b')].map(b => b.textContent.trim()).join('|') === 'Administrateur|Direction|Responsable d’équipe|Projet|Utilisateur|Lecture seule|Compte en attente'),
      JSON.stringify({ matrice, verrou, enregistre }));
    await page.click('[data-action="vueRoles"][data-vue="utilisateurs"]'); await page.waitForTimeout(150);
    // Simulation des rôles : en tant que Thomas (membre), lecture seule, changement de rôle, retour
    // Administration créateur (2026-10-23) : menu à part, la simulation n'est plus un onglet d'Administration
    await aller('monAdmin');
    const plusOngletSimulation = !(await page.$('[data-action="ongletMonAdmin"][data-id="simulation"]'));
    await aller('adminCreateur'); await page.waitForTimeout(200);
    verifier('Administration créateur : menu à part avec la Simulation des rôles (plus d’onglet dans Administration)',
      plusOngletSimulation && (await texte()).includes('Voir l’application en tant que'));
    await capture('28-simulation-roles');
    // Cartes = les 6 rôles d'accès de la matrice + Compte en attente (2026-10-22)
    const cartesSimulation = await page.$$eval('.grille-simulation > .carte b', b => b.map(x => x.textContent.trim()));
    verifier('Simulation : une carte par rôle d’accès (Administrateur … Lecture seule) et Compte en attente',
      cartesSimulation.join('|') === 'Administrateur|Direction|Responsable d’équipe|Projet|Utilisateur|Lecture seule|Compte en attente', cartesSimulation.join(', '));
    await page.evaluate(() => { const liste = document.querySelector('select[name="personne-utilisateur"]');
      liste.value = [...liste.options].find(o => o.textContent.startsWith('Thomas Bernard')).value; });
    await page.click('[data-action="demarrerSimulation"][data-role="utilisateur"]'); await page.waitForTimeout(300);
    verifier('Simulation : vu comme Thomas (membre), sans droits d’administrateur, bandeau affiché', await page.evaluate(() =>
      !!document.querySelector('.bandeau-simulation') && maRessource().nom === 'Thomas Bernard' && !etat.estAdmin && !etat.estCreateur
      && !document.querySelector('[data-ecran="previsionnel"]') && document.querySelector('.moi-nom').textContent === 'Thomas Bernard'));
    // Droits par menu de Suivi de mes équipes (migration 037) : menu masqué si « Non » ; avant la migration, repli sur « general »
    const parMenu = await page.evaluate(() => {
      const ligne = etat.d.droitsRoles.find(d => d.role === monRole() && d.droit === 'suivi_projets'), avant = ligne.niveau;
      ligne.niveau = 'non'; rendre();
      const masque = !document.querySelector('.laterale [data-ecran="projets"]') && !!document.querySelector('.laterale [data-ecran="dashboard"]');
      ligne.niveau = avant;
      const sauvegarde = etat.d.droitsRoles;
      etat.d.droitsRoles = sauvegarde.filter(d => d.droit !== 'suivi_projets');
      const repli = niveauDroit('suivi_projets') === niveauDroit('general');
      etat.d.droitsRoles = sauvegarde; rendre();
      return { masque, repli };
    });
    verifier('Matrice par menu : menu de Suivi masqué si « Non », repli sur l’ancien droit avant la migration 037',
      parMenu.masque && parMenu.repli, JSON.stringify(parMenu));
    verifier('Simulation : pas de menu Administration dans Suivi de mes équipes (membre)', !(await page.$('.laterale [data-ecran="administration"]')));
    await aller('daily'); await page.waitForTimeout(300);
    // Sa note du dernier jour de semaine : dans le texte, ou en « Rappel d'hier » (attribut placeholder) un samedi ou un dimanche
    verifier('Simulation : écrans de la personne (son daily par projet)', (await texte()).includes('SSO & gestion des droits')
      && (await page.innerHTML('#app')).includes('Mapping des rôles applicatifs'));
    await capture('29-simulation-en-cours');
    verifier('Simulation : lecture seule (écriture refusée)', await page.evaluate(() =>
      Api.creer('absences', { ressourceId: maRessource().id, jour: '2026-12-01', type: 'Congés validé' }).then(() => false, e => e.message.includes('lecture seule'))));
    await page.selectOption('.bandeau-simulation select', 'sansEquipe|'); await page.waitForTimeout(300);
    verifier('Simulation : compte sans équipe (écran d’attente avec bandeau)', (await texte()).includes('Votre compte est créé') && !!(await page.$('.bandeau-simulation')));
    await page.click('[data-action="arreterSimulation"]'); await page.waitForTimeout(300);
    verifier('Simulation : retour au rôle de créateur', await page.evaluate(() =>
      etat.estCreateur && etat.estAdmin && !etat.simulation && !document.querySelector('.bandeau-simulation') && etat.ecran === 'adminCreateur'));

    /* --- Écran étroit : Galaxy Z Fold 7 déplié (≈ 884 px) — menu en tiroir, écrans sur toute la largeur --- */
    await page.setViewportSize({ width: 884, height: 1000 });
    await page.evaluate(() => allerA('daily')); await page.waitForTimeout(300);   // menu masqué : navigation directe
    const largeurContenu = await page.evaluate(() => document.querySelector('.contenu').getBoundingClientRect().width);
    verifier('Z Fold déplié : menu latéral masqué, bouton ☰, contenu sur toute la largeur, pas de débordement',
      await page.isVisible('[data-action="basculerMenuLateral"]') && largeurContenu > 860
      && await page.evaluate(() => document.querySelector('.laterale').getBoundingClientRect().right <= 0 && document.documentElement.scrollWidth <= 884));
    await page.click('[data-action="basculerMenuLateral"]'); await page.waitForTimeout(300);
    const menuOuvert = await page.evaluate(() => document.querySelector('.laterale').getBoundingClientRect().left === 0);
    await page.click('.laterale [data-action="aller"][data-ecran="dashboard"]'); await page.waitForTimeout(400);
    verifier('Z Fold déplié : le menu s’ouvre par ☰ et se referme après le choix d’un écran', menuOuvert
      && await page.evaluate(() => etat.ecran === 'dashboard' && !document.querySelector('.laterale.ouverte')));
    await capture('30-zfold-deplie');
    await page.setViewportSize({ width: 1440, height: 900 });

    /* --- Vérification de l'email (maquette verification-email) : code demandé, refusé si faux, accepté sinon --- */
    await page.click('[data-action="deconnexion"]'); await page.waitForSelector('form[data-action-envoi="seConnecter"]');
    await page.fill('input[name=email]', 'nonverifie@test.fr'); await page.fill('input[name=motDePasse]', 'motdepasse'); await page.click('form button');
    await page.waitForSelector('form[data-action-envoi="validerCodeEmail"]');
    verifier('Email non vérifié : saisie du code à la connexion', (await texte()).includes('Vérifiez votre adresse email') && (await texte()).includes('nonverifie@test.fr'));
    await capture('31-verification-email');
    await page.fill('input[name=code]', '000000'); await page.click('form[data-action-envoi="validerCodeEmail"] button'); await page.waitForTimeout(300);
    verifier('Email non vérifié : code faux refusé avec un message clair', (await texte()).includes('Code incorrect ou expiré'));
    await page.fill('input[name=code]', '123456'); await page.click('form[data-action-envoi="validerCodeEmail"] button');
    await page.waitForFunction(() => etat.session && etat.session.user.email === 'nonverifie@test.fr' && !etat.chargement);
    verifier('Email non vérifié : bon code → connecté directement', await page.evaluate(() => etat.session.user.emailVerified === true));

    /* --- Connexion Google (aller-retour simulé avec vérificateur de session) --- */
    await page.click('[data-action="deconnexion"]'); await page.waitForSelector('[data-action="connexionGoogle"]');
    await page.click('[data-action="connexionGoogle"]');
    // Attendre la fin de l'aller-retour (et non un délai fixe : la redirection prend un temps variable)
    await page.waitForFunction(() => typeof etat !== 'undefined' && etat.session && /Gaëlle/.test(etat.session.user.name || '') && !etat.chargement, null, { timeout: 10000 });
    await page.waitForTimeout(200);
    verifier('Google : session ouverte au retour, vérificateur retiré de l’adresse',
      (await texte()).includes('Gaëlle') && !page.url().includes('neon_auth_session_verifier'));
    await page.goto(BASE + '/app/?error=access_denied'); await page.waitForTimeout(500);
    await page.click('[data-action="deconnexion"]').catch(() => {});
    await page.goto(BASE + '/app/?error=access_denied'); await page.waitForSelector('[data-action="connexionGoogle"]');
    verifier('Google : erreur de retour affichée en clair', (await texte()).includes('Connexion Google annulée'));

    verifier('Aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
  } catch (e) {
    verifier('Parcours complet sans exception', false, e.message);
    await page.screenshot({ path: path.join(__dirname, 'echec.png') });
  } finally {
    await navigateur.close(); serveur.kill();
  }
  resultats.forEach(r => console.log(`${r.ok ? '✔' : '✘'} ${r.nom}${r.detail ? ' — ' + r.detail : ''}`));
  const echecs = resultats.filter(r => !r.ok).length;
  console.log(echecs ? `\n${echecs} échec(s)` : `\nTous les contrôles passent (${resultats.length}).`);
  process.exit(echecs ? 1 : 0);
})();
