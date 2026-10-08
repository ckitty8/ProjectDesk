/* ============================================================
   Règles de calcul (un seul endroit — règle n°4 de CLAUDE.md)
   ------------------------------------------------------------
   Fonctions pures : elles reçoivent des données et renvoient un
   résultat, sans lire l'état global ni toucher au DOM. Les écrans
   les appellent ; ils ne recalculent rien eux-mêmes.
   ============================================================ */
'use strict';

const Calculs = (() => {

  /* ---------- Dates (format ISO « AAAA-MM-JJ », sans fuseau) ---------- */
  const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const MOIS_LONGS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const JOURS_LONGS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const JOURS_INITIALES = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

  const deux = n => String(n).padStart(2, '0');
  const versIso = d => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
  function depuisIso(iso) { const [a, m, j] = iso.split('-').map(Number); return new Date(a, m - 1, j); }
  const aujourdhui = () => versIso(new Date());
  function ajouterJours(iso, n) { const d = depuisIso(iso); d.setDate(d.getDate() + n); return versIso(d); }
  const ecartJours = (isoA, isoB) => Math.round((depuisIso(isoB) - depuisIso(isoA)) / 86400000);

  const estWeekend = iso => [0, 6].includes(depuisIso(iso).getDay());
  // feries : Set de dates ISO (table jours_feries)
  const estJourOuvre = (iso, feries) => !estWeekend(iso) && !feries.has(iso);

  // Lundi de la semaine contenant la date
  function lundi(iso) { const d = depuisIso(iso); const decalage = (d.getDay() + 6) % 7; d.setDate(d.getDate() - decalage); return versIso(d); }
  // Lundi → vendredi de la semaine qui commence au lundi donné
  const joursOuvresSemaine = lundiIso => [0, 1, 2, 3, 4].map(i => ajouterJours(lundiIso, i));
  // Jours ouvrés (hors week-ends et fériés) entre deux dates ISO incluses — export du daily
  function joursOuvresEntre(debut, fin, feries) {
    const jours = [];
    for (let j = debut; j <= fin; j = ajouterJours(j, 1)) if (estJourOuvre(j, feries)) jours.push(j);
    return jours;
  }

  function joursDuMois(annee, mois) {
    const nb = new Date(annee, mois + 1, 0).getDate();
    return Array.from({ length: nb }, (_, i) => versIso(new Date(annee, mois, i + 1)));
  }

  const formatCourt = iso => { if (!iso) return '—'; const d = depuisIso(iso); return `${d.getDate()} ${MOIS_COURTS[d.getMonth()]}`; };
  const formatAvecAnnee = iso => { if (!iso) return '—'; const d = depuisIso(iso); return `${d.getDate()} ${MOIS_COURTS[d.getMonth()]} ${d.getFullYear()}`; };
  function formatLong(iso) {
    const d = depuisIso(iso); const jour = JOURS_LONGS[d.getDay()];
    return `${jour[0].toUpperCase()}${jour.slice(1)} ${d.getDate()} ${MOIS_LONGS[d.getMonth()]} ${d.getFullYear()}`;
  }
  const libelleMois = (annee, mois) => `${MOIS_LONGS[mois]} ${annee}`;
  const trimestreDe = iso => Math.floor(depuisIso(iso).getMonth() / 3) + 1;
  // Nombre affiché à la française (virgule, 1 décimale max)
  const nombre = n => String(Math.round(n * 10) / 10).replace('.', ',');
  const pourcent = n => Math.round(n) + '%';
  const moyenne = liste => liste.length ? liste.reduce((a, b) => a + b, 0) / liste.length : 0;

  /* ---------- Sprints (2 semaines, numérotés depuis le sprint de référence) ---------- */
  function sprintDe(iso) {
    const ref = CONFIG.SPRINT_REFERENCE;
    const index = Math.floor(ecartJours(ref.debut, iso) / CONFIG.DUREE_SPRINT_JOURS);
    const debut = ajouterJours(ref.debut, index * CONFIG.DUREE_SPRINT_JOURS);
    // Le sprint se termine le vendredi de sa 2e semaine
    return { numero: ref.numero + index, debut, fin: ajouterJours(debut, CONFIG.DUREE_SPRINT_JOURS - 3) };
  }

  /* Vélocité (Scrum) : moyenne des points terminés sur les sprints de référence ; prévision du
     sprint = vélocité × (capacité du sprint ÷ capacité moyenne des sprints de référence), pour
     tenir compte des absences. `historique` = [{ points, capacite }]. */
  function velocite(historique, capaciteSprint) {
    const moyennePoints = moyenne(historique.map(h => h.points));
    const moyenneCapacite = moyenne(historique.map(h => h.capacite));
    return { velocite: moyennePoints, capaciteMoyenne: moyenneCapacite,
      prevision: moyenneCapacite ? moyennePoints * capaciteSprint / moyenneCapacite : 0 };
  }
  // Répartition idéale d'un sprint : jours par catégorie = jours disponibles × part (REPARTITION_SPRINT)
  const repartitionSprint = disponible => REPARTITION_SPRINT.map(c => ({ ...c, jours: disponible * c.part / 100 }));

  /* ---------- Projets ---------- */
  const estTermine = p => p.statut === STATUTS_PROJET.TERMINE;
  const projetsActifs = projets => projets.filter(p => !estTermine(p));
  const avancementMoyen = projets => moyenne(projets.map(p => p.avancement || 0));

  // À surveiller : à risque, en retard, ou échéance proche (non terminés)
  function projetsASurveiller(projets, dateIso) {
    return projetsActifs(projets).filter(p =>
      [STATUTS_PROJET.A_RISQUE, STATUTS_PROJET.EN_RETARD].includes(p.statut) ||
      (p.fin && ecartJours(dateIso, p.fin) <= CONFIG.ALERTE_ECHEANCE_JOURS && ecartJours(dateIso, p.fin) >= 0));
  }

  /* ---------- Objectifs (OKR) ---------- */
  // Progression d'un objectif = moyenne des progressions de ses résultats clés
  const progressionObjectif = resultatsCles => moyenne(resultatsCles.map(k => k.progression || 0));

  // Atteinte moyenne des OKR d'une équipe sur un trimestre (null si aucun objectif)
  function atteinteTrimestre(objectifs, resultatsCles, equipeId, annee, trimestre) {
    const objs = objectifs.filter(o => o.equipeId === equipeId && o.annee === annee && o.trimestre === trimestre);
    if (!objs.length) return null;
    return moyenne(objs.map(o => progressionObjectif(resultatsCles.filter(k => k.objectifId === o.id))));
  }

  /* ---------- Congés ---------- */
  // Durée d'une absence en jours : 1 (journée) ou 0,5 (demi-journée, migration 009)
  const dureeAbsence = a => Number(a.duree ?? 1);
  const sommeDurees = liste => liste.reduce((s, a) => s + dureeAbsence(a), 0);

  // Jours travaillés / non travaillés d'une personne sur un mois — reprise de l'onglet « Jours de congés »
  // du fichier du porteur (Calendrier_2026.xlsx), sur les jours de semaine du mois :
  // - congés = absences de tout type posées sur ces jours (demi-journée = 0,5), fériés NON compris
  //   (demande du porteur 2026-09-27 : la colonne C doit correspondre aux congés du calendrier) ;
  // - fériés = jours fériés tombant en semaine (non travaillés, mais ce ne sont pas des congés) ;
  // - travaillés = jours de semaine − fériés − congés.
  // - presence (fiche de la personne : dateArrivee / dateDepart, facultatives) : les jours hors
  //   présence ne comptent ni en travaillés ni en congés (voir estPresent).
  function joursTravaillesMois(ressourceId, annee, mois, absences, feries, presence = {}) {
    const semaine = joursDuMois(annee, mois).filter(j => !estWeekend(j) && estPresent(presence, j));
    const absent = new Map(absences.filter(a => a.ressourceId === ressourceId).map(a => [a.jour, dureeAbsence(a)]));
    const nbFeries = semaine.filter(j => feries.has(j)).length;
    const conges = semaine.filter(j => !feries.has(j)).reduce((s, j) => s + (absent.get(j) || 0), 0);
    return { ouvres: semaine.length, feries: nbFeries, travailles: semaine.length - nbFeries - conges, conges };
  }
  // Récap annuel d'une personne : 12 mois, totaux, et « reste à prendre » = total travaillé − objectif
  // (jours de travail attendus par le client pour l'équipe et l'année ; négatif = jours pris en trop)
  // Arrivée ou départ en cours d'année (décision du porteur 2026-09-27) : objectif proratisé =
  // objectif × jours de semaine de présence ÷ jours de semaine de l'année, arrondi à la demi-journée.
  function recapJoursTravailles(ressourceId, annee, absences, feries, objectif, presence = {}) {
    const mois = Array.from({ length: 12 }, (_, m) => joursTravaillesMois(ressourceId, annee, m, absences, feries, presence));
    const travailles = mois.reduce((s, m) => s + m.travailles, 0), conges = mois.reduce((s, m) => s + m.conges, 0);
    const ouvresAnnee = Array.from({ length: 12 }, (_, m) => joursDuMois(annee, m).filter(j => !estWeekend(j)).length).reduce((a, b) => a + b, 0);
    const ouvresPresence = mois.reduce((s, m) => s + m.ouvres, 0);
    const objectifPersonne = Math.round(objectif * ouvresPresence / ouvresAnnee * 2) / 2;
    return { mois, travailles, conges, objectif: objectifPersonne, reste: travailles - objectifPersonne };
  }

  // Capacité « type » Scrum d'une équipe pour un sprint (information) :
  // engageable = (disponible − cérémonies) × facteur de focus, avec cérémonies = Σ capacité × jours de
  // cérémonie par sprint. Paramètres : CONFIG.CEREMONIES_JOURS_SPRINT, CONFIG.FACTEUR_FOCUS.
  function capaciteScrum(ressources, disponible) {
    const ceremonies = ressources.reduce((s, r) => s + (r.capacite ?? 100) / 100 * CONFIG.CEREMONIES_JOURS_SPRINT, 0);
    const engageable = Math.max(0, disponible - ceremonies) * CONFIG.FACTEUR_FOCUS;
    return { disponible, ceremonies, engageable, heures: engageable * CONFIG.HEURES_PAR_JOUR };
  }

  // Absents d'un groupe (membres d'un projet) un jour donné, en personnes (demi-journée = 0,5).
  // Niveau : 'aucun' | 'partiel' (au moins un absent) | 'critique' (plus de la moitié absente).
  function absentsDuJour(ressourceIds, jour, absences) {
    const absents = absences.filter(a => a.jour === jour && ressourceIds.includes(a.ressourceId)).reduce((s, a) => s + dureeAbsence(a), 0);
    const niveau = !absents ? 'aucun' : absents > ressourceIds.length / 2 ? 'critique' : 'partiel';
    return { absents, total: ressourceIds.length, niveau };
  }

  // Capacité d'une liste de personnes sur une période, en jours-homme.
  // théorique = Σ jours ouvrés × capacité ; disponible = idem, moins les absences (demi-journée = 0,5).
  // Présence d'une personne un jour donné : entre sa date d'arrivée et sa date de départ
  // (incluses, toutes deux facultatives ; dates ISO comparables comme des chaînes).
  function estPresent(r, jour) {
    return (!r.dateArrivee || jour >= r.dateArrivee) && (!r.dateDepart || jour <= r.dateDepart);
  }
  // Présente au moins un jour de la période [debut, fin] : arrivée avant la fin ET départ après le début
  function estPresentSur(r, debut, fin) {
    return (!r.dateArrivee || r.dateArrivee <= fin) && (!r.dateDepart || r.dateDepart >= debut);
  }

  // Les jours hors présence (avant l'arrivée, après le départ) ne comptent pas dans la capacité.
  function capacitePeriode(ressources, debut, fin, absences, feries) {
    let theorique = 0, disponible = 0;
    const absent = new Map(absences.map(a => [a.ressourceId + '|' + a.jour, dureeAbsence(a)]));
    for (let jour = debut; jour <= fin; jour = ajouterJours(jour, 1)) {
      if (!estJourOuvre(jour, feries)) continue;
      ressources.filter(r => estPresent(r, jour)).forEach(r => {
        const part = (r.capacite ?? 100) / 100;
        theorique += part;
        disponible += part * (1 - (absent.get(r.id + '|' + jour) || 0));
      });
    }
    return { theorique, disponible };
  }

  /* ---------- Temps ---------- */
  // Jours de semaine (lundi → vendredi) d'un mois ; la saisie des heures est mensuelle
  const joursSemaineMois = (annee, mois) => joursDuMois(annee, mois).filter(j => !estWeekend(j));
  // Clé d'une feuille de temps mensuelle : 1er jour du mois (colonne `semaine` de feuilles_temps, migration 016)
  const debutMois = (annee, mois) => `${annee}-${deux(mois + 1)}-01`;

  // Heures d'une personne sur une liste de jours : total par jour et total général
  function heuresJours(ressourceId, jours, temps) {
    const parJour = jours.map(j => temps.filter(t => t.ressourceId === ressourceId && t.jour === j)
      .reduce((s, t) => s + Number(t.heures || 0), 0));
    return { jours, parJour, total: parJour.reduce((a, b) => a + b, 0) };
  }
  const heuresSemaine = (ressourceId, lundiIso, temps) => heuresJours(ressourceId, joursOuvresSemaine(lundiIso), temps);
  const heuresMois = (ressourceId, annee, mois, temps) => heuresJours(ressourceId, joursSemaineMois(annee, mois), temps);

  // Heures attendues d'une personne sur une liste de jours : jours ouvrés (hors fériés), moins
  // les absences (demi-journée = 0,5) et les jours hors présence, × HEURES_PAR_JOUR × capacité
  function heuresAttenduesJours(ressource, jours, absences, feries) {
    const absent = new Map(absences.filter(a => a.ressourceId === ressource.id).map(a => [a.jour, dureeAbsence(a)]));
    const nb = jours.filter(j => estJourOuvre(j, feries) && estPresent(ressource, j))
      .reduce((s, j) => s + 1 - (absent.get(j) || 0), 0);
    return nb * CONFIG.HEURES_PAR_JOUR * (ressource.capacite ?? 100) / 100;
  }
  const heuresAttendues = (ressource, lundiIso, absences, feries) => heuresAttenduesJours(ressource, joursOuvresSemaine(lundiIso), absences, feries);
  const heuresAttenduesMois = (ressource, annee, mois, absences, feries) => heuresAttenduesJours(ressource, joursSemaineMois(annee, mois), absences, feries);

  // Taux d'occupation = heures saisies / heures attendues (en %)
  function tauxOccupation(ressources, lundiIso, temps, absences, feries) {
    const attendu = ressources.reduce((s, r) => s + heuresAttendues(r, lundiIso, absences, feries), 0);
    const saisi = ressources.reduce((s, r) => s + heuresSemaine(r.id, lundiIso, temps).total, 0);
    return attendu ? (saisi / attendu) * 100 : 0;
  }

  /* ---------- Plan de charge (migration 021) ----------
     Reprise du tableur du porteur « Suivi_temps_TechLead_2projets » (2026-10-07) :
     jours prévus = jours disponibles × % du temps sur le projet × % du type de tâche.
     Jours disponibles d'un mois = jours travaillés (jours de semaine − fériés − congés, hors
     jours de non-présence : joursTravaillesMois) × capacité de la personne (100 % en général ;
     ajout par rapport au tableur, pour rester cohérent avec le timesheet). */
  function previsionMois(ressource, annee, mois, absences, feries) {
    const j = joursTravaillesMois(ressource.id, annee, mois, absences, feries, ressource);
    return { ouvres: j.ouvres - j.feries, conges: j.conges, travailles: j.travailles,
      disponibles: j.travailles * (ressource.capacite ?? 100) / 100 };
  }
  // Part d'une valeur : partDe(20, 36) = 7,2 (36 % de 20)
  const partDe = (valeur, pourcent) => valeur * Number(pourcent || 0) / 100;
  // Heures saisies (timesheet) par une personne sur un projet entre deux dates incluses
  const heuresProjetPeriode = (ressourceId, projetId, debut, fin, temps) => temps
    .filter(t => t.ressourceId === ressourceId && t.projetId === projetId && t.jour >= debut && t.jour <= fin)
    .reduce((s, t) => s + Number(t.heures || 0), 0);

  /* ---------- Divers ---------- */
  const initiales = nom => (nom || '?').split(/\s+/).map(m => m[0]).join('').slice(0, 2).toUpperCase();
  // Prochain code projet d'une équipe : PREFIXE-n (n = plus grand numéro existant + 1)
  function prochainCodeProjet(prefixe, projets) {
    const numeros = projets.map(p => p.code).filter(c => c.startsWith(prefixe + '-')).map(c => Number(c.split('-')[1]) || 0);
    return `${prefixe}-${deux(Math.max(0, ...numeros) + 1)}`;
  }

  // Découpe une note de daily en rubriques (Hier / Aujourd'hui / Blocages / autre) :
  // [{ titre, lignes: [...] }] — un titre est une ligne sans tiret qui ne commence pas par « - ».
  function rubriquesDaily(texte) {
    const rubriques = []; let courante = null;
    (texte || '').split('\n').forEach(l => {
      const ligne = l.trim(); if (!ligne) return;
      if (!ligne.startsWith('-')) { courante = { titre: ligne, lignes: [] }; rubriques.push(courante); return; }
      if (!courante) { courante = { titre: '', lignes: [] }; rubriques.push(courante); }
      courante.lignes.push(ligne.replace(/^-\s*/, ''));
    });
    return rubriques;
  }
  // Blocages réels d'une note : lignes de la rubrique « Blocages », hors « Aucun », « RAS », « néant »
  const estRubriqueBlocages = titre => /^blocages?\b/i.test(titre);
  function blocagesDaily(texte) {
    return rubriquesDaily(texte).filter(r => estRubriqueBlocages(r.titre)).flatMap(r => r.lignes)
      .filter(l => l && !/^(aucun|aucune|ras|néant|rien)\.?$/i.test(l));
  }
  /* Daily en trois champs (demande du porteur, 2026-10-05) : « Hier » (la veille), « Aujourd'hui »,
     « Blocages ». La note reste un seul texte en base (notes_daily.texte), au format des rubriques :
     titre de rubrique puis une ligne « - … » par point (lu par rubriquesDaily et blocagesDaily).
     Un texte hors rubrique (ancienne note) est rangé dans « Aujourd'hui » : rien n'est perdu. */
  const RUBRIQUES_DAILY = [['hier', 'Hier'], ['aujourdhui', 'Aujourd’hui'], ['blocages', 'Blocages']];
  const cleRubriqueDaily = ligne => {
    const t = ligne.trim().toLowerCase().replace(/[’']/g, '').replace(/\s*:$/, '');
    return t === 'hier' ? 'hier' : t === 'aujourdhui' ? 'aujourdhui' : /^blocages?$/.test(t) ? 'blocages' : null;
  };
  function decouperDaily(texte) {
    const champs = { hier: [], aujourdhui: [], blocages: [] }; let courante = 'aujourdhui';
    (texte || '').split('\n').forEach(l => {
      const cle = cleRubriqueDaily(l);
      if (cle) { courante = cle; return; }
      const point = l.replace(/^\s*-\s?/, '');
      if (point.trim()) champs[courante].push(point);
    });
    return { hier: champs.hier.join('\n'), aujourdhui: champs.aujourdhui.join('\n'), blocages: champs.blocages.join('\n') };
  }
  function composerDaily(champs) {
    return RUBRIQUES_DAILY.map(([cle, titre]) => {
      const points = (champs[cle] || '').split('\n').filter(l => l.trim()).map(l => '- ' + l.replace(/^\s*-\s?/, ''));
      return points.length ? titre + '\n' + points.join('\n') : '';
    }).filter(Boolean).join('\n\n');
  }

  return {
    MOIS_COURTS, JOURS_INITIALES, versIso, depuisIso, aujourdhui, ajouterJours, ecartJours, estWeekend, estJourOuvre, dureeAbsence,
    lundi, joursOuvresSemaine, joursOuvresEntre, joursDuMois, formatCourt, formatAvecAnnee, formatLong, libelleMois,
    trimestreDe, nombre, pourcent, sprintDe, velocite, repartitionSprint, estTermine, projetsActifs, avancementMoyen,
    projetsASurveiller, progressionObjectif, atteinteTrimestre,
    estPresent, estPresentSur, capacitePeriode, capaciteScrum, absentsDuJour, joursTravaillesMois, recapJoursTravailles, heuresAttendues, joursSemaineMois, debutMois, heuresMois, heuresAttenduesMois, tauxOccupation, initiales, prochainCodeProjet,
    rubriquesDaily, estRubriqueBlocages, blocagesDaily, decouperDaily, composerDaily,
    heuresAttenduesJours, previsionMois, partDe, heuresProjetPeriode
  };
})();
