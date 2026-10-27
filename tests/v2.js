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
  try {
    const contexte = await navigateur.newContext({ viewport: { width: 1200, height: 900 } });
    await contexte.addInitScript(base => { window.CONFIG_SURCHARGE = { NEON_AUTH_URL: base + '/auth', DATA_API_URL: base + '/rest/v1' }; }, BASE);
    const page = await contexte.newPage();
    const erreurs = [];
    page.on('pageerror', e => erreurs.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) erreurs.push(m.text()); });

    // Nombre de lignes affichées pour une table du diagnostic
    const lignes = async table => Number(await page.locator(`[data-testid="tables"] tr:has(th:text-is("${table}")) td`).textContent());
    const connecter = async (email, motDePasse = 'motdepasse') => {
      await page.fill('input[type=email]', email);
      await page.fill('input[type=password]', motDePasse);
      await page.click('button[type=submit]');
    };

    /* ---------- Connexion ---------- */
    await page.goto(BASE + '/v2/');
    await page.waitForSelector('input[type=email]');
    verifier('Sans session, la connexion est proposée', await page.textContent('h1') === 'Connexion');
    await connecter('camille@test.fr', 'mauvais');
    await page.waitForSelector('[role=alert]');
    verifier('Un mauvais mot de passe affiche une erreur et laisse sur la connexion', await page.locator('input[type=email]').count() === 1);

    await connecter('camille@test.fr');
    await page.waitForSelector('[data-testid=compte]');
    verifier('Connexion : le compte est affiché', (await page.textContent('[data-testid=compte]')).includes('Camille Laurent'));

    /* ---------- Chargement des tables ---------- */
    verifier('Les équipes sont chargées (4)', await lignes('equipes') === 4);
    verifier('Les ressources sont chargées (12)', await lignes('ressources') === 12);
    verifier('Les projets sont chargés', await lignes('projets') > 0);
    verifier('La matrice des droits est chargée', await lignes('droits_roles') > 0);
    verifier('Aucune table en échec', await page.locator('.erreur-socle').count() === 0);
    verifier('Une responsable d\'équipe n\'a pas la simulation', await page.locator('section[aria-label="Simulation de rôle"]').count() === 0);
    verifier('L\'équipe ouverte est proposée (équipe de Camille)', (await page.inputValue('select[aria-label="Équipe ouverte"]')) !== '');

    /* ---------- Session conservée au rechargement, puis déconnexion ---------- */
    await page.reload();
    await page.waitForSelector('[data-testid=compte]');
    verifier('La session survit au rechargement de la page', true);
    await page.click('text=Se déconnecter');
    await page.waitForSelector('input[type=email]');
    verifier('Déconnexion : retour à la connexion', true);

    /* ---------- Créateur : simulation de rôle ---------- */
    await connecter('createur@test.fr');
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
    verifier('Simulation : le bandeau violet est affiché', await page.locator('.bandeau-simulation').count() === 1);
    verifier('Simulation : une seule équipe', (await page.locator('select[aria-label="Équipe ouverte"] option').count()) === 1);
    await page.click('text=Revenir à mon rôle de créateur');
    await page.waitForFunction(() => !document.querySelector('[data-testid=simulation-en-cours]'));
    verifier('Fin de simulation : le bandeau disparaît', await page.locator('.bandeau-simulation').count() === 0);
    verifier('Fin de simulation : données complètes de nouveau', await lignes('projets') === projetsReels);
    verifier('Fin de simulation : le créateur est de retour', (await page.textContent('[data-testid=role]')).includes('Créateur'));


    /* ---------- Catalogue des composants (/v2/composants) ---------- */
    await page.click('text=Catalogue des composants');
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
  } finally {
    await navigateur.close();
    serveur.kill();
  }

  resultats.forEach(r => console.log(`${r.ok ? '✔' : '✘'} ${r.nom}${r.ok ? '' : r.detail ? ' — ' + r.detail : ''}`));
  const echecs = resultats.filter(r => !r.ok).length;
  console.log(echecs ? `\n${echecs} contrôle(s) en échec` : `\n✔ ${resultats.length} contrôles passés`);
  process.exit(echecs ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
