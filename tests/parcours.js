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
    await page.waitForSelector('.laterale');
    verifier('Une seule équipe : ouverture directe de l’outil (dashboard)', (await texte()).includes('Dashboard général'));
    await page.click('[data-action="changerEquipe"]'); await page.waitForSelector('[data-action="ouvrirEquipe"]');
    await capture('02-choix-equipe');
    verifier('Choix d’équipe : invitation reçue affichée', (await texte()).includes('Produit'));
    await page.click('[data-action="ouvrirEquipe"]');
    await page.waitForSelector('.laterale');

    /* --- Section Général (lecture) --- */
    await capture('03-dashboard');
    await page.click('[data-action="choisirTrimestre"][data-t="4"]'); await page.waitForTimeout(200);
    verifier('Dashboard : 6 objectifs au T4', (await texte()).includes('6 objectifs'));
    await aller('projets'); await capture('04-projets');
    await page.click('tr:has-text("PF-12") [data-action="deplierProjet"]'); await page.waitForTimeout(200);
    verifier('Projets : tickets dépliés', (await texte()).includes('PF-12.1'));
    await page.click('tr.cliquable[data-action="ouvrirProjet"]'); await page.waitForTimeout(200);
    verifier('Projets : panneau en lecture seule', (await texte()).includes('Vue générale en lecture seule'));
    await page.click('.fermer');
    await aller('ressources'); await page.click('[data-action="moisSuivant"]'); await capture('05-ressources');
    await aller('administration'); await capture('06-administration');
    await aller('timesheet'); await page.click('[data-action="semainePrecedente"]'); await page.click('[data-action="semaineSuivante"]');
    await capture('07-timesheet');

    /* --- Règle : la section « Général » est en lecture seule ---
       Aucun champ, formulaire ou action d'écriture dans les écrans Général (tous onglets). */
    const ACTIONS_LECTURE = ['aller', 'ouvrirProjet', 'fermer', 'choisirTrimestre', 'filtrerEquipeProjets', 'deplierProjet',
      'moisPrecedent', 'moisSuivant', 'semainePrecedente', 'semaineSuivante', 'ongletAdministration', 'choisirReferentiel',
      'filtrerDailyEquipes', 'dailyEquipesAujourdhui', 'dailyEquipesDecaler'];
    const ecritures = async () => page.$$eval('.contenu [data-action-change], .contenu [data-action-saisie], .contenu [data-action-envoi], .contenu [data-action]',
      (els, permises) => els.map(e => e.dataset.actionChange || e.dataset.actionSaisie || e.dataset.actionEnvoi || e.dataset.action)
        .filter(a => a && !permises.includes(a)), ACTIONS_LECTURE);
    const interdites = [];
    for (const ecran of ['dashboard', 'projets', 'ressources', 'timesheet', 'dailyEquipes', 'administration']) {
      await aller(ecran);
      if (ecran === 'administration') {
        for (const onglet of ['equipes', 'referentiels', 'champs']) { await page.click(`[data-action="ongletAdministration"][data-id="${onglet}"]`); await page.waitForTimeout(150); interdites.push(...await ecritures()); }
      } else interdites.push(...await ecritures());
    }
    await aller('projets'); await page.click('tr.cliquable[data-action="ouvrirProjet"]'); await page.waitForTimeout(200);
    interdites.push(...await page.$$eval('.panneau [data-action-change], .panneau [data-action-envoi], .panneau [data-action-saisie]', els => els.map(e => 'panneau:' + (e.dataset.actionChange || e.dataset.actionEnvoi || e.dataset.actionSaisie))));
    await page.click('.fermer');
    verifier('Général : lecture seule (aucune action d’écriture)', interdites.length === 0, [...new Set(interdites)].join(', '));

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
    await page.click('[data-action="ongletMonAdmin"][data-id="equipes"]'); await page.click('tr:has-text("Plateforme") [data-action="modifierEquipe"]'); await page.waitForTimeout(400);
    verifier('Mon admin : fenêtre équipe avec membres et invitation', (await page.textContent('.modale')).includes('Camille Laurent') && !!(await page.$('.modale form[data-action-envoi="inviterDansEquipe"]')));
    await page.click('.modale .fermer'); await page.click('[data-action="ongletMonAdmin"][data-id="demandes"]');
    verifier('Timesheet : pas de NaN', !(await texte()).includes('NaN'));

    await aller('dailyEquipes'); await page.waitForTimeout(300); await capture('17-daily-equipes');
    verifier('Daily des équipes : note d’un coéquipier visible', (await texte()).includes('Mapping des rôles applicatifs'));
    verifier('Daily des équipes : blocages du jour regroupés', (await texte()).includes('Blocages du jour') && (await texte()).includes('Identifiants de recette expirés'));

    /* --- Mon dashboard (édition) --- */
    await aller('daily'); await capture('08-daily');
    await page.click('[data-action="dailyDecaler"][data-sens="-1"]'); await page.waitForTimeout(200);
    await page.fill('#note-daily', 'Hier\n- Test automatique\n- Deuxième point'); await page.waitForTimeout(1200);
    await page.click('[data-action="dailyAujourdhui"]'); await page.waitForTimeout(200);
    verifier('Daily : note enregistrée et visible dans l’historique', (await texte()).includes('Test automatique'));
    verifier('Daily personnel : la note d’un coéquipier n’apparaît pas', !(await page.inputValue('#note-daily')).includes('Mapping des rôles'));

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
    await page.click('form[data-action-envoi="creerProjet"] .btn.primaire'); await page.waitForTimeout(400);
    verifier('Nouveau projet créé et ouvert', (await page.inputValue('.panneau input[data-champ="nom"]')) === 'Projet de test');
    await page.click('.fermer');

    await aller('conges'); await page.click('[data-action="moisSuivant"]');
    await page.click('[data-action="choisirPinceau"][data-id="Congés prévisionnel"]');
    await page.click('td[data-action="basculerAbsence"] >> nth=3'); await page.waitForTimeout(300);
    await capture('11-conges');
    await page.click('[data-action="ongletConges"][data-id="recap"]'); await page.waitForTimeout(200);
    verifier('Congés : onglet Récap annuel (personnes de la grille)', (await texte()).includes('Solde') && !(await texte()).includes('Aucune ressource') && !(await page.$('td[data-action="basculerAbsence"]')));
    await page.click('[data-action="ongletConges"][data-id="capacite"]'); await page.waitForTimeout(200);
    verifier('Congés : onglet Capacité par sprint', (await texte()).includes('jours-homme') && !(await texte()).includes('Solde'));
    await page.click('[data-action="ongletConges"][data-id="grille"]');
    verifier('Congés : jours fériés affichés par défaut avec le type « Jours férié »', !!(await page.$('td.ferme .case-absence[title="Armistice"], td.ferme .case-absence')) && (await page.textContent('td.ferme .case-absence')).includes('JF'));
    verifier('Congés : absence posée', (await page.$$('td[data-action="basculerAbsence"] .case-absence')).length > 0);

    await aller('listeRessources');
    const lignesUnites = async () => page.$$eval('#table-unites tbody tr', t => t.filter(x => x.style.display !== 'none').map(x => x.textContent.replace(/\s+/g, ' ').replace(/^[^A-Za-zÀ-ÿ]+/, '').trim()));
    const ligneVisible = async debut => (await lignesUnites()).some(l => l.startsWith(debut));
    verifier('Liste des ressources : direction → équipe → projet', await ligneVisible('Plateforme') && await ligneVisible('Data')
      && !!(await page.$('#table-unites tr[data-chemin~="' + (await page.getAttribute('#table-unites tr:has-text("Data DA")', 'data-id')) + '"]')));
    await page.click('tr:has-text("PF-12") [data-action="deplierProjetArbre"]'); await page.waitForTimeout(200);
    await capture('12-liste-ressources');
    verifier('Liste des ressources : membres d’un projet avec leur rôle', (await lignesUnites()).some(l => /Chef de projet|Membre/.test(l) && !l.startsWith('PF')));
    await page.fill('.recherche-champ input', 'data'); await page.waitForTimeout(150);
    verifier('Liste des ressources : recherche (unité et son contenu)', await ligneVisible('Data') && !(await ligneVisible('Mobile')));
    await page.fill('.recherche-champ input', ''); await page.waitForTimeout(150);
    verifier('Liste des ressources : suppression impossible d’une unité non vide', !!(await page.$('button.btn-icone[disabled][title$="non vide : passez-la en Inactive"]')));
    await page.click('[data-action="nouvelleUnite"][data-type="direction"]');
    await page.fill('form[data-action-envoi="enregistrerEquipe"] input[name=nom]', 'Direction Test');
    await page.fill('form[data-action-envoi="enregistrerEquipe"] input[name=prefixe]', 'DT');
    await page.click('form[data-action-envoi="enregistrerEquipe"] .btn.primaire'); await page.waitForTimeout(400);
    verifier('Liste des ressources : direction ajoutée', await ligneVisible('Direction Test'));
    await page.click('tr:has-text("Direction Test") [data-action="nouvelleUnite"][data-type="equipe"]');
    verifier('Liste des ressources : « + Équipe » pré-rattache à la direction',
      (await page.$eval('select[name=parentId]', s => s.options[s.selectedIndex].text)) === 'Direction Test');
    await page.click('.modale .fermer');
    await page.click('tr:has-text("Direction Test") [data-action="supprimerEquipe"]'); await page.waitForTimeout(400);
    verifier('Liste des ressources : direction vide supprimée', !(await ligneVisible('Direction Test')));
    await page.click('[data-action="ongletListeRessources"][data-id="postes"]'); await page.waitForTimeout(200);
    await capture('18-postes');
    reponsePrompt = 'Développeur back-end';
    await page.click('tr:has-text("Dév. back-end") [data-action="renommerValeurListe"]'); await page.waitForTimeout(400);
    reponsePrompt = 'Merci de compléter';
    await page.click('[data-action="ongletListeRessources"][data-id="organisation"]'); await page.click('[data-action="toutDeplier"]'); await page.waitForTimeout(200);
    verifier('Postes : renommage propagé aux fiches ressources', (await texte()).includes('Développeur back-end'));
    await page.click('tr:has-text("PF-12") [data-action="assigner"]'); await page.waitForTimeout(200);
    await page.selectOption('select[name=ressource]', { index: 3 }); await page.waitForTimeout(200);
    await page.check('input[name=projet] >> nth=0');
    await page.click('.modale .btn.primaire'); await page.waitForTimeout(300);
    verifier('Affectation enregistrée (modale fermée)', !(await page.$('.modale')));
    // « + Membre » → « + Nouveau membre » → retour à l'affectation, personne sélectionnée
    await page.click('tr:has-text("PF-17") [data-action="assigner"]'); await page.waitForTimeout(200);
    await page.click('[data-action="nouvellePersonneAffectation"]'); await page.waitForTimeout(200);
    await page.fill('form[data-action-envoi="enregistrerRessource"] input[name=nom]', 'Nina Test');
    await page.click('form[data-action-envoi="enregistrerRessource"] .btn.primaire'); await page.waitForTimeout(400);
    const choisie = await page.$eval('select[name=ressource]', s => s.options[s.selectedIndex].text);
    const pf17Coche = await page.$eval('label:has-text("PF-17") input[name=projet]', c => c.checked);
    await page.click('.modale .btn.primaire'); await page.waitForTimeout(400);
    verifier('Affectation : personne créée depuis « + Membre » puis affectée', choisie.startsWith('Nina Test') && pf17Coche
      && await page.evaluate(() => etat.d.affectations.some(a => a.ressourceId === etat.d.ressources.find(r => r.nom === 'Nina Test').id)));
    // Projet modifiable depuis l'arborescence : nom, dates
    await page.click('tr:has-text("PF-17") [data-action="ouvrirProjet"]'); await page.waitForTimeout(200);
    await page.fill('.panneau input[data-champ="nom"]', 'Portail développeurs v2'); await page.press('.panneau input[data-champ="nom"]', 'Tab'); await page.waitForTimeout(300);
    verifier('Projet : nom modifié depuis Liste des ressources',
      await page.evaluate(() => { const p = etat.d.projets.find(x => x.code === 'PF-17'); return p.nom === 'Portail développeurs v2'; }));
    await page.click('.panneau .fermer');

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

    /* --- Administratrice sans équipe : entrée directe dans l'outil, création d'équipe --- */
    await page.click('[data-action="deconnexion"]'); await page.waitForSelector('form[data-action-envoi="seConnecter"]');
    await page.fill('input[name=email]', 'admin@test.fr'); await page.fill('input[name=motDePasse]', 'motdepasse'); await page.click('form button');
    await page.waitForSelector('.laterale');
    verifier('Admin sans équipe : arrive dans l’outil (pas l’espace demandeur)', !(await texte()).includes('Espace demandeur') && (await texte()).includes('Dashboard général'));
    await page.click('[data-action="aller"][data-ecran="daily"]'); await page.waitForTimeout(200);
    verifier('Admin sans équipe : Mon dashboard invite à ouvrir une équipe', (await texte()).includes('Aucune équipe ouverte'));
    await page.click('[data-action="aller"][data-ecran="listeRessources"]'); await page.waitForTimeout(200);
    verifier('Admin sans équipe : Liste des ressources ouverte (arborescence)', !(await texte()).includes('Aucune équipe ouverte') && !!(await page.$('#table-unites')));
    await page.click('[data-action="aller"][data-ecran="monAdmin"]'); await page.click('[data-action="ongletMonAdmin"][data-id="equipes"]');
    await page.click('[data-action="nouvelleEquipe"]');
    await page.fill('form[data-action-envoi="enregistrerEquipe"] input[name=nom]', 'Direction Digitale');
    await page.fill('form[data-action-envoi="enregistrerEquipe"] input[name=prefixe]', 'dd');
    await page.click('form[data-action-envoi="enregistrerEquipe"] .btn.primaire'); await page.waitForTimeout(500);
    verifier('Admin : équipe créée et ouverte automatiquement', (await page.textContent('.bloc-equipe')).includes('Direction Digitale'));

    /* --- Connexion Google (aller-retour simulé avec vérificateur de session) --- */
    await page.click('[data-action="deconnexion"]'); await page.waitForSelector('[data-action="connexionGoogle"]');
    await page.click('[data-action="connexionGoogle"]');
    await page.waitForSelector('form[data-action-envoi="deposerDemande"]');
    verifier('Google : session ouverte au retour, vérificateur retiré de l’adresse',
      (await texte()).includes('Gaëlle Google') && !page.url().includes('neon_auth_session_verifier'));
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
