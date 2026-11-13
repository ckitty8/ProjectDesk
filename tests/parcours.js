/* ============================================================
   Contrôles de bout en bout de l’application (/app/, React — voir docs/specifications/migration-react.md)
   ------------------------------------------------------------
   1. Démarre tests/serveur-simule.js (services Neon simulés).
   2. Ouvre /app/ (construit par `npm --prefix web run build`) en redirigeant Neon Auth et la Data API vers le serveur simulé.
   3. Vérifie : connexion, jeton, chargement des tables, droits, simulation de rôle, déconnexion, absence d'erreur JavaScript.
   Usage : node tests/parcours.js   (prérequis : npm --prefix web run build ; Playwright installé globalement)
   ============================================================ */
'use strict';

const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 8125, BASE = `http://localhost:${PORT}`;
const CAPTURES = path.resolve(__dirname, '../docs/maquettes/etat-actuel');
const resultats = [];
const verifier = (nom, condition, detail = '') => { resultats.push({ nom, ok: !!condition, detail }); };

(async () => {
  const serveur = spawn('node', [path.join(__dirname, 'serveur-simule.js'), String(PORT)], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const navigateur = await chromium.launch();
  let page;
  try {
    const contexte = await navigateur.newContext({ viewport: { width: 1440, height: 900 } });
    // Date figée au 31/10/2026 (les contrôles et les captures supposent octobre 2026 comme mois courant) ; les minuteurs restent réels
    await contexte.clock.setFixedTime(new Date('2026-10-31T10:00:00'));
    // Les contrôles supposent la vue administrateur (la vue par défaut d'un administrateur est son rôle : voir le contrôle « Mode administrateur »)
    await contexte.addInitScript(() => { try { if (localStorage.getItem('pp_mode_admin') === null) localStorage.setItem('pp_mode_admin', '1');
      // La pastille « Configuration » (bas droite) recouvrirait des éléments cliqués par les contrôles : fermée par défaut
      if (localStorage.getItem('pp_config_fermee') === null) localStorage.setItem('pp_config_fermee', '1'); } catch { /* sans stockage */ } });
    await contexte.addInitScript(base => { window.CONFIG_SURCHARGE = { NEON_AUTH_URL: base + '/auth', DATA_API_URL: base + '/rest/v1' }; }, BASE);
    page = await contexte.newPage();
    const erreurs = [];
    page.on('pageerror', e => erreurs.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) erreurs.push(m.text()); });

    const connecter = async (email, motDePasse = 'motdepasse') => {
      await page.fill('input[type=email]', email);
      await page.fill('input[type=password]', motDePasse);
      await page.click('form button.btn-connexion');
    };

    const VAGUE_A = CAPTURES;
    fs.mkdirSync(CAPTURES, { recursive: true });
    const capture = nom => page.screenshot({ path: path.join(VAGUE_A, nom + '.png') });
    const texte = () => page.textContent('body');

    /* ---------- Connexion (vague A) ---------- */
    await page.goto(BASE + '/app/');
    await page.waitForSelector('input[type=email]');
    await capture('01-connexion');
    verifier('Sans session, la connexion est proposée avec sa mention de propriété', (await page.textContent('.mention-propriete')).includes('© 2026 CIRITEC'));
    verifier('Connexion : plus de « Continuer avec Google » (email et mot de passe seulement)', !/google/i.test(await texte()));
    await connecter('camille@test.fr', 'faux-mdp-1');
    await page.waitForSelector('.message-erreur');
    verifier('Un mauvais mot de passe affiche une erreur claire et laisse sur la connexion', (await texte()).includes('incorrect') && await page.locator('input[type=email]').count() === 1);

    // Mot de passe oublié : demande, lien reçu par email (simulé), nouveau mot de passe, connexion
    await page.click('text=Mot de passe oublié ?');
    await page.fill('input[name=email]', 'camille@test.fr');
    await page.click('text=Recevoir le lien par email');
    await page.waitForSelector('.message-info');
    const emailEnvoye = (await texte()).includes('email de réinitialisation');
    const lien = (await (await page.request.get(BASE + '/auth/dernier-lien-simule')).json()).lien;
    await page.goto(lien);
    await page.waitForSelector('input[name=confirmation]');
    await page.waitForFunction(() => !location.search.includes('token='));
    await page.fill('input[name=motDePasse]', 'motdepasse'); await page.fill('input[name=confirmation]', 'autre-mot-de-passe');
    await page.click('text=Enregistrer le mot de passe'); await page.waitForSelector('.message-erreur');
    verifier('Mot de passe oublié : deux saisies différentes refusées', (await texte()).includes('sont différents'));
    await page.fill('input[name=motDePasse]', 'motdepasse'); await page.fill('input[name=confirmation]', 'motdepasse');
    await page.click('text=Enregistrer le mot de passe'); await page.waitForSelector('.message-info');
    verifier('Mot de passe oublié : email, lien (jeton retiré de l\'adresse), nouveau mot de passe enregistré',
      emailEnvoye && (await texte()).includes('Mot de passe enregistré') && await page.locator('input[type=password]').count() === 1);

    // Email non vérifié : code demandé, refusé si faux, accepté sinon
    await connecter('nonverifie@test.fr');
    await page.waitForSelector('input[name=code]');
    verifier('Email non vérifié : saisie du code à la connexion', (await texte()).includes('Vérifiez votre adresse email') && (await texte()).includes('nonverifie@test.fr'));
    await capture('01b-verification-email');
    await page.fill('input[name=code]', '000000'); await page.click('text=Valider et me connecter'); await page.waitForSelector('.message-erreur');
    verifier('Email non vérifié : code faux refusé avec un message clair', (await texte()).includes('Code incorrect ou expiré'));
    await page.fill('input[name=code]', '123456'); await page.click('text=Valider et me connecter');
    // « nonverifie » n'a pas d'équipe : une fois le code validé, il arrive directement sur l'écran d'attente d'accès
    await page.waitForSelector('text=Bonjour Victor');
    verifier('Email non vérifié : bon code → connecté directement', true);
    verifier('Compte sans équipe : message « votre compte est créé » et bouton Actualiser', (await texte()).includes('Votre compte est créé') && await page.getByRole('button', { name: 'Actualiser' }).count() === 1);
    await capture('02b-choix-equipe-en-attente');
    await page.click('text=Déconnexion');
    await page.waitForSelector('input[type=email]');

    /* ---------- Connexion de Camille : ouverture directe du dashboard ---------- */
    await connecter('camille@test.fr');
    await page.waitForSelector('.laterale');
    verifier('Une seule équipe : ouverture directe du dashboard général', page.url().endsWith('/app/dashboard') && (await texte()).includes('Vue consolidée des équipes'));
    await capture('03-dashboard');
    verifier('Dashboard : 4 indicateurs', await page.locator('.grille-kpi .kpi').count() === 4);
    verifier('Dashboard : projets à surveiller', await page.locator('.carte-titre', { hasText: 'Projets à surveiller' }).count() === 1);
    verifier('Barre latérale : sections Vue d’ensemble, Suivi de mes équipes et Mon dashboard, lien actif', (await page.textContent('.laterale')).includes('Vue d’ensemble') && (await page.textContent('.laterale')).includes('Suivi de mes équipes')
      && (await page.textContent('.laterale')).includes('Mon dashboard') && await page.locator('.menu-lien.actif', { hasText: 'Dashboard général' }).count() === 1);
    verifier('En-tête : fil d\'Ariane et badge Lecture seule', (await page.textContent('.fil')).includes('Suivi de mes équipes') && (await page.textContent('.fil')).includes('Lecture seule'));
    // Sections repliables : un clic sur le titre replie ses menus, un second les déplie
    await page.click('.menu-titre-bouton:has-text("Suivi de mes équipes")');
    verifier('Barre latérale : un clic sur le titre d\'une section la replie, un second la déplie',
      await page.locator('.laterale a[href$="/timesheet"]').count() === 0 && (await page.click('.menu-titre-bouton:has-text("Suivi de mes équipes")'), true)
      && await page.locator('.laterale a[href$="/timesheet"]').count() === 1);
    verifier('Barre latérale : bloc utilisateur (équipe, nom, mention)', (await page.textContent('.bloc-utilisateur')).includes('Plateforme') && (await page.textContent('.bloc-utilisateur')).includes('Camille Laurent')
      && (await page.textContent('.bloc-utilisateur')).includes('CIRITEC'));
    verifier('Titre de l\'onglet du navigateur', (await page.title()) === 'Dashboard général · ProjectDesk');
    // Mon profil : un clic sur l'avatar du bloc utilisateur ouvre la page (consultation seule : compte, fiche, accès)
    await page.click('.bloc-moi .avatar');
    await page.waitForSelector('.grille-profil');
    await page.screenshot({ path: path.join(CAPTURES, '35-mon-profil.png') });
    verifier('Mon profil : compte, fiche ressource et accès affichés, sans bouton de modification',
      page.url().endsWith('/app/mon-profil') && (await texte()).includes('Camille Laurent') && (await texte()).includes('Ma fiche ressource')
      && (await texte()).includes('Mon accès') && await page.locator('.ecran button:has-text("Modifier")').count() === 0);
    // Mode administrateur : la vue par défaut est le rôle ; le bouton du profil donne la vue administrateur complète
    verifier('Mode administrateur : bandeau, pastille et bouton « Revenir à mon rôle » quand il est actif',
      await page.locator('.bandeau-mode-admin').count() === 1 && (await page.textContent('.bloc-moi')).includes('administrateur')
      && await page.locator('button:has-text("Revenir à mon rôle")').count() >= 1);
    await page.click('.ecran button:has-text("Revenir à mon rôle")');
    await page.waitForSelector('.laterale');
    verifier('Mode administrateur : « Revenir à mon rôle » rend la vue du rôle (plus de bandeau ni de pastille)',
      await page.locator('.bandeau-mode-admin').count() === 0 && !(await page.textContent('.bloc-moi')).includes('administrateur'));
    await page.click('.bloc-moi .avatar');
    await page.click('.ecran button:has-text("Passer en administrateur")');
    await page.waitForURL('**/app/dashboard');
    await page.waitForSelector('.bandeau-mode-admin');
    verifier('Mode administrateur : « Passer en administrateur » active la vue complète', await page.locator('.bandeau-mode-admin').count() >= 1);
    await page.click('.laterale a[href$="/dashboard"]');
    await page.waitForSelector('.laterale');

    // Menu Aide : guide de l'écran, puis premiers pas
    await page.click('text=Aide');
    await page.click('text=Aide sur cet écran');
    verifier('Aide : guide de l\'écran ouvert dans une fenêtre', (await page.textContent('.modale')).includes('Aide · Dashboard général'));
    await page.click('.modale [aria-label=Fermer]');
    await page.click('text=Aide'); await page.click('text=Premiers pas');
    verifier('Aide : page « Premiers pas »', (await page.textContent('.modale')).includes('Mon dashboard › Liste des ressources'));
    await page.keyboard.press('Escape');

    /* ---------- Choix d'équipe (équipe déjà ouverte : croix, invitation reçue) ---------- */
    await page.click('.bloc-equipe >> text=Changer');
    await page.waitForSelector('.carte-choix');
    await capture('02-choix-equipe');
    verifier('Choix d\'équipe : invitation reçue affichée', (await texte()).includes('Invitations reçues') && (await texte()).includes('Produit'));
    verifier('Choix d\'équipe : équipe courante marquée, avec effectifs et rôle', await page.locator('.carte-choix.courante', { hasText: 'Plateforme' }).count() === 1
      && (await page.textContent('.carte-choix.courante')).includes('personnes'));
    await page.click('[aria-label=Fermer]');
    await page.waitForSelector('.laterale');
    verifier('Choix d\'équipe : la croix revient à l\'écran précédent', page.url().endsWith('/app/dashboard'));
    await page.click('.bloc-equipe >> text=Changer');
    await page.click('.carte-choix.courante >> text=Ouvrir');
    await page.waitForSelector('.laterale');
    verifier('Choix d\'équipe : « Ouvrir » entre dans l\'équipe (mémorisée sur le poste)', page.url().endsWith('/app/dashboard')
      && await page.evaluate(() => !!localStorage.getItem('pp_equipe')));

    /* ---------- Trucs et astuces ---------- */
    await page.click('.menu-lien >> text=Trucs et astuces');
    await page.waitForSelector('.themes');
    await capture('19-astuces');
    verifier('Trucs et astuces : adresse, 3 thèmes, KPI Scrum et Kanban avec exemples', page.url().endsWith('/app/trucs-et-astuces') && await page.locator('.theme').count() === 3
      && await page.locator('.tableau-kpi').count() >= 2 && await page.locator('.badge-reel').count() > 1 && await page.locator('.badge-illustratif').count() > 5);
    verifier('Trucs et astuces : capacité réelle du sprint en gras', (await page.locator('.tableau-kpi td b', { hasText: / j$/ }).count()) >= 1);
    await page.selectOption('select[aria-label="Projet d’exemple"]', { index: 1 });
    verifier('Trucs et astuces : changer de projet recalcule les exemples', (await page.locator('.tableau-kpi th', { hasText: 'Exemple ·' }).first().textContent()).length > 10);
    await page.click('text=Rôles Scrum (organigramme)');
    await capture('25-roles-scrum');
    verifier('Trucs et astuces › Rôles Scrum : organigramme détaillé et qui fait quoi', await page.locator('.org-carte').count() >= 9 && await page.locator('.tableau-roles tbody tr').count() >= 8);
    await page.click('.theme >> text=Roadmap');
    await capture('19b-astuces-roadmap');
    verifier('Trucs et astuces › Roadmap : chaîne vision → sprint, 2 formats, méthodes, bonnes pratiques', (await texte()).includes('De la vision au sprint')
      && await page.locator('.grille-formats .carte').count() === 2 && (await texte()).includes('Selon la méthode du projet') && (await texte()).includes('Pièges à éviter'));
    await page.click('.theme >> text=Test & Learn');
    await capture('19c-astuces-test-learn');
    verifier('Trucs et astuces › Test & Learn : boucle, carte d\'expérience, phases IA et indicateurs', (await texte()).includes('La boucle Test & Learn')
      && (await texte()).includes('Carte d’expérience') && (await texte()).includes('Les phases d’un projet IA') && (await texte()).includes('Ce que l’on mesure'));

    /* ---------- Vague B : Projet (Gantt, Liste), Feuilles de temps, Daily des équipes, Gestion des ressources ---------- */
    const VAGUE_B = CAPTURES;
    const captureB = nom => page.screenshot({ path: path.join(VAGUE_B, nom + '.png') });
    const menu = fin => page.click(`.laterale a[href$="${fin}"]`);
    // Administration créateur : hors de la barre latérale, on y entre par « Mon profil »
    // Administration › Ressources › Paramétrage des rôles (ex-onglet Rôles, 2.98)
    const ouvrirParametrageRoles = async () => {
      await page.click('[role=tab]:has-text("Ressources")'); await page.waitForSelector('.lien-referentiel');
      await page.click('.lien-referentiel:has-text("Personnes et rôles")'); await page.waitForSelector('.tableau-roles-acces');
    };
    const ouvrirAdminCreateur = async () => { await page.click('.bloc-moi .avatar'); await page.click('text=Ouvrir l’Administration créateur'); };

    // Dashboard : un projet à surveiller ouvre le panneau du projet (lecture seule)
    await menu('/dashboard');
    await page.click('tr.cliquable:has-text("App terrain hors-ligne")');
    await page.waitForSelector('.panneau[role=dialog]');
    verifier('Dashboard : un projet à surveiller ouvre son panneau en lecture seule', (await page.textContent('.panneau')).includes('Mobile')
      && (await page.textContent('.panneau')).includes('lecture seule') && (await page.textContent('.panneau')).includes('Équipe projet'));
    await page.keyboard.press('Escape');

    // Roadmap (Vue d’ensemble, 3.04) : tableau des demandes, colonnes du fichier CDO-ROADMAP-NEW, sans données
    await menu('/roadmap');
    await page.waitForSelector('.tableau-roadmap');
    await captureB('36-roadmap');
    verifier('Roadmap : une pastille par projet, une seule roadmap affichée à la fois (3.31)', await page.locator('.onglets [role=tab]').count() > 1 && await page.locator('.tableau-roadmap').count() === 1);
    await page.click('.onglets [role=tab]:has-text("Sans projet")');   // les 3 demandes d'exemple n'ont pas de projet
    verifier('Roadmap : menu juste après Projet, tableau à 4 blocs et 28 colonnes (toutes celles du fichier, 3.09)', await page.locator('.laterale a[href$="/projets"] + a[href$="/roadmap"]').count() === 1
      && await page.locator('.tableau-roadmap tr.blocs-roadmap th').count() === 4 && await page.locator('.tableau-roadmap thead tr:nth-child(2) th').count() === 28);
    // 3 demandes de 2026 du fichier (migration 057) : la stratégique en 1er, puis la mieux notée ; sans complexité, « complexité à saisir » en dernier
    const lignesRoadmap = page.locator('.tableau-roadmap tbody tr');
    verifier('Roadmap : 3 demandes classées par rang de traitement DSI, score calculé', await lignesRoadmap.count() === 3
      && (await lignesRoadmap.nth(0).textContent()).includes('flux tranche commerciale') && (await lignesRoadmap.nth(0).textContent()).includes('5,25')
      && (await lignesRoadmap.nth(1).textContent()).includes('liens vidéos') && (await lignesRoadmap.nth(1).textContent()).includes('3,5')
      && (await lignesRoadmap.nth(2).textContent()).includes('complexité à saisir') && !(await texte()).includes('Aucune demande pour le moment.'));
    verifier('Roadmap : les colonnes ajoutées en 3.09 portent les valeurs du fichier (Mois de la demande, Etat, Planification)',
      (await lignesRoadmap.nth(2).textContent()).includes('24 juil. 2026') && (await lignesRoadmap.nth(2).textContent()).includes('Ouvert')
      && (await lignesRoadmap.nth(2).textContent()).includes('T4 2026') && (await lignesRoadmap.nth(0).textContent()).includes('Annulé'));

    // Mon dashboard › Projet › Roadmap (3.07, maquette saisie-demandes-roadmap/) : saisie des demandes par les chefs de projet (ici en administrateur)
    await page.click('.laterale a[href$="/mes-demandes"]');
    await page.waitForSelector('select[aria-label="Projet"]');
    await page.selectOption('select[aria-label="Projet"]', '');
    await page.waitForSelector('.tableau-demandes');
    await captureB('38-mes-demandes');
    verifier('Mon dashboard › Projet › Roadmap : 3e sous-menu ; les 3 demandes sans projet (administrateur), rang global et score', await page.locator('.sous-menu a[href$="/mes-demandes"]').count() === 1
      && await page.locator('.tableau-demandes tbody tr').count() === 3 && (await page.locator('.tableau-demandes tbody tr').first().textContent()).includes('5,25'));
    await page.selectOption('select[aria-label="Projet"]', { index: 1 });
    await page.waitForSelector('text=Aucune demande pour ce projet.');
    await page.click('button:has-text("+ Nouvelle demande")');
    await page.waitForSelector('.panneau[role=dialog] .fiche-demande');
    await page.getByLabel('Demande', { exact: true }).fill('Afficher le nombre de lots disponibles sur la fiche programme');
    await page.getByLabel('Stratégique', { exact: true }).selectOption('Oui');
    await page.getByLabel('Priorité demandeur', { exact: true }).selectOption('1');
    await page.getByLabel('Impact client', { exact: true }).selectOption('3');
    await page.getByLabel('Impact collaborateur', { exact: true }).selectOption('3');
    await page.getByLabel('Complexité', { exact: true }).selectOption('2');
    await page.getByLabel('Chiffrage DSI (j-h)', { exact: true }).fill('2.5');
    // Sprint / version (3.09) : sprints et mises en production du projet ; choisir une MEP reprend sa date dans « Date de MEP »
    const sprintVersion = page.getByLabel('Sprint DSI', { exact: true });
    const mep = await sprintVersion.locator('optgroup[label="Mises en production"] option').first();
    const libelleMep = await mep.textContent();
    await sprintVersion.selectOption(libelleMep);
    verifier('Fiche demande : Sprint / version propose les sprints et les MEP du projet ; une MEP remplit la Date de MEP',
      await sprintVersion.locator('optgroup').count() === 2 && libelleMep.startsWith('MEP ') && (await page.getByLabel('Date de MEP', { exact: true }).inputValue()) !== '');
    await captureB('38b-fiche-demande');
    verifier('Fiche demande : champs par bloc, score et rang calculés en direct (score 6, rang 1)', (await page.textContent('.fiche-demande')).includes('6')
      && await page.locator('.fiche-demande .champ-calcule').count() === 2 && (await page.locator('.fiche-demande .champ-calcule').first().textContent()) === '1'
      && (await page.locator('.fiche-demande .champ-calcule').nth(1).textContent()) === '6');
    await page.click('.panneau button:has-text("Enregistrer")');
    await page.waitForSelector('.tableau-demandes tbody tr');
    verifier('Fiche demande : la demande est enregistrée dans le projet, au rang 1', await page.locator('.tableau-demandes tbody tr').count() === 1
      && (await page.locator('.tableau-demandes tbody tr td').first().textContent()) === '1');
    await menu('/roadmap');
    await page.waitForSelector('.tableau-roadmap');
    // Une roadmap par pastille (3.26) : on parcourt les pastilles ; la nouvelle demande est dans l'équipe de son projet, en tête de sa roadmap
    let totalDemandes = 0, premiereLigne = '';
    for (let i = 0, n = await page.locator('.onglets [role=tab]').count(); i < n; i++) {
      await page.locator('.onglets [role=tab]').nth(i).click();
      const lignes = page.locator('.tableau-roadmap tbody tr:has(td.cellule-demande)');
      totalDemandes += await lignes.count();
      if (await lignes.count() && (await lignes.first().textContent()).includes('lots disponibles')) premiereLigne = await lignes.first().textContent();
    }
    verifier('Roadmap : la nouvelle demande apparaît en tête de la roadmap de son équipe (4 demandes au total)', totalDemandes === 4 && premiereLigne.includes('2,5'));
    await page.click('.laterale a[href$="/mes-demandes"]');
    await page.waitForSelector('select[aria-label="Projet"]');
    await page.selectOption('select[aria-label="Projet"]', { index: 1 });
    await page.click('.tableau-demandes button:has-text("Modifier")');
    await page.waitForSelector('.panneau[role=dialog] .fiche-demande');
    await page.getByLabel('Stratégique', { exact: true }).selectOption('Non');
    await page.click('.panneau button:has-text("Enregistrer")');
    await page.waitForFunction(() => document.querySelector('.tableau-demandes tbody td')?.textContent === '2');
    verifier('Fiche demande : modifier (plus stratégique) la fait passer au rang 2', true);
    page.once('dialog', d => d.accept());      // confirmation de la suppression (le traitement général des fenêtres n'est posé que plus loin)
    await page.click('.tableau-demandes button[aria-label="Supprimer la demande"]');
    await page.waitForSelector('text=Aucune demande pour ce projet.');
    verifier('Mon dashboard › Projet › Roadmap : suppression d\'une demande', await page.locator('.tableau-demandes').count() === 0);
    await menu('/dashboard');

    // Projet (Vue d’ensemble) : onglets Gantt (par défaut) et Liste (2.91)
    await menu('/projets');
    await page.waitForSelector('.gantt-carte');
    await captureB('04b-gantt');
    verifier('Projet : deux onglets Gantt et Liste', await page.locator('[role=tab]').count() === 2
      && await page.locator('[role=tab][aria-selected=true]:has-text("Gantt")').count() === 1);
    verifier('Gantt : échelle de 6 mois, groupes par équipe, une ligne par projet et trait « aujourd\'hui »', await page.locator('.gantt-mois .mois > div').count() === 6
      && await page.locator('.gantt-groupe').count() >= 3 && await page.locator('.gantt-ligne').count() === 9 && await page.locator('.gantt-jour').count() >= 1);
    verifier('Gantt : sprints en barres et mises en production en losanges, détail en infobulle', await page.locator('.gantt-sprint').count() >= 2
      && await page.locator('.gantt-mep .losange').count() >= 3 && await page.locator('.gantt-mep').first().getAttribute('title') !== null
      && (await page.locator('.gantt-sprint').first().getAttribute('title')).includes('Sprint'));
    const periode = await page.textContent('.encart-compact b');
    await page.click('[aria-label="Période suivante"]');
    verifier('Gantt : la période se décale d\'un mois', (await page.textContent('.encart-compact b')) !== periode);
    await page.click('text=Aujourd’hui');
    verifier('Gantt : « Aujourd\'hui » revient à la période par défaut', (await page.textContent('.encart-compact b')) === periode);
    await page.click('[aria-label=Zoom] >> text=Semaine');
    verifier('Gantt : zoom semaine (12 semaines)', await page.locator('.gantt-mois .mois > div').count() === 12);
    await page.click('[aria-label=Zoom] >> text=Trimestre');
    verifier('Gantt : zoom trimestre (4 trimestres)', await page.locator('.gantt-mois .mois > div').count() === 4);
    await page.click('[aria-label=Zoom] >> text=Mois');
    await page.click('.puces >> text=Mobile');
    verifier('Gantt : filtre par équipe', await page.locator('.gantt-ligne').count() > 0 && await page.locator('.gantt-ligne').count() < 9);
    await page.click('.puces >> text=Toutes les équipes');
    await page.selectOption('select[aria-label="Projet"]', { label: 'SSO & gestion des droits' });
    verifier('Gantt : filtre par projet', await page.locator('.gantt-ligne').count() === 1);
    await page.selectOption('select[aria-label="Projet"]', { label: 'Tous les projets' });
    await page.click('.gantt-projet:has-text("SSO & gestion des droits")');
    await page.waitForSelector('.panneau[role=dialog]');
    verifier('Gantt : un clic sur un projet ouvre son panneau', (await page.textContent('.panneau h2')) === 'SSO & gestion des droits');
    await page.click('.panneau [aria-label=Fermer]');

    await page.click('[role=tab]:has-text("Liste")');
    await page.waitForSelector('.tableau');
    await captureB('02-projets');
    verifier('Liste des projets : 9 projets groupés par équipe, avancement et statut', await page.locator('tr.cliquable').count() === 9
      && await page.locator('tr.groupe').count() >= 3 && await page.locator('.tableau .barre').count() === 9 && await page.locator('.tableau .badge').count() >= 9);
    await page.click('.puces >> text=Mobile');
    verifier('Liste des projets : filtre par équipe', await page.locator('tr.cliquable').count() > 0 && await page.locator('tr.cliquable').count() < 9);
    await page.click('.puces >> text=Toutes les équipes');
    await page.click('tr.cliquable:has-text("SSO & gestion des droits")');
    await page.waitForSelector('.panneau[role=dialog]');
    verifier('Liste des projets : un clic ouvre le panneau (équipe, chef, équipe projet)', (await page.textContent('.panneau h2')) === 'SSO & gestion des droits'
      && (await page.textContent('.panneau')).includes('Chef de projet') && (await page.textContent('.panneau')).includes('Équipe projet'));
    await page.click('.panneau [aria-label=Fermer]');
    verifier('Liste des projets : la croix ferme le panneau', await page.locator('.panneau').count() === 0);

    // Feuilles de temps (ex-Timesheet) : validation des feuilles par la responsable
    await menu('/timesheet');
    await page.waitForSelector('.tableau');
    await page.click('[aria-label="Mois précédent"]');
    await page.waitForSelector('text=septembre 2026');
    await captureB('07-timesheet');
    verifier('Feuilles de temps : feuilles du mois par personne, 4 indicateurs (validation possible)', (await texte()).includes('Saisi / attendu') && await page.locator('.grille-kpi .kpi').count() === 4
      && !(await texte()).includes('NaN'));
    const avant = await page.locator('button:has-text("Valider")').count();
    verifier('Feuilles de temps : feuilles soumises à valider pour mes équipes seulement', avant === 1);
    await page.locator('button:has-text("Renvoyer")').first().click();
    await page.waitForSelector('.modale');
    await page.fill('.modale textarea', 'Merci de compléter septembre');
    await page.click('.modale button:has-text("Renvoyer la feuille")');
    await page.waitForFunction(() => !document.querySelector('.modale'));
    await page.waitForSelector('.badge:has-text("À compléter")');
    verifier('Feuilles de temps : « Renvoyer » demande un motif et renvoie la feuille à compléter', await page.locator('.badge:has-text("À compléter")').count() >= 1);

    // Daily des équipes
    await menu('/daily-des-equipes');
    await page.waitForSelector('.grille-fil');
    await captureB('17-daily-equipes');
    verifier('Daily des équipes : note d\'un coéquipier sur un projet commun visible', (await texte()).includes('Mapping des rôles applicatifs'));
    verifier('Daily des équipes : fil groupé par jour et blocages ouverts', await page.locator('.fil-jour').count() >= 1 && (await texte()).includes('Blocages ouverts · 2')
      && (await texte()).includes('Identifiants de recette expirés'));
    await page.click('.filtres-fil >> text=Thomas Bernard');
    verifier('Daily des équipes : filtre par personne', (await texte()).includes('Mapping des rôles applicatifs') && !(await texte()).includes('Finaliser le plan de migration SSO'));
    await page.click('.filtres-fil >> text=Toutes');
    await page.click('[role=tab]:has-text("Synthèse")');
    await page.waitForSelector('.tableau-synthese');
    await captureB('33-daily-synthese');
    verifier('Daily des équipes › Synthèse : chiffres clés et carte membre × jour', (await texte()).includes('Dailys renseignés')
      && await page.locator('.tableau-synthese thead th').count() === 7 && await page.locator('.case-synthese.case-bloc').count() >= 1);
    await page.locator('.case-synthese.case-bloc').first().click();
    verifier('Daily des équipes › Synthèse : un clic ouvre le daily à droite', (await page.textContent('.panneau-lecture')).includes('Blocages'));
    const titreAvant = await page.textContent('.panneau-lecture .discret');
    await page.click('text=‹ Jour précédent');
    verifier('Daily des équipes : jour précédent dans le panneau de lecture', (await page.textContent('.panneau-lecture .discret')) !== titreAvant);
    await page.click('text=Cette semaine');
    const semaine = await page.textContent('.libelle-semaine');
    await page.click('[aria-label="Semaine précédente"]');
    verifier('Daily des équipes : semaine précédente', (await page.textContent('.libelle-semaine')) !== semaine);
    await page.click('text=Cette semaine');
    verifier('Daily des équipes : « Cette semaine » revient à la semaine courante', (await page.textContent('.libelle-semaine')) === semaine);
    // Export Excel
    await page.click('text=Exporter en Excel');
    await page.waitForSelector('.modale');
    await captureB('22-export-daily-excel');
    verifier('Export Excel : période, projets et contenu du fichier', (await page.textContent('.modale')).includes('Projets (ceux dont vous pouvez lire le daily)')
      && (await page.textContent('.modale')).includes('Ajouter l’onglet « Blocages »'));
    const [telechargement] = await Promise.all([page.waitForEvent('download'), page.click('.modale >> text=Télécharger le fichier Excel')]);
    const fichierXlsx = path.join(VAGUE_B, 'export-test.xlsx');
    await telechargement.saveAs(fichierXlsx);
    const octets = fs.readFileSync(fichierXlsx);
    fs.unlinkSync(fichierXlsx);
    verifier('Export Excel : fichier .xlsx téléchargé (archive valide avec feuille Daily et Blocages)', /^Daily_.*\.xlsx$/.test(telechargement.suggestedFilename())
      && octets.readUInt32LE(0) === 0x04034B50 && octets.includes('sheet2.xml') && octets.toString('utf8').includes('Mapping des rôles applicatifs'));
    await page.waitForFunction(() => !document.querySelector('.modale'));

    // Gestion des ressources
    await menu('/ressources');
    await page.waitForSelector('.calendrier');
    await captureB('05-ressources');
    verifier('Gestion des ressources : calendrier par équipe, légende, synthèse des absents par projet', (await page.textContent('.carte-titre')).includes('Congés')
      && await page.locator('.calendrier tr.groupe').count() >= 3 && await page.locator('.calendrier tr.ligne-synthese').count() >= 3 && await page.locator('.calendrier tr[data-personne]').count() >= 10);
    verifier('Gestion des ressources : lecture seule (aucune case cliquable)', await page.locator('.calendrier td.cliquable').count() === 0);
    await page.click('[aria-label="Mois suivant"]');
    verifier('Gestion des ressources : navigation de mois', (await page.textContent('.carte-titre b')).includes('novembre 2026') && await page.locator('.calendrier th').count() === 31);
    await page.click('.puce >> text=Par projet');
    verifier('Gestion des ressources : vue par projet (membres et synthèse)', await page.locator('.calendrier tr[data-personne]').count() >= 1 && await page.locator('.calendrier tr.ligne-synthese').count() === 1);
    await page.click('.puce >> text=Par équipe');
    await page.click('[role=tab]:has-text("Liste des ressources")');
    await page.waitForSelector('#annuaire-ressources');
    await captureB('05b-ressources-liste');
    verifier('Gestion des ressources › Liste : annuaire des 12 personnes avec projets et statut', await page.locator('#annuaire-ressources tbody tr').count() === 12
      && (await texte()).includes(' · PO') && (await texte()).includes('Anniversaires d’octobre'));
    await page.fill('input[placeholder="Rechercher une personne"]', 'thomas');
    verifier('Gestion des ressources › Liste : recherche par nom', await page.locator('#annuaire-ressources tbody tr').count() === 1);
    await page.fill('input[placeholder="Rechercher une personne"]', '');
    await page.selectOption('select[aria-label="Statut"]', 'inactif');
    verifier('Gestion des ressources › Liste : filtre par statut', (await texte()).includes('Aucune ressource.'));
    await page.selectOption('select[aria-label="Statut"]', '');
    await page.selectOption('select[aria-label="Équipe"]', { label: 'Mobile' });
    verifier('Gestion des ressources › Liste : filtre par équipe', await page.locator('#annuaire-ressources tbody tr').count() === 3);

    /* ---------- Vague C : Daily, Saisir mes heures, Congés, Sprints, Mises en production (édition) ---------- */
    const VAGUE_C = CAPTURES;
    const captureC = nom => page.screenshot({ path: path.join(VAGUE_C, nom + '.png') });
    let reponsePrompt = '';
    page.on('dialog', d => d.accept(d.type() === 'prompt' ? reponsePrompt : undefined));      // confirmations acceptées ; réponse aux « prompt » réglable
    const toast = () => page.textContent('.notification');

    // Daily : un daily par projet, enregistrement automatique
    await menu('/daily');
    await page.waitForSelector('.ecran-daily');
    await captureC('08-daily');
    verifier('Daily : une carte par projet où je suis affecté(e), trois champs, historique de 12 jours', await page.locator('textarea.note-daily').count() === 15
      && (await texte()).includes('0 / 5 projets renseignés') && await page.locator('.historique a').count() === 12);
    const zone = page.locator('textarea.note-daily').nth(1);       // « Aujourd'hui » du premier projet
    await zone.fill('Revue de la roadmap SSO');
    await page.waitForSelector('text=enregistré');
    await page.waitForSelector('text=1 / 5 projets renseignés');
    verifier('Daily : enregistrement automatique, bilan et état « Renseigné »', (await texte()).includes('1 / 5 projets renseignés') && await page.locator('.badge:has-text("Renseigné")').count() === 1);
    await page.reload();
    await page.waitForSelector('.ecran-daily');
    verifier('Daily : la note survit au rechargement (écrite en base)', await page.locator('textarea.note-daily').nth(1).inputValue() === 'Revue de la roadmap SSO');
    const jourAffiche = await page.textContent('.ecran-daily h2');
    await page.click('[aria-label="Jour précédent"]');
    verifier('Daily : jour précédent (week-ends sautés)', (await page.textContent('.ecran-daily h2')) !== jourAffiche); 
    await page.locator('.historique a').nth(3).click();
    verifier('Daily : l\'historique ouvre le jour choisi', await page.locator('.historique a.actif').count() === 1);
    await page.click('text=Aujourd’hui >> nth=0');

    // Saisir mes heures
    await menu('/saisir-mes-heures');
    await page.waitForSelector('.grille-mois');
    await captureC('13-mon-timesheet');
    const cellule = page.locator('input.saisie-mois[aria-label="2026-10-05"]').first();
    await cellule.fill('7,5');
    await cellule.blur();
    await page.waitForSelector('td.num b:has-text("7,5 h")');
    verifier('Saisir mes heures : une saisie (virgule acceptée) met à jour les totaux', (await texte()).includes('7,5 h') && (await texte()).includes('sur 1'));
    await page.locator('input.saisie-mois[aria-label="2026-10-05"]').first().fill('30');
    await page.locator('input.saisie-mois[aria-label="2026-10-05"]').first().blur();
    await page.waitForSelector('.notification.visible.erreur');
    verifier('Saisir mes heures : heures invalides refusées (0 à 24) avec message', (await toast()).includes('Heures invalides') && await page.locator('input.saisie-mois[aria-label="2026-10-05"]').first().inputValue() === '7,5');
    await page.locator('input.saisie-mois[aria-label="2026-10-05"]').first().fill('');
    await page.locator('input.saisie-mois[aria-label="2026-10-05"]').first().blur();
    await page.waitForFunction(() => !document.body.textContent.includes('7,5 h'));
    verifier('Saisir mes heures : une case vidée supprime la saisie', true);
    await page.locator('input.saisie-mois[aria-label="2026-10-06"]').first().fill('8');
    await page.locator('input.saisie-mois[aria-label="2026-10-06"]').first().blur();
    await page.waitForSelector('td.num b:has-text("8 h")');
    await page.click('text=Soumettre le mois');
    await page.waitForSelector('.badge:has-text("Soumise")');
    verifier('Saisir mes heures : « Soumettre le mois » verrouille la feuille', await page.locator('input.saisie-mois[disabled]').count() > 10 && await page.locator('text=Soumettre le mois').count() === 0);

    // Congés
    await menu('/conges');
    await page.waitForSelector('.calendrier');
    await captureC('11-conges');
    await page.click('.puce:has-text("Congés validé")');
    const ligneCamille = page.locator('tr[data-personne]', { hasText: 'Camille Laurent' });
    await ligneCamille.locator('td').nth(12).click();                                  // lundi 12 octobre
    await page.waitForSelector('tr[data-personne]:has-text("Camille Laurent") .case-absence');
    verifier('Congés : un clic pose l\'absence du type choisi et met à jour le total', await ligneCamille.locator('.case-absence').count() === 1 && (await ligneCamille.textContent()).includes('1 j'));
    await ligneCamille.locator('td').nth(12).click();
    await page.waitForFunction(() => ![...document.querySelectorAll('tr[data-personne]')].some(r => r.textContent.includes('Camille Laurent') && r.querySelector('.case-absence')));
    verifier('Congés : un second clic retire l\'absence', await ligneCamille.locator('.case-absence').count() === 0);
    await page.click('.puce:has-text("Demi-journée")');
    await ligneCamille.locator('td').nth(13).click();
    await page.waitForSelector('tr[data-personne]:has-text("Camille Laurent") .case-absence');
    verifier('Congés : une demi-journée est marquée « ½ » et compte 0,5', (await ligneCamille.textContent()).includes('CV½') && (await ligneCamille.textContent()).includes('0,5 j'));
    await page.click('.puce:has-text("Effacer")');
    await ligneCamille.locator('td').nth(13).click();
    await page.waitForFunction(() => document.querySelectorAll('tr[data-personne]').length > 0 && ![...document.querySelectorAll('tr[data-personne]')].some(r => r.textContent.includes('Camille Laurent') && r.textContent.includes('CV½')));
    verifier('Congés : « Effacer » retire l\'absence', await ligneCamille.locator('.case-absence').count() === 0);
    verifier('Congés : les cases des personnes de mes équipes sont cliquables', await page.locator('.calendrier td.cliquable').count() > 20);
    await page.click('[role=tab]:has-text("Récap annuel")');
    await page.waitForSelector('.recap-travail');
    await captureC('11b-recap-annuel');
    verifier('Congés › Récap annuel : 12 mois, jours travaillés et congés, reste à prendre', await page.locator('.recap-travail thead th:has-text("Sept.")').count() === 1
      && (await texte()).includes('Jours de semaine du mois') && (await texte()).includes('Reste à') && await page.locator('.recap-travail tr.total').count() >= 3);
    const objectif = page.locator('input.objectif-client').first();
    verifier('Congés › Récap annuel : objectif client modifiable par le responsable de l\'équipe', await objectif.count() === 1);
    await objectif.fill('200');
    await objectif.blur();
    await page.waitForFunction(() => document.querySelector('input.objectif-client').value === '200');
    await page.reload();
    await page.click('[role=tab]:has-text("Récap annuel")');
    await page.waitForSelector('.recap-travail');
    verifier('Congés › Récap annuel : l\'objectif saisi est enregistré en base', await page.locator('input.objectif-client').first().inputValue() === '200');

    // Sprints
    await menu('/sprints');
    await page.waitForSelector('.tableau-sprints');
    await page.selectOption('select[aria-label="Projet"]', { label: 'SSO & gestion des droits' });
    await captureC('09c-sprints');
    const lignesSprint = () => page.locator('.tableau-sprints tbody tr:not(.ligne-ajout)').count();
    verifier('Sprints : les sprints du projet par année, modifiables, avec ligne d\'ajout', await lignesSprint() === 2 && await page.locator('tr.ligne-ajout').count() === 1
      && (await texte()).includes('en cours') === (await texte()).includes('en cours'));
    await page.fill('input[aria-label="Nouveau sprint : numéro"]', '21');
    await page.fill('input[aria-label="Nouveau sprint : version"]', 'V2.2');
    await page.fill('input[aria-label="Nouveau sprint : début"]', '2026-10-12');
    await page.fill('input[aria-label="Nouveau sprint : fin"]', '2026-10-23');
    await page.click('button[title="Ajouter le sprint"]');
    await page.waitForFunction(() => document.querySelectorAll('.tableau-sprints tbody tr:not(.ligne-ajout)').length === 3);
    verifier('Sprints : ajout d\'un sprint', await lignesSprint() === 3);
    await page.fill('input[aria-label="Nouveau sprint : numéro"]', '21');
    await page.fill('input[aria-label="Nouveau sprint : début"]', '2026-11-02');
    await page.fill('input[aria-label="Nouveau sprint : fin"]', '2026-11-13');
    await page.click('button[title="Ajouter le sprint"]');
    await page.waitForSelector('.notification.visible.erreur');
    verifier('Sprints : « Sprint N » unique par année et par projet', (await toast()).includes('existe déjà en 2026') && await lignesSprint() === 3);
    const finDernier = page.locator('input[aria-label="Fin"]').last();
    await finDernier.fill('2026-10-01');
    await finDernier.blur();
    await page.waitForSelector('.notification.visible.erreur >> text=précède');
    verifier('Sprints : date de fin avant la date de début refusée, ancienne valeur remise', await page.locator('input[aria-label="Fin"]').last().inputValue() === '2026-10-23');
    const versionDernier = page.locator('input[aria-label="Version"]').last();
    await versionDernier.fill('V2.2-corrigée');
    await versionDernier.blur();
    await page.waitForFunction(() => [...document.querySelectorAll('input[aria-label="Version"]')].some(i => i.value === 'V2.2-corrigée'));
    await page.reload();
    await page.waitForSelector('.tableau-sprints');
    await page.selectOption('select[aria-label="Projet"]', { label: 'SSO & gestion des droits' });
    verifier('Sprints : la modification d\'un champ est enregistrée', await page.locator('input[aria-label="Version"]').last().inputValue() === 'V2.2-corrigée');
    await page.locator('button[title="Supprimer ce sprint"]').last().click();
    await page.waitForFunction(() => document.querySelectorAll('.tableau-sprints tbody tr:not(.ligne-ajout)').length === 2);
    verifier('Sprints : suppression d\'un sprint (après confirmation)', await lignesSprint() === 2);

    // Mises en production
    await menu('/mes-projets');
    await page.waitForSelector('.formulaire-mep');
    await captureC('09-mes-projets');
    const nbMep = await page.locator('.tableau-sprints tbody tr').count();
    await page.fill('.formulaire-mep input[type=date]', '2026-12-01');
    await page.fill('.formulaire-mep input[name=version]', 'V9.9');
    await page.fill('.formulaire-mep input[name=bugs]', '2');
    await page.click('.formulaire-mep >> text=Ajouter');
    await page.waitForFunction(n => document.querySelectorAll('.tableau-sprints tbody tr').length === n + 1, nbMep);
    verifier('Mises en production : ajout (date, version, tickets livrés, statut)', await page.locator('.tableau-sprints input[value="V9.9"]').count() === 1);
    const ligneMep = page.locator('.tableau-sprints tbody tr', { has: page.locator('input[value="V9.9"]') });
    await ligneMep.locator('select').selectOption('faite');
    await page.waitForFunction(() => [...document.querySelectorAll('.tableau-sprints tr')].some(r => r.querySelector('input[value="V9.9"]') && r.querySelector('select').value === 'faite'));
    verifier('Mises en production : le statut se modifie sur place', await ligneMep.locator('select').inputValue() === 'faite');
    await ligneMep.locator('button[title="Supprimer cette mise en production"]').click();
    await page.waitForFunction(n => document.querySelectorAll('.tableau-sprints tbody tr').length === n, nbMep);
    verifier('Mises en production : suppression (après confirmation)', await page.locator('.tableau-sprints input[value="V9.9"]').count() === 0);

    // Nouveau projet, puis panneau modifiable
    await page.click('text=+ Nouveau projet');
    await page.waitForSelector('#nouveau-projet');
    await captureC('10-nouveau-projet');
    verifier('Nouveau projet : formulaire (code proposé, méthode à choisir)', (await page.inputValue('input[name=code]')).startsWith('PF-') && await page.locator('.choix-methode').count() >= 4);
    await page.fill('input[name=nom]', 'Projet vague C');
    await page.click('.choix-methode:has-text("Agile Scrum")');
    await page.click('text=Créer le projet');
    await page.waitForSelector('input[aria-label="Nom du projet"]');
    await captureC('11-panneau-projet');
    verifier('Nouveau projet : créé, puis panneau modifiable (nom, méthode, chef), sans statut', await page.inputValue('input[aria-label="Nom du projet"]') === 'Projet vague C'
      && await page.locator('.panneau select[aria-label="Statut"]').count() === 0 && await page.locator('.panneau select[aria-label="Méthode"]').inputValue() === 'Agile Scrum'
      && (await page.inputValue('.panneau select[aria-label="Chef de projet"]')) !== '');
    await page.fill('input[aria-label="Nom du projet"]', 'Projet vague C (renommé)');
    await page.locator('input[aria-label="Nom du projet"]').blur();
    await page.waitForFunction(() => document.querySelector('input[aria-label="Nom du projet"]').value.includes('renommé'));
    await page.keyboard.press('Escape');
    await menu('/projets');
    await page.click('[role=tab]:has-text("Liste")');
    await page.waitForSelector('tr.cliquable');
    verifier('Panneau projet : le nom modifié est enregistré (visible dans Projet › Liste)', await page.locator('tr.cliquable:has-text("Projet vague C (renommé)")').count() === 1
      && await page.locator('tr.cliquable').count() === 10);
    await menu('/mes-projets');
    await page.click('text=+ Nouveau projet');
    await page.fill('input[name=nom]', 'Autre projet');
    await page.click('.choix-methode:has-text("Cascade")');
    await page.click('text=Créer le projet');
    await page.waitForSelector('input[aria-label="Nom du projet"]');
    await page.click('text=Supprimer le projet');
    await page.waitForFunction(() => !document.querySelector('.panneau'));
    verifier('Panneau projet : suppression du projet (après confirmation), panneau fermé', await page.locator('.panneau').count() === 0);

    /* ---------- Vague D (1/2) : Liste des ressources et fenêtres ---------- */
    const VAGUE_D = CAPTURES;
    const captureD = nom => page.screenshot({ path: path.join(VAGUE_D, nom + '.png') });
    await menu('/liste-des-ressources');
    await page.waitForSelector('.nav-ressources');
    await captureD('12-liste-ressources');
    verifier('Liste des ressources : navigation par équipe (responsable, projets), Profils et Types de contrat', await page.locator('.noeud.equipe').count() >= 4
      && await page.locator('.noeud.projet').count() >= 9 && (await page.textContent('.nav-ressources')).includes('Types de contrat'));
    verifier('Liste des ressources : l\'équipe ouverte est choisie, avec son responsable et ses personnes', (await page.textContent('.detail-ressources')).includes('Plateforme')
      && (await page.textContent('.detail-ressources')).includes('Responsable de l’équipe') && await page.locator('.tableau-personnes tr[data-ressource]').count() === 4);
    verifier('Liste des ressources : la direction est en tête (badge), ses équipes en retrait dessous (Direction › équipe › projet)', await page.locator('.nav-ressources .noeud-groupe:not(.sous-unite) .badge:has-text("Direction")').count() === 1
      && await page.locator('.nav-ressources .noeud-groupe.sous-unite').count() >= 3);
    await page.fill('.nav-ressources input', 'hugo');
    verifier('Liste des ressources : recherche dans la navigation (l\'équipe de la personne reste visible)', await page.locator('.noeud-groupe').count() === 1 && (await page.textContent('.nav-ressources')).includes('Data'));
    await page.fill('.nav-ressources input', '');
    await page.click('.noeud.projet:has-text("SSO & gestion des droits")');
    await captureD('12b-liste-projet');
    verifier('Liste des ressources : détail d\'un projet (Product Owners, membres, indicateurs)', (await page.textContent('.detail-ressources')).includes('Product Owners')
      && await page.locator('.carte-po:not(.ajout)').count() >= 1 && await page.locator('.detail-kpi b').count() === 3);
    // « + Product Owner » : affecte la personne au projet ET lui donne le rôle Chef de projet, elle apparaît alors dans les Product Owners (porteur, 2026-11-09)
    const nbPoAvant = await page.locator('.carte-po:not(.ajout)').count();
    await page.click('.detail-ressources >> text=+ Product Owner');
    await page.waitForSelector('.modale[role=dialog]');
    await page.selectOption('.modale select[name=ressource]', { label: 'Julien Dubois — Plateforme · DevOps' });
    await page.click('.modale button:has-text("Ajouter")');
    await page.waitForFunction(n => document.querySelectorAll('.carte-po:not(.ajout)').length > n, nbPoAvant);
    verifier('Liste des ressources : « + Product Owner » ajoute la personne dans les Product Owners du projet', await page.locator('.carte-po:not(.ajout)').count() === nbPoAvant + 1);
    await page.click('.detail-ressources >> text=+ Membre');
    await page.waitForSelector('.modale[role=dialog]');
    await captureD('11b-affectation');
    verifier('Fenêtre d\'affectation : projet d\'origine coché, aucun rôle par affectation (rôle unique)', (await page.textContent('.modale h2')).includes('SSO & gestion des droits')
      && await page.locator('.modale input[type=checkbox]:checked').count() >= 1 && await page.locator('.modale select[name^=role-]').count() === 0);
    await page.selectOption('.modale select[name=ressource]', { label: 'Julien Dubois — Plateforme · DevOps' }).catch(async () => {
      await page.selectOption('.modale select[name=ressource]', { index: 1 });
    });
    await page.click('.modale button:has-text("Enregistrer les affectations")');
    await page.waitForFunction(() => !document.querySelector('.modale'));
    verifier('Fenêtre d\'affectation : enregistrée, la personne apparaît dans le projet', await page.locator('.tableau-personnes tr[data-ressource], .carte-po:not(.ajout)').count() >= 2);

    // Fiche ressource
    await page.click('.noeud.equipe:has-text("Plateforme")');
    await page.locator('tr[data-ressource]', { hasText: 'Thomas Bernard' }).locator('text=Fiche').click();
    await page.waitForSelector('.modale[role=dialog]');
    await captureD('11c-fiche-ressource');
    verifier('Fiche ressource : champs, rôle en lecture, projets de la personne', (await page.textContent('.modale h2')) === 'Fiche de Thomas Bernard'
      && (await page.textContent('.modale')).includes('Rôle') && (await page.textContent('.modale')).includes('Modifier ses projets'));
    await page.fill('.modale input[name=dateArrivee]', '2026-06-01');
    await page.fill('.modale input[name=dateDepart]', '2026-05-01');
    await page.click('.modale button:has-text("Enregistrer")');
    await page.waitForSelector('.notification.visible.erreur');
    verifier('Fiche ressource : date de départ avant la date d\'arrivée refusée', (await toast()).includes('date de départ précède'));
    await page.fill('.modale input[name=dateDepart]', '');
    await page.fill('.modale input[name=dateArrivee]', '');
    await page.fill('.modale input[name=capacite]', '90');
    await page.click('.modale button:has-text("Enregistrer")');
    await page.waitForFunction(() => !document.querySelector('.modale'));
    await page.locator('tr[data-ressource]', { hasText: 'Thomas Bernard' }).locator('text=Fiche').click();
    verifier('Fiche ressource : la modification est enregistrée', await page.inputValue('.modale input[name=capacite]') === '90');
    await page.keyboard.press('Escape');

    // Statut actif / inactif
    await page.locator('tr[data-ressource]', { hasText: 'Julien Dubois' }).locator('button:has(.badge)').click();
    await page.waitForSelector('.section-pliable:has-text("Inactifs")');
    verifier('Liste des ressources : « Actif » rend la personne inactive (date de fin = aujourd\'hui), section Inactifs', await page.locator('tr.inactive').count() === 1);
    await page.locator('tr.inactive button:has(.badge)').click();
    await page.waitForFunction(() => !document.querySelector('tr.inactive'));
    verifier('Liste des ressources : « Inactif » réactive la personne', await page.locator('tr.inactive').count() === 0);

    // Nouvelle personne puis suppression
    await page.click('text=+ Personne >> nth=-1');
    await page.waitForSelector('.modale[role=dialog]');
    await page.fill('.modale input[name=prenom]', 'Nouvelle');
    await page.fill('.modale input[name=nomFamille]', 'Recrue');
    await page.click('.modale button:has-text("Enregistrer")');
    await page.waitForSelector('tr[data-ressource]:has-text("Nouvelle Recrue")');
    verifier('Nouvelle personne : prénom et nom saisis séparément, nom complet recomposé et visible dans le tableau', await page.locator('tr[data-ressource]:has-text("Nouvelle Recrue")').count() === 1);
    await page.locator('tr[data-ressource]', { hasText: 'Nouvelle Recrue' }).locator('text=Fiche').click();
    await page.click('.modale button:has-text("Supprimer")');
    await page.waitForFunction(() => !document.querySelector('tr[data-ressource]') || ![...document.querySelectorAll('tr[data-ressource]')].some(r => r.textContent.includes('Nouvelle Recrue')));
    verifier('Fiche ressource : suppression de la personne (après confirmation)', await page.locator('tr[data-ressource]:has-text("Nouvelle Recrue")').count() === 0);

    // Rattachement d'une personne d'une autre équipe
    await page.click('text=+ Personne existante');
    await page.waitForSelector('.modale[role=dialog]');
    await page.selectOption('.modale select[name=ressource]', { index: 1 });
    await page.click('.modale button:has-text("Ajouter à l’équipe")');
    await page.waitForSelector('tr[data-rattachee]');
    verifier('Rattachement : la personne s\'affiche dans « Rattachées depuis une autre équipe » avec son équipe d\'origine', (await page.textContent('tr[data-rattachee]')).includes('Équipe d’origine') && !(await page.textContent('tr[data-rattachee]')).includes('Équipe d’origine : —'));
    await page.click('tr[data-rattachee] >> text=Retirer');
    await page.waitForFunction(() => !document.querySelector('tr[data-rattachee]'));
    verifier('Rattachement : « Retirer » supprime le rattachement seulement', await page.locator('tr[data-rattachee]').count() === 0);

    // Profils (postes) et types de contrat
    await page.click('.noeud:has-text("Profils")');
    await page.waitForSelector('.detail-ressources .tableau');
    const nbPostes = await page.locator('.detail-ressources tbody tr').count();
    reponsePrompt = 'Poste de test';
    await page.click('.detail-ressources button:has-text("+ Ajouter")');
    await page.waitForFunction(n => document.querySelectorAll('.detail-ressources tbody tr').length === n + 1, nbPostes);
    verifier('Profils : ajout d\'une valeur (administrateur)', (await page.textContent('.detail-ressources')).includes('Poste de test'));
    reponsePrompt = 'Poste de test renommé';
    await page.locator('tr:has-text("Poste de test") button[title^="Renommer"]').click();
    await page.waitForSelector('text=Poste de test renommé');
    await page.locator('tr:has-text("Poste de test renommé") button[title="Supprimer"]').click();
    await page.waitForFunction(n => document.querySelectorAll('.detail-ressources tbody tr').length === n, nbPostes);
    verifier('Profils : renommer puis supprimer une valeur inutilisée', !(await page.textContent('.detail-ressources')).includes('Poste de test'));

    // Équipe : modification, membres et invitation, création puis suppression
    await page.click('.noeud.equipe:has-text("Plateforme")');
    await page.click('text=Modifier l’équipe');
    await page.waitForSelector('.modale[role=dialog]');
    await page.waitForSelector('.modale >> text=camille@test.fr');
    await captureD('11d-equipe');
    verifier('Fenêtre équipe : nom, préfixe, type, membres (comptes de connexion)', (await page.inputValue('.modale input[name=nom]')) === 'Plateforme'
      && (await page.textContent('.modale')).includes('camille@test.fr'));
    await page.fill('.modale input[type=email]', 'nouveau.compte@test.fr');
    await page.click('.modale button:has-text("Inviter")');
    await page.waitForSelector('.modale >> text=invitation en attente');
    verifier('Fenêtre équipe : invitation par email, affichée « en attente »', (await page.textContent('.modale')).includes('nouveau.compte@test.fr'));
    await page.keyboard.press('Escape');
    verifier('Liste des ressources : plus de bouton pour ajouter une équipe (réservé à Administration › Équipes)',
      await page.locator('button:has-text("+ Ajouter une équipe")').count() === 0 && await page.locator('button[title="Supprimer l’équipe"]').count() === 0);
    // Ajout et suppression de directions et d'équipes : Administration › Équipes seulement (porteur, 2026-11-06)
    await menu('/administration');
    await page.waitForSelector('.onglets');
    await page.click('[role=tab]:has-text("Équipes")');
    verifier('Administration › Équipes : les projets de chaque équipe sont listés (ajout, modification, suppression depuis ce seul onglet)',
      await page.locator('tr.ligne-projet').count() > 0 && await page.locator('button:has-text("+ Projet")').count() > 0
      && await page.locator('tr.ligne-projet button:has-text("Supprimer")').count() > 0);
    verifier('Administration › Équipes : « + Personne existante » sur les directions, équipes et projets (3.28)',
      await page.locator('tr.ligne-projet button:has-text("+ Personne existante")').count() > 0 && await page.locator('tr:not(.ligne-projet) button:has-text("+ Personne existante")').count() > 0);
    verifier('Administration › Équipes : « + Personne » sur les directions, équipes et projets (3.23)',
      await page.locator('tr.ligne-projet button:has-text("+ Personne")').count() > 0 && await page.locator('tr:not(.ligne-projet) button:has-text("+ Personne")').count() > 0);
    await page.click('button:has-text("+ Nouvelle équipe")');
    await page.fill('.modale input[name=nom]', 'Équipe Test');
    await page.fill('.modale input[name=prefixe]', 'et');
    await page.click('.modale button:has-text("Créer")');
    await page.waitForSelector('tr:has-text("Équipe Test")');
    verifier('Nouvelle équipe : créée depuis Administration › Équipes (organisation et ligne equipes)', await page.locator('tr:has-text("Équipe Test")').count() === 1);
    await page.locator('tr:has-text("Équipe Test") button:has-text("Supprimer")').click();
    await page.waitForFunction(() => ![...document.querySelectorAll('tr')].some(n => n.textContent.includes('Équipe Test')));
    verifier('Équipe vide : suppression possible depuis Administration › Équipes (après confirmation)', await page.locator('tr:has-text("Équipe Test")').count() === 0);
    // Direction : se supprime même non vide (ses équipes se retrouvent sans direction) — migration 061
    const nbUnitesAvant = await page.locator('table.tableau tbody tr:not(.ligne-projet)').count();
    await page.click('button:has-text("+ Nouvelle direction")');
    await page.fill('.modale input[name=nom]', 'Direction Test');
    await page.fill('.modale input[name=prefixe]', 'dt');
    await page.click('.modale button:has-text("Créer")');
    await page.waitForSelector('tr:has-text("Direction Test")');
    await page.locator('tr:has-text("Direction Test") button:has-text("Supprimer")').click();
    await page.waitForFunction(() => ![...document.querySelectorAll('tr')].some(n => n.textContent.includes('Direction Test')));
    verifier('Direction : création puis suppression depuis Administration › Équipes',
      await page.locator('table.tableau tbody tr:not(.ligne-projet)').count() === nbUnitesAvant);
    // La création a rendu « Équipe Test » active : on revient à Plateforme (la suite des contrôles couvre toutes les équipes)
    await page.click('.bloc-equipe >> text=Changer');
    await page.click('.carte-choix:has-text("Plateforme") >> text=Ouvrir');
    await page.waitForSelector('.laterale');

    /* ---------- Vague D (2/2) : Administration (administrateur) ---------- */
    await menu('/administration');
    await page.waitForSelector('.onglets');
    await captureD('14-mon-admin');
    verifier('Administration : onglets de l\'administrateur (comptes, équipes et ressources, référentiels, jours fériés) avec compteurs', (await page.textContent('.onglets')).includes('Comptes en attente')
      && (await page.textContent('.onglets')).includes('Équipes et ressources') && !(await page.textContent('.onglets')).includes('Ressources') && (await page.textContent('.onglets')).includes('Référentiels'));
    verifier('Administration : l\'onglet « Comptes en attente » s\'ouvre d\'abord quand il y en a', await page.locator('[role=tab][aria-selected=true]:has-text("Comptes en attente")').count() === 1);
    await captureD('26-comptes-en-attente');
    const nbAttente = await page.locator('.tableau tbody tr').count();
    await page.locator('.tableau tbody tr').first().locator('select[aria-label="Équipe"]').selectOption({ label: 'Mobile' });
    await page.locator('.tableau tbody tr').first().locator('select[aria-label="Fiche ressource"]').selectOption('nouvelle');
    await page.locator('.tableau tbody tr').first().locator('button:has-text("Donner l’accès")').click();
    await page.waitForSelector('text=Accès donné à');
    verifier('Comptes en attente : « Donner l\'accès » crée la fiche et invite dans l\'équipe', (await toast()).includes('Accès donné à'));

    // Administration › Menus par équipe (étape 1 : écrans accessibles par équipe) : une case écrit une ligne, relue au rechargement
    await page.click('[role=tab]:has-text("Menus par équipe")');
    await page.waitForSelector('.tableau-menus-equipes');
    const caseCongesData = page.locator('input[aria-label="Gestion des ressources › Congés · Data"]');
    verifier('Administration › Menus par équipe : tous les écrans sont accessibles par défaut', await caseCongesData.isChecked());
    await caseCongesData.click();       // case pilotée par les données : l'état change après l'écriture
    await page.waitForFunction(() => !document.querySelector('input[aria-label="Gestion des ressources › Congés · Data"]').checked);
    await page.reload();
    await page.waitForSelector('.laterale');
    await page.click('.laterale a[href$="/administration"]');
    await page.click('[role=tab]:has-text("Menus par équipe")');
    await page.waitForSelector('.tableau-menus-equipes');
    verifier('Administration › Menus par équipe : un écran décoché reste décoché après rechargement',
      !(await page.locator('input[aria-label="Gestion des ressources › Congés · Data"]').isChecked()));
    await page.locator('input[aria-label="Gestion des ressources › Congés · Data"]').click();
    await page.waitForFunction(() => document.querySelector('input[aria-label="Gestion des ressources › Congés · Data"]').checked);
    await page.click('[role=tab]:has-text("Équipes")');
    verifier('Administration › Équipes : directions et équipes (la direction en ligne de groupe, ses équipes dessous), responsables, membres, projets, « Modifier »', await page.locator('.tableau tbody tr.groupe').count() === 1 && await page.locator('.tableau tbody tr').count() >= 4 && await page.locator('button:has-text("Modifier")').count() >= 4);
    await page.locator('button:has-text("Modifier")').first().click();
    await page.waitForSelector('.modale[role=dialog]');
    verifier('Administration › Équipes : la fenêtre équipe s\'ouvre', await page.locator('.modale input[name=nom]').count() === 1);
    await page.keyboard.press('Escape');
    await page.click('button:has-text("+ Nouvelle direction")');
    await page.waitForSelector('.modale[role=dialog]');
    verifier('Administration › Équipes : « + Nouvelle direction » ouvre le formulaire sur le type Direction, sans rattachement', (await page.locator('.modale select[name=type]').inputValue()) === 'direction'
      && (await page.textContent('.modale h2')).includes('Nouvelle direction'));
    await page.keyboard.press('Escape');

    await page.click('[role=tab]:has-text("Référentiels")');
    await page.waitForSelector('.lien-referentiel');
    await captureD('10b-referentiels');
    verifier('Administration › Référentiels : liste des référentiels et leurs valeurs', await page.locator('.lien-referentiel').count() === 4 && await page.locator('.lien-referentiel:has-text("Profil")').count() === 0
      && await page.locator('.lien-referentiel:has-text("Rôles projet")').count() === 0 && await page.locator('input[aria-label="Valeur 1"]').count() === 1);
    await page.click('.lien-referentiel:has-text("Statuts projet")');
    const nomValeur = await page.inputValue('input[aria-label="Valeur 1"]');
    await page.fill('.encart-compact input[name=libelle]', 'Statut de test');
    await page.click('.encart-compact >> text=Ajouter');
    await page.waitForSelector('input[value="Statut de test"]');
    verifier('Administration › Référentiels : ajout d\'une valeur (visible dans les listes)', await page.locator('input[value="Statut de test"]').count() === 1);
    const champValeur = await page.locator('input[value="Statut de test"]').elementHandle();
    await champValeur.fill('Statut de test renommé');
    await champValeur.evaluate(el => el.blur());
    await page.waitForSelector('input[value="Statut de test renommé"]');
    const interrupteur = page.locator('tr:has(input[value="Statut de test renommé"]) .interrupteur');
    await interrupteur.click();
    await page.waitForFunction(() => ![...document.querySelectorAll('tr')].find(r => r.querySelector('input[value="Statut de test renommé"]'))?.querySelector('.interrupteur')?.classList.contains('actif'));
    verifier('Administration › Référentiels : renommer et désactiver une valeur', (await interrupteur.getAttribute('class')).includes('actif') === false && nomValeur.length > 0);

    // Roadmap (3.05, maquette admin-roadmap-colonnes/) : colonnes du tableau de Vue d’ensemble › Roadmap
    verifier('Administration › Référentiels : les listes de la Roadmap n\'y sont pas (réglées dans l\'onglet Roadmap)', await page.locator('.lien-referentiel:has-text("Roadmap")').count() === 0);
    await page.click('[role=tab]:has-text("Roadmap")');
    await page.waitForSelector('.tableau-colonnes-roadmap');
    await captureD('37-admin-roadmap');
    const lignesColonnes = () => page.locator('.tableau-colonnes-roadmap tbody tr').count();
    verifier('Administration › Roadmap : 28 colonnes, Rang et Score calculés et verrouillés, Liste déroulante ou Saisie libre pour les autres', await lignesColonnes() === 28
      && await page.locator('.badge-calculee').count() === 2 && await page.locator('.tableau-colonnes-roadmap button[aria-label^="Supprimer la colonne"]').count() === 26
      && await page.locator('.tableau-colonnes-roadmap .choix-type .puce.active:has-text("Liste déroulante")').count() === 17 && await page.locator('select[aria-label^="Format de"]').count() === 9);
    await page.fill('input[aria-label="Nom de la nouvelle colonne"]', 'Canal');
    await page.click('button:has-text("Ajouter la colonne")');
    await page.waitForSelector('input[aria-label="Nom de la colonne Canal"]');
    const ligneCanal = page.locator('tr:has(input[aria-label="Nom de la colonne Canal"])');
    verifier('Administration › Roadmap : ajout d\'une colonne en liste déroulante, rangée en fin de son bloc', await lignesColonnes() === 29
      && (await ligneCanal.textContent()).includes('Aucune valeur') && await page.locator('.tableau-colonnes-roadmap tbody tr').last().locator('input[aria-label="Nom de la colonne Canal"]').count() === 1);
    await ligneCanal.locator('button:has-text("Valeurs…")').click();
    await page.waitForSelector('.panneau[role=dialog]');
    await page.fill('.panneau input[name=libelle]', 'E-mail');
    await page.click('.panneau button:has-text("Ajouter")');
    await page.waitForSelector('.panneau input[value="E-mail"]');
    await captureD('37b-admin-roadmap-valeurs');
    await page.click('.panneau [aria-label=Fermer]');
    verifier('Administration › Roadmap : les valeurs d\'une liste déroulante se saisissent dans le panneau', (await ligneCanal.textContent()).includes('E-mail'));
    await ligneCanal.locator('button:has-text("Saisie libre")').click();
    await page.waitForSelector('select[aria-label="Format de Canal"]');
    await page.selectOption('select[aria-label="Format de Canal"]', 'nombre');
    await page.waitForFunction(() => document.querySelector('select[aria-label="Format de Canal"]')?.value === 'nombre');
    await ligneCanal.locator('button:has-text("Liste déroulante")').click();
    await page.waitForFunction(() => [...document.querySelectorAll('tr')].some(r => r.querySelector('input[aria-label="Nom de la colonne Canal"]') && r.textContent.includes('E-mail')));
    verifier('Administration › Roadmap : passer en saisie libre (format Nombre) puis revenir en liste garde ses valeurs', true);
    await page.locator('button[aria-label="Monter Canal"]').click();
    await page.waitForFunction(() => { const l = [...document.querySelectorAll('.tableau-colonnes-roadmap tbody tr')]; return l[l.length - 1].querySelector('input[aria-label="Nom de la colonne Statut MEP"]'); });
    verifier('Administration › Roadmap : « ↑ » remonte la colonne dans son bloc', true);
    await menu('/roadmap');
    await page.waitForSelector('.tableau-roadmap');
    const titres = await page.locator('.tableau-roadmap thead tr:nth-child(2) th').allTextContents();
    verifier('Roadmap : le tableau suit les colonnes réglées dans Administration (29 colonnes, Canal avant Statut MEP)', titres.length === 29
      && titres.indexOf('Canal') === titres.indexOf('Statut MEP') - 1);
    await menu('/administration');
    await page.click('[role=tab]:has-text("Roadmap")');
    await page.waitForSelector('.tableau-colonnes-roadmap');
    await page.locator('button[aria-label="Supprimer la colonne Canal"]').click();
    await page.waitForFunction(() => !document.querySelector('input[aria-label="Nom de la colonne Canal"]'));
    verifier('Administration › Roadmap : suppression d\'une colonne (et de sa liste)', await lignesColonnes() === 28);
    // Sous-onglet Calculs (3.08, maquette admin-roadmap-calculs/) : formule du score, critères du rang, exemple sur les 3 premières demandes
    await page.click('.onglets-secondaires [role=tab]:has-text("Calculs")');
    await page.waitForSelector('.calculs-roadmap');
    await captureD('37c-admin-roadmap-calculs');
    const exemple = page.locator('.tableau-exemple-calcul tbody tr');
    verifier('Administration › Roadmap › Calculs : formule, 4 critères du rang, exemple détaillé des 3 premières demandes', (await page.textContent('.formule')).includes('0,5 × Impact client')
      && await page.locator('.calculs-roadmap ol li').count() === 4 && await exemple.count() === 3
      && (await exemple.first().textContent()).includes('(0,5 × 3 + 0,3 × 2) ÷ (0,2 × 2) = 2,1 ÷ 0,4 = 5,25') && (await exemple.first().textContent()).includes('Stratégique : passe en tête')
      && (await exemple.nth(2).textContent()).includes('sans score'));
    await page.click('.onglets-secondaires [role=tab]:has-text("Colonnes")');
    await page.waitForSelector('.tableau-colonnes-roadmap');

    // Ressources (2.93, rôle unique 2.96) : profils (postes) et Rôle
    await page.click('[role=tab]:has-text("Ressources")');
    await page.waitForSelector('.lien-referentiel');
    await captureD('10c-ressources');
    verifier('Administration › Équipes et ressources : Directions/équipes/projets, Profil, Rôle et Personnes et rôles (plus de rôles de projet ni d\'onglet Rôles)', await page.locator('.lien-referentiel').count() === 4
      && await page.locator('.lien-referentiel:has-text("Rôles projet")').count() === 0 && await page.locator('.lien-referentiel:has-text("Profil")').count() === 1
      && await page.locator('.lien-referentiel:has(span:text-is("Rôle"))').count() === 1 && await page.locator('.lien-referentiel:has-text("Personnes et rôles")').count() === 1
      && await page.locator('[role=tab]:text-is("Rôles")').count() === 0);
    await page.click('.lien-referentiel:has-text("Personnes et rôles")'); await page.waitForSelector('.tableau-roles-acces');
    verifier('Administration › Personnes et rôles : « + Ajouter à une équipe » (rôle par équipe, 3.27)', await page.locator('.tableau-roles-acces select[aria-label^="Ajouter"]').count() > 0);
    verifier('Administration › Personnes et rôles : bouton « Supprimer » par personne (3.24)', await page.locator('.tableau-roles-acces button:has-text("Supprimer")').count() > 0);
    await page.click('.lien-referentiel:has-text("Profil")');
    await page.waitForSelector('input[aria-label="Valeur 1"]');
    verifier('Administration › Ressources : le profil (postes) est une liste modifiable', await page.locator('.carte-titre h2:has-text("Profil")').count() === 1
      && await page.locator('input[aria-label="Nouvelle valeur"]').count() === 1);
    await page.click('.lien-referentiel:has(span:text-is("Rôle"))');
    await page.waitForSelector('.carte-titre h2:text-is("Rôle")');
    verifier('Administration › Ressources : le rôle est en lecture seule (6 rôles, Administrateur, Créateur), avec périmètre et nombre de personnes', await page.locator('tbody tr').count() === 8
      && await page.locator('input').count() === 0 && (await page.textContent('tbody')).includes('Sa direction et ses équipes') && (await page.textContent('tbody')).includes('Lecture seule'));
    await page.click('[role=tab]:has-text("Référentiels")');
    await page.waitForSelector('.lien-referentiel');

    await page.click('[role=tab]:has-text("Jours fériés")');
    await page.waitForSelector('input[aria-label="Nouvelle date"]');
    await page.fill('input[aria-label="Nouvelle date"]', '2026-12-26');
    await page.fill('input[aria-label="Nouveau libellé"]', 'Noël de test');
    await page.click('.encart-compact >> text=Ajouter');
    await page.waitForSelector('input[value="Noël de test"]');
    await page.fill('input[aria-label="Nouvelle date"]', '2026-12-26');
    await page.fill('input[aria-label="Nouveau libellé"]', 'Doublon');
    await page.click('.encart-compact >> text=Ajouter');
    await page.waitForSelector('.notification.visible.erreur');
    verifier('Administration › Jours fériés : ajout, doublon refusé', (await toast()).includes('déjà férié') && await page.locator('input[value="Noël de test"]').count() === 1);
    await page.locator('tr:has(input[value="Noël de test"]) button[title="Supprimer ce jour férié"]').click();
    await page.waitForFunction(() => !document.querySelector('input[value="Noël de test"]'));
    verifier('Administration › Jours fériés : suppression (après confirmation)', await page.locator('input[value="Noël de test"]').count() === 0);

    await page.click('[role=tab]:has-text("Envoi du daily")');
    await page.waitForSelector('select[aria-label^="Mode"]');
    await captureD('21-envoi-daily');
    await page.locator('select[aria-label^="Mode"]').first().selectOption('power_automate');
    await page.waitForSelector('button:has-text("Configurer le flux")');
    await page.locator('input[aria-label^="Destinataires"]').first().fill('equipe@test.fr');
    await page.locator('input[aria-label^="Destinataires"]').first().blur();
    await page.locator('button:has-text("Configurer le flux")').first().click();
    await page.waitForSelector('.modale[role=dialog]');
    verifier('Envoi du daily : mode Power Automate, fenêtre de mise en place (URI, corps avec la clé du projet)', (await page.inputValue('.modale input[aria-label="URI"]')).includes('/rpc/daily_projet')
      && (await page.inputValue('.modale input[aria-label^="Corps"]')).includes('p_cle'));
    await page.keyboard.press('Escape');
    await page.locator('select[aria-label^="Mode"]').first().selectOption('aucun');

    await ouvrirParametrageRoles();
    await captureD('31-roles-administration');
    verifier('Administration › Ressources › Paramétrage des rôles : utilisateurs et rôles (équipe, projets, compte relié, poste)', await page.locator('.tableau-roles-acces tbody tr').count() >= 12);
    await page.selectOption('select[aria-label="Rôle"]', 'lecture');
    verifier('Administration › Ressources › Paramétrage des rôles : filtre par rôle', await page.locator('.tableau-roles-acces tbody tr').count() < 12);
    await page.selectOption('select[aria-label="Rôle"]', '');
    await page.fill('input[aria-label="Rechercher une personne"]', 'thomas');
    verifier('Administration › Ressources › Paramétrage des rôles : recherche par nom', await page.locator('.tableau-roles-acces tbody tr').count() === 1);
    await page.fill('input[aria-label="Rechercher une personne"]', '');
    // Prénom et nom séparés, modifiables dans la ligne (2.88, 2.89) : enregistrés en quittant le champ, le nom complet est recomposé ; remis ensuite
    const champNom = page.locator('input[aria-label="Nom de Léa Moreau"]');
    verifier('Administration › Ressources › Paramétrage des rôles : prénom et nom sont deux champs (découpage du nom complet existant)', await page.locator('input[aria-label="Prénom de Léa Moreau"]').inputValue() === 'Léa'
      && await champNom.inputValue() === 'Moreau');
    await champNom.fill('Moreau-Durand');
    await champNom.blur();
    await page.waitForSelector('.notification.visible:has-text("Nom enregistré")');
    await page.waitForSelector('input[aria-label="Nom de Léa Moreau-Durand"]');
    verifier('Administration › Ressources › Paramétrage des rôles : le nom se modifie dans la ligne, le nom complet est recomposé', await page.locator('input[aria-label="Prénom de Léa Moreau-Durand"]').inputValue() === 'Léa');
    await page.locator('input[aria-label="Nom de Léa Moreau-Durand"]').fill('Moreau');
    await page.locator('input[aria-label="Nom de Léa Moreau-Durand"]').blur();
    await page.waitForSelector('input[aria-label="Nom de Léa Moreau"]');
    // Le nom du compte de connexion suit la fiche (2.90, migration 049) : mon propre nom, affiché sous le menu, est mis à jour
    const nomAvant = (await page.textContent('.moi-nom')).trim();
    await page.locator('input[aria-label="Nom de Camille Laurent"]').fill('Laurent-Test');
    await page.locator('input[aria-label="Nom de Camille Laurent"]').blur();
    await page.waitForFunction(() => document.querySelector('.moi-nom')?.textContent?.includes('Laurent-Test'));
    verifier('Administration › Ressources › Paramétrage des rôles : le nom du compte de connexion (sous le menu) suit la fiche', (await page.textContent('.notification')).includes('compte de connexion')
      && (await page.textContent('.moi-nom')).includes('Camille Laurent-Test') && nomAvant.includes('Camille'));
    await page.locator('input[aria-label="Nom de Camille Laurent-Test"]').fill('Laurent');
    await page.locator('input[aria-label="Nom de Camille Laurent-Test"]').blur();
    await page.waitForFunction(() => !document.querySelector('.moi-nom')?.textContent?.includes('Laurent-Test'));
    await page.selectOption('select[aria-label="Rôle de Léa Moreau"]', 'chef');
    await page.waitForSelector('.notification.visible:has-text("Rôle")');
    verifier('Administration › Ressources › Paramétrage des rôles : un rôle se choisit dans la liste de la ligne et s\'enregistre', (await toast()).includes('Rôle'));
    await page.selectOption('select[aria-label="Rôle de Léa Moreau"]', 'utilisateur');
    await page.waitForFunction(() => document.querySelector('select[aria-label="Rôle de Léa Moreau"]')?.value === 'utilisateur');
    await page.waitForTimeout(700);        // laisse finir la relecture des données avant de changer autre chose sur la même ligne
    // Profil et équipe d'une personne se règlent depuis sa ligne (porteur, 2026-11-12)
    // On choisit un profil différent de l'actuel (sinon aucun changement, donc aucun enregistrement)
    const profils = await page.locator('select[aria-label="Profil de Léa Moreau"] option').evaluateAll(o => o.map(x => x.value).filter(Boolean));
    const profilActuel = await page.locator('select[aria-label="Profil de Léa Moreau"]').inputValue();
    await page.selectOption('select[aria-label="Profil de Léa Moreau"]', profils.find(v => v !== profilActuel));
    await page.waitForSelector('.notification.visible');
    await page.waitForFunction(() => /Profil enregistré/i.test(document.querySelector('.notification')?.textContent ?? ''), null, { timeout: 5000 }).catch(() => undefined);   // le contrôle suivant dit ce qui s'est affiché
    verifier('Administration › Ressources › Paramétrage des rôles : le profil se choisit dans la liste de la ligne et s\'enregistre',
      profils.length > 1 && (await toast()).includes('Profil enregistré') && await page.locator('select[aria-label^="Équipe de Léa Moreau"]').count() >= 1,
      `profils=${profils.length} toast=${await toast()}`);
    // Administrateur : la case est réservée au créateur (la base refuse les autres), elle est donc grisée pour une administratrice
    verifier('Administration › Ressources › Paramétrage des rôles : la case Administrateur est grisée pour qui n\'est pas le créateur', await page.locator('input[aria-label="Administrateur : Léa Moreau"]').isDisabled());

    /* ---------- Responsable : adresse non permise → redirection ---------- */
    // Le serveur de test ne réécrit pas les adresses (Vercel le fait) : navigation dans la page elle-même
    await page.evaluate(() => { history.pushState({}, '', '/app/introuvable'); dispatchEvent(new PopStateEvent('popstate')); });
    await page.waitForFunction(() => location.pathname.endsWith('/dashboard'));
    verifier('Adresse inconnue : retour à l\'écran d\'arrivée', page.url().endsWith('/app/dashboard'));

    // Déconnexion depuis la barre latérale
    await page.click('text=Se déconnecter');
    await page.waitForSelector('input[type=email]');
    verifier('Déconnexion : retour à la connexion', true);
    await connecter('camille@test.fr');
    await page.waitForSelector('.laterale');

    /* ---------- Session conservée au rechargement, déconnexion ---------- */
    await page.reload();
    await page.waitForSelector('.laterale');
    verifier('La session survit au rechargement de la page', await page.locator('.bloc-moi').count() === 1);
    await page.click('text=Se déconnecter');
    await page.waitForSelector('input[type=email]');

    /* ---------- Créateur : simulation de rôle ---------- */
    await connecter('createur@test.fr');
    await page.waitForSelector('.laterale');
    // Nombre de personnes de la liste des ressources (Vue d’ensemble) : toutes les équipes pour le créateur, le périmètre de la personne en simulation.
    // (Les projets, sprints et MEP, eux, sont lisibles de tous depuis la migration 050 : ils ne servent plus à mesurer le périmètre.)
    const projetsActifs = async () => {
      await menu('/ressources');
      await page.click('[role=tab]:has-text("Liste des ressources")');
      await page.waitForSelector('.tableau');
      return await page.locator('.tableau tbody tr:not(.groupe)').count();
    };
    verifier('Le créateur est reconnu (carte « Espace créateur » de Mon profil), sans badge « Créateur » dans le menu', !(await page.textContent('.bloc-utilisateur')).includes('Créateur'));
    const projetsReels = await projetsActifs();
    const projetsGantt = async () => {
      await menu('/projets');
      await page.waitForSelector('.gantt-carte');
      return await page.locator('.gantt-ligne').count();
    };
    const ganttReel = await projetsGantt();
    await ouvrirAdminCreateur();
    await page.waitForSelector('.grille-simulation');
    await page.selectOption('select[aria-label="Personne pour Utilisateur"]', { label: 'Thomas Bernard · aujourd’hui Chef de projet' }).catch(async () => {
      const id = await page.locator('select[aria-label="Personne pour Utilisateur"] option', { hasText: 'Thomas Bernard' }).getAttribute('value');
      await page.selectOption('select[aria-label="Personne pour Utilisateur"]', id);
    });
    // Le choix de la personne est mémorisé : on quitte l'écran (Mon profil) puis on revient, la carte garde la personne choisie
    const choixAvant = await page.locator('select[aria-label="Personne pour Utilisateur"]').inputValue();
    await page.click('.bloc-moi .avatar');
    await page.waitForSelector('.grille-profil');
    await ouvrirAdminCreateur();
    await page.waitForSelector('.grille-simulation');
    verifier('Simulation : la personne choisie sur une carte est mémorisée au retour sur l\'écran',
      await page.locator('select[aria-label="Personne pour Utilisateur"]').inputValue() === choixAvant);
    await page.click('button:has-text("Voir l’application en tant que utilisateur")');
    await page.waitForSelector('.bandeau-simulation');
    verifier('Simulation : le rôle simulé remplace celui du créateur', !(await page.textContent('.bloc-utilisateur')).includes('★ Créateur')
      && (await page.textContent('.laterale')).includes('simulation'));
    verifier('Simulation : les personnes visibles sont limitées au périmètre de la personne', await projetsActifs() < projetsReels);
    verifier('Simulation (rôle Utilisateur) : le menu Projet de Vue d’ensemble reste visible et montre tous les projets de toutes les équipes (migration 050)',
      await page.locator('.laterale a[href$="/projets"]').count() === 1 && await projetsGantt() === ganttReel && ganttReel >= 9);
    await captureD('29-simulation-en-cours');
    // Mon dashboard › Congés : hors administrateur, seule la fiche de la personne simulée est affichée (aucune autre, pas de bascule « Par projet »)
    await menu('/conges');
    await page.waitForSelector('tr[data-personne]');
    verifier('Congés (non administrateur) : une seule personne est affichée, sans bascule « Par projet »',
      await page.locator('tr[data-personne]').count() === 1
      && await page.locator('button.puce:has-text("Par projet")').count() === 0);
    verifier('Simulation : le bandeau violet est affiché en haut des écrans', (await page.textContent('.bandeau-simulation')).includes('lecture seule'));
    await page.selectOption('.bandeau-simulation select', { index: 1 });
    verifier('Simulation : changer de rôle depuis le bandeau', (await page.textContent('.bandeau-simulation')).includes('Administrateur'));
    await page.click('text=Revenir à mon rôle de créateur');
    await page.waitForFunction(() => !document.querySelector('.bandeau-simulation'));
    verifier('Fin de simulation : le bandeau disparaît', true);
    verifier('Fin de simulation : données complètes de nouveau', await projetsActifs() === projetsReels);

    // Le créateur valide les feuilles de toutes les équipes
    await page.goto(BASE + '/app/timesheet');
    await page.waitForSelector('.tableau');
    await page.click('[aria-label="Mois précédent"]');
    await page.waitForSelector('text=septembre 2026');
    const aValider = await page.locator('button:has-text("Valider")').count();
    verifier('Feuilles de temps : le créateur peut valider les feuilles soumises de toutes les équipes', aValider >= 3);
    await page.locator('button:has-text("Valider")').first().click();
    await page.waitForFunction(n => document.querySelectorAll('.tableau button.succes').length < n, aValider);
    verifier('Feuilles de temps : « Valider » fige la feuille et met à jour l\'écran', await page.locator('button:has-text("Valider")').count() === aValider - 1
      && await page.locator('.badge:has-text("Validée")').count() >= 1);

    /* ---------- Vague D (2/2) : Administration créateur ---------- */
    await page.goto(BASE + '/app/administration-createur');
    await page.waitForSelector('.grille-simulation');
    await captureD('28-simulation-roles');
    verifier('Administration créateur : une carte par rôle (Administrateur, 6 rôles puis compte en attente)', await page.locator('.grille-simulation .carte').count() === 8
      && (await page.textContent('.grille-simulation')).includes('Vue d’ensemble :'));
    await page.selectOption('select[aria-label="Personne pour Chef de projet"]', { label: 'Thomas Bernard · a ce rôle' }).catch(async () => {
      await page.selectOption('select[aria-label="Personne pour Chef de projet"]', { index: 0 });
    });
    await page.click('button:has-text("Voir l’application en tant que chef de projet")');
    await page.waitForSelector('.bandeau-simulation');
    verifier('Simulation depuis Administration créateur : le bandeau s\'affiche et l\'application suit le rôle simulé', (await page.textContent('.bandeau-simulation')).includes('Chef de projet')
      && await page.locator('.laterale .badge-createur', { hasText: 'simulation' }).count() === 1);
    await page.click('text=Revenir à mon rôle de créateur');
    await page.waitForSelector('.grille-simulation');
    verifier('Fin de simulation : retour à Administration créateur', page.url().endsWith('/app/administration-createur') && await page.locator('.bandeau-simulation').count() === 0);
    await page.click('button:has-text("Voir l’application en tant que compte en attente")');
    await page.waitForSelector('.bandeau-simulation');
    await page.waitForSelector('text=Votre compte est créé');
    verifier('Simulation « Compte en attente » : écran d\'attente d\'accès', (await texte()).includes('Votre compte est créé'));
    await page.click('text=Revenir à mon rôle de créateur');
    await page.waitForSelector('.grille-simulation');
    verifier('Administration créateur : plus d\'onglet « Matrice des droits » (déplacée dans Administration)', await page.locator('[role=tab]:has-text("Matrice des droits")').count() === 0);
    await menu('/administration');
    await page.waitForSelector('.onglets');
    await page.click('[role=tab]:has-text("Matrice des droits")');
    await page.waitForSelector('.tableau-matrice');
    await captureD('32-matrice-droits');
    verifier('Matrice des droits : une colonne par rôle, périmètres, sections et onglets', await page.locator('.tableau-matrice thead th').count() === 10
      && (await texte()).includes('Périmètre') && await page.locator('.tableau-matrice .ligne-onglet').count() >= 5 && await page.locator('.tableau-matrice select').count() > 100);
    const celluleDroit = page.locator('select[aria-label="onglet_astuces_agile · utilisateur"]');
    const avantNiveau = await celluleDroit.inputValue();
    await celluleDroit.selectOption(avantNiveau === 'oui' ? 'lecture' : 'oui');
    await page.waitForFunction(v => document.querySelector('select[aria-label="onglet_astuces_agile · utilisateur"]').value !== v, avantNiveau);
    verifier('Matrice des droits : un niveau se modifie sur place (enregistré en base, réservé au créateur)', await celluleDroit.inputValue() !== avantNiveau);
    await celluleDroit.selectOption(avantNiveau);
    verifier('Matrice des droits : Administrateur × Rôles figé', await page.locator('select[aria-label="roles · admin"]').isDisabled());
    await ouvrirParametrageRoles();
    // Administrateur prévu (migration 047), côté créateur : la case est cochable même pour une fiche sans compte, puis décochable
    const caseAdmin = page.locator('input[aria-label="Administrateur : Léa Moreau"]');
    verifier('Administration › Ressources › Paramétrage des rôles : la case Administrateur n\'est pas grisée pour une fiche sans compte (créateur)', await caseAdmin.isEnabled());
    await caseAdmin.click();   // case contrôlée : son état change après l'enregistrement, d'où click() et non check()
    await page.waitForSelector('.notification.visible:has-text("Administrateur prévu")');
    verifier('Administration › Ressources › Paramétrage des rôles : administrateur prévu pour une fiche sans compte, appliqué à sa connexion',
      await caseAdmin.isChecked() && (await page.textContent('.tableau-roles-acces')).includes('administrateur prévu'));
    await caseAdmin.click();
    await page.waitForFunction(() => !document.querySelector('.tableau-roles-acces')?.textContent?.includes('administrateur prévu'));
    verifier('Administration › Ressources › Paramétrage des rôles : le statut d\'administrateur prévu se retire', !(await caseAdmin.isChecked()));

    await ouvrirAdminCreateur();
    await page.waitForSelector('.grille-simulation');
    await page.click('[role=tab]:has-text("Qui a quel rôle")');
    await page.waitForSelector('.tableau-qui-a-quel-role');
    await captureD('27b-roles');
    verifier('Qui a quel rôle : tableau par rôle avec description, personnes, équipe et compte', await page.locator('.tableau-qui-a-quel-role tr.groupe').count() === 8
      && (await texte()).includes('personne(s)'));

    /* ---------- Catalogue des composants (/app/composants) ---------- */
    await page.goto(BASE + '/app/composants');
    await page.waitForSelector('section[aria-label="Boutons"]');
    const section = nom => page.locator(`section[aria-label="${nom}"]`);
    verifier('Catalogue : toutes les sections sont présentes', await page.locator('.section-catalogue').count() === 9);
    await section('Onglets').getByRole('tab', { name: /Équipe/ }).click();
    verifier('Onglets : le clic change l\'onglet actif', (await page.textContent('[data-testid=onglet-actif]')).includes('b'));
    await section('Tableau').locator('tr.cliquable', { hasText: 'Thomas Bernard' }).click();
    verifier('Tableau : le clic sur une ligne l\'ouvre', (await page.textContent('[data-testid=ligne-ouverte]')).includes('Thomas Bernard'));
    verifier('Tableau : une ligne inactive est grisée', await section('Tableau').locator('tr.inactive').count() === 1);
    await page.click('text=Ouvrir le panneau');
    verifier('Panneau : s\'ouvre avec son titre', await page.locator('.panneau[role=dialog] h2').textContent() === 'Projet VISTA');
    await page.click('.panneau [aria-label=Fermer]');
    verifier('Panneau : la croix le ferme', await page.locator('.panneau').count() === 0);
    await page.click('text=Ouvrir la fenêtre');
    await page.keyboard.press('Escape');
    verifier('Fenêtre modale : Échap la ferme', await page.locator('.modale').count() === 0);
    await page.click('text=Ouvrir la fenêtre');
    await page.click('[data-testid=voile]', { position: { x: 5, y: 5 } });
    verifier('Fenêtre modale : un clic sur le voile la ferme', await page.locator('.modale').count() === 0);
    const calendrier = section('Calendrier');
    verifier('Calendrier : novembre 2026 affiché (30 jours)', (await calendrier.textContent('b')).includes('novembre 2026') && await calendrier.locator('thead th').count() === 30 + 2);
    verifier('Calendrier : congé, demi-journée et jour férié affichés', await calendrier.locator('.case-absence').count() >= 3 && (await calendrier.textContent('.calendrier')).includes('CP½'));
    await calendrier.locator('td.cliquable').first().click();
    verifier('Calendrier : le clic sur une case est transmis à l\'écran', (await page.textContent('[data-testid=ligne-ouverte]')).startsWith('Ligne ouverte : absence'));
    await calendrier.getByRole('button', { name: 'Mois suivant' }).click();
    verifier('Calendrier : navigation vers décembre 2026', (await calendrier.textContent('b')).includes('décembre 2026'));
    await calendrier.getByRole('button', { name: 'Mois précédent' }).click();
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.screenshot({ path: path.join(CAPTURES, '34-catalogue-composants.png'), fullPage: true });

    verifier('Aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
  } catch (e) {
    console.error('Échec à', page && page.url(), '\n', page && (await page.textContent('body')).slice(0, 600));
    throw e;
  } finally {
    await navigateur.close();
    serveur.kill();
  }

  resultats.forEach(r => console.log(`${r.ok ? '✔' : '✘'} ${r.nom}${r.ok ? '' : r.detail ? ' — ' + r.detail : ''}`));
  const echecs = resultats.filter(r => !r.ok).length;
  console.log(echecs ? `\n${echecs} contrôle(s) en échec` : `\n✔ ${resultats.length} contrôles passés`);
  process.exit(echecs ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
