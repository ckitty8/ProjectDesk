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
  // Badge d'une valeur de référentiel (couleur administrée)
  const badgeRef = (refId, libelle) => libelle ? badge(libelle, couleurDe(refId, libelle)) : '';
  const badgeDemande = statut => { const s = STATUTS_DEMANDE[statut]; return badge(s.libelle, s.texte, s.fond); };
  const badgeFeuille = statut => { const s = STATUTS_FEUILLE[statut] || STATUTS_FEUILLE.en_saisie; return badge(s.libelle, s.texte, s.fond); };

  const pastille = couleur => `<span class="pastille" style="background:${couleur}"></span>`;
  const avatar = (nom, grand = false) => `<span class="avatar${grand ? ' grand' : ''}">${esc(Calculs.initiales(nom))}</span>`;
  const code = texte => `<span class="code">${esc(texte)}</span>`;

  // Barre de progression (pourcentage 0-100)
  const barre = (pct, couleur = '#003CC8', classe = '') =>
    `<span class="barre ${classe}"><span style="width:${Math.max(0, Math.min(100, pct))}%;background:${couleur}"></span></span>`;

  // Couleur de barre selon le statut du projet
  function couleurStatutProjet(statut) {
    if (statut === STATUTS_PROJET.A_RISQUE) return '#D98A1C';
    if (statut === STATUTS_PROJET.EN_RETARD) return '#D14343';
    if (statut === STATUTS_PROJET.TERMINE) return '#0F8A6B';
    return '#003CC8';
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
  const kpi = (libelle, valeur, complement = '') => `
    <div class="carte kpi"><div class="kpi-libelle">${esc(libelle)}</div>
      <div class="kpi-valeur">${valeur}<span class="kpi-complement">${complement}</span></div></div>`;

  // Liste déroulante : options [{ valeur, libelle }] ou chaînes
  function liste(options, valeur, attributs = '') {
    return `<select ${attributs}>${options.map(o => {
      const v = typeof o === 'object' ? o.valeur : o, l = typeof o === 'object' ? o.libelle : o;
      return `<option value="${esc(v)}"${String(v) === String(valeur ?? '') ? ' selected' : ''}>${esc(l)}</option>`;
    }).join('')}</select>`;
  }

  const vide = texte => `<div class="vide">${esc(texte)}</div>`;

  return { esc, teinte, badge, badgeRef, badgeDemande, badgeFeuille, pastille, avatar, code, barre, couleurStatutProjet, entete, onglets, kpi, liste, vide };
})();
