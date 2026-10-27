/* ============================================================
   Contrôles de bout en bout de la nouvelle application (/v2/, migration React — voir docs/specifications/migration-react.md)
   ------------------------------------------------------------
   1. Démarre tests/serveur-simule.js (mêmes services Neon simulés que tests/parcours.js).
   2. Ouvre /v2/ (construit par `npm --prefix web run build`) en redirigeant Neon Auth et la Data API vers le serveur simulé.
   3. Vérifie : connexion, jeton, chargement des tables, droits, simulation de rôle, déconnexion, absence d'erreur JavaScript.
   Usage : node tests/v2.js   (prérequis : npm --prefix web run build ; Playwright installé globalement)
   ============================================================ */
'use strict';

const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 8125, BASE = `http://localhost:${PORT}`;
const CAPTURES = path.resolve(__dirname, '../docs/maquettes/catalogue-composants');
const resultats = [];
const verifier = (nom, condition, detail = '') => { resultats.push({ nom, ok: !!condition, detail }); };

(async () => {
  const serveur = spawn('node', [path.join(__dirname, 'serveur-simule.js'), String(PORT)], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const navigateur = await chromium.launch();
  let page;
  try {
    const contexte = await navigateur.newContext({ viewport: { width: 1440, height: 900 } });
    await contexte.addInitScript(base => { window.CONFIG_SURCHARGE = { NEON_AUTH_URL: base + '/auth', DATA_API_URL: base + '/rest/v1' }; }, BASE);
    page = await contexte.newPage();
    const erreurs = [];
    page.on('pageerror', e => erreurs.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) erreurs.push(m.text()); });

    // Nombre de lignes affichées pour une table du diagnostic
    const lignes = async table => Number(await page.locator(`[data-testid="tables"] tr:has(th:text-is("${table}")) td`).textContent());
    const connecter = async (email, motDePasse = 'motdepasse') => {
      await page.fill('input[type=email]', email);
      await page.fill('input[type=password]', motDePasse);
      await page.click('form button.btn-connexion');
    };

    const VAGUE_A = path.resolve(__dirname, '../docs/maquettes/v2-vague-a');
    fs.mkdirSync(VAGUE_A, { recursive: true });
    const capture = nom => page.screenshot({ path: path.join(VAGUE_A, nom + '.png') });
    const texte = () => page.textContent('body');

    /* ---------- Connexion (vague A) ---------- */
    await page.goto(BASE + '/v2/');
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
    verifier('Une seule équipe : ouverture directe du dashboard général', page.url().endsWith('/v2/dashboard') && (await texte()).includes('Vue consolidée des équipes'));
    await capture('03-dashboard');
    verifier('Dashboard : 4 indicateurs', await page.locator('.grille-kpi .kpi').count() === 4);
    verifier('Dashboard : projets à surveiller', await page.locator('.carte-titre', { hasText: 'Projets à surveiller' }).count() === 1);
    verifier('Barre latérale : sections Suivi de mes équipes et Mon dashboard, lien actif', (await page.textContent('.laterale')).includes('Suivi de mes équipes')
      && (await page.textContent('.laterale')).includes('Mon dashboard') && await page.locator('.menu-lien.actif', { hasText: 'Dashboard général' }).count() === 1);
    verifier('En-tête : fil d\'Ariane et badge Lecture seule', (await page.textContent('.fil')).includes('Suivi de mes équipes') && (await page.textContent('.fil')).includes('Lecture seule'));
    verifier('Barre latérale : bloc utilisateur (équipe, nom, mention)', (await page.textContent('.bloc-utilisateur')).includes('Plateforme') && (await page.textContent('.bloc-utilisateur')).includes('Camille Laurent')
      && (await page.textContent('.bloc-utilisateur')).includes('CIRITEC'));
    verifier('Titre de l\'onglet du navigateur', (await page.title()) === 'Dashboard général · ProjectDesk');

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
    verifier('Choix d\'équipe : la croix revient à l\'écran précédent', page.url().endsWith('/v2/dashboard'));
    await page.click('.bloc-equipe >> text=Changer');
    await page.click('.carte-choix.courante >> text=Ouvrir');
    await page.waitForSelector('.laterale');
    verifier('Choix d\'équipe : « Ouvrir » entre dans l\'équipe (mémorisée sur le poste)', page.url().endsWith('/v2/dashboard')
      && await page.evaluate(() => !!localStorage.getItem('pp_equipe')));

    /* ---------- Trucs et astuces ---------- */
    await page.click('.menu-lien >> text=Trucs et astuces');
    await page.waitForSelector('.themes');
    await capture('19-astuces');
    verifier('Trucs et astuces : adresse, 3 thèmes, KPI Scrum et Kanban avec exemples', page.url().endsWith('/v2/trucs-et-astuces') && await page.locator('.theme').count() === 3
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

    /* ---------- Écran pas encore migré ---------- */
    await page.click('.menu-lien >> text=Daily des équipes');
    await page.waitForSelector('text=pas encore migré');
    verifier('Écran pas encore migré : page explicative avec lien vers l\'application actuelle', (await texte()).includes('pas encore migré') && await page.locator('a[href="/app/"]').count() >= 1
      && page.url().endsWith('/v2/daily-des-equipes'));

    /* ---------- Responsable : adresse non permise → redirection ---------- */
    // Le serveur de test ne réécrit pas les adresses (Vercel le fait) : navigation dans la page elle-même
    await page.evaluate(() => { history.pushState({}, '', '/v2/introuvable'); dispatchEvent(new PopStateEvent('popstate')); });
    await page.waitForFunction(() => location.pathname.endsWith('/dashboard'));
    verifier('Adresse inconnue : retour à l\'écran d\'arrivée', page.url().endsWith('/v2/dashboard'));

    // Déconnexion depuis la barre latérale
    await page.click('text=Se déconnecter');
    await page.waitForSelector('input[type=email]');
    verifier('Déconnexion : retour à la connexion', true);
    await connecter('camille@test.fr');
    await page.waitForSelector('.laterale');

    /* ---------- Session technique (/v2/session) ---------- */
    await page.goto(BASE + '/v2/session');
    await page.waitForSelector('[data-testid=compte]');
    verifier('Session : le compte est affiché', (await page.textContent('[data-testid=compte]')).includes('Camille Laurent'));
    verifier('Les équipes sont chargées (4)', await lignes('equipes') === 4);
    verifier('Les ressources sont chargées (12)', await lignes('ressources') === 12);
    verifier('Les projets sont chargés', await lignes('projets') > 0);
    verifier('La matrice des droits est chargée', await lignes('droits_roles') > 0);
    verifier('Aucune table en échec', await page.locator('.erreur-socle').count() === 0);
    verifier('Une responsable d\'équipe n\'a pas la simulation', await page.locator('section[aria-label="Simulation de rôle"]').count() === 0);
    await page.reload();
    await page.waitForSelector('[data-testid=compte]');
    verifier('La session survit au rechargement de la page', true);
    await page.click('text=Se déconnecter');
    await page.waitForSelector('input[type=email]');

    /* ---------- Créateur : simulation de rôle ---------- */
    await connecter('createur@test.fr');
    await page.waitForSelector('.laterale');
    await page.goto(BASE + '/v2/session');
    await page.waitForSelector('[data-testid=compte]');
    verifier('Le créateur est reconnu', (await page.textContent('[data-testid=role]')).includes('Créateur'));
    const projetsReels = await lignes('projets');
    verifier('Le créateur voit toutes les équipes', await lignes('equipes') === 4);
    await page.selectOption('select[aria-label="Rôle simulé"]', 'utilisateur');
    const idThomas = await page.locator('select[aria-label="Personne simulée"] option', { hasText: 'Thomas Bernard' }).getAttribute('value');
    await page.selectOption('select[aria-label="Personne simulée"]', idThomas);
    await page.click('text=Simuler');
    await page.waitForSelector('[data-testid=simulation-en-cours]');
    verifier('Simulation : le rôle simulé remplace celui du créateur', !(await page.textContent('[data-testid=role]')).includes('Créateur'));
    verifier('Simulation : les données sont limitées au périmètre de la personne', await lignes('projets') < projetsReels);
    verifier('Simulation : une seule équipe', (await page.locator('select[aria-label="Équipe ouverte"] option').count()) === 1);
    await page.click('text=Ouvrir le dashboard');
    await page.waitForSelector('.bandeau-simulation');
    await capture('29-simulation-en-cours');
    verifier('Simulation : le bandeau violet est affiché en haut des écrans', (await page.textContent('.bandeau-simulation')).includes('lecture seule')
      && (await page.textContent('.laterale')).includes('simulation'));
    await page.selectOption('.bandeau-simulation select', { index: 1 });
    verifier('Simulation : changer de rôle depuis le bandeau', (await page.textContent('.bandeau-simulation')).includes('Administrateur'));
    await page.click('text=Revenir à mon rôle de créateur');
    await page.waitForFunction(() => !document.querySelector('.bandeau-simulation'));
    verifier('Fin de simulation : le bandeau disparaît', true);
    await page.goto(BASE + '/v2/session');
    await page.waitForSelector('[data-testid=compte]');
    verifier('Fin de simulation : données complètes de nouveau', await lignes('projets') === projetsReels);
    verifier('Fin de simulation : le créateur est de retour', (await page.textContent('[data-testid=role]')).includes('Créateur'));

    /* ---------- Catalogue des composants (/v2/composants) ---------- */
    await page.goto(BASE + '/v2/composants');
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
    fs.mkdirSync(CAPTURES, { recursive: true });
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.screenshot({ path: path.join(CAPTURES, 'catalogue.png'), fullPage: true });

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
