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
  page.on('dialog', d => d.accept(d.type() === 'prompt' ? 'Merci de compléter' : undefined));

  const capture = async nom => { await page.waitForTimeout(250); await page.screenshot({ path: path.join(CAPTURES, nom + '.png') }); };
  const aller = async ecran => { await page.click(`[data-action="aller"][data-ecran="${ecran}"]`); await page.waitForTimeout(250); };
  const texte = () => page.textContent('#app');

  try {
    /* --- Connexion --- */
    await page.goto(BASE + '/app/');
    await page.waitForSelector('form[data-action-envoi="seConnecter"]');
    await capture('01-connexion');
    await page.fill('input[name=email]', 'camille@test.fr'); await page.fill('input[name=motDePasse]', 'faux-mdp');
    await page.click('form button'); await page.waitForTimeout(300);
    verifier('Connexion refusée avec un mauvais mot de passe', (await texte()).includes('incorrect'));
    await page.fill('input[name=motDePasse]', 'motdepasse'); await page.click('form button');
    await page.waitForSelector('[data-action="ouvrirEquipe"]');
    await capture('02-choix-equipe');
    verifier('Choix d’équipe : invitation reçue affichée', (await texte()).includes('Produit'));
    await page.click('[data-action="ouvrirEquipe"]');
    await page.waitForSelector('.laterale');

    /* --- Section Général (lecture) --- */
    await capture('03-dashboard');
    await page.click('[data-action="choisirTrimestre"][data-t="4"]'); await page.waitForTimeout(200);
    verifier('Dashboard : 6 objectifs au T4', (await texte()).includes('6 objectifs'));
    await aller('projets'); await capture('04-projets');
    await page.click('[data-action="deplierProjet"]'); await page.waitForTimeout(200);
    verifier('Projets : tickets dépliés', (await texte()).includes('PF-12.1'));
    await page.click('tr.cliquable[data-action="ouvrirProjet"]'); await page.waitForTimeout(200);
    verifier('Projets : panneau en lecture seule', (await texte()).includes('Vue générale en lecture seule'));
    await page.click('.fermer');
    await aller('ressources'); await page.click('[data-action="moisSuivant"]'); await capture('05-ressources');
    await aller('administration'); await capture('06-administration');
    await page.click('[data-action="ongletAdministration"][data-id="referentiels"]'); await page.waitForTimeout(200);
    await page.fill('form[data-action-envoi="ajouterValeur"] input', 'Demande légale');
    await page.click('form[data-action-envoi="ajouterValeur"] button'); await page.waitForTimeout(300);
    verifier('Administration : valeur de référentiel ajoutée', (await page.$$eval('input[data-action-change="renommerValeur"]', l => l.map(i => i.value))).includes('Demande légale'));
    await aller('timesheet'); await page.click('[data-action="semainePrecedente"]'); await page.click('[data-action="semaineSuivante"]');
    await capture('07-timesheet');
    verifier('Timesheet : pas de NaN', !(await texte()).includes('NaN'));

    /* --- Mon dashboard (édition) --- */
    await aller('daily'); await capture('08-daily');
    await page.click('[data-action="dailyDecaler"][data-sens="-1"]'); await page.waitForTimeout(200);
    await page.fill('#note-daily', 'Hier\n- Test automatique\n- Deuxième point'); await page.waitForTimeout(1200);
    await page.click('[data-action="dailyAujourdhui"]'); await page.waitForTimeout(200);
    verifier('Daily : note enregistrée et visible dans l’historique', (await texte()).includes('Test automatique'));

    await aller('mesProjets'); await capture('09-mes-projets');
    await page.click('.gantt-ligne:has-text("PF-14") .gantt-barre');   // projet dont Camille est cheffe await page.waitForTimeout(200);
    await capture('10-panneau-projet');
    await page.selectOption('select[data-champ="statut"]', 'En retard'); await page.waitForTimeout(300);
    verifier('Panneau : statut modifié', (await page.inputValue('select[data-champ="statut"]')) === 'En retard');
    await page.fill('form[data-action-envoi="ajouterTicket"] input[name=titre]', 'Ticket de test');
    await page.click('form[data-action-envoi="ajouterTicket"] button'); await page.waitForTimeout(300);
    verifier('Panneau : ticket ajouté', (await texte()).includes('Ticket de test'));
    await page.click('.fermer');
    await page.click('[data-action="ouvrirObjectifs"]'); await page.waitForTimeout(200);
    await page.fill('form[data-action-envoi="ajouterObjectif"] input', 'Objectif de test'); await page.click('form[data-action-envoi="ajouterObjectif"] button');
    await page.waitForTimeout(300);
    verifier('Objectifs : objectif ajouté', (await texte()).includes('Objectif de test'));
    await page.click('.fermer');
    await page.click('[data-action="nouveauProjet"]'); await page.waitForTimeout(200);
    await page.fill('form[data-action-envoi="creerProjet"] input[name=nom]', 'Projet de test');
    await page.fill('form[data-action-envoi="creerProjet"] input[name=fin]', '2026-12-31');
    await page.click('form[data-action-envoi="creerProjet"] .btn.primaire'); await page.waitForTimeout(400);
    verifier('Nouveau projet créé et ouvert', (await texte()).includes('Projet de test'));
    await page.click('.fermer');

    await aller('conges'); await page.click('[data-action="moisSuivant"]');
    await page.click('[data-action="choisirPinceau"][data-id="RTT"]');
    await page.click('td[data-action="basculerAbsence"] >> nth=3'); await page.waitForTimeout(300);
    await capture('11-conges');
    verifier('Congés : absence posée', (await page.$$('td[data-action="basculerAbsence"] .case-absence')).length > 0);

    await aller('listeRessources'); await capture('12-liste-ressources');
    await page.click('[data-action="assigner"] >> nth=0'); await page.waitForTimeout(200);
    await page.selectOption('select[name=ressource]', { index: 3 }); await page.waitForTimeout(200);
    await page.check('input[name=projet] >> nth=0');
    await page.click('.modale .btn.primaire'); await page.waitForTimeout(300);
    verifier('Affectation enregistrée (modale fermée)', !(await page.$('.modale')));

    await aller('monTimesheet'); await page.click('[data-action="semainePrecedente"]'); await page.waitForTimeout(200);
    await page.click('[data-action="semaineSuivante"]'); await page.waitForTimeout(200);
    const saisie = await page.$('input.saisie-heure:not([disabled])');
    if (saisie) { await saisie.fill('3,5'); await saisie.press('Tab'); await page.waitForTimeout(300); }
    verifier('Mon timesheet : heure saisie', !!saisie && (await texte()).includes('3,5'));
    await capture('13-mon-timesheet');
    const avant = (await page.$$('[data-action="validerFeuille"]')).length;
    await page.click('[data-action="validerFeuille"] >> nth=0'); await page.waitForTimeout(300);
    verifier('Mon timesheet : feuille validée par le responsable', (await page.$$('[data-action="validerFeuille"]')).length === avant - 1);
    await page.click('[data-action="soumettreSemaine"]'); await page.waitForTimeout(300);
    verifier('Mon timesheet : semaine soumise', (await texte()).includes('Soumise'));

    await aller('monAdmin'); await capture('14-mon-admin');
    await page.click('.fiche >> nth=0'); await page.click('[data-action="statutDemande"][data-statut="analyse"]'); await page.waitForTimeout(300);
    await page.click('[data-action="statutDemande"][data-statut="acceptee"]'); await page.waitForTimeout(300);
    await page.click('[data-action="projetDepuisDemande"]'); await page.waitForTimeout(200);
    await page.fill('form[data-action-envoi="creerProjet"] input[name=fin]', '2027-02-28');
    await page.click('form[data-action-envoi="creerProjet"] .btn.primaire'); await page.waitForTimeout(400);
    await page.click('.fermer');
    verifier('Demande acceptée et projet créé depuis la demande', (await texte()).includes('Projet créé'));
    await page.click('[data-action="ongletMonAdmin"][data-id="formulaire"]'); await page.waitForTimeout(200);
    await page.click('[data-action="choisirTypeChamp"][data-type="Date"]'); await page.click('[data-action="ajouterChamp"]'); await page.waitForTimeout(300);
    await capture('15-formulaire');
    verifier('Formulaire : champ ajouté', (await texte()).includes('Nouveau champ'));

    /* --- Espace demandeur (compte sans équipe) --- */
    await page.click('[data-action="deconnexion"]'); await page.waitForSelector('form[data-action-envoi="seConnecter"]');
    await page.fill('input[name=email]', 'elodie@test.fr'); await page.fill('input[name=motDePasse]', 'motdepasse'); await page.click('form button');
    await page.waitForSelector('form[data-action-envoi="deposerDemande"]');
    const form = 'form[data-action-envoi="deposerDemande"]';
    const champs = await page.$$(`${form} [name]`);
    for (const c of champs) {
      const tag = await c.evaluate(e => e.tagName); const type = await c.getAttribute('type');
      if (tag === 'SELECT') await c.selectOption({ index: 1 });
      else if (type === 'date') await c.fill('2026-12-15');
      else if (type === 'number') await c.fill('10');
      else await c.fill('Demande automatique');
    }
    await page.click(`${form} .btn.primaire`); await page.waitForTimeout(400);
    await capture('16-espace-demandeur');
    verifier('Demandeur : demande déposée et suivie', ((await texte()).match(/Demande automatique/g) || []).length >= 1 && (await texte()).includes('Nouvelle'));

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
