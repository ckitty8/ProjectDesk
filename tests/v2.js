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

const PORT = 8125, BASE = `http://localhost:${PORT}`;
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
    verifier('Simulation : une seule équipe', (await page.locator('select[aria-label="Équipe ouverte"] option').count()) === 1);
    await page.click('text=Arrêter la simulation');
    await page.waitForFunction(() => !document.querySelector('[data-testid=simulation-en-cours]'));
    verifier('Fin de simulation : données complètes de nouveau', await lignes('projets') === projetsReels);
    verifier('Fin de simulation : le créateur est de retour', (await page.textContent('[data-testid=role]')).includes('Créateur'));

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
