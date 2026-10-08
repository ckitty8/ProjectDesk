/* ============================================================
   Mon dashboard › Plan de charge (maquette docs/maquettes/previsionnel-temps/)
   Réservé aux chefs de projet (et administrateurs). Remplace le tableur du porteur
   « Suivi temps tech lead », pour toute personne affectée (pas seulement les tech leads).
   - Onglet « Prévisionnel » : par mois sur 12 mois, jours ouvrés (fériés), congés
     (Congés & capacité), jours travaillés, puis par projet de la personne :
     jours travaillés × % du temps sur le projet × % de chaque type de tâche.
   - Onglet « Temps réel par sprint » : sur les dates d'un sprint, heures prévues
     (capacité × % du projet) et heures réellement saisies (Saisir mes heures).
   Données : previsions_temps (% d'une personne sur un projet) et types_tache_projet
   (migration 021) ; modifiables par qui pilote le projet (peutPiloterProjet).
   Calculs : Calculs.previsionMois, partDe, heuresAttenduesJours, heuresProjetPeriode.
   ============================================================ */
'use strict';

const Previsionnel = {
  NB_MOIS: 12,

  // Le menu n'apparaît qu'aux chefs de projet (fiche « chef » ou affectation) et aux administrateurs
  estVisible: () => etat.estAdmin || etat.d.projets.some(suisChefDuProjet),

  // Projets que je pilote, puis personnes proposées : affectées (hors Lecteur) à l'un d'eux, présentes
  personnes() {
    const pilotes = new Set(etat.d.projets.filter(peutPiloterProjet).map(p => p.id));
    const ids = new Set(etat.d.affectations.filter(a => pilotes.has(a.projetId) && a.role !== ROLES_PROJET.LECTEUR).map(a => a.ressourceId));
    return ressourcesActives().filter(r => ids.has(r.id)).sort((a, b) => a.nom.localeCompare(b.nom));
  },
  personneChoisie(personnes) {
    const moi = maRessource();
    return personnes.find(r => r.id === ui('previsionnel').ressourceId) || personnes.find(r => moi && r.id === moi.id) || personnes[0] || null;
  },
  // Projets en cours d'une personne (affectations hors Lecteur), par code
  projetsDe: r => etat.d.affectations.filter(a => a.ressourceId === r.id && a.role !== ROLES_PROJET.LECTEUR)
    .map(a => projet(a.projetId)).filter(projetEnCours).sort(parCode),
  // % du temps d'une personne sur un projet (0 si pas encore saisi)
  part: (projetId, ressourceId) => Number(((etat.d.previsionsTemps || []).find(x => x.projetId === projetId && x.ressourceId === ressourceId) || {}).part || 0),
  types: projetId => (etat.d.typesTache || []).filter(t => t.projetId === projetId),

  // Mois affichés : 12 mois à partir du mois de départ (mois courant par défaut)
  mois() {
    const d = Calculs.depuisIso(Calculs.aujourdhui());
    const depart = ui('previsionnel', { annee: d.getFullYear(), mois: d.getMonth() });
    return Array.from({ length: this.NB_MOIS }, (_, i) => {
      const date = new Date(depart.annee, depart.mois + i, 1);
      return { annee: date.getFullYear(), mois: date.getMonth() };
    });
  },
  // Valeur affichée dans l'unité choisie (jours, ou heures = jours × HEURES_PAR_JOUR)
  enUnite: jours => ui('previsionnel', { unite: 'jours' }).unite === 'heures' ? jours * CONFIG.HEURES_PAR_JOUR : jours,
  format: n => n.toFixed(2).replace('.', ','),

  /* ---------- Onglet Prévisionnel ---------- */
  prevision(r) {
    const esc = C.esc, mois = this.mois(), fer = feries();
    const parMois = mois.map(m => Calculs.previsionMois(r, m.annee, m.mois, etat.d.absences, fer));
    const somme = valeurs => valeurs.reduce((a, b) => a + b, 0);
    const cellules = valeurs => valeurs.map(v => `<td class="num">${this.format(this.enUnite(v))}</td>`).join('')
      + `<td class="num"><b>${this.format(this.enUnite(somme(valeurs)))}</b></td>`;
    const ligne = (libelle, pourcent, valeurs, classe = '') => `<tr class="${classe}"><td>${libelle}</td><td class="num">${pourcent}</td>${cellules(valeurs)}</tr>`;
    const saisiePourcent = (valeur, attributs) => `<span style="white-space:nowrap"><input class="saisie-heure" style="width:62px" type="number" min="0" max="100" step="1" value="${valeur}" ${attributs}> %</span>`;
    const disponibles = parMois.map(m => m.disponibles);

    // Un bloc par projet : ligne projet (% du temps), une ligne par type de tâche, sous-totaux
    const projets = this.projetsDe(r);
    const blocs = projets.map(p => {
      const modifiable = peutPiloterProjet(p), part = this.part(p.id, r.id), types = this.types(p.id);
      const duProjet = disponibles.map(v => Calculs.partDe(v, part));
      const sommeTypes = somme(types.map(t => Number(t.part)));
      const lignesTypes = types.map(t => ligne(modifiable
          ? `<span class="ligne-flex" style="padding-left:18px"><input class="champ" style="height:28px;width:150px" value="${esc(t.libelle)}" data-action-change="renommerTypeTache" data-id="${t.id}">
             <button class="btn petit" title="Supprimer ce type" data-action="supprimerTypeTache" data-id="${t.id}">✕</button></span>`
          : `<span style="padding-left:18px">${esc(t.libelle)}</span>`,
        modifiable ? saisiePourcent(Number(t.part), `data-action-change="partTypeTache" data-id="${t.id}"`) : Number(t.part) + ' %',
        duProjet.map(v => Calculs.partDe(v, t.part)))).join('');
      // Sous-total du tableur du porteur : « TT tous sauf US » (seulement si le projet a un type « US »)
      const us = types.find(t => t.libelle.trim().toUpperCase() === 'US');
      const horsUs = us ? ligne('<span style="padding-left:18px"><i>Total hors US</i></span>', (sommeTypes - Number(us.part)) + ' %',
        duProjet.map(v => Calculs.partDe(v, sommeTypes - Number(us.part))), 'discret') : '';
      const alerteTypes = types.length && sommeTypes !== 100 ? `<span style="color:var(--danger)">Σ ${sommeTypes} % ≠ 100 %</span>` : types.length ? 'Σ 100 %' : '';
      const ajout = modifiable ? `<form class="ligne-flex" style="padding-left:18px" data-action-envoi="ajouterTypeTache" data-projet="${p.id}">
          <input class="champ" style="height:28px;width:170px" name="libelle" placeholder="Nouveau type de tâche" required><button class="btn petit">Ajouter</button></form>` : '';
      return `<tr class="groupe"><td><span class="ligne-flex">${C.code(p.code)}<b>${esc(p.nom)}</b>${modifiable ? '' : ' <span class="discret">(lecture)</span>'}</span></td>
          <td class="num">${modifiable ? saisiePourcent(part, `data-action-change="partProjetPrevision" data-projet="${p.id}" data-ressource="${r.id}" style="width:62px;font-weight:600"`) : part + ' %'}</td>
          ${duProjet.map(v => `<td class="num"><b>${this.format(this.enUnite(v))}</b></td>`).join('')}<td class="num"><b>${this.format(this.enUnite(somme(duProjet)))}</b></td></tr>
        ${lignesTypes}${horsUs}
        <tr><td>${ajout}</td><td class="num discret">${alerteTypes}</td><td colspan="${mois.length + 1}"></td></tr>`;
    }).join('');

    const sommeParts = somme(projets.map(p => this.part(p.id, r.id)));
    const capacite = r.capacite ?? 100;
    const titreUnite = ui('previsionnel', { unite: 'jours' }).unite === 'heures' ? 'heures' : 'jours';
    const kpis = `<div class="grille-kpi q3">
      ${C.kpi('Jours travaillés', Calculs.nombre(somme(parMois.map(m => m.travailles))), `sur ${Calculs.nombre(somme(parMois.map(m => m.ouvres)))} jours ouvrés · ${Calculs.nombre(somme(parMois.map(m => m.conges)))} j de congés`)}
      ${C.kpi('Répartition des projets', `<span style="color:${sommeParts === 100 ? 'inherit' : 'var(--danger)'}">${sommeParts} %</span>`,
        projets.map(p => `${esc(p.nom)} ${this.part(p.id, r.id)} %`).join(' · ') + (sommeParts === 100 ? '' : ' · le total doit faire 100 %'))}
      ${C.kpi('Charge prévue', Calculs.nombre(Calculs.partDe(somme(disponibles), sommeParts)) + ' j',
        projets.map(p => `${esc(p.nom)} ${Calculs.nombre(Calculs.partDe(somme(disponibles), this.part(p.id, r.id)))} j`).join(' · '))}</div>`;

    return `${kpis}
      <div class="carte" style="overflow:auto"><table class="tableau" style="font-size:12.5px">
        <thead><tr><th style="min-width:200px">Répartition en ${titreUnite}</th><th class="num">% cible</th>
          ${mois.map(m => `<th class="num">${Calculs.MOIS_COURTS[m.mois]}${m.mois === 0 || m === mois[0] ? ' ' + String(m.annee).slice(2) : ''}</th>`).join('')}<th class="num">Total</th></tr></thead>
        <tbody>
          ${ligne('Jours ouvrés <span class="discret">(hors week-ends et fériés)</span>', '', parMois.map(m => m.ouvres))}
          ${ligne('Congés / absences <span class="discret">(Congés & capacité)</span>', '', parMois.map(m => m.conges))}
          ${ligne('<b>Jours travaillés</b>', '', parMois.map(m => m.travailles), 'groupe')}
          ${capacite !== 100 ? ligne(`<b>Disponibles</b> <span class="discret">(capacité ${capacite} %)</span>`, '', disponibles, 'groupe') : ''}
          ${blocs || `<tr><td colspan="${mois.length + 3}">${C.vide('Aucun projet en cours pour cette personne.')}</td></tr>`}
          ${ligne('<b>TOTAL</b>', `<b>${sommeParts} %</b>`, disponibles.map(v => Calculs.partDe(v, sommeParts)), 'groupe')}
        </tbody></table></div>
      <div class="discret" style="font-size:12px;margin-top:8px">Calcul : jours travaillés × % du projet × % du type de tâche
        (× ${Calculs.nombre(CONFIG.HEURES_PAR_JOUR)} h par jour en « Heures »). Congés repris de Congés & capacité, fériés de l’Administration.
        Les % se modifient par le chef du projet concerné.</div>`;
  },

  /* ---------- Onglet Temps réel par sprint ---------- */
  // Projet dont on suit les sprints : choisi, sinon CDO, sinon le premier projet ayant des sprints datés
  projetSprints(projets) {
    const avecSprints = projets.filter(p => sprintsDuProjet(p.id).length);
    const choix = ui('previsionnel').projetSprints;
    return avecSprints.find(p => p.id === choix) || avecSprints.find(p => p.nom === 'CDO') || avecSprints[0] || null;
  },
  // Sprint affiché : choisi par ‹ ›, sinon le sprint en cours, sinon le dernier commencé, sinon le premier
  sprintChoisi(sprints) {
    const jour = Calculs.aujourdhui();
    return sprints.find(s => s.numero === ui('previsionnel').sprint) || sprints.find(s => s.debut <= jour && jour <= s.fin)
      || [...sprints].reverse().find(s => s.debut <= jour) || sprints[0];
  },

  reel(r) {
    const esc = C.esc, projets = this.projetsDe(r), ref = this.projetSprints(projets);
    if (!ref) return `<div class="carte" style="padding:16px">Aucun sprint daté sur les projets de ${esc(r.nom)} :
      renseignez les dates des sprints dans Mon dashboard › Administration › Sprints.</div>`;
    const sprints = sprintsDuProjet(ref.id), s = this.sprintChoisi(sprints), rang = sprints.indexOf(s), fer = feries();
    const capaciteH = Calculs.heuresAttenduesJours(r, Calculs.joursOuvresEntre(s.debut, s.fin, fer), etat.d.absences, fer);
    const lignes = projets.map(p => ({ p, cible: this.part(p.id, r.id), prevu: Calculs.partDe(capaciteH, this.part(p.id, r.id)),
      reel: Calculs.heuresProjetPeriode(r.id, p.id, s.debut, s.fin, etat.d.temps) }));
    const totalReel = lignes.reduce((t, l) => t + l.reel, 0), totalPrevu = lignes.reduce((t, l) => t + l.prevu, 0);
    const pourcentReel = l => totalReel ? l.reel / totalReel * 100 : 0;
    const plusGrandEcart = [...lignes].sort((a, b) => Math.abs(b.reel - b.prevu) - Math.abs(a.reel - a.prevu))[0];
    const h = n => Calculs.nombre(n) + ' h';

    const choixProjet = projets.filter(p => sprintsDuProjet(p.id).length).map(p => ({ valeur: p.id, libelle: `Sprints de ${p.nom}` }));
    const navigation = `<div class="ligne-flex">${C.liste(choixProjet, ref.id, 'class="champ" style="width:auto" data-action-change="projetSprintsPrevision"')}
      <button class="btn petit" data-action="sprintPrevision" data-numero="${(sprints[rang - 1] || s).numero}" ${rang > 0 ? '' : 'disabled'}>‹</button>
      <b>${esc(nomSprint(s))} · ${Calculs.formatCourt(s.debut)} → ${Calculs.formatAvecAnnee(s.fin)}</b>
      <button class="btn petit" data-action="sprintPrevision" data-numero="${(sprints[rang + 1] || s).numero}" ${rang < sprints.length - 1 ? '' : 'disabled'}>›</button></div>`;

    return `<div class="carte" style="padding:12px 16px">${navigation}</div>
      <div class="grille-kpi q3">
        ${C.kpi('Heures saisies', h(totalReel), `sur ${h(capaciteH)} de capacité`)}
        ${C.kpi('Taux de saisie', capaciteH ? Calculs.pourcent(totalReel / capaciteH * 100) : '—', `${h(Math.max(0, capaciteH - totalReel))} non saisies`, 'completude')}
        ${C.kpi('Écart au prévisionnel', plusGrandEcart ? (plusGrandEcart.reel >= plusGrandEcart.prevu ? '+' : '') + h(plusGrandEcart.reel - plusGrandEcart.prevu) : '—',
          plusGrandEcart ? `${esc(plusGrandEcart.p.nom)} (${h(plusGrandEcart.reel)} saisies pour ${h(plusGrandEcart.prevu)} prévues)` : '')}</div>
      <div class="carte"><div class="carte-titre"><h2>Par projet</h2><span class="discret">heures de « Saisir mes heures » sur les dates du sprint</span></div>
        <table class="tableau"><thead><tr><th>Projet</th><th class="num">% cible</th><th class="num">Heures prévues</th><th class="num">Heures réelles</th>
          <th class="num">Jours (JH)</th><th class="num">% réel</th><th class="num">Écart (points)</th><th style="width:18%">Consommé / prévu</th></tr></thead>
        <tbody>${lignes.map(l => {
          const ecart = pourcentReel(l) - l.cible;
          return `<tr><td><span class="ligne-flex">${C.code(l.p.code)}${esc(l.p.nom)}</span></td><td class="num">${l.cible} %</td>
            <td class="num">${this.format(l.prevu)}</td><td class="num"><b>${this.format(l.reel)}</b></td>
            <td class="num">${this.format(l.reel / CONFIG.HEURES_PAR_JOUR)}</td><td class="num">${totalReel ? Calculs.nombre(pourcentReel(l)) + ' %' : '—'}</td>
            <td class="num" style="color:${totalReel && Math.abs(ecart) > 5 ? 'var(--danger)' : 'inherit'}">${totalReel ? (ecart > 0 ? '+' : '') + Calculs.nombre(ecart) : '—'}</td>
            <td>${C.barre(l.prevu ? Math.min(100, l.reel / l.prevu * 100) : 0)}</td></tr>`;
        }).join('')}
          <tr class="groupe"><td><b>Total</b></td><td class="num">${lignes.reduce((t, l) => t + l.cible, 0)} %</td><td class="num">${this.format(totalPrevu)}</td>
            <td class="num"><b>${this.format(totalReel)}</b></td><td class="num">${this.format(totalReel / CONFIG.HEURES_PAR_JOUR)}</td><td class="num">${totalReel ? '100 %' : '—'}</td><td></td><td></td></tr>
        </tbody></table></div>
      <div class="discret" style="font-size:12px">Capacité = jours ouvrés du sprint hors fériés et congés × ${Calculs.nombre(CONFIG.HEURES_PAR_JOUR)} h × capacité de la personne.
        Les heures se saisissent par projet dans Gestion des ressources › Mon timesheet › Saisir mes heures.</div>`;
  }
};

Ecrans.previsionnel = {
  titre: 'Plan de charge',
  section: 'moi',
  rendre() {
    const onglet = ui('previsionnel', { onglet: 'prevision' }).onglet;
    const entete = C.entete('Plan de charge', 'Réservé aux chefs de projet · répartition du temps d’une personne entre ses projets', '');
    if (!Previsionnel.estVisible()) return `<div class="ecran">${entete}<div class="carte">${C.vide('Écran réservé aux chefs de projet.')}</div></div>`;
    const personnes = Previsionnel.personnes(), r = Previsionnel.personneChoisie(personnes);
    if (!r) return `<div class="ecran">${entete}<div class="carte">${C.vide('Aucune personne affectée à vos projets.')}</div></div>`;

    const puce = (cle, libelle) => `<button class="puce${onglet === cle ? ' active' : ''}" data-action="ongletPrevision" data-onglet="${cle}">${libelle}</button>`;
    const choixPersonne = C.liste(personnes.map(p => ({ valeur: p.id, libelle: `${p.nom} — ${Previsionnel.projetsDe(p).map(x => x.nom).join(', ')}` })), r.id,
      'class="champ" style="width:280px" data-action-change="personnePrevision"');
    const mois = Previsionnel.mois(), unite = ui('previsionnel', { unite: 'jours' }).unite;
    const reglages = onglet === 'prevision' ? `
      <div class="ligne-flex"><span class="libelle" style="margin:0">Période</span>
        <button class="btn petit" data-action="moisPrevision" data-sens="-1">‹</button>
        <b>${Calculs.libelleMois(mois[0].annee, mois[0].mois)} → ${Calculs.libelleMois(mois[mois.length - 1].annee, mois[mois.length - 1].mois)}</b>
        <button class="btn petit" data-action="moisPrevision" data-sens="1">›</button></div>
      <div class="puces"><button class="puce${unite === 'jours' ? ' active' : ''}" data-action="unitePrevision" data-unite="jours">Jours</button>
        <button class="puce${unite === 'heures' ? ' active' : ''}" data-action="unitePrevision" data-unite="heures">Heures (${Calculs.nombre(CONFIG.HEURES_PAR_JOUR)} h/j)</button></div>` : '';

    return `<div class="ecran" style="max-width:1320px">
      ${entete}
      <div class="puces">${puce('prevision', 'Prévisionnel')}${puce('reel', 'Temps réel par sprint')}</div>
      <div class="carte" style="padding:12px 16px"><div class="ligne-flex" style="justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div class="ligne-flex"><span class="libelle" style="margin:0">Personne</span>${choixPersonne}
          <span class="discret" style="font-size:12px">(vous-même ou un membre de vos projets)</span></div>${reglages}</div></div>
      ${onglet === 'prevision' ? Previsionnel.prevision(r) : Previsionnel.reel(r)}
    </div>`;
  }
};

/* ---------- Actions ---------- */
// Pourcentage saisi : nombre entre 0 et 100, sinon null (message d'erreur)
function lirePourcent(element) {
  const valeur = Number(element.value);
  if (element.value === '' || isNaN(valeur) || valeur < 0 || valeur > 100) { notifier('Pourcentage invalide (0 à 100)', 'erreur'); rendre(); return null; }
  return valeur;
}

Object.assign(Actions, {
  ongletPrevision: d => majUi('previsionnel', { onglet: d.onglet }),
  personnePrevision: (d, el) => majUi('previsionnel', { ressourceId: el.value }),
  unitePrevision: d => majUi('previsionnel', { unite: d.unite }),
  moisPrevision(d) {
    const premier = Previsionnel.mois()[0], date = new Date(premier.annee, premier.mois + Number(d.sens), 1);
    majUi('previsionnel', { annee: date.getFullYear(), mois: date.getMonth() });
  },
  projetSprintsPrevision: (d, el) => majUi('previsionnel', { projetSprints: el.value, sprint: null }),
  sprintPrevision: d => majUi('previsionnel', { sprint: Number(d.numero) }),

  // % du temps d'une personne sur un projet (upsert sur l'affectation)
  partProjetPrevision(d, el) {
    const part = lirePourcent(el); if (part === null) return;
    executer(() => Api.creer('previsions_temps', { projetId: d.projet, ressourceId: d.ressource, part }, 'projet_id,ressource_id'), 'previsionsTemps');
  },
  // Types de tâche d'un projet : % cible, libellé, ajout (en fin de liste), suppression
  partTypeTache(d, el) {
    const part = lirePourcent(el); if (part === null) return;
    executer(() => Api.modifier('types_tache_projet', { id: 'eq.' + d.id }, { part }), 'typesTache');
  },
  renommerTypeTache(d, el) {
    const libelle = el.value.trim(); if (!libelle) { notifier('Le libellé est obligatoire', 'erreur'); return rendre(); }
    executer(() => Api.modifier('types_tache_projet', { id: 'eq.' + d.id }, { libelle }), 'typesTache');
  },
  ajouterTypeTache(d, form) {
    const ordre = Math.max(0, ...Previsionnel.types(d.projet).map(t => t.ordre)) + 1;
    executer(() => Api.creer('types_tache_projet', { projetId: d.projet, libelle: form.elements.libelle.value.trim(), part: 0, ordre }), 'typesTache');
  },
  supprimerTypeTache(d) {
    if (confirm('Supprimer ce type de tâche ?')) executer(() => Api.supprimer('types_tache_projet', { id: 'eq.' + d.id }), 'typesTache');
  }
});
