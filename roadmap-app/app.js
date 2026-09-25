'use strict';

/* ============================================================
   State & persistence
   ============================================================ */
const STORAGE_KEY = 'roadmap_pm_items_v1';
const CAPACITY_KEY = 'roadmap_pm_capacity_v1';

let state = {
  items: [],
  capacity: { ...DEFAULT_CAPACITY },
  view: 'backlog',
  search: '',
  filters: { statut: '', categorie: '', planification: '', etat: '' },
  sort: { field: 'rang', dir: 'asc' },
  editingId: null
};

function uid() {
  return 'it_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      state.items = JSON.parse(raw);
    } else {
      state.items = SEED_ITEMS.map(it => ({ id: uid(), ...it }));
    }
  } catch (e) {
    state.items = SEED_ITEMS.map(it => ({ id: uid(), ...it }));
  }
  try {
    const rawCap = localStorage.getItem(CAPACITY_KEY);
    if (rawCap) state.capacity = { ...DEFAULT_CAPACITY, ...JSON.parse(rawCap) };
  } catch (e) { /* ignore */ }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
}
function saveCapacity() {
  localStorage.setItem(CAPACITY_KEY, JSON.stringify(state.capacity));
}

/* ============================================================
   Business logic (repris des formules Excel)
   Score = (0.5*ImpactClient + 0.3*ImpactCollaborateur) / (0.2*Complexité)
   Fixe  = 1 si Stratégique = "Oui" sinon 0
   Clé   = (1-Fixe)*100000 + PrioritéDemandeur*1000 + (1000-Score)
   Rang  = rang croissant sur la Clé (plus petit = plus prioritaire)
   ============================================================ */
function computeScore(item) {
  const impact = 0.5 * Number(item.impactClient || 0) + 0.3 * Number(item.impactCollaborateur || 0);
  const denom = 0.2 * Number(item.complexite || 0);
  if (!denom) return 0;
  const v = impact / denom;
  return Math.round(v * 100) / 100;
}
function computeFixe(item) { return item.strategique === 'Oui' ? 1 : 0; }
function computeCle(item, score, fixe) {
  return (1 - fixe) * 100000 + Number(item.prioriteDemandeur || 3) * 1000 + (1000 - score);
}

function enrichItems(items) {
  const enriched = items.map(it => {
    const score = computeScore(it);
    const fixe = computeFixe(it);
    const cle = computeCle(it, score, fixe);
    return { ...it, score, fixe, cle };
  });
  // Rang: on classe uniquement les demandes actives (hors Terminé / Annulée)
  const ranked = enriched
    .filter(it => it.statut !== 'Terminé' && it.statut !== 'Annulée')
    .sort((a, b) => a.cle - b.cle);
  const rangMap = new Map(ranked.map((it, idx) => [it.id, idx + 1]));
  return enriched.map(it => ({ ...it, rang: rangMap.get(it.id) || null }));
}

function getEnrichedItems() {
  return enrichItems(state.items);
}

/* ============================================================
   Filtering / sorting / search
   ============================================================ */
function applyFilters(items) {
  const { search, filters } = state;
  let out = items;
  if (filters.statut) out = out.filter(i => i.statut === filters.statut);
  if (filters.categorie) out = out.filter(i => i.categorie === filters.categorie);
  if (filters.planification) out = out.filter(i => i.planification === filters.planification);
  if (filters.etat) out = out.filter(i => i.etat === filters.etat);
  if (search) {
    const s = search.toLowerCase();
    out = out.filter(i =>
      (i.demande || '').toLowerCase().includes(s) ||
      (i.demandeur || '').toLowerCase().includes(s) ||
      (i.thematique || '').toLowerCase().includes(s) ||
      (i.parcours || '').toLowerCase().includes(s) ||
      (i.us || '').toLowerCase().includes(s)
    );
  }
  return out;
}

function sortItems(items) {
  const { field, dir } = state.sort;
  const mult = dir === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    let av = a[field], bv = b[field];
    if (av == null) av = '';
    if (bv == null) bv = '';
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    if (av < bv) return -1 * mult;
    if (av > bv) return 1 * mult;
    return 0;
  });
}

/* ============================================================
   Rendering: shell / navigation
   ============================================================ */
function render() {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === state.view));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${state.view}`));
  const items = getEnrichedItems();
  if (state.view === 'backlog') renderBacklog(items);
  if (state.view === 'kanban') renderKanban(items);
  if (state.view === 'timeline') renderTimeline(items);
  if (state.view === 'dashboard') renderDashboard(items);
  if (state.view === 'capacity') renderCapacity(items);
  renderFilterOptions();
}

function renderFilterOptions() {
  const selStatut = document.getElementById('filter-statut');
  const selCat = document.getElementById('filter-categorie');
  const selPlan = document.getElementById('filter-planification');
  const selEtat = document.getElementById('filter-etat');
  if (selStatut.options.length <= 1) {
    fillSelect(selStatut, ['', ...ALL_STATUTS], state.filters.statut, true);
    fillSelect(selCat, ['', ...CATEGORIES], state.filters.categorie, true);
    fillSelect(selPlan, ['', ...TRIMESTRES], state.filters.planification, true);
    fillSelect(selEtat, ['', ...ETATS], state.filters.etat, true);
  }
}

function fillSelect(select, options, current, keepFirstLabel) {
  select.innerHTML = '';
  options.forEach((opt, idx) => {
    const o = document.createElement('option');
    o.value = opt;
    o.textContent = opt === '' && keepFirstLabel ? (select.dataset.placeholder || 'Tous') : opt;
    if (opt === current) o.selected = true;
    select.appendChild(o);
  });
}

/* ============================================================
   Badges helpers
   ============================================================ */
function badge(text, color) {
  if (!text) return '';
  return `<span class="badge" style="--c:${color || '#94a3b8'}">${escapeHtml(text)}</span>`;
}
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('fr-FR');
}

/* ============================================================
   Backlog (table view)
   ============================================================ */
function renderBacklog(items) {
  const filtered = sortItems(applyFilters(items));
  const tbody = document.getElementById('backlog-tbody');
  document.getElementById('backlog-count').textContent = `${filtered.length} demande(s)`;
  tbody.innerHTML = filtered.map(it => `
    <tr data-id="${it.id}">
      <td class="rang-cell">${it.rang ?? '—'}</td>
      <td>${badge(it.categorie, CATEGORIE_COLORS[it.categorie])}</td>
      <td class="col-wide">
        <div class="demande-title">${escapeHtml(it.demande) || '<span class="muted">(sans titre)</span>'}</div>
        <div class="demande-sub">${escapeHtml(it.thematique || '')}${it.us ? ' · US ' + escapeHtml(it.us) : ''}</div>
      </td>
      <td>${escapeHtml(it.demandeur || '')}</td>
      <td>${badge(it.etat, ETAT_COLORS[it.etat])}</td>
      <td>${badge(it.statut, STATUT_COLORS[it.statut])}</td>
      <td>${it.planification ? badge(it.planification, '#6366f1') : ''}</td>
      <td class="num">${it.score}</td>
      <td class="num">${it.chiffrageDSI ?? ''}</td>
      <td class="num">${it.strategique === 'Oui' ? '★' : ''}</td>
      <td>
        <button class="icon-btn btn-edit" title="Modifier">✎</button>
        <button class="icon-btn btn-delete" title="Supprimer">🗑</button>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="11" class="empty-row">Aucune demande ne correspond aux filtres.</td></tr>`;

  tbody.querySelectorAll('.btn-edit').forEach(b => b.addEventListener('click', e => openDrawer(e.target.closest('tr').dataset.id)));
  tbody.querySelectorAll('.btn-delete').forEach(b => b.addEventListener('click', e => deleteItem(e.target.closest('tr').dataset.id)));
  tbody.querySelectorAll('tr[data-id]').forEach(tr => tr.addEventListener('dblclick', () => openDrawer(tr.dataset.id)));
}

/* ============================================================
   Kanban view
   ============================================================ */
function renderKanban(items) {
  const filtered = applyFilters(items);
  const board = document.getElementById('kanban-board');
  const cols = [...STATUT_PIPELINE, ...STATUT_HORS_FLUX];
  board.innerHTML = cols.map(statut => {
    const colItems = filtered.filter(i => i.statut === statut).sort((a, b) => (a.rang ?? 9999) - (b.rang ?? 9999));
    return `
      <div class="kanban-col" data-statut="${escapeHtml(statut)}">
        <div class="kanban-col-header" style="--c:${STATUT_COLORS[statut]}">
          <span>${escapeHtml(statut)}</span>
          <span class="kanban-count">${colItems.length}</span>
        </div>
        <div class="kanban-col-body" data-dropzone="${escapeHtml(statut)}">
          ${colItems.map(cardHtml).join('')}
        </div>
      </div>`;
  }).join('');

  board.querySelectorAll('.kanban-card').forEach(card => {
    card.addEventListener('click', () => openDrawer(card.dataset.id));
    card.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', card.dataset.id);
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });
  board.querySelectorAll('[data-dropzone]').forEach(zone => {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('dragover');
      const id = e.dataTransfer.getData('text/plain');
      const item = state.items.find(i => i.id === id);
      if (item) { item.statut = zone.dataset.dropzone; saveData(); render(); }
    });
  });
}

function cardHtml(it) {
  return `
    <div class="kanban-card" draggable="true" data-id="${it.id}">
      <div class="kanban-card-top">
        ${badge(it.categorie, CATEGORIE_COLORS[it.categorie])}
        ${it.strategique === 'Oui' ? '<span class="star" title="Stratégique">★</span>' : ''}
      </div>
      <div class="kanban-card-title">${escapeHtml(it.demande) || '(sans titre)'}</div>
      <div class="kanban-card-meta">
        <span>${escapeHtml(it.demandeur || '')}</span>
        ${it.chiffrageDSI ? `<span>${it.chiffrageDSI} JH</span>` : ''}
      </div>
      ${it.planification ? `<div class="kanban-card-plan">${escapeHtml(it.planification)}</div>` : ''}
    </div>`;
}

/* ============================================================
   Timeline / Roadmap view (par trimestre)
   ============================================================ */
function renderTimeline(items) {
  const filtered = applyFilters(items).filter(i => i.statut !== 'Annulée');
  const wrap = document.getElementById('timeline-board');
  const groups = ['(Non planifié)', ...TRIMESTRES];
  wrap.innerHTML = groups.map(g => {
    const groupItems = filtered.filter(i => (i.planification || '(Non planifié)') === g)
      .sort((a, b) => (a.rang ?? 9999) - (b.rang ?? 9999));
    if (groupItems.length === 0 && g === '(Non planifié)') return '';
    const totalJH = groupItems.reduce((s, i) => s + Number(i.chiffrageDSI || 0), 0);
    return `
      <div class="timeline-col">
        <div class="timeline-col-header">
          <div class="timeline-col-title">${g}</div>
          <div class="timeline-col-sub">${groupItems.length} item(s) · ${totalJH} JH</div>
        </div>
        <div class="timeline-col-body">
          ${groupItems.map(cardHtml).join('') || '<div class="empty-row small">—</div>'}
        </div>
      </div>`;
  }).join('');
  wrap.querySelectorAll('.kanban-card').forEach(card => card.addEventListener('click', () => openDrawer(card.dataset.id)));
}

/* ============================================================
   Dashboard
   ============================================================ */
function renderDashboard(items) {
  const el = document.getElementById('view-dashboard');
  const active = items.filter(i => i.etat !== 'Annulé');
  const total = items.length;
  const termine = items.filter(i => i.statut === 'Terminé').length;
  const enCours = items.filter(i => STATUT_PIPELINE.slice(1, -1).includes(i.statut)).length;
  const ouvert = items.filter(i => i.etat === 'Ouvert').length;
  const chargeTotale = items.filter(i => i.statut !== 'Annulée').reduce((s, i) => s + Number(i.chiffrageDSI || 0), 0);
  const chargeRestante = items.filter(i => i.statut !== 'Terminé' && i.statut !== 'Annulée').reduce((s, i) => s + Number(i.chiffrageDSI || 0), 0);
  const avancement = total ? Math.round((termine / total) * 100) : 0;

  const byStatut = ALL_STATUTS.map(s => ({ label: s, value: items.filter(i => i.statut === s).length, color: STATUT_COLORS[s] }));
  const byCategorie = CATEGORIES.map(c => ({ label: c, value: items.filter(i => i.categorie === c).length, color: CATEGORIE_COLORS[c] }));

  const top = [...items].filter(i => i.statut !== 'Terminé' && i.statut !== 'Annulée')
    .sort((a, b) => (a.rang ?? 9999) - (b.rang ?? 9999)).slice(0, 8);

  el.innerHTML = `
    <div class="kpi-grid">
      ${kpiCard('Demandes au total', total, '')}
      ${kpiCard('Ouvertes', ouvert, '')}
      ${kpiCard('En cours de traitement', enCours, '')}
      ${kpiCard('Terminées', termine, `${avancement}% du backlog`)}
      ${kpiCard('Charge totale', chargeTotale.toFixed(1) + ' JH', '')}
      ${kpiCard('Charge restante', chargeRestante.toFixed(1) + ' JH', 'non livrée')}
    </div>
    <div class="dash-charts">
      <div class="card">
        <h3>Répartition par statut</h3>
        ${barChart(byStatut)}
      </div>
      <div class="card">
        <h3>Répartition par catégorie métier</h3>
        ${barChart(byCategorie)}
      </div>
    </div>
    <div class="card">
      <h3>Top priorités (rang de traitement DSI)</h3>
      <table class="mini-table">
        <thead><tr><th>Rang</th><th>Demande</th><th>Catégorie</th><th>Statut</th><th>Score</th><th>Charge (JH)</th></tr></thead>
        <tbody>
          ${top.map(it => `
            <tr class="clickable" data-id="${it.id}">
              <td>${it.rang}</td>
              <td>${escapeHtml(it.demande) || '—'}</td>
              <td>${badge(it.categorie, CATEGORIE_COLORS[it.categorie])}</td>
              <td>${badge(it.statut, STATUT_COLORS[it.statut])}</td>
              <td>${it.score}</td>
              <td>${it.chiffrageDSI ?? ''}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
  el.querySelectorAll('tr.clickable').forEach(tr => tr.addEventListener('click', () => openDrawer(tr.dataset.id)));
}

function kpiCard(label, value, sub) {
  return `<div class="kpi-card"><div class="kpi-value">${value}</div><div class="kpi-label">${label}</div>${sub ? `<div class="kpi-sub">${sub}</div>` : ''}</div>`;
}

function barChart(data) {
  const max = Math.max(1, ...data.map(d => d.value));
  return `<div class="barchart">
    ${data.map(d => `
      <div class="barchart-row">
        <div class="barchart-label">${escapeHtml(d.label)}</div>
        <div class="barchart-track"><div class="barchart-fill" style="width:${(d.value / max * 100)}%;background:${d.color}"></div></div>
        <div class="barchart-value">${d.value}</div>
      </div>`).join('')}
  </div>`;
}

/* ============================================================
   Capacité (simulateur d'équipe)
   ============================================================ */
function renderCapacity(items) {
  const el = document.getElementById('view-capacity');
  const cap = state.capacity;
  const capaciteJHParTrimestre = (cap.nbDev * cap.joursOuvresParTrimestre);
  const capacitePOParTrimestre = (cap.nbPO * cap.joursOuvresParTrimestre);

  const chargeParTrimestre = {};
  TRIMESTRES.forEach(t => { chargeParTrimestre[t] = 0; });
  items.filter(i => i.statut !== 'Annulée' && i.statut !== 'Terminé' && i.planification)
    .forEach(i => { chargeParTrimestre[i.planification] = (chargeParTrimestre[i.planification] || 0) + Number(i.chiffrageDSI || 0); });

  el.innerHTML = `
    <div class="card">
      <h3>Paramètres de l'équipe</h3>
      <div class="capacity-form">
        <label>Développeurs<input type="number" min="0" step="1" id="cap-nbDev" value="${cap.nbDev}"></label>
        <label>PO / Chefs de projet<input type="number" min="0" step="1" id="cap-nbPO" value="${cap.nbPO}"></label>
        <label>TJM développeur (€)<input type="number" min="0" step="50" id="cap-tjmDev" value="${cap.tjmDev}"></label>
        <label>TJM PO / CP (€)<input type="number" min="0" step="50" id="cap-tjmPO" value="${cap.tjmPO}"></label>
        <label>Jours ouvrés / trimestre / personne<input type="number" min="0" step="1" id="cap-jours" value="${cap.joursOuvresParTrimestre}"></label>
      </div>
      <p class="hint">Capacité dev estimée : <b>${capaciteJHParTrimestre} JH/trimestre</b> (${(capaciteJHParTrimestre * cap.tjmDev).toLocaleString('fr-FR')} €) ·
      Capacité PO estimée : <b>${capacitePOParTrimestre} JH/trimestre</b> (${(capacitePOParTrimestre * cap.tjmPO).toLocaleString('fr-FR')} €)</p>
    </div>
    <div class="card">
      <h3>Capacité vs charge planifiée (par trimestre)</h3>
      <table class="mini-table">
        <thead><tr><th>Trimestre</th><th>Capacité dev (JH)</th><th>Charge planifiée (JH)</th><th>Écart</th><th></th></tr></thead>
        <tbody>
          ${TRIMESTRES.map(t => {
            const charge = chargeParTrimestre[t];
            const ecart = capaciteJHParTrimestre - charge;
            const pct = Math.min(100, (charge / Math.max(1, capaciteJHParTrimestre)) * 100);
            const over = ecart < 0;
            return `<tr>
              <td>${t}</td>
              <td>${capaciteJHParTrimestre}</td>
              <td>${charge.toFixed(1)}</td>
              <td class="${over ? 'neg' : 'pos'}">${ecart >= 0 ? '+' : ''}${ecart.toFixed(1)}</td>
              <td class="cap-bar"><div class="cap-bar-track"><div class="cap-bar-fill ${over ? 'over' : ''}" style="width:${pct}%"></div></div></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      <p class="hint">Charge = somme du "Chiffrage DSI (JH)" des demandes non terminées/annulées, regroupées par trimestre de planification.</p>
    </div>
  `;

  ['nbDev', 'nbPO', 'tjmDev', 'tjmPO'].forEach(k => {
    document.getElementById(`cap-${k}`).addEventListener('change', e => {
      cap[k] = Number(e.target.value) || 0; saveCapacity(); render();
    });
  });
  document.getElementById('cap-jours').addEventListener('change', e => {
    cap.joursOuvresParTrimestre = Number(e.target.value) || 0; saveCapacity(); render();
  });
}

/* ============================================================
   Drawer (formulaire d'ajout / édition)
   ============================================================ */
function fieldRow(key, control) {
  return `<div class="form-field"><label>${FIELD_LABELS[key] || key}</label>${control}</div>`;
}
function inputText(key, val) { return `<input type="text" data-field="${key}" value="${escapeHtml(val || '')}">`; }
function inputTextarea(key, val) { return `<textarea data-field="${key}" rows="2">${escapeHtml(val || '')}</textarea>`; }
function inputDate(key, val) { return `<input type="date" data-field="${key}" value="${val || ''}">`; }
function inputNumber(key, val, step) { return `<input type="number" step="${step || 1}" data-field="${key}" value="${val ?? ''}">`; }
function selectField(key, val, options, allowEmpty) {
  const opts = allowEmpty ? ['', ...options] : options;
  return `<select data-field="${key}">${opts.map(o => `<option value="${escapeHtml(o)}" ${String(o) === String(val ?? '') ? 'selected' : ''}>${o === '' ? '—' : escapeHtml(String(o))}</option>`).join('')}</select>`;
}

function drawerFormHtml(item) {
  return `
    <div class="drawer-section">
      <h4>Identification de la demande</h4>
      ${fieldRow('demandeur', inputText('demandeur', item.demandeur))}
      ${fieldRow('parcours', inputText('parcours', item.parcours))}
      ${fieldRow('categorie', selectField('categorie', item.categorie, CATEGORIES, true))}
      ${fieldRow('moisDemande', inputDate('moisDemande', item.moisDemande))}
      ${fieldRow('us', inputText('us', item.us))}
      ${fieldRow('thematique', inputText('thematique', item.thematique))}
      ${fieldRow('demande', inputTextarea('demande', item.demande))}
      ${fieldRow('commentaires', inputTextarea('commentaires', item.commentaires))}
    </div>
    <div class="drawer-section">
      <h4>Priorisation</h4>
      ${fieldRow('etat', selectField('etat', item.etat, ETATS, true))}
      ${fieldRow('prioriteDemandeur', selectField('prioriteDemandeur', item.prioriteDemandeur, [1, 2, 3], true))}
      ${fieldRow('strategique', selectField('strategique', item.strategique, OUI_NON, true))}
      ${fieldRow('impactClient', selectField('impactClient', item.impactClient, [1, 2, 3], true))}
      ${fieldRow('impactCollaborateur', selectField('impactCollaborateur', item.impactCollaborateur, [1, 2, 3], true))}
      ${fieldRow('complexite', selectField('complexite', item.complexite, [1, 2, 3, 4, 5], true))}
      ${fieldRow('planification', selectField('planification', item.planification, TRIMESTRES, true))}
      <div class="form-field readonly-field"><label>Score (calculé)</label><input type="text" disabled value="${computeScore(item)}"></div>
    </div>
    <div class="drawer-section">
      <h4>Cadrage & Développement</h4>
      ${fieldRow('cadrageAmoa', selectField('cadrageAmoa', item.cadrageAmoa, CADRAGE_STATUTS, true))}
      ${fieldRow('statut', selectField('statut', item.statut, ALL_STATUTS, true))}
      ${fieldRow('priseEnChargeDSI', selectField('priseEnChargeDSI', item.priseEnChargeDSI, OUI_NON, true))}
      ${fieldRow('chiffrageDSI', inputNumber('chiffrageDSI', item.chiffrageDSI, 0.5))}
      ${fieldRow('atterrissageChiffrage', inputText('atterrissageChiffrage', item.atterrissageChiffrage))}
      ${fieldRow('sprintDSI', inputText('sprintDSI', item.sprintDSI))}
      ${fieldRow('avancementDev', inputNumber('avancementDev', item.avancementDev, 5))}
    </div>
    <div class="drawer-section">
      <h4>Recette & Mise en production</h4>
      ${fieldRow('estimeMEP', inputDate('estimeMEP', item.estimeMEP))}
      ${fieldRow('statutRecette', selectField('statutRecette', item.statutRecette, ITERATIONS, true))}
      ${fieldRow('dateMEP', inputDate('dateMEP', item.dateMEP))}
      ${fieldRow('statutMEP', selectField('statutMEP', item.statutMEP, ITERATIONS, true))}
    </div>
  `;
}

function openDrawer(id) {
  state.editingId = id || null;
  const item = id ? state.items.find(i => i.id === id) : {};
  document.getElementById('drawer-title').textContent = id ? 'Modifier la demande' : 'Nouvelle demande';
  document.getElementById('drawer-form').innerHTML = drawerFormHtml(item || {});
  document.getElementById('drawer-delete').style.display = id ? 'inline-flex' : 'none';
  document.getElementById('overlay').classList.add('show');
  document.getElementById('drawer').classList.add('show');
}
function closeDrawer() {
  document.getElementById('overlay').classList.remove('show');
  document.getElementById('drawer').classList.remove('show');
  state.editingId = null;
}
function saveDrawer() {
  const form = document.getElementById('drawer-form');
  const data = {};
  form.querySelectorAll('[data-field]').forEach(el => { data[el.dataset.field] = el.value; });
  ['prioriteDemandeur', 'impactClient', 'impactCollaborateur', 'complexite', 'chiffrageDSI', 'avancementDev'].forEach(k => {
    if (data[k] !== undefined && data[k] !== '') data[k] = Number(data[k]);
  });
  if (state.editingId) {
    const idx = state.items.findIndex(i => i.id === state.editingId);
    state.items[idx] = { ...state.items[idx], ...data };
  } else {
    state.items.push({ id: uid(), ...data });
  }
  saveData();
  closeDrawer();
  render();
}
function deleteItem(id) {
  if (!confirm('Supprimer définitivement cette demande ?')) return;
  state.items = state.items.filter(i => i.id !== id);
  saveData();
  render();
}

/* ============================================================
   Import / Export
   ============================================================ */
const CSV_FIELDS = Object.keys(FIELD_LABELS);

function toCsv(items) {
  const header = CSV_FIELDS.map(f => FIELD_LABELS[f]).join(';');
  const rows = items.map(it => CSV_FIELDS.map(f => csvEscape(it[f])).join(';'));
  return [header, ...rows].join('\n');
}
function csvEscape(v) {
  const s = String(v ?? '');
  if (/[;"\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.length);
  const sep = lines[0].includes(';') ? ';' : ',';
  const rows = lines.map(line => splitCsvLine(line, sep));
  const header = rows[0];
  const labelToKey = {};
  Object.entries(FIELD_LABELS).forEach(([k, v]) => { labelToKey[v] = k; });
  return rows.slice(1).map(row => {
    const obj = { id: uid() };
    header.forEach((h, idx) => {
      const key = labelToKey[h] || h;
      obj[key] = row[idx] ?? '';
    });
    return obj;
  });
}
function splitCsvLine(line, sep) {
  const out = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === sep) { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}
function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ============================================================
   Bootstrap
   ============================================================ */
function initEvents() {
  document.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', () => { state.view = b.dataset.view; render(); }));
  document.getElementById('search').addEventListener('input', e => { state.search = e.target.value; render(); });
  document.getElementById('filter-statut').addEventListener('change', e => { state.filters.statut = e.target.value; render(); });
  document.getElementById('filter-categorie').addEventListener('change', e => { state.filters.categorie = e.target.value; render(); });
  document.getElementById('filter-planification').addEventListener('change', e => { state.filters.planification = e.target.value; render(); });
  document.getElementById('filter-etat').addEventListener('change', e => { state.filters.etat = e.target.value; render(); });
  document.getElementById('btn-add').addEventListener('click', () => openDrawer(null));
  document.getElementById('drawer-close').addEventListener('click', closeDrawer);
  document.getElementById('overlay').addEventListener('click', closeDrawer);
  document.getElementById('drawer-save').addEventListener('click', saveDrawer);
  document.getElementById('drawer-delete').addEventListener('click', () => { if (state.editingId) deleteItem(state.editingId); closeDrawer(); });

  document.getElementById('btn-export-csv').addEventListener('click', () => downloadFile('roadmap.csv', toCsv(getEnrichedItems()), 'text/csv;charset=utf-8'));
  document.getElementById('btn-export-json').addEventListener('click', () => downloadFile('roadmap.json', JSON.stringify(state.items, null, 2), 'application/json'));
  document.getElementById('btn-import').addEventListener('click', () => document.getElementById('import-input').click());
  document.getElementById('import-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        let imported;
        if (file.name.endsWith('.json')) imported = JSON.parse(reader.result).map(it => ({ id: it.id || uid(), ...it }));
        else imported = parseCsv(reader.result);
        state.items = imported;
        saveData();
        render();
        alert(`${imported.length} demande(s) importée(s).`);
      } catch (err) {
        alert('Erreur lors de l\'import : ' + err.message);
      }
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  });
  document.getElementById('btn-reset').addEventListener('click', () => {
    if (!confirm('Réinitialiser toutes les données avec le jeu de démonstration ?')) return;
    state.items = SEED_ITEMS.map(it => ({ id: uid(), ...it }));
    state.capacity = { ...DEFAULT_CAPACITY };
    saveData(); saveCapacity(); render();
  });

  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      if (state.sort.field === field) state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
      else { state.sort.field = field; state.sort.dir = 'asc'; }
      render();
    });
  });
}

loadData();
document.addEventListener('DOMContentLoaded', () => { initEvents(); render(); });
