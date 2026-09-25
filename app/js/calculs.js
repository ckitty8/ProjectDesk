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
  // Numéro de semaine ISO 8601 (semaine du jeudi)
  function numeroSemaine(iso) {
    const d = depuisIso(iso); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const premierJeudi = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - premierJeudi) / 86400000 - 3 + ((premierJeudi.getDay() + 6) % 7)) / 7);
  }
  const joursOuvresSemaine = lundiIso => [0, 1, 2, 3, 4].map(i => ajouterJours(lundiIso, i));

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
  // Sprints à afficher : le précédent, le courant et les suivants
  function sprintsAutour(iso, avant = 1, apres = 4) {
    const courant = sprintDe(iso); const liste = [];
    for (let i = -avant; i <= apres; i++) liste.push(sprintDe(ajouterJours(courant.debut, i * CONFIG.DUREE_SPRINT_JOURS)));
    return liste;
  }

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

  // Tickets d'un projet : total, terminés
  function compteTickets(tickets) {
    return { total: tickets.length, termines: tickets.filter(t => t.statut === STATUTS_TICKET.TERMINE).length };
  }
  const ticketsOuverts = tickets => tickets.filter(t => t.statut !== STATUTS_TICKET.TERMINE).length;

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
  // absences : liste { ressourceId, jour, type } ; renvoie le décompte d'une personne sur une année
  function recapConges(ressourceId, annee, absences, typesAbsence) {
    const siennes = absences.filter(a => a.ressourceId === ressourceId && a.jour.startsWith(String(annee)));
    const parType = {};
    typesAbsence.forEach(t => { parType[t.libelle] = siennes.filter(a => a.type === t.libelle).length; });
    const cpPris = parType[ABSENCE_CP] || 0;
    return { parType, total: siennes.length, cpPris, soldeCp: CONFIG.DROIT_CP_ANNUEL - cpPris };
  }

  // Capacité d'une liste de personnes sur une période, en jours-homme.
  // théorique = Σ jours ouvrés × capacité ; disponible = idem, moins les jours d'absence.
  function capacitePeriode(ressources, debut, fin, absences, feries) {
    let theorique = 0, disponible = 0;
    const absent = new Set(absences.map(a => a.ressourceId + '|' + a.jour));
    for (let jour = debut; jour <= fin; jour = ajouterJours(jour, 1)) {
      if (!estJourOuvre(jour, feries)) continue;
      ressources.forEach(r => {
        const part = (r.capacite ?? 100) / 100;
        theorique += part;
        if (!absent.has(r.id + '|' + jour)) disponible += part;
      });
    }
    return { theorique, disponible };
  }

  /* ---------- Temps ---------- */
  // Heures d'une personne sur une semaine : total par jour et total général
  function heuresSemaine(ressourceId, lundiIso, temps) {
    const jours = joursOuvresSemaine(lundiIso);
    const parJour = jours.map(j => temps.filter(t => t.ressourceId === ressourceId && t.jour === j)
      .reduce((s, t) => s + Number(t.heures || 0), 0));
    return { jours, parJour, total: parJour.reduce((a, b) => a + b, 0) };
  }

  // Heures attendues d'une personne sur une semaine (jours ouvrés non absents × capacité)
  function heuresAttendues(ressource, lundiIso, absences, feries) {
    const absent = new Set(absences.filter(a => a.ressourceId === ressource.id).map(a => a.jour));
    const jours = joursOuvresSemaine(lundiIso).filter(j => estJourOuvre(j, feries) && !absent.has(j));
    return jours.length * CONFIG.HEURES_PAR_JOUR * (ressource.capacite ?? 100) / 100;
  }

  // Taux d'occupation = heures saisies / heures attendues (en %)
  function tauxOccupation(ressources, lundiIso, temps, absences, feries) {
    const attendu = ressources.reduce((s, r) => s + heuresAttendues(r, lundiIso, absences, feries), 0);
    const saisi = ressources.reduce((s, r) => s + heuresSemaine(r.id, lundiIso, temps).total, 0);
    return attendu ? (saisi / attendu) * 100 : 0;
  }

  /* ---------- Divers ---------- */
  const initiales = nom => (nom || '?').split(/\s+/).map(m => m[0]).join('').slice(0, 2).toUpperCase();
  // Prochain code projet d'une équipe : PREFIXE-n (n = plus grand numéro existant + 1)
  function prochainCodeProjet(prefixe, projets) {
    const numeros = projets.map(p => p.code).filter(c => c.startsWith(prefixe + '-')).map(c => Number(c.split('-')[1]) || 0);
    return `${prefixe}-${deux(Math.max(0, ...numeros) + 1)}`;
  }
  const numeroDemande = n => 'DEM-' + String(n).padStart(3, '0');
  const nbPoints = texte => (texte || '').split('\n').filter(l => l.trim().startsWith('-')).length;
  const nbMots = texte => (texte || '').split(/\s+/).filter(Boolean).length;

  return {
    MOIS_COURTS, JOURS_INITIALES, versIso, depuisIso, aujourdhui, ajouterJours, ecartJours, estWeekend, estJourOuvre,
    lundi, numeroSemaine, joursOuvresSemaine, joursDuMois, formatCourt, formatAvecAnnee, formatLong, libelleMois,
    trimestreDe, nombre, pourcent, moyenne, sprintDe, sprintsAutour, estTermine, projetsActifs, avancementMoyen,
    projetsASurveiller, compteTickets, ticketsOuverts, progressionObjectif, atteinteTrimestre, recapConges,
    capacitePeriode, heuresSemaine, heuresAttendues, tauxOccupation, initiales, prochainCodeProjet, numeroDemande,
    nbPoints, nbMots
  };
})();
