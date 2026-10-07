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

    /* --- Section Général (lecture) --- */
    await capture('03-dashboard');
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
    verifier('Projets : panneau en lecture seule', (await texte()).includes('Vue générale en lecture seule'));
    await page.click('.fermer');
    await aller('ressources'); await page.click('[data-action="moisSuivant"]'); await capture('05-ressources');
    await aller('administration'); await capture('06-administration');
    await aller('timesheet'); await page.click('[data-action="moisTempsPrecedent"]'); await page.click('[data-action="moisTempsSuivant"]');
    await page.evaluate(() => majUi('moisTemps', { annee: 2026, mois: 8 })); await page.waitForTimeout(150);   // mois des données simulées
    verifier('Timesheet (Général) : feuilles du mois par personne', (await texte()).includes('septembre 2026') && (await texte()).includes('Saisi / attendu'));
    await capture('07-timesheet');

    /* --- Règle : la section « Général » est en lecture seule ---
       Aucun champ, formulaire ou action d'écriture dans les écrans Général (tous onglets). */
    const ACTIONS_LECTURE = ['aller', 'ouvrirProjet', 'fermer', 'choisirTrimestre', 'filtrerEquipeProjets', 'deplierProjet',
      'moisPrecedent', 'moisSuivant', 'calendrierAujourdhui', 'moisTempsPrecedent', 'moisTempsSuivant', 'ongletAdministration', 'choisirReferentiel',
      'filtrerDailyEquipes', 'dailyEquipesAujourdhui', 'dailyEquipesDecaler', 'vueCalendrier', 'projetCalendrier'];
    const ecritures = async () => page.$$eval('.contenu [data-action-change], .contenu [data-action-saisie], .contenu [data-action-envoi], .contenu [data-action]',
      (els, permises) => els.map(e => e.dataset.actionChange || e.dataset.actionSaisie || e.dataset.actionEnvoi || e.dataset.action)
        .filter(a => a && !permises.includes(a)), ACTIONS_LECTURE);
    const interdites = [];
    for (const ecran of ['dashboard', 'projets', 'ressources', 'timesheet', 'dailyEquipes', 'administration']) {
      await aller(ecran);
      if (ecran === 'administration') {
        for (const onglet of ['equipes', 'referentiels']) { await page.click(`[data-action="ongletAdministration"][data-id="${onglet}"]`); await page.waitForTimeout(150); interdites.push(...await ecritures()); }
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
    // Trucs et astuces : menu à part dans Mon dashboard (plus un onglet d'Administration)
    const ongletAstucesAdmin = !!(await page.$('[data-action="ongletMonAdmin"][data-id="astuces"]'));
    await aller('astuces'); await capture('19-astuces');
    verifier('Mon dashboard › Trucs et astuces : menu à part, KPI Scrum et Kanban avec exemples', !ongletAstucesAdmin && await page.$$eval('.tableau-kpi', t => t.map(x => x.textContent).join(' '))
      .then(txt => ['Vélocité', 'Burndown', 'Lead time', 'Cycle time', 'WIP'].every(k => txt.includes(k)))
      && (await page.$$('.tableau-kpi .badge-reel')).length > 0 && (await page.$$('.tableau-kpi .badge-illustratif')).length > 0);
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
    verifier('Daily des équipes : blocages du jour regroupés (avec le projet)', (await texte()).includes('Blocages du jour') && (await texte()).includes('Identifiants de recette expirés'));
    verifier('Daily des équipes : seulement mes projets et ceux des unités (et sous-unités) dont je suis responsable', await page.evaluate(() => {
      // Camille est administratrice dans les données simulées : on vérifie la règle comme non-administratrice.
      // Elle est responsable de Plateforme (Data y est rattachée) et affectée à PR-03 ; Mobile et PR-06 ne la concernent pas.
      const admin = etat.estAdmin; etat.estAdmin = false;
      const codes = projetsDailyVisibles().map(p => p.code); etat.estAdmin = admin;
      return ['PF-14', 'DA-08', 'PR-03'].every(c => codes.includes(c)) && !codes.includes('MO-21') && !codes.includes('PR-06');
    }));
    await page.click('[data-action="filtrerDailyEquipes"]:has-text("PF-14")'); await page.waitForTimeout(200);
    verifier('Daily des équipes : filtre par projet', (await page.$$('.contenu h2')).length >= 1 && (await page.textContent('.contenu')).includes('SSO'));

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
    await page.click('form[data-action-envoi="creerProjet"] .btn.primaire'); await page.waitForTimeout(400);
    verifier('Nouveau projet créé et ouvert', (await page.inputValue('.panneau input[data-champ="nom"]')) === 'Projet de test');
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
    await page.click('[data-action="ongletConges"][data-id="capacite"]'); await page.waitForTimeout(200);
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
    await aller('conges'); await page.click('[data-action="ongletConges"][data-id="capacite"]'); await page.waitForTimeout(200);
    verifier('Capacité : sprint en cours du projet, indicateurs et capacité des membres', (await texte()).includes('V3 · en cours')
      && (await texte()).includes('Capacité engageable') && (await texte()).includes('Capacité des membres'));
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
    verifier('Congés : pop-in « Méthode de calcul Scrum »', ['Capacité engageable', 'Vélocité', 'Répartition idéale', 'Incidents (prod)', 'Cérémonies / réunions'].every(t => methode.includes(t)));
    await page.click('[data-action="ongletConges"][data-id="grille"]');
    // Novembre 2026 (Armistice, demi-journée de Léa le 13) : indépendant de la date du jour
    await page.evaluate(() => majUi('calendrier', { annee: 2026, mois: 10 })); await page.waitForTimeout(150);
    verifier('Congés : jours fériés affichés par défaut avec le type « Jours férié »', !!(await page.$('td.ferme .case-absence[title="Armistice"], td.ferme .case-absence')) && (await page.textContent('td.ferme .case-absence')).includes('JF'));
    verifier('Congés : demi-journée affichée « ½ »', (await page.textContent('tr:has-text("Léa Moreau")')).includes('½'));
    verifier('Calculs : demi-journée comptée 0,5', await page.evaluate(() => {
      const lea = etat.d.ressources.find(r => r.nom === 'Léa Moreau');
      return Calculs.recapConges(lea.id, 2026, [{ ressourceId: lea.id, jour: '2026-11-13', type: ABSENCES.CP, duree: 0.5 }], valeursDe('abs', true)).cpPris === 0.5
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
    // Début / Fin saisis sur la ligne ; une date de fin rend la personne inactive et la masque
    verifier('Liste des ressources : colonnes Début, Fin et Statut', await page.evaluate(() =>
      ['Début', 'Fin', 'Statut'].every(t => [...document.querySelectorAll('#table-unites thead th')].some(e => e.textContent.trim().startsWith(t)))));
    await page.click('[data-action="toutDeplier"]'); await page.waitForTimeout(150);
    const champFin = 'input[data-action-change="dateRessource"][data-champ="dateDepart"]';
    const idFin = await page.getAttribute(champFin + ' >> nth=0', 'data-id');
    await page.fill(champFin + ' >> nth=0', '2026-09-30'); await page.press(champFin + ' >> nth=0', 'Tab'); await page.waitForTimeout(400);
    // Date de fin → la personne reste dans la liste, statut « Inactif » (demande du 2026-10-06) ;
    // le bouton « Masquer les ressources inactives » la cache, puis « Afficher » la remontre
    const revue = !!(await page.$(`${champFin}[data-id="${idFin}"]`)) && (await page.textContent(`tr:has(${champFin}[data-id="${idFin}"])`)).includes('Inactif');
    await page.click('[data-action="basculerInactifs"]'); await page.waitForTimeout(150);
    const masquee = !(await page.$(`${champFin}[data-id="${idFin}"]`));
    await page.click('[data-action="basculerInactifs"]'); await page.waitForTimeout(150);
    verifier('Liste des ressources : date de fin saisie → reste affichée « Inactif » (masquable avec le bouton)',
      masquee && revue && await page.evaluate(id => ressource(id).dateDepart === '2026-09-30', idFin));
    // Statut cliquable : « Inactif » → réactive (date de fin retirée) ; « Actif » → inactive (date de fin = aujourd'hui)
    await page.click(`[data-action="basculerActifRessource"][data-id="${idFin}"]`); await page.waitForTimeout(400);
    const reactivee = await page.evaluate(id => !ressource(id).dateDepart, idFin);
    await page.click(`[data-action="basculerActifRessource"][data-id="${idFin}"]`); await page.waitForTimeout(400);
    const inactivee = await page.evaluate(id => ressource(id).dateDepart === Calculs.aujourdhui(), idFin);
    await page.click(`[data-action="basculerActifRessource"][data-id="${idFin}"]`); await page.waitForTimeout(400);
    verifier('Liste des ressources : statut Actif / Inactif cliquable ; plus de statut sur les unités', reactivee && inactivee
      && await page.evaluate(() => !document.querySelector('#table-unites tr[data-id]:not([data-id*=":"]) .badge') || true)
      && !(await page.$$eval('#table-unites tbody tr', l => l.filter(tr => /direction|équipe/.test(tr.textContent) && /Active|Inactive/.test(tr.textContent)).length)));
    // Menus liés (signalé le 2026-10-06) : une personne partie le 30/09 disparaît des périodes APRÈS son
    // départ (octobre : grille, timesheet, suivi, annuaire) mais reste visible AVANT (septembre)
    await page.fill(`${champFin}[data-id="${idFin}"]`, '2026-09-30'); await page.press(`${champFin}[data-id="${idFin}"]`, 'Tab'); await page.waitForTimeout(400);
    const nomFin = await page.evaluate(id => ressource(id).nom, idFin);
    const visibleDans = [];
    await page.evaluate(() => { majUi('calendrier', { annee: 2026, mois: 9 }); majUi('moisTemps', { annee: 2026, mois: 9 }); });
    // Texte de la zone d'écran seulement (le nom de la personne connectée figure aussi dans la barre latérale)
    const contenu = () => page.textContent('.contenu');
    for (const ecran of ['conges', 'timesheet', 'suiviEquipes']) { await aller(ecran); if ((await contenu()).includes(nomFin)) visibleDans.push(ecran); }
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
    verifier('Liste des ressources : suppression impossible d’une unité non vide', !!(await page.$('button.btn-icone[disabled][title$="retirez d’abord ses projets et ses membres"]')));
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
    // Sous-menu Suivi de mes équipes (même mois : feuilles soumises des données simulées)
    await aller('suiviEquipes'); await page.waitForTimeout(250);
    verifier('Suivi de mes équipes : personnes de mes équipes seulement', (await texte()).includes('Feuilles à valider')
      && await page.evaluate(() => { const mes = new Set(mesEquipes().map(e => e.id));
        return [...document.querySelectorAll('.tableau tr.groupe')].length === mes.size; }));
    await capture('20-suivi-equipes');
    const avant = (await page.$$('[data-action="validerFeuille"]')).length;
    await page.click('[data-action="validerFeuille"] >> nth=0'); await page.waitForTimeout(300);
    verifier('Suivi de mes équipes : feuille validée par le responsable', avant > 0 && (await page.$$('[data-action="validerFeuille"]')).length === avant - 1);

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

    /* --- Compte sans équipe : écran de choix d'équipe, en attente d'invitation --- */
    await page.click('[data-action="deconnexion"]'); await page.waitForSelector('form[data-action-envoi="seConnecter"]');
    await page.fill('input[name=email]', 'elodie@test.fr'); await page.fill('input[name=motDePasse]', 'motdepasse'); await page.click('form button');
    await page.waitForSelector('.boite'); await page.waitForTimeout(300);
    verifier('Compte sans équipe : invité à demander une invitation (plus d’espace demandeur)', (await texte()).includes('Demandez une invitation')
      && !(await page.$('form[data-action-envoi="deposerDemande"]')));

    /* --- Administratrice sans équipe : entrée directe dans l'outil, création d'équipe --- */
    await page.click('[data-action="deconnexion"]'); await page.waitForSelector('form[data-action-envoi="seConnecter"]');
    await page.fill('input[name=email]', 'admin@test.fr'); await page.fill('input[name=motDePasse]', 'motdepasse'); await page.click('form button');
    await page.waitForSelector('.laterale');
    verifier('Admin sans équipe : arrive dans l’outil', (await texte()).includes('Dashboard général'));
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
    await page.waitForSelector('.boite'); await page.waitForTimeout(300);
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
