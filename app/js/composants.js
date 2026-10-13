/* ============================================================
   Composants d'affichage réutilisables (HTML en chaînes)
   ------------------------------------------------------------
   Toute donnée venant de la base passe par esc() avant d'être
   insérée dans le HTML (protection contre l'injection de balises).
   ============================================================ */
'use strict';

const C = (() => {
  // Échappement HTML
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Teinte claire d'une couleur (fond des badges) : mélange avec du blanc
  function teinte(hex, force = 0.12) {
    const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const m = x => Math.round(255 - (255 - x) * force);
    return `rgb(${m(r)},${m(g)},${m(b)})`;
  }

  // Badge (statut, rôle...) : couleur de texte + fond teinté
  const badge = (texte, couleur, fond) =>
    `<span class="badge" style="color:${couleur};background:${fond || teinte(couleur)}">${esc(texte)}</span>`;
  // Badge d'un ton de la palette (TONS, config.js) : neutre, succes, info, attention, violet
  const badgeTon = (texte, ton) => badge(texte, TONS[ton].texte, TONS[ton].fond);
  // Badge d'une valeur de référentiel (couleur administrée)
  const badgeRef = (refId, libelle) => libelle ? badge(libelle, couleurDe(refId, libelle)) : '';
  const badgeFeuille = statut => { const s = STATUTS_FEUILLE[statut] || STATUTS_FEUILLE.en_saisie; return badge(s.libelle, s.texte, s.fond); };

  const pastille = couleur => `<span class="pastille" style="background:${couleur}"></span>`;
  const avatar = (nom, grand = false) => `<span class="avatar${grand ? ' grand' : ''}">${esc(Calculs.initiales(nom))}</span>`;
  const code = texte => `<span class="code">${esc(texte)}</span>`;
  // Barre d'outils en haut d'un onglet : carte avec les choix à gauche, boutons ou note à droite
  const barreOutils = (gauche, droite) => `<div class="carte encart-compact"><div class="ligne-flex entre">
      <div class="ligne-flex">${gauche}</div>${droite}</div></div>`;
  // Compte non relié à une fiche ressource (Daily, Saisir mes heures) : la marche à suivre
  const compteSansFiche = () => `<div class="carte encart">Votre compte n’est lié à aucune fiche ressource :
    renseignez l’email de votre compte sur votre fiche (Liste des ressources), puis reconnectez-vous.</div>`;
  // Logo et nom de l'application (barre latérale ; « grand » sur les écrans de connexion)
  const marque = (grand = false) => `<div class="marque"><div class="logo${grand ? ' grand' : ''}"><i></i><i></i><i></i></div>
    <div class="marque-nom">${esc(CONFIG.NOM_APPLICATION)}</div></div>`;
  /* Mention de propriété (maquette docs/maquettes/mention-ciritec/) : courte en bas du menu,
     complète (« logiciel propriétaire ») sur les écrans de connexion */
  const mentionPropriete = (complete = false) => `<div class="mention-propriete">© ${CONFIG.ANNEE_DROITS} <b>${esc(CONFIG.PROPRIETAIRE)}</b>
    · Tous droits réservés${complete ? ` · ${esc(CONFIG.NOM_APPLICATION)} est un logiciel propriétaire` : ''}</div>`;

  // Barre de progression (pourcentage 0-100)
  const barre = (pct, couleur = COULEURS.primaire, classe = '') =>
    `<span class="barre ${classe}"><span style="width:${Math.max(0, Math.min(100, pct))}%;background:${couleur}"></span></span>`;

  // Couleur de barre selon le statut du projet
  function couleurStatutProjet(statut) {
    if (statut === STATUTS_PROJET.A_RISQUE) return COULEURS.alerte;
    if (statut === STATUTS_PROJET.EN_RETARD) return COULEURS.danger;
    if (statut === STATUTS_PROJET.TERMINE) return COULEURS.succes;
    return COULEURS.primaire;
  }

  // Titre d'écran + sous-titre + zone d'actions à droite
  const entete = (titre, sousTitre, actions = '') => `
    <div class="entete-ecran">
      <div><h1>${esc(titre)}</h1><div class="sous-titre">${sousTitre}</div></div>
      <div class="actions-ecran">${actions}</div>
    </div>`;

  // Onglets : liste [{ id, libelle, compte }] ; action = nom d'action appelée avec data-id
  const onglets = (liste, actif, action) => `
    <div class="onglets">${liste.map(o => `
      <button class="onglet${o.id === actif ? ' actif' : ''}" data-action="${action}" data-id="${o.id}">
        ${esc(o.libelle)}${o.compte !== undefined ? ` <span class="compte">${o.compte}</span>` : ''}
      </button>`).join('')}
    </div>`;

  // Carte indicateur (KPI)
  const kpi = (libelle, valeur, complement = '', cleAide = '') => `
    <div class="carte kpi"><div class="kpi-libelle">${esc(libelle)}${cleAide ? ' ' + aide(cleAide) : ''}</div>
      <div class="kpi-valeur">${valeur}<span class="kpi-complement">${complement}</span></div></div>`;

  // Liste déroulante : options [{ valeur, libelle, desactive }] ou chaînes
  function liste(options, valeur, attributs = '') {
    return `<select ${attributs}>${options.map(o => {
      const v = typeof o === 'object' ? o.valeur : o, l = typeof o === 'object' ? o.libelle : o;
      const desactive = typeof o === 'object' && o.desactive ? ' disabled' : '';
      return `<option value="${esc(v)}"${String(v) === String(valeur ?? '') ? ' selected' : ''}${desactive}>${esc(l)}</option>`;
    }).join('')}</select>`;
  }

  // Bulle d'information « ⓘ » : texte de AIDES (config.js), visible au survol ou au clavier (tabulation)
  const aide = cle => {
    const texte = typeof AIDES[cle] === 'function' ? AIDES[cle]() : (AIDES[cle] || '');
    return `<span class="aide" tabindex="0" role="note" aria-label="${esc(texte)}">ⓘ<span class="bulle">${esc(texte)}</span></span>`;
  };

  /* Place la bulle d'une icône ⓘ sous l'icône (au-dessus s'il n'y a pas la place), sans
     sortir de la fenêtre. Appelée au survol et au focus (écouteurs en bas de ce fichier). */
  function placerBulle(icone) {
    const bulle = icone.querySelector('.bulle'); if (!bulle) return;
    const r = icone.getBoundingClientRect(), largeur = 280, marge = 8;
    const gauche = Math.min(Math.max(r.left + r.width / 2 - largeur / 2, marge), window.innerWidth - largeur - marge);
    // Dans une fenêtre modale (centrée par transform), « fixed » se repère sur la modale : on corrige
    const modale = icone.closest('.modale'), origine = modale ? modale.getBoundingClientRect() : { left: 0, top: 0 };
    const hauteur = bulle.offsetHeight;                      // la bulle est affichée (survol / focus)
    const haut = r.bottom + 6 + hauteur > window.innerHeight - marge ? Math.max(marge, r.top - 6 - hauteur) : r.bottom + 6;
    bulle.style.left = (gauche - origine.left) + 'px';
    bulle.style.top = (haut - origine.top) + 'px';
  }

  const vide = texte => `<div class="vide">${esc(texte)}</div>`;

  // Petites icônes (traits, couleur du texte) : direction, équipe, projet, modifier, supprimer, recherche
  const TRACES = {
    direction: 'M4 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M16 9h3a1 1 0 0 1 1 1v11M8 7h4M8 11h4M8 15h4M3 21h18',
    equipe: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M21 19v-1a4 4 0 0 0-3-3.8M16 4.2a3 3 0 0 1 0 5.6',
    projet: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    modifier: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
    supprimer: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    recherche: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3'
  };
  const icone = (nom, taille = 16) => `<svg width="${taille}" height="${taille}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round" style="flex:0 0 auto"><path d="${TRACES[nom]}"></path></svg>`;
  // Bouton-icône d'action ; desactive = bouton grisé avec l'explication en infobulle
  const boutonIcone = (nom, action, attributs, titre, desactive = false) =>
    `<button class="btn-icone" title="${esc(titre)}" ${desactive ? 'disabled' : `data-action="${action}" ${attributs}`}>${icone(nom)}</button>`;
  // Statut actif / inactif ; libellés au féminin par défaut (unités), ['Actif', 'Inactif'] pour une personne
  const badgeActif = (actif, libelles = ['Active', 'Inactive']) => actif ? badgeTon(libelles[0], 'succes') : badgeTon(libelles[1], 'neutre');

  return {
    aide, placerBulle, esc, teinte, badge, badgeTon, badgeRef, badgeFeuille, badgeActif, pastille, avatar, code, barreOutils, compteSansFiche,
    marque, mentionPropriete, barre, couleurStatutProjet, entete, onglets, kpi, liste, vide, icone, boutonIcone
  };
})();

// Bulles ⓘ : positionnées à l'ouverture (voir C.placerBulle)
['mouseover', 'focusin'].forEach(evt => document.addEventListener(evt, e => {
  const icone = e.target.closest && e.target.closest('.aide');
  if (icone) C.placerBulle(icone);
}));
