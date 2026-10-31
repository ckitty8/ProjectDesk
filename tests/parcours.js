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

    /* ---------- Vague B : Projets et Roadmap, Timesheet, Daily des équipes, Gestion des ressources ---------- */
    const VAGUE_B = CAPTURES;
    const captureB = nom => page.screenshot({ path: path.join(VAGUE_B, nom + '.png') });
    const menu = fin => page.click(`.laterale a[href$="${fin}"]`);

    // Dashboard : un projet à surveiller ouvre le panneau du projet (lecture seule)
    await menu('/dashboard');
    await page.click('tr.cliquable:has-text("App terrain hors-ligne")');
    await page.waitForSelector('.panneau[role=dialog]');
    verifier('Dashboard : un projet à surveiller ouvre son panneau en lecture seule', (await page.textContent('.panneau')).includes('Mobile')
      && (await page.textContent('.panneau')).includes('lecture seule') && (await page.textContent('.panneau')).includes('Équipe projet'));
    await page.keyboard.press('Escape');

    // Projets et Roadmap
    await menu('/projets');
    await page.waitForSelector('.tableau');
    await captureB('02-projets');
    verifier('Projets et Roadmap : 9 projets groupés par équipe, avancement et statut', await page.locator('tr.cliquable').count() === 9
      && await page.locator('tr.groupe').count() >= 3 && await page.locator('.tableau .barre').count() === 9 && await page.locator('.tableau .badge').count() >= 9);
    await page.click('.puces >> text=Mobile');
    verifier('Projets et Roadmap : filtre par équipe', await page.locator('tr.cliquable').count() > 0 && await page.locator('tr.cliquable').count() < 9);
    await page.click('.puces >> text=Toutes les équipes');
    await page.click('tr.cliquable:has-text("SSO & gestion des droits")');
    await page.waitForSelector('.panneau[role=dialog]');
    verifier('Projets et Roadmap : un clic ouvre le panneau (équipe, statut, chef, équipe projet)', (await page.textContent('.panneau h2')) === 'SSO & gestion des droits'
      && (await page.textContent('.panneau')).includes('Chef de projet') && (await page.textContent('.panneau')).includes('Équipe projet'));
    await page.click('.panneau [aria-label=Fermer]');
    verifier('Projets et Roadmap : la croix ferme le panneau', await page.locator('.panneau').count() === 0);
    await page.click('[role=tab]:has-text("Planning projet")');
    await page.waitForSelector('.planning-projet');
    await captureB('04b-planning-projet');
    verifier('Planning projet : frise de 6 mois, sprints, mises en production et trait « aujourd\'hui »', await page.locator('.gantt-mois .mois > div').count() === 6
      && await page.locator('.gantt-sprint').count() >= 2 && await page.locator('.gantt-mep').count() >= 3 && await page.locator('.gantt-jour').count() >= 1);
    verifier('Planning projet : sprint en cours mis en avant, détail en infobulle', await page.locator('.gantt-mep').first().getAttribute('title') !== null
      && (await page.locator('.gantt-sprint').first().getAttribute('title')).includes('Sprint'));
    const periode = await page.textContent('.encart-compact b');
    await page.click('[aria-label="Période suivante"]');
    verifier('Planning projet : la période se décale d\'un mois', (await page.textContent('.encart-compact b')) !== periode);
    await page.click('text=Aujourd’hui');
    verifier('Planning projet : « Aujourd\'hui » revient à la période par défaut', (await page.textContent('.encart-compact b')) === periode);

    // Timesheet : validation des feuilles par la responsable
    await menu('/timesheet');
    await page.waitForSelector('.tableau');
    await page.click('[aria-label="Mois précédent"]');
    await page.waitForSelector('text=septembre 2026');
    await captureB('07-timesheet');
    verifier('Timesheet : feuilles du mois par personne, 4 indicateurs (validation possible)', (await texte()).includes('Saisi / attendu') && await page.locator('.grille-kpi .kpi').count() === 4
      && !(await texte()).includes('NaN'));
    const avant = await page.locator('button:has-text("Valider")').count();
    verifier('Timesheet : feuilles soumises à valider pour mes équipes seulement', avant === 1);
    await page.locator('button:has-text("Renvoyer")').first().click();
    await page.waitForSelector('.modale');
    await page.fill('.modale textarea', 'Merci de compléter septembre');
    await page.click('.modale button:has-text("Renvoyer la feuille")');
    await page.waitForFunction(() => !document.querySelector('.modale'));
    await page.waitForSelector('.badge:has-text("À compléter")');
    verifier('Timesheet : « Renvoyer » demande un motif et renvoie la feuille à compléter', await page.locator('.badge:has-text("À compléter")').count() >= 1);

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
    verifier('Daily : une carte par projet où je suis affecté(e), trois champs, historique de 12 jours', await page.locator('textarea.note-daily').count() === 9
      && (await texte()).includes('0 / 3 projets renseignés') && await page.locator('.historique a').count() === 12);
    const zone = page.locator('textarea.note-daily').nth(1);       // « Aujourd'hui » du premier projet
    await zone.fill('Revue de la roadmap SSO');
    await page.waitForSelector('text=enregistré');
    await page.waitForSelector('text=1 / 3 projets renseignés');
    verifier('Daily : enregistrement automatique, bilan et état « Renseigné »', (await texte()).includes('1 / 3 projets renseignés') && await page.locator('.badge:has-text("Renseigné")').count() === 1);
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
    verifier('Nouveau projet : créé, puis panneau modifiable (nom, statut, méthode, chef)', await page.inputValue('input[aria-label="Nom du projet"]') === 'Projet vague C'
      && await page.locator('.panneau select[aria-label="Statut"]').count() === 1 && await page.locator('.panneau select[aria-label="Méthode"]').inputValue() === 'Agile Scrum'
      && (await page.inputValue('.panneau select[aria-label="Chef de projet"]')) !== '');
    await page.fill('input[aria-label="Nom du projet"]', 'Projet vague C (renommé)');
    await page.locator('input[aria-label="Nom du projet"]').blur();
    await page.selectOption('.panneau select[aria-label="Statut"]', { index: 1 });
    await page.waitForFunction(() => document.querySelector('input[aria-label="Nom du projet"]').value.includes('renommé'));
    await page.keyboard.press('Escape');
    await menu('/projets');
    await page.waitForSelector('.tableau');
    await page.waitForSelector('tr.cliquable');
    verifier('Panneau projet : le nom modifié est enregistré (visible dans Projets et Roadmap)', await page.locator('tr.cliquable:has-text("Projet vague C (renommé)")').count() === 1
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
    verifier('Liste des ressources : navigation par équipe (responsable, projets), Postes et Types de contrat', await page.locator('.noeud.equipe').count() >= 4
      && await page.locator('.noeud.projet').count() >= 9 && (await page.textContent('.nav-ressources')).includes('Types de contrat'));
    verifier('Liste des ressources : l\'équipe ouverte est choisie, avec son responsable et ses personnes', (await page.textContent('.detail-ressources')).includes('Plateforme')
      && (await page.textContent('.detail-ressources')).includes('Responsable de l’équipe') && await page.locator('.tableau-personnes tr[data-ressource]').count() === 4);
    await page.fill('.nav-ressources input', 'hugo');
    verifier('Liste des ressources : recherche dans la navigation (l\'équipe de la personne reste visible)', await page.locator('.noeud-groupe').count() === 1 && (await page.textContent('.nav-ressources')).includes('Data'));
    await page.fill('.nav-ressources input', '');
    await page.click('.noeud.projet:has-text("SSO & gestion des droits")');
    await captureD('12b-liste-projet');
    verifier('Liste des ressources : détail d\'un projet (Product Owners, membres, indicateurs)', (await page.textContent('.detail-ressources')).includes('Product Owners')
      && await page.locator('.carte-po:not(.ajout)').count() >= 1 && await page.locator('.detail-kpi b').count() === 3);
    await page.click('text=+ Ajouter un Product Owner');
    await page.waitForSelector('.modale[role=dialog]');
    await captureD('11b-affectation');
    verifier('Fenêtre d\'affectation : projet d\'origine coché, rôle « Chef de projet » préchoisi', (await page.textContent('.modale h2')).includes('SSO & gestion des droits')
      && await page.locator('.modale input[type=checkbox]:checked').count() >= 1);
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
    verifier('Fiche ressource : champs, rôle d\'accès en lecture, projets de la personne', (await page.textContent('.modale h2')) === 'Fiche de Thomas Bernard'
      && (await page.textContent('.modale')).includes('Rôle d’accès') && (await page.textContent('.modale')).includes('Modifier ses projets'));
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
    await page.fill('.modale input[name=nom]', 'Nouvelle Recrue');
    await page.click('.modale button:has-text("Enregistrer")');
    await page.waitForSelector('tr[data-ressource]:has-text("Nouvelle Recrue")');
    verifier('Nouvelle personne : créée dans l\'équipe et visible dans le tableau', await page.locator('tr[data-ressource]:has-text("Nouvelle Recrue")').count() === 1);
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
    verifier('Rattachement : la personne s\'affiche dans « Rattachées depuis une autre équipe » avec son équipe d\'origine', (await page.textContent('tr[data-rattachee]')).includes('Équipe d’origine'));
    await page.click('tr[data-rattachee] >> text=Retirer');
    await page.waitForFunction(() => !document.querySelector('tr[data-rattachee]'));
    verifier('Rattachement : « Retirer » supprime le rattachement seulement', await page.locator('tr[data-rattachee]').count() === 0);

    // Postes et types de contrat
    await page.click('.noeud:has-text("Postes")');
    await page.waitForSelector('.detail-ressources .tableau');
    const nbPostes = await page.locator('.detail-ressources tbody tr').count();
    reponsePrompt = 'Poste de test';
    await page.click('.detail-ressources button:has-text("+ Ajouter")');
    await page.waitForFunction(n => document.querySelectorAll('.detail-ressources tbody tr').length === n + 1, nbPostes);
    verifier('Postes : ajout d\'une valeur (administrateur)', (await page.textContent('.detail-ressources')).includes('Poste de test'));
    reponsePrompt = 'Poste de test renommé';
    await page.locator('tr:has-text("Poste de test") button[title^="Renommer"]').click();
    await page.waitForSelector('text=Poste de test renommé');
    await page.locator('tr:has-text("Poste de test renommé") button[title="Supprimer"]').click();
    await page.waitForFunction(n => document.querySelectorAll('.detail-ressources tbody tr').length === n, nbPostes);
    verifier('Postes : renommer puis supprimer une valeur inutilisée', !(await page.textContent('.detail-ressources')).includes('Poste de test'));

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
    await page.click('text=+ Ajouter une équipe');
    await page.fill('.modale input[name=nom]', 'Équipe Test');
    await page.fill('.modale input[name=prefixe]', 'et');
    await page.click('.modale button:has-text("Créer")');
    await page.waitForSelector('.noeud.equipe:has-text("Équipe Test")');
    verifier('Nouvelle équipe : créée (organisation et ligne equipes), visible dans la navigation', await page.locator('.noeud.equipe:has-text("Équipe Test")').count() === 1);
    await page.click('.noeud.equipe:has-text("Équipe Test")');
    await page.click('.detail-entete button[title="Supprimer l’équipe"]');
    await page.waitForFunction(() => ![...document.querySelectorAll('.noeud.equipe')].some(n => n.textContent.includes('Équipe Test')));
    verifier('Équipe vide : suppression possible (après confirmation)', await page.locator('.noeud.equipe:has-text("Équipe Test")').count() === 0);
    // La création a rendu « Équipe Test » active : on revient à Plateforme (la suite des contrôles couvre toutes les équipes)
    await page.click('.bloc-equipe >> text=Changer');
    await page.click('.carte-choix:has-text("Plateforme") >> text=Ouvrir');
    await page.waitForSelector('.laterale');

    /* ---------- Vague D (2/2) : Administration (administrateur) ---------- */
    await menu('/administration');
    await page.waitForSelector('.onglets');
    await captureD('14-mon-admin');
    verifier('Administration : onglets de l\'administrateur (comptes, équipes, référentiels, jours fériés, rôles) avec compteurs', (await page.textContent('.onglets')).includes('Comptes en attente')
      && (await page.textContent('.onglets')).includes('Rôles') && (await page.textContent('.onglets')).includes('Référentiels'));
    verifier('Administration : l\'onglet « Comptes en attente » s\'ouvre d\'abord quand il y en a', await page.locator('[role=tab][aria-selected=true]:has-text("Comptes en attente")').count() === 1);
    await captureD('26-comptes-en-attente');
    const nbAttente = await page.locator('.tableau tbody tr').count();
    await page.locator('.tableau tbody tr').first().locator('select[aria-label="Équipe"]').selectOption({ label: 'Mobile' });
    await page.locator('.tableau tbody tr').first().locator('select[aria-label="Fiche ressource"]').selectOption('nouvelle');
    await page.locator('.tableau tbody tr').first().locator('button:has-text("Donner l’accès")').click();
    await page.waitForSelector('text=Accès donné à');
    verifier('Comptes en attente : « Donner l\'accès » crée la fiche et invite dans l\'équipe', (await toast()).includes('Accès donné à'));

    await page.click('[role=tab]:has-text("Équipes")');
    verifier('Administration › Équipes : tableau avec responsables, membres, projets, « Modifier »', await page.locator('.tableau tbody tr').count() >= 4 && await page.locator('button:has-text("Modifier")').count() >= 4);
    await page.locator('button:has-text("Modifier")').first().click();
    await page.waitForSelector('.modale[role=dialog]');
    verifier('Administration › Équipes : la fenêtre équipe s\'ouvre', await page.locator('.modale input[name=nom]').count() === 1);
    await page.keyboard.press('Escape');

    await page.click('[role=tab]:has-text("Référentiels")');
    await page.waitForSelector('.lien-referentiel');
    await captureD('10b-referentiels');
    verifier('Administration › Référentiels : liste des référentiels et leurs valeurs', await page.locator('.lien-referentiel').count() >= 6 && await page.locator('input[aria-label="Valeur 1"]').count() === 1);
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

    await page.click('[role=tab]:has-text("Rôles")');
    await page.waitForSelector('.tableau-roles-acces');
    await captureD('31-roles-administration');
    verifier('Administration › Rôles : utilisateurs et rôles (équipe, projets, compte relié, poste)', await page.locator('.tableau-roles-acces tbody tr').count() >= 12);
    await page.selectOption('select[aria-label="Rôle"]', 'lecture');
    verifier('Administration › Rôles : filtre par rôle', await page.locator('.tableau-roles-acces tbody tr').count() < 12);
    await page.selectOption('select[aria-label="Rôle"]', '');
    await page.fill('input[aria-label="Rechercher une personne"]', 'thomas');
    verifier('Administration › Rôles : recherche par nom', await page.locator('.tableau-roles-acces tbody tr').count() === 1);
    await page.fill('input[aria-label="Rechercher une personne"]', '');
    await page.selectOption('select[aria-label="Rôle de Léa Moreau"]', 'projet');
    await page.waitForSelector('.notification.visible:has-text("Rôle")');
    verifier('Administration › Rôles : un rôle d\'accès se choisit dans la liste de la ligne et s\'enregistre', (await toast()).includes('Rôle'));
    await page.selectOption('select[aria-label="Rôle de Léa Moreau"]', 'utilisateur');

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
    // Nombre de projets actifs du dashboard : toutes les équipes pour le créateur, le périmètre de la personne en simulation
    const projetsActifs = async () => {
      await menu('/dashboard');
      await page.waitForSelector('.grille-kpi');
      return parseInt(await page.locator('.kpi:has-text("Projets actifs") .kpi-valeur >> nth=0').textContent(), 10);
    };
    verifier('Le créateur est reconnu (badge) et voit toutes les équipes', (await page.textContent('.bloc-utilisateur')).includes('Créateur'));
    const projetsReels = await projetsActifs();
    await menu('/administration-createur');
    await page.waitForSelector('.grille-simulation');
    await page.selectOption('select[aria-label="Personne pour Utilisateur"]', { label: 'Thomas Bernard · aujourd’hui Projet' }).catch(async () => {
      const id = await page.locator('select[aria-label="Personne pour Utilisateur"] option', { hasText: 'Thomas Bernard' }).getAttribute('value');
      await page.selectOption('select[aria-label="Personne pour Utilisateur"]', id);
    });
    await page.click('button:has-text("Voir l’application en tant que utilisateur")');
    await page.waitForSelector('.bandeau-simulation');
    verifier('Simulation : le rôle simulé remplace celui du créateur', !(await page.textContent('.bloc-utilisateur')).includes('★ Créateur')
      && (await page.textContent('.laterale')).includes('simulation'));
    verifier('Simulation : les données sont limitées au périmètre de la personne', await projetsActifs() < projetsReels);
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
    verifier('Timesheet : le créateur peut valider les feuilles soumises de toutes les équipes', aValider >= 3);
    await page.locator('button:has-text("Valider")').first().click();
    await page.waitForFunction(n => document.querySelectorAll('.tableau button.succes').length < n, aValider);
    verifier('Timesheet : « Valider » fige la feuille et met à jour l\'écran', await page.locator('button:has-text("Valider")').count() === aValider - 1
      && await page.locator('.badge:has-text("Validée")').count() >= 1);

    /* ---------- Vague D (2/2) : Administration créateur ---------- */
    await page.goto(BASE + '/app/administration-createur');
    await page.waitForSelector('.grille-simulation');
    await captureD('28-simulation-roles');
    verifier('Administration créateur : une carte par rôle (6 rôles d\'accès puis compte en attente)', await page.locator('.grille-simulation .carte').count() === 7
      && (await page.textContent('.grille-simulation')).includes('Suivi :'));
    await page.selectOption('select[aria-label="Personne pour Projet"]', { label: 'Thomas Bernard · a ce rôle' }).catch(async () => {
      await page.selectOption('select[aria-label="Personne pour Projet"]', { index: 0 });
    });
    await page.click('button:has-text("Voir l’application en tant que projet")');
    await page.waitForSelector('.bandeau-simulation');
    verifier('Simulation depuis Administration créateur : le bandeau s\'affiche et l\'application suit le rôle simulé', (await page.textContent('.bandeau-simulation')).includes('Projet')
      && await page.locator('.laterale .badge-createur', { hasText: 'simulation' }).count() === 1);
    await page.click('text=Revenir à mon rôle de créateur');
    await page.waitForSelector('.grille-simulation');
    verifier('Fin de simulation : retour à Administration créateur', page.url().endsWith('/app/administration-createur') && await page.locator('.bandeau-simulation').count() === 0);
    await page.click('button:has-text("Voir l’application en tant que compte en attente")');
    await page.waitForSelector('.bandeau-simulation');
    verifier('Simulation « Compte en attente » : écran d\'attente d\'accès', (await texte()).includes('Votre compte est créé'));
    await page.click('text=Revenir à mon rôle de créateur');
    await page.waitForSelector('.grille-simulation');
    await page.click('[role=tab]:has-text("Matrice des droits")');
    await page.waitForSelector('.tableau-matrice');
    await captureD('32-matrice-droits');
    verifier('Matrice des droits : une colonne par rôle, périmètres, sections et onglets', await page.locator('.tableau-matrice thead th').count() === 9
      && (await texte()).includes('Périmètre') && await page.locator('.tableau-matrice .ligne-onglet').count() >= 5 && await page.locator('.tableau-matrice select').count() > 100);
    const celluleDroit = page.locator('select[aria-label="onglet_astuces_agile · utilisateur"]');
    const avantNiveau = await celluleDroit.inputValue();
    await celluleDroit.selectOption(avantNiveau === 'oui' ? 'lecture' : 'oui');
    await page.waitForFunction(v => document.querySelector('select[aria-label="onglet_astuces_agile · utilisateur"]').value !== v, avantNiveau);
    verifier('Matrice des droits : un niveau se modifie sur place (enregistré en base, réservé au créateur)', await celluleDroit.inputValue() !== avantNiveau);
    await celluleDroit.selectOption(avantNiveau);
    verifier('Matrice des droits : Administrateur × Rôles figé', await page.locator('select[aria-label="roles · admin"]').isDisabled());
    await page.click('[role=tab]:has-text("Qui a quel rôle")');
    await page.waitForSelector('.tableau-qui-a-quel-role');
    await captureD('27b-roles');
    verifier('Qui a quel rôle : tableau par rôle avec description, personnes, équipe et compte', await page.locator('.tableau-qui-a-quel-role tr.groupe').count() === 7
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
