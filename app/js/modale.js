/* ============================================================
   Fenêtres modales
   - affectation : assigner une ressource à des projets, avec un rôle
                   (maquette : « Assigner une ressource ») ; m.role pré-choisit le
                   rôle sur le projet d'origine (« + Ajouter un Product Owner »)
   - ressource   : fiche d'une personne (nom, poste, capacité, dates, email, rôle d'accès)
   - equipe      : créer / modifier une unité (direction ou équipe : type,
                   rattachement, statut), membres et invitations
   - objectifs   : objectifs (OKR) et résultats clés de mon équipe
   - envoiPowerAutomate : mise en place du flux qui envoie le daily d'une équipe
   - exportDaily : choix de la période et des projets du fichier Excel du daily
   ============================================================ */
'use strict';

const Modale = {
  rendre() {
    const m = etat.modale;
    const corps = { affectation: this.affectation, ressource: this.ressource, responsable: this.responsable, equipe: this.equipe, objectifs: this.objectifs, aide: this.aide, methodeCapacite: this.methodeCapacite, envoiPowerAutomate: this.envoiPowerAutomate, exportDaily: this.exportDaily }[m.type].call(this, m);
    return `<div class="modale">${corps}</div>`;
  },
  entete: titre => `<div class="panneau-entete"><h2>${C.esc(titre)}</h2><button type="button" class="fermer" data-action="fermer">✕</button></div>`,

  /* ---------- Affectations d'une ressource ---------- */
  affectation(m) {
    const esc = C.esc;
    const personnes = ressourcesActives().map(r => ({ valeur: r.id, libelle: `${r.nom} — ${equipe(r.equipeId).nom}` }));
    const rId = m.ressourceId || '';
    const actuelles = rId ? etat.d.affectations.filter(a => a.ressourceId === rId) : [];
    // Projets proposés : ceux que je peux modifier, groupés par équipe
    const groupes = etat.d.equipes.map(e => {
      const projets = etat.d.projets.filter(p => p.equipeId === e.id && peutEditerProjet(p));
      if (!projets.length) return '';
      return `<div class="libelle" style="margin-top:10px">${esc(e.nom)}</div>` + projets.map(p => {
        // Coché : déjà affecté, ou projet d'où l'on vient (« + Membre »)
        const a = actuelles.find(x => x.projetId === p.id), coche = a || m.projetId === p.id;
        return `<label class="ligne-flex" style="padding:5px 0"><input type="checkbox" name="projet" value="${p.id}" ${coche ? 'checked' : ''}>
          ${C.code(p.code)}<span style="flex:1">${esc(p.nom)}</span>
          ${C.liste(valeursDe('role').map(v => v.libelle), a ? a.role : (p.id === m.projetId && m.role) || ROLES_PROJET.MEMBRE, `class="champ" style="width:auto;height:28px" name="role-${p.id}"`)}</label>`;
      }).join('');
    }).join('');
    const nbCoches = actuelles.length + (m.projetId && !actuelles.some(x => x.projetId === m.projetId) ? 1 : 0);
    // Équipe où créer une nouvelle personne : celle du projet d'origine, sinon l'équipe ouverte
    const equipeNouvelle = m.projetId ? projet(m.projetId).equipeId : etat.equipeCourante;
    return `<form class="pile" style="gap:0;min-height:0;flex:1;display:flex;flex-direction:column" data-action-envoi="enregistrerAffectations">
      ${this.entete(m.projetId ? `Ajouter une ressource à ${projet(m.projetId).code}` : rId ? `Affectations de ${ressource(rId).nom}` : 'Assigner une ressource')}
      <div class="panneau-corps"><div><label class="libelle">Ressource</label>
        ${C.liste([{ valeur: '', libelle: personnes.length ? '— choisir —' : '— aucune fiche : créez la personne —' }, ...personnes], rId, 'class="champ" name="ressource" required data-action-change="choisirRessourceAffectation"')}
        ${equipeNouvelle ? `<div style="margin-top:6px"><a data-action="nouvellePersonneAffectation" data-equipe="${equipeNouvelle}">+ Nouveau membre</a>
          <span class="discret" style="font-size:12px">(créée dans ${esc(equipe(equipeNouvelle).nom)}, puis sélectionnée ici)</span></div>` : ''}</div>
        <div>${groupes || C.vide('Aucun projet modifiable.')}</div></div>
      <div class="panneau-pied"><span class="discret" style="flex:1">${nbCoches} affectation(s)</span>
        <button type="button" class="btn" data-action="fermer">Annuler</button><button class="btn primaire">Enregistrer les affectations</button></div></form>`;
  },

  /* ---------- Fiche d'une personne (maquette docs/maquettes/ressources-v2/2-fiche.png) ----------
     Poste, contrat, capacité, dates, email ; ses rôles, déduits de ses affectations (responsable
     d'équipes, rôle sur des projets) qu'on retire ou ajoute ici ; case Administrateur (créateur
     seulement) ; Passer inactif / Réactiver ; Supprimer (administrateurs). */
  ressource(m) {
    const esc = C.esc, r = m.id ? ressource(m.id) : { equipeId: m.equipeId, capacite: 100 };
    const statut = m.id ? C.badgeActif(!estInactive(r), ['Actif', 'Inactif']) : '';
    const boutons = m.id ? `<button type="button" class="btn" data-action="basculerActifRessource" data-id="${m.id}">${estInactive(r) ? 'Réactiver' : 'Passer inactif'}</button>
        ${etat.estAdmin ? `<button type="button" class="btn danger" data-action="supprimerRessource" data-id="${m.id}">Supprimer</button>` : ''}<span style="flex:1"></span>` : '';
    // data-affecter : création lancée depuis « + Nouvelle personne » → on enchaîne sur son affectation
    // (au projet d'origine data-retour-projet s'il y en a un)
    return `<form data-action-envoi="enregistrerRessource" data-id="${m.id || ''}" data-equipe="${r.equipeId}" data-affecter="${m.affecter ? 'oui' : ''}" data-retour-projet="${m.retourProjet || ''}">
      <div class="panneau-entete"><h2>${esc(m.id ? 'Fiche de ' + r.nom : 'Nouvelle personne')} ${statut}</h2><button type="button" class="fermer" data-action="fermer">✕</button></div>
      <div class="panneau-corps">
        <div class="deux-colonnes"><div><label class="libelle">Nom complet</label><input class="champ" name="nom" value="${esc(r.nom || '')}" required></div>
          <div><label class="libelle">Email (lien automatique avec son compte)</label><input class="champ" type="email" name="email" value="${esc(r.email || '')}"></div></div>
        <div class="deux-colonnes"><div><label class="libelle">Poste</label>${this.listeReferentiel('poste', r.poste, 'poste')}</div>
          <div><label class="libelle">Type de contrat</label>${this.listeReferentiel('contrat', r.typeContrat, 'typeContrat')}</div></div>
        <div class="deux-colonnes"><div><label class="libelle">Date d’arrivée ${C.aide('datesPresence')}</label><input class="champ" type="date" name="dateArrivee" value="${esc(r.dateArrivee || '')}"></div>
          <div><label class="libelle">Date de départ</label><input class="champ" type="date" name="dateDepart" value="${esc(r.dateDepart || '')}"></div></div>
        <div><label class="libelle">Capacité (%)</label><input class="champ" type="number" min="0" max="100" name="capacite" value="${r.capacite}" required style="width:120px"></div>
        ${m.id ? this.rolesFiche(r) : ''}
        <label class="ligne-flex case-admin"><input type="checkbox" name="administrateur" ${estAdministrateur(r) ? 'checked' : ''} ${etat.estCreateur && r.userId ? '' : 'disabled'}>
          <b style="font-weight:500">Administrateur</b><span class="discret">— accès à tout (réservé au créateur${r.userId ? '' : ' ; la personne doit s’être connectée une fois'})</span></label>
      </div>
      <div class="panneau-pied">${boutons}
        <button type="button" class="btn" data-action="fermer">Annuler</button><button class="btn primaire">Enregistrer</button></div></form>`;
  },
  // Rôles d'une personne, déduits de ses affectations (spécification § 5)
  rolesFiche(r) {
    const esc = C.esc;
    const responsable = (etat.d.responsablesEquipe || []).filter(x => x.ressourceId === r.id).map(x => {
      const e = equipe(x.equipeId);
      return `<div class="ligne-flex ligne-role">${C.badge('Responsable', '#5B2DA0', '#EDE6FA')}<span>de <b style="font-weight:500">${esc(e.nom)}</b></span><span style="flex:1"></span>
        ${peutGererEquipe(e) ? `<a class="discret" data-action="retirerResponsable" data-equipe="${e.id}" data-ressource="${r.id}">Retirer</a>` : ''}</div>`;
    });
    const projets = etat.d.affectations.filter(a => a.ressourceId === r.id && projet(a.projetId)).map(a => {
      const p = projet(a.projetId);
      return `<div class="ligne-flex ligne-role">${C.badgeRef('role', a.role)}<span>de <b style="font-weight:500">${esc(p.nom)}</b> <span class="discret">(${esc(equipe(p.equipeId).nom)})</span></span>
        <span style="flex:1"></span>${peutGererProjet(p) ? `<a class="discret" data-action="retirerAffectation" data-id="${a.id}">Retirer</a>` : ''}</div>`;
    });
    return `<div class="roles-fiche"><label class="libelle">Rôles (déduits de ses affectations) ${C.aide('roleProjet')}</label>
      ${[...responsable, ...projets].join('') || '<div class="pale">Aucune affectation.</div>'}
      <div class="ligne-flex" style="margin-top:6px"><a data-action="assigner" data-ressource="${r.id}">+ Affecter à un projet</a><span class="pale">·</span>
        <a data-action="ajouterResponsable" data-ressource="${r.id}">+ Responsable d’une équipe</a></div></div>`;
  },

  /* ---------- Responsable d'une équipe (table responsables_equipe) ----------
     Ouvert depuis une équipe (équipe connue : choisir la personne) ou depuis une fiche
     (personne connue : choisir l'équipe parmi celles que l'on gère). */
  responsable(m) {
    const deja = (etat.d.responsablesEquipe || []).filter(x => (m.equipeId && x.equipeId === m.equipeId) || (m.ressourceId && x.ressourceId === m.ressourceId));
    const personnes = ressourcesActives().filter(r => !deja.some(x => x.ressourceId === r.id)).sort((a, b) => a.nom.localeCompare(b.nom))
      .map(r => ({ valeur: r.id, libelle: r.nom }));
    const equipes = etat.d.equipes.filter(e => peutGererEquipe(e) && !deja.some(x => x.equipeId === e.id)).map(e => ({ valeur: e.id, libelle: e.nom }));
    const titre = m.equipeId ? 'Responsable de ' + equipe(m.equipeId).nom : 'Responsable d’une équipe · ' + ressource(m.ressourceId).nom;
    return `<form data-action-envoi="enregistrerResponsable" data-equipe="${m.equipeId || ''}" data-ressource="${m.ressourceId || ''}">
      ${this.entete(titre)}
      <div class="panneau-corps">${m.equipeId
        ? `<div><label class="libelle">Personne</label>${C.liste([{ valeur: '', libelle: '— choisir —' }, ...personnes], '', 'class="champ" name="ressource" required')}</div>`
        : `<div><label class="libelle">Équipe</label>${C.liste([{ valeur: '', libelle: '— choisir —' }, ...equipes], '', 'class="champ" name="equipe" required')}</div>`}
        <div class="discret">Une équipe peut avoir plusieurs responsables ; une personne peut être responsable de plusieurs équipes.</div></div>
      <div class="panneau-pied"><button type="button" class="btn" data-action="fermer">Annuler</button><button class="btn primaire">Ajouter</button></div></form>`;
  },

  /* ---------- Équipe : création / modification, membres et invitations ---------- */
  equipe(m) {
    const esc = C.esc, e = m.id ? equipe(m.id) : { nom: '', prefixe: '', couleur: '#003CC8', type: m.typeUnite || 'equipe', parentId: m.parentId || null };
    const libelleType = e.type === 'direction' ? 'Direction' : 'Équipe';
    // Directions proposées pour le rattachement (sauf l'unité elle-même)
    const directions = etat.d.equipes.filter(x => x.type === 'direction' && x.id !== m.id).map(x => ({ valeur: x.id, libelle: x.nom }));
    const personnes = m.id ? ressourcesActives().filter(r => r.equipeId === m.id).map(r => ({ valeur: r.id, libelle: r.nom })) : [];
    const membres = (m.organisation && m.organisation.members) || [];
    const invitations = ((m.organisation && m.organisation.invitations) || []).filter(i => i.status === 'pending');
    const peutInviter = m.id && (etat.estAdmin || estResponsableDe(m.id));
    return `<div style="display:flex;flex-direction:column;min-height:0">
      ${this.entete(m.id ? libelleType + ' ' + e.nom : (e.type === 'direction' ? 'Nouvelle direction' : 'Nouvelle équipe'))}
      <div class="panneau-corps">
        <form class="pile" data-action-envoi="enregistrerEquipe" data-id="${m.id || ''}">
          <fieldset style="border:0;padding:0;margin:0;display:contents" ${etat.estAdmin ? '' : 'disabled'}>
          <div class="deux-colonnes"><div><label class="libelle">Nom</label><input class="champ" name="nom" value="${esc(e.nom)}" required></div>
            <div class="deux-colonnes"><div><label class="libelle">Préfixe projets</label><input class="champ" name="prefixe" value="${esc(e.prefixe)}" maxlength="4" required style="text-transform:uppercase"></div>
              <div><label class="libelle">Couleur</label><input type="color" class="couleur-choix" style="width:100%;height:34px" name="couleur" value="${e.couleur}"></div></div></div>
          <div class="deux-colonnes"><div><label class="libelle">Type</label>${C.liste([{ valeur: 'equipe', libelle: 'Équipe' }, { valeur: 'direction', libelle: 'Direction' }], e.type, 'class="champ" name="type"')}</div>
            <div><label class="libelle">Rattachée à (équipe seulement)</label>${C.liste([{ valeur: '', libelle: '— aucune direction —' }, ...directions], e.parentId || '', 'class="champ" name="parentId"')}</div></div>
          <div class="deux-colonnes"><div><label class="libelle">Statut</label>${C.liste([{ valeur: 'true', libelle: 'Active' }, { valeur: 'false', libelle: 'Inactive' }], String(e.actif !== false), 'class="champ" name="actif"')}</div>
            <div>${m.id ? `<label class="libelle">Responsable</label>${C.liste([{ valeur: '', libelle: '—' }, ...personnes], e.responsableId || '', 'class="champ" name="responsableId"')}` : ''}</div></div>
          <div class="discret" style="font-size:12px">Direction et équipe sont des espaces de travail (membres, projets) ; une direction peut en plus regrouper des équipes. Changer le type ne change ni les membres ni les projets.</div>
          ${etat.estAdmin ? `<div style="text-align:right"><button class="btn primaire">${m.id ? 'Enregistrer' : 'Créer'}</button></div>`
            : '<div class="discret" style="font-size:12px">Nom, préfixe, couleur et responsable : modifiables par un administrateur.</div>'}
          </fieldset>
        </form>
        ${m.id ? `<div><div class="libelle">Membres (comptes de connexion)</div>
          ${m.organisation ? membres.map(mb => `<div class="ligne-flex" style="padding:5px 0">${C.avatar(mb.user ? mb.user.name : '?')}
            <span style="flex:1">${esc(mb.user ? mb.user.name + ' · ' + mb.user.email : mb.userId)}</span>${C.badge(mb.role, '#4A5363', '#F1F3F7')}</div>`).join('') : '<span class="pale">Chargement…</span>'}
          ${invitations.map(i => `<div class="ligne-flex discret" style="padding:5px 0">✉ ${esc(i.email)} · ${esc(i.role)} · invitation en attente</div>`).join('')}</div>
          ${peutInviter ? `<form class="ligne-flex" data-action-envoi="inviterDansEquipe" data-id="${m.id}">
            <input class="champ" type="email" name="email" placeholder="email@entreprise.fr" required>
            ${C.liste([{ valeur: 'member', libelle: 'member' }, { valeur: 'admin', libelle: 'admin (valide les temps)' }], 'member', 'class="champ" name="role" style="width:auto"')}
            <button class="btn">Inviter</button></form>
            <div class="discret" style="font-size:12px">La personne invitée crée son compte avec cet email : l’invitation apparaît sur son écran de choix d’équipe.</div>` : ''}` : ''}
      </div></div>`;
  },

  // Liste d'un référentiel (postes, contrats) ; garde la valeur actuelle même si elle est désactivée
  listeReferentiel(refId, valeur, nom) {
    const valeurs = valeursDe(refId).map(v => v.libelle);
    if (valeur && !valeurs.includes(valeur)) valeurs.unshift(valeur);
    return C.liste([{ valeur: '', libelle: '—' }, ...valeurs], valeur || '', `class="champ" name="${nom}"`);
  },

  /* ---------- Guide d'aide (bouton Aide de l'en-tête) ---------- */
  aide(m) {
    const esc = C.esc, ecran = Ecrans[etat.ecran] || {};
    const guide = m.sujet === 'ecran'
      ? { titre: 'Aide · ' + (ecran.titre || ''), paragraphes: GUIDE_ECRANS[etat.ecran] || ['Pas encore d’aide pour cet écran.'] }
      : GUIDES[m.sujet];
    return `<div style="display:flex;flex-direction:column">${this.entete(guide.titre)}
      <div class="panneau-corps">${guide.paragraphes.map(p => `<p style="margin:0">${esc(p)}</p>`).join('')}
        <p class="discret" style="margin:0;font-size:12px">Astuce : survolez les ⓘ pour le détail d’un chiffre ou d’une règle.</p></div></div>`;
  },

  /* ---------- Méthode de calcul de l'onglet Capacité ----------
     Formules seules (les chiffres du projet sont dans l'onglet) ; paramètres lus dans CONFIG. */
  methodeCapacite() {
    const n = Calculs.nombre, focus = Math.round(CONFIG.FACTEUR_FOCUS * 100);
    const bloc = (titre, lignes) => `<div><h3 style="margin:0 0 4px">${titre}</h3><ul style="margin:0;padding-left:18px">${lignes.map(l => `<li>${l}</li>`).join('')}</ul></div>`;
    return `<div style="display:flex;flex-direction:column">${this.entete('Méthode de calcul · Scrum')}
      <div class="panneau-corps">
        ${bloc('Capacité par sprint', ['<b>Théorique</b> = jours ouvrés du sprint (hors week-ends et fériés) × capacité (%) de chaque membre',
          '<b>Disponible</b> = théorique − absences (demi-journée = 0,5) ; jours avant l’arrivée ou après le départ exclus'])}
        ${bloc('Capacité engageable (Scrum)', [`<b>Engageable</b> = (disponible − cérémonies) × facteur de focus`,
          `cérémonies : ${n(CONFIG.CEREMONIES_JOURS_SPRINT)} j par personne et par sprint (planning, daily, revue, rétrospective, affinage)`,
          `facteur de focus : ${focus} % (interruptions, support, réunions hors sprint)`, `en heures : engageable × ${n(CONFIG.HEURES_PAR_JOUR)} h`])}
        ${bloc('Vélocité', [`<b>Vélocité</b> = moyenne des points terminés sur les ${CONFIG.SPRINTS_MOYENNE_VELOCITE} derniers sprints`,
          '<b>Prévision</b> du sprint = vélocité × (capacité du sprint ÷ capacité moyenne des sprints de référence)',
          'ne se compare pas entre équipes : elle sert à prévoir'])}
        ${bloc('Répartition idéale d’un sprint', ['<b>Jours par catégorie</b> = jours disponibles du sprint × part de la catégorie',
          'parts proposées (pratiques Scrum usuelles, à ajuster) : ' + REPARTITION_SPRINT.map(c => `${C.esc(c.categorie)} ${c.part} %`).join(' · ')])}
      </div></div>`;
  },

  /* ---------- Envoi du daily : mise en place du flux Power Automate ----------
     Le flux appelle la fonction daily_projet de la Data API (migration 019) avec l'id et la clé
     du projet, sans compte : la clé suffit. m = { projetId, cle, apercu (réponse de la fonction) } */
  envoiPowerAutomate(m) {
    const esc = C.esc, p = projet(m.projetId);
    const url = CONFIG.DATA_API_URL + '/rpc/daily_projet';
    const corps = JSON.stringify({ p_projet: m.projetId, p_cle: m.cle });
    const champ = (libelle, valeur) => `<div><div class="libelle">${libelle}</div>
      <div class="ligne-flex"><input class="champ" readonly value="${esc(valeur)}" style="font-family:monospace;font-size:12px">
      <button type="button" class="btn petit" data-action="copierTexte" data-texte="${esc(valeur)}">Copier</button></div></div>`;
    const etape = (n, texte) => `<li style="margin-bottom:6px">${texte}</li>`;
    return `<div style="display:flex;flex-direction:column">${this.entete('Power Automate · daily ' + p.code + ' · ' + p.nom)}
      <div class="panneau-corps">
        <ol style="margin:0;padding-left:18px">
          ${etape(1, 'Nouveau flux <b>planifié</b> : périodicité 1 jour, à l’heure réglée dans l’onglet (fuseau Paris).')}
          ${etape(2, 'Action <b>HTTP</b> : méthode <b>POST</b>, l’URI et le corps ci-dessous, en-tête <span class="code">Content-Type</span> = <span class="code">application/json</span>.')}
          ${etape(3, 'Action <b>Condition</b> : <span class="code">body(\'HTTP\')?[\'a_envoyer\']</span> est égal à <span class="code">true</span> (faux le week-end, un jour non coché ou un férié).')}
          ${etape(4, 'Si oui : <b>Envoyer un e-mail (V2)</b> (Outlook pro ou perso, Gmail) — À : <span class="code">replace(body(\'HTTP\')?[\'destinataires\'], \',\', \';\')</span>, Objet : <span class="code">body(\'HTTP\')?[\'objet\']</span>, Corps : <span class="code">body(\'HTTP\')?[\'html\']</span>.')}
        </ol>
        ${champ('URI', url)}
        ${champ('Corps (contient la clé secrète du projet : ne pas la diffuser)', corps)}
        <div class="ligne-flex"><button type="button" class="btn petit" data-action="renouvelerCleDaily" data-projet="${m.projetId}">Renouveler la clé</button>
          <span class="discret" style="font-size:12px">l’ancienne clé cesse aussitôt de fonctionner : mettez le flux à jour</span></div>
        <div><div class="libelle">Aperçu de l’e-mail du jour</div>
          <div class="carte" style="padding:12px 14px;max-height:260px;overflow:auto">${m.apercu ? m.apercu.html : '<span class="pale">Aperçu indisponible</span>'}</div></div>
      </div></div>`;
  },

  /* ---------- Export du daily en Excel (maquette docs/maquettes/export-daily-excel/) ----------
     Période (raccourcis ou dates libres), projets dont je peux lire le daily (cochés au départ :
     celui filtré à l'écran, sinon tous), options du fichier. Voir telechargerDailyExcel. */
  exportDaily(m) {
    const esc = C.esc;
    const raccourci = (cle, libelle) => `<button type="button" class="puce${m.periode === cle ? ' active' : ''}" data-action="periodeExportDaily" data-periode="${cle}">${libelle}</button>`;
    const projets = projetsDailyVisibles().map(p => `<label class="ligne-flex" style="padding:4px 0">
      <input type="checkbox" name="projet" value="${p.id}" ${m.projets.includes(p.id) ? 'checked' : ''}>${C.code(p.code)}<span>${esc(p.nom)}</span></label>`).join('');
    const option = (nom, libelle) => `<label class="ligne-flex" style="padding:3px 0"><input type="checkbox" name="${nom}" checked>${libelle}</label>`;
    return `<form style="display:flex;flex-direction:column;min-height:0" data-action-envoi="telechargerDailyExcel">
      ${this.entete('Exporter le daily en Excel')}
      <div class="panneau-corps">
        <div><div class="libelle">Période</div>
          <div class="puces" style="margin-bottom:8px">${raccourci('jour', 'Ce jour')}${raccourci('semaine', 'Cette semaine')}${raccourci('mois', 'Ce mois')}${raccourci('moisPrecedent', 'Mois précédent')}</div>
          <div class="deux-colonnes"><div><label class="libelle">Du</label><input class="champ" type="date" name="debut" value="${m.debut}" required></div>
            <div><label class="libelle">Au</label><input class="champ" type="date" name="fin" value="${m.fin}" required></div></div></div>
        <div><div class="libelle">Projets (ceux dont vous pouvez lire le daily)</div>${projets}</div>
        <div><div class="libelle">Contenu du fichier</div>
          <div class="discret" style="padding:3px 0">Onglet « Daily » : une ligne par personne, par projet et par jour ouvré</div>
          ${option('manquants', 'Inclure les absents et les daily manquants')}
          ${option('blocages', 'Ajouter l’onglet « Blocages » : uniquement les blocages signalés')}</div>
      </div>
      <div class="panneau-pied"><span style="flex:1"></span><button type="button" class="btn" data-action="fermer">Annuler</button>
        <button class="btn primaire">Télécharger le fichier Excel</button></div></form>`;
  },

  /* ---------- Objectifs (OKR) de l'équipe courante ---------- */
  objectifs() {
    const esc = C.esc, jour = Calculs.aujourdhui(), eqId = etat.equipeCourante;
    const periode = ui('objectifs', { annee: Number(jour.slice(0, 4)), trimestre: Calculs.trimestreDe(jour) });
    const modifiable = estMembreDe(eqId);
    const objs = etat.d.objectifs.filter(o => o.equipeId === eqId && o.annee === periode.annee && o.trimestre === periode.trimestre);
    const blocs = objs.map(o => {
      const krs = etat.d.resultatsCles.filter(k => k.objectifId === o.id);
      return `<div class="carte" style="padding:12px 14px">
        <div class="ligne-flex">${C.code(o.code)}<b style="flex:1">${esc(o.titre)}</b>
          ${modifiable ? C.liste(Object.keys(CONFIANCES).map(c => ({ valeur: c, libelle: 'Confiance ' + c })), o.confiance, `class="champ" style="width:auto;height:28px" data-action-change="confianceObjectif" data-id="${o.id}"`) : ''}</div>
        ${krs.map(k => `<div class="ligne-flex" style="margin-top:8px">${C.code(k.code)}<span style="flex:1">${esc(k.libelle)}</span>
          ${modifiable ? `<input type="number" min="0" max="100" class="saisie-heure" value="${k.progression}" data-action-change="progressionKr" data-id="${k.id}"> %` : k.progression + ' %'}</div>`).join('')}
        ${modifiable ? `<form class="ligne-flex" style="margin-top:8px" data-action-envoi="ajouterKr" data-objectif="${o.id}">
          <input class="champ" name="libelle" placeholder="Nouveau résultat clé (ex. Disponibilité 99,9 %)" required><button class="btn petit">Ajouter</button></form>` : ''}
      </div>`;
    }).join('');
    return `<div style="display:flex;flex-direction:column;min-height:0">
      ${this.entete(`Objectifs ${equipe(eqId).nom} · T${periode.trimestre} ${periode.annee}`)}
      <div class="panneau-corps">
        <div class="puces">${[1, 2, 3, 4].map(q => `<button class="puce${q === periode.trimestre ? ' active' : ''}" data-action="trimestreObjectifs" data-t="${q}">T${q}</button>`).join('')}</div>
        ${blocs || C.vide('Aucun objectif sur ce trimestre.')}
        ${modifiable ? `<form class="ligne-flex" data-action-envoi="ajouterObjectif"><input class="champ" name="titre" placeholder="Nouvel objectif (ex. Fiabiliser la plateforme)" required>
          <button class="btn primaire">Ajouter l’objectif</button></form>` : ''}
      </div></div>`;
  }
};

// Le créateur est invité dans chaque équipe créée par un autre administrateur ; il accepte d'office à sa
// connexion (fonction SQL accepter_mes_invitations, migration 026) et peut ainsi y donner l'accès à des personnes.
async function inviterCreateur(equipeId) {
  const createur = (etat.d.createur || [])[0];
  if (createur && !etat.estCreateur) await Api.inviterMembre(equipeId, createur.email, 'admin').catch(() => {});
}

Object.assign(Actions, {
  /* Affectations */
  choisirRessourceAffectation: (_, el) => majEtat({ modale: { ...etat.modale, ressourceId: el.value || null } }),
  async enregistrerAffectations(_, form) {
    const f = new FormData(form), rId = f.get('ressource');
    const coches = new Set(f.getAll('projet'));
    const actuelles = etat.d.affectations.filter(a => a.ressourceId === rId);
    await executer(async () => {
      for (const p of etat.d.projets.filter(x => peutEditerProjet(x))) {
        const a = actuelles.find(x => x.projetId === p.id), role = f.get('role-' + p.id);
        if (coches.has(p.id) && !a) await Api.creer('affectations', { projetId: p.id, ressourceId: rId, role });
        else if (coches.has(p.id) && a && a.role !== role) await Api.modifier('affectations', { id: 'eq.' + a.id }, { role });
        else if (!coches.has(p.id) && a) await Api.supprimer('affectations', { id: 'eq.' + a.id });
      }
      etat.modale = null;
    }, 'affectations');
  },

  /* Ressources */
  enregistrerRessource(d, form) {
    const f = Object.fromEntries(new FormData(form)); f.capacite = Number(f.capacite); f.dateArrivee = f.dateArrivee || null; f.dateDepart = f.dateDepart || null;
    if (f.dateArrivee && f.dateDepart && f.dateDepart < f.dateArrivee) return notifier('La date de départ précède la date d’arrivée', 'erreur');
    // Case Administrateur (créateur seulement) : ligne de la table administrateurs, hors fiche
    const administrateur = f.administrateur === 'on'; delete f.administrateur;
    executer(async () => {
      if (d.id) {
        const r = ressource(d.id);
        await Api.modifier('ressources', { id: 'eq.' + d.id }, f);
        if (etat.estCreateur && r.userId && administrateur !== estAdministrateur(r)) {
          if (administrateur) await Api.creer('administrateurs', { userId: r.userId });
          else await Api.supprimer('administrateurs', { user_id: 'eq.' + r.userId });
        }
        etat.modale = null; return;
      }
      const [creee] = await Api.creer('ressources', { ...f, equipeId: d.equipe });
      // Venue de « + Nouvelle personne » : on enchaîne sur son affectation, la personne sélectionnée
      etat.modale = d.affecter ? { type: 'affectation', ressourceId: creee.id, projetId: d.retourProjet || null } : null;
    }, 'ressources', 'administrateurs');
  },

  // Nouveau responsable d'une équipe : depuis l'équipe (personne choisie) ou depuis la fiche (équipe choisie)
  enregistrerResponsable(d, form) {
    const f = Object.fromEntries(new FormData(form));
    const equipeId = d.equipe || f.equipe, ressourceId = d.ressource || f.ressource;
    executer(async () => { await Api.creer('responsables_equipe', { equipeId, ressourceId }); etat.modale = d.ressource ? { type: 'ressource', id: d.ressource } : null; }, 'responsablesEquipe');
  },
  // Depuis la fenêtre d'affectation : créer la personne puis y revenir
  nouvellePersonneAffectation: d => majEtat({ modale: { type: 'ressource', id: null, equipeId: d.equipe, affecter: true, retourProjet: etat.modale.projetId || '' } }),
  supprimerRessource(d) {
    if (!confirm('Supprimer cette personne ? Ses affectations, absences et temps seront supprimés.')) return;
    executer(async () => { await Api.supprimer('ressources', { id: 'eq.' + d.id }); etat.modale = null; }, 'ressources', 'affectations', 'absences', 'temps');
  },


  /* Équipes */
  async modifierEquipe(d) {
    majEtat({ modale: { type: 'equipe', id: d.id, organisation: null } });
    try { const organisation = await Api.lireOrganisation(d.id); if (etat.modale && etat.modale.id === d.id) majEtat({ modale: { ...etat.modale, organisation } }); }
    catch (e) { notifier('Membres illisibles : ' + e.message, 'erreur'); }
  },
  // Création : organisation Neon Auth (le créateur en devient propriétaire) + ligne « equipes »
  async enregistrerEquipe(d, form) {
    const f = Object.fromEntries(new FormData(form)); f.prefixe = f.prefixe.toUpperCase(); f.actif = f.actif !== 'false';
    // Une direction n'est rattachée à rien ; champ vide = pas de rattachement (la base contrôle aussi)
    f.parentId = f.type === 'direction' ? null : (f.parentId || null);
    if (f.responsableId === '') f.responsableId = null;
    await executer(async () => {
      if (d.id) { await Api.modifier('equipes', { id: 'eq.' + d.id }, f); }
      else {
        const slug = f.nom.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36);
        const org = await Api.creerOrganisation(f.nom, slug);
        await inviterCreateur(org.id);
        await Api.creer('equipes', { id: org.id, nom: f.nom, prefixe: f.prefixe, couleur: f.couleur, type: f.type, parentId: f.parentId, actif: f.actif });
        etat.organisations = await Api.listerOrganisations();
        etat.rolesEquipe[org.id] = 'owner';
        // Première équipe de l'utilisateur : elle devient l'équipe ouverte
        if (!etat.equipeCourante) { etat.equipeCourante = org.id; ecrireMemoire('equipe', org.id); }
      }
      etat.modale = null;
    }, 'equipes');
  },
  async inviterDansEquipe(d, form) {
    const f = new FormData(form);
    try { await Api.inviterMembre(d.id, f.get('email'), f.get('role')); notifier('Invitation envoyée'); await Actions.modifierEquipe({ id: d.id }); }
    catch (e) { notifier(e.message, 'erreur'); }
  },

  /* Objectifs */
  trimestreObjectifs: d => majUi('objectifs', { trimestre: Number(d.t) }),
  ajouterObjectif(_, form) {
    const p = ui('objectifs', { annee: Number(Calculs.aujourdhui().slice(0, 4)), trimestre: Calculs.trimestreDe(Calculs.aujourdhui()) });
    const numero = etat.d.objectifs.filter(o => o.equipeId === etat.equipeCourante && o.annee === p.annee).length + 1;
    executer(() => Api.creer('objectifs', { equipeId: etat.equipeCourante, annee: p.annee, trimestre: p.trimestre, code: 'O' + numero, titre: new FormData(form).get('titre') }), 'objectifs');
  },
  confianceObjectif: (d, el) => executer(() => Api.modifier('objectifs', { id: 'eq.' + d.id }, { confiance: el.value }), 'objectifs'),
  ajouterKr(d, form) {
    const o = parId('objectifs', d.objectif), n = etat.d.resultatsCles.filter(k => k.objectifId === o.id).length + 1;
    executer(() => Api.creer('resultats_cles', { objectifId: o.id, code: `KR${o.code.slice(1)}.${n}`, libelle: new FormData(form).get('libelle') }), 'resultatsCles');
  },
  progressionKr(d, el) {
    const v = Math.max(0, Math.min(100, Number(el.value) || 0));
    executer(() => Api.modifier('resultats_cles', { id: 'eq.' + d.id }, { progression: v }), 'resultatsCles');
  }
});
